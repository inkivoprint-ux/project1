"use client";

import { showSuccess } from "@/lib/notifications";

import Link from "next/link";
import localFont from "next/font/local";
import { ArrowLeft, Check, Eye, EyeOff, ImagePlus, RotateCcw, ShoppingBag, Sparkles, Trash2, Type, Upload, ZoomIn } from "lucide-react";
import { ChangeEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { formatPrice, Product } from "@/lib/products";
import { addCartEntries, type CartEntry } from "@/lib/cart";
import { createProductPurchaseEntries, normalizePurchaseQuantity } from "@/lib/purchase";
import { emptySizeQuantities, isTShirtCategory, parseSizeQuantities, serializeSizeQuantities, totalSizeQuantity } from "@/lib/productSizes";
import { buildDesignAssetFileName, saveDesignDraft, type DraftAsset } from "@/lib/orders";
import { createDefaultTemplate, loadCustomerTemplate, maskClipPath, subscribeToTemplates } from "@/lib/customization";
import { hasSupabaseConfiguration } from "@/lib/supabase/config";
import { refreshSharedTemplate } from "@/lib/sharedCatalog";
import { estimatedPrintDpi } from "@/lib/renderQuality";
import { generateSurfaceMap } from "@/lib/smartMockup";
import { DEFAULT_TEXT_DEFORMATION, getTextStyle, getTextSurfaceOverrides, type TextFont, type TextSurface } from "@/lib/textCustomization";
import { BrandLogo } from "./BrandLogo";
import { WarpedArtwork } from "./WarpedArtwork";
import { canvasBlendOperation, previewBlendMode } from "@/lib/artworkBlend";
import { BuyNowCheckout } from "./BuyNowCheckout";
import { QuantitySelector } from "./QuantitySelector";
import { SizeQuantitySelector } from "./SizeQuantitySelector";
import { MockupStage } from "./MockupStage";
import { loadCanvasImage, exportCanvasBlob } from "@/lib/canvasImages";

type ActiveLayer = "image" | "text";
type DragState = { layer: ActiveLayer; pointerX: number; pointerY: number; originX: number; originY: number } | null;

const anekMalayalam = localFont({
  src: [
    { path: "../public/fonts/AnekMalayalam-Regular.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/AnekMalayalam-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../public/fonts/AnekMalayalam-Bold.ttf", weight: "700", style: "normal" },
  ],
  display: "swap",
  adjustFontFallback: false,
});

// Google Fonts are bundled locally so previews and exports use the same files.
const manjari = localFont({
  src: [
    { path: "../public/fonts/Manjari-Regular.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/Manjari-Bold.ttf", weight: "700", style: "normal" },
  ], display: "swap", adjustFontFallback: false, preload: false,
});
const chilanka = localFont({
  src: "../public/fonts/Chilanka-Regular.ttf", weight: "400", style: "normal",
  display: "swap", adjustFontFallback: false, preload: false,
});
const gayathri = localFont({
  src: [
    { path: "../public/fonts/Gayathri-Regular.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/Gayathri-Bold.ttf", weight: "700", style: "normal" },
  ], display: "swap", adjustFontFallback: false, preload: false,
});
const balooMalayalam = localFont({
  src: "../public/fonts/BalooChettan2[wght].ttf", weight: "400 800", style: "normal",
  display: "swap", adjustFontFallback: false, preload: false,
});
const notoSerifMalayalam = localFont({
  src: "../public/fonts/NotoSerifMalayalam[wght].ttf", weight: "100 900", style: "normal",
  display: "swap", adjustFontFallback: false, preload: false,
});
const malayalamFonts = {
  malayalam: { label: "Anek Malayalam", family: anekMalayalam.style.fontFamily },
  manjari: { label: "Manjari", family: manjari.style.fontFamily },
  chilanka: { label: "Chilanka", family: chilanka.style.fontFamily },
  gayathri: { label: "Gayathri", family: gayathri.style.fontFamily },
  "baloo-malayalam": { label: "Baloo Chettan 2", family: balooMalayalam.style.fontFamily },
  "noto-serif-malayalam": { label: "Noto Serif Malayalam", family: notoSerifMalayalam.style.fontFamily },
};
function getMalayalamFont(font: TextFont) {
  return font in malayalamFonts ? malayalamFonts[font as keyof typeof malayalamFonts] : undefined;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function Customizer({ product }: { product: Product }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageScale, setImageScale] = useState(1);
  const [imageRotation, setImageRotation] = useState(0);
  const [imageX, setImageX] = useState(0);
  const [imageY, setImageY] = useState(0);
  const [imageMeta, setImageMeta] = useState<{ width: number; height: number } | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [textSize, setTextSize] = useState(28);
  const [textColor, setTextColor] = useState("#ffffff");
  const [textRotation, setTextRotation] = useState(0);
  const [textX, setTextX] = useState(0);
  const [textY, setTextY] = useState(0);
  const [font, setFont] = useState<TextFont>("classic");
  const [textOpacity, setTextOpacity] = useState(100);
  const [textSurface, setTextSurface] = useState<TextSurface>("product");
  const [textDeformation, setTextDeformation] = useState({ ...DEFAULT_TEXT_DEFORMATION });
  const [textWrinkleMap, setTextWrinkleMap] = useState<{ key: string; map: string } | null>(null);
  const [textMapError, setTextMapError] = useState(false);
  const [textBold, setTextBold] = useState<boolean | null>(null);
  const [textItalic, setTextItalic] = useState<boolean | null>(null);
  const [textRenderState, setTextRenderState] = useState<"rendering" | "ready" | "error">("rendering");
  const [imageRenderState, setImageRenderState] = useState<"rendering" | "ready" | "error">("rendering");
  const [malayalamFontStatus, setMalayalamFontStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadedMalayalamFont, setLoadedMalayalamFont] = useState("");
  const [activeLayer, setActiveLayer] = useState<ActiveLayer>("image");
  const [showBoundary, setShowBoundary] = useState(false);
  const [savedDesignSignature, setSavedDesignSignature] = useState<string | null>(null);
  const [savingToCart, setSavingToCart] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [sizeQuantities, setSizeQuantities] = useState(emptySizeQuantities);
  const isTShirt = isTShirtCategory(product.category);
  const selectedQuantity = isTShirt ? totalSizeQuantity(sizeQuantities) : quantity;
  const [requirePersonalisation, setRequirePersonalisation] = useState(false);
  const [purchaseIntent, setPurchaseIntent] = useState("cart");
  const [purchaseContextReady, setPurchaseContextReady] = useState(false);
  const [buyNow, setBuyNow] = useState<CartEntry[] | null>(null);
  const purchaseBusyRef = useRef(false);
  const preparedDesignRef = useRef<{ signature: string; id: string } | null>(null);
  const [view, setView] = useState<"front" | "back">("front");
  const [message, setMessage] = useState("");
  const [template, setTemplate] = useState(() => createDefaultTemplate(product));
  const [templateReady, setTemplateReady] = useState(!hasSupabaseConfiguration());
  const [loadedMockup, setLoadedMockup] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const artworkRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState>(null);
  const textStyle = getTextStyle(font, textBold, textItalic);
  const selectedMalayalamFont = getMalayalamFont(font);
  const malayalamFontKey = `${textStyle.italic ? "italic " : ""}${textStyle.weight} 48px ${selectedMalayalamFont?.family ?? anekMalayalam.style.fontFamily}`;
  const waitingForTextFont = Boolean(selectedMalayalamFont) && Boolean(text.trim()) && (malayalamFontStatus !== "ready" || loadedMalayalamFont !== malayalamFontKey);
  const textArtwork = useMemo(() => typeof document === "undefined" || !text.trim() || waitingForTextFont ? null : createTextArtwork(text, textColor, font, textSize, textStyle.weight, textStyle.italic), [text, textColor, font, textSize, textStyle.weight, textStyle.italic, waitingForTextFont]);
  const waitingForTextRender = Boolean(template.tools.text && textArtwork && textRenderState !== "ready");
  const waitingForImageRender = Boolean(template.tools.images && imageUrl && imageRenderState !== "ready");
  const allowsBackView = Boolean(product.views?.some((item) => item.id === "back"));

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      setQuantity(normalizePurchaseQuantity(params.get("quantity")));
      if (isTShirt) setSizeQuantities(parseSizeQuantities(params.get("sizes")));
      setRequirePersonalisation(params.get("personalise") === "1");
      setPurchaseIntent(params.get("intent") === "buy-now" ? "buy-now" : "cart");
      setView(params.get("view") === "back" && allowsBackView ? "back" : "front");
      setPurchaseContextReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [allowsBackView, isTShirt]);

  useEffect(() => {
    if (!selectedMalayalamFont) return;
    let cancelled = false;
    document.fonts.load(malayalamFontKey, "മലയാളം")
      .then((loadedFonts) => { if (!cancelled) { setLoadedMalayalamFont(malayalamFontKey); setMalayalamFontStatus(loadedFonts.length ? "ready" : "error"); } })
      .catch(() => { if (!cancelled) setMalayalamFontStatus("error"); });
    return () => { cancelled = true; };
  }, [malayalamFontKey, selectedMalayalamFont]);

  useEffect(() => {
    const refresh = () => setTemplate(loadCustomerTemplate(product));
    const timer = window.setTimeout(() => {
      if (hasSupabaseConfiguration()) refreshSharedTemplate(product).then(() => { refresh(); setTemplateReady(true); }).catch(() => setMessage("The print template could not be loaded. Reload before personalising."));
      else refresh();
    }, 0);
    const unsubscribe = subscribeToTemplates(refresh);
    return () => { window.clearTimeout(timer); unsubscribe(); };
  }, [product]);
  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);
  const area = view === "back" ? template.backArea ?? template.area : template.area;
  const productView = product.views?.find((item) => item.id === view) ?? { id: "front", label: "Front", image: product.image };
  const mockupSrc = template.mockupImages?.[view] ?? productView.image;
  const surfaceMap = area.surfaceMap;
  const hasDesign = Boolean((template.tools.images && imageUrl) || (template.tools.text && textArtwork));
  const imageSizingEnabled = template.tools.allowScale || template.tools.allowCrop;
  const imagePrintDpi = imageMeta ? estimatedPrintDpi(imageMeta.width, imageMeta.height, area.widthMm, area.heightMm) : null;
  const effectiveActiveLayer: ActiveLayer = activeLayer === "image" && !template.tools.images && template.tools.text ? "text" : activeLayer === "text" && !template.tools.text && template.tools.images ? "image" : activeLayer;
  const designSignature = JSON.stringify([product.id, product.price, view, imageUrl, imageScale, imageRotation, imageX, imageY, text, textSize, textColor, textRotation, textX, textY, font, textOpacity, textSurface, textDeformation, textWrinkleMap?.key, textStyle.weight, textStyle.italic, template]);
  const cartSignature = `${designSignature}:${isTShirt ? serializeSizeQuantities(sizeQuantities) : quantity}`;
  const added = savedDesignSignature === cartSignature;

  // Build only when the user selects wrinkles; never change the image layer or template.
  const textMapKey = JSON.stringify([mockupSrc, area.x, area.y, area.width, area.height, area.rotation]);
  const needsTextMap = Boolean(text.trim()) && textSurface === "wrinkled" && !area.surfaceMap;
  useEffect(() => {
    if (!needsTextMap || loadedMockup !== mockupSrc || textWrinkleMap?.key === textMapKey) return;
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      const stage = stageRef.current;
      if (!stage) return;
      setTextMapError(false);
      const image = stage.querySelector("img");
      const padding = image ? parseFloat(getComputedStyle(image).paddingLeft) || 0 : 0;
      generateSurfaceMap(mockupSrc, area, stage.clientWidth, stage.clientHeight, padding)
        .then((map) => { if (!cancelled) setTextWrinkleMap({ key: textMapKey, map }); })
        .catch(() => { if (!cancelled) setTextMapError(true); });
    });
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [needsTextMap, loadedMockup, mockupSrc, area, textMapKey, textWrinkleMap?.key]);

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { setMessage("Please choose an image smaller than 15 MB."); return; }
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { setMessage("Please upload a JPG, PNG, or WEBP image."); return; }
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    const nextUrl = URL.createObjectURL(file);
    setImageUrl(nextUrl);
    setOriginalFile(file);
    setImageMeta(null);
    readImageDimensions(nextUrl).then(setImageMeta).catch(() => setImageMeta(null));
    setMessage("Photo loaded. Use the placement controls or drag it on the product.");
    setActiveLayer("image");
    setShowBoundary(false);
    event.target.value = "";
  }

  function resetImagePlacement() {
    setImageScale(area.defaultArtworkScale ?? 1);
    setImageRotation(area.defaultArtworkRotation ?? 0);
    setImageX(area.defaultArtworkOffsetX ?? 0);
    setImageY(area.defaultArtworkOffsetY ?? 0);
  }

  function beginDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (savingToCart || !template.tools.allowMove) return;
    const layer = effectiveActiveLayer === "image" && !imageUrl && textArtwork ? "text" : effectiveActiveLayer;
    if ((layer === "image" && !imageUrl) || (layer === "text" && !textArtwork)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      layer,
      pointerX: event.clientX,
      pointerY: event.clientY,
      originX: layer === "image" ? imageX : textX,
      originY: layer === "image" ? imageY : textY,
    };
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const artwork = artworkRef.current;
    if (!drag || !artwork) return;
    const unit = Math.max(1, Math.min(artwork.offsetWidth, artwork.offsetHeight)) / 300;
    const radians = area.rotation * Math.PI / 180;
    const dx = event.clientX - drag.pointerX;
    const dy = event.clientY - drag.pointerY;
    const nextX = clamp(drag.originX + (dx * Math.cos(radians) + dy * Math.sin(radians)) / unit, -artwork.offsetWidth / unit / 2, artwork.offsetWidth / unit / 2);
    const nextY = clamp(drag.originY + (-dx * Math.sin(radians) + dy * Math.cos(radians)) / unit, -artwork.offsetHeight / unit / 2, artwork.offsetHeight / unit / 2);
    if (drag.layer === "image") { setImageX(Math.round(nextX)); setImageY(Math.round(nextY)); }
    else { setTextX(Math.round(nextX)); setTextY(Math.round(nextY)); }
  }

  function endDrag() { dragRef.current = null; }

  function reset() {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(null);
    setImageMeta(null);
    setOriginalFile(null);
    resetImagePlacement();
    setText("");
    setTextSize(28);
    setTextColor("#ffffff");
    setTextRotation(0);
    setTextX(0);
    setTextY(0);
    setFont("classic");
    setTextOpacity(100);
    setTextSurface("product");
    setTextDeformation({ ...DEFAULT_TEXT_DEFORMATION });
    setTextBold(null);
    setTextItalic(null);
    setSavedDesignSignature(null);
    setMessage("Design reset");
  }

  function changeView(nextView: "front" | "back") {
    const nextArea = nextView === "back" ? template.backArea ?? template.area : template.area;
    setView(nextView);
    setImageScale(nextArea.defaultArtworkScale ?? 1);
    setImageRotation(nextArea.defaultArtworkRotation ?? 0);
    setImageX(nextArea.defaultArtworkOffsetX ?? 0);
    setImageY(nextArea.defaultArtworkOffsetY ?? 0);
    setTextRotation(nextArea.defaultArtworkRotation ?? 0);
    setTextX(nextArea.defaultArtworkOffsetX ?? 0);
    setTextY(nextArea.defaultArtworkOffsetY ?? 0);
  }

  async function purchase(action: "cart" | "buy-now") {
    if (!templateReady || loadedMockup !== mockupSrc || !purchaseContextReady || purchaseBusyRef.current || waitingForTextFont || waitingForTextRender || waitingForImageRender) return;
    try { createProductPurchaseEntries(product, quantity, sizeQuantities); }
    catch (failure) { setMessage(failure instanceof Error ? failure.message : "Choose your size and quantity."); return; }
    const requestedDesign = Boolean((template.tools.images && imageUrl) || (template.tools.text && text.trim()));
    if ((requirePersonalisation || requestedDesign) && !hasDesign) {
      setMessage("Add a photo or text and wait for the preview before ordering with personalisation.");
      return;
    }
    purchaseBusyRef.current = true;
    setSavingToCart(true);
    try {
      let designId: string | undefined;
      if (hasDesign && preparedDesignRef.current?.signature === designSignature) {
        designId = preparedDesignRef.current.id;
      } else if (hasDesign) {
        if (!stageRef.current || !artworkRef.current) throw new Error("The design preview is not ready. Please try again.");
        designId = `${product.slug}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
        const assets: DraftAsset[] = [];
        if (template.tools.images && imageUrl && originalFile) {
          const mimeType = originalFile.type as DraftAsset["mimeType"];
          assets.push({ kind: "original", fileName: buildDesignAssetFileName(designId, "original", mimeType), mimeType, blob: originalFile });
        }
        const artworkBlob = await exportArtworkBlob(artworkRef.current);
        const previewBlob = await exportProductPreview(stageRef.current, artworkRef.current, mockupSrc, area.rotation);
        if (!artworkBlob || !previewBlob) throw new Error("The design files could not be generated.");
        assets.push({ kind: "edited", fileName: buildDesignAssetFileName(designId, "edited", "image/png"), mimeType: "image/png", blob: artworkBlob });
        assets.push({ kind: "preview", fileName: buildDesignAssetFileName(designId, "preview", "image/png"), mimeType: "image/png", blob: previewBlob });
        await saveDesignDraft({
          id: designId,
          productId: product.id,
          createdAt: new Date().toISOString(),
          assets,
          configuration: { view, imageScale, imageRotation, imageX, imageY, text, textSize, textColor, textRotation, textX, textY, font, textOpacity, textSurface, textDeformation, textBold: textStyle.weight >= 600, textItalic: textStyle.italic, textFontWeight: textStyle.weight, templateId: template.id, templateVersion: template.version, templateSnapshot: { ...template, area, backArea: undefined, mockupImages: undefined } },
        });
        preparedDesignRef.current = { signature: designSignature, id: designId };
      }
      const entries = createProductPurchaseEntries(product, quantity, sizeQuantities, designId);
      if (action === "buy-now") {
        setBuyNow(entries);
        setMessage("Your selection is ready for checkout. Your shopping cart is unchanged.");
      } else {
        addCartEntries(entries);
        setSavedDesignSignature(cartSignature);
        showSuccess("Added to cart successfully. Your artwork files are saved with the item.");
        setMessage(designId ? "Your personalised item and generated files are saved in your cart." : "Product added to your cart without personalisation.");
      }
    } catch (failure) {
      setMessage(failure instanceof Error ? failure.message : "The design files could not be prepared. Please try again.");
    } finally {
      purchaseBusyRef.current = false;
      setSavingToCart(false);
    }
  }

  const mappedProps = {
    curvature: area.curvature,
    perspective: area.perspective,
    taper: area.taper,
    opacity: area.opacity,
    blendMode: area.blendMode,
    overlayStrength: area.overlayStrength,
    mockupSrc,
    backdropArea: area,
    brightness: area.brightness,
    contrast: area.contrast,
    saturation: area.saturation,
    maskRadius: area.maskRadius,
    maskShape: area.maskShape,
    maskPoints: area.maskPoints,
    surface: area.surface,
    precisionWrap: area.precisionWrap,
    wrapAngle: area.wrapAngle,
    edgeFade: area.edgeFade,
    surfaceMap,
    displacementStrength: area.displacementStrength,
    fabricBlendStrength: area.fabricBlendStrength,
    fabricTextureStrength: area.fabricTextureStrength,
  } as const;
  const textMappedProps = { ...mappedProps, ...getTextSurfaceOverrides(textSurface, { ...area, surfaceMap: surfaceMap ?? (textWrinkleMap?.key === textMapKey ? textWrinkleMap.map : undefined) }, textDeformation) };

  return (
    <main className="customizer-shell">
      <header className="customizer-header">
        <Link href={`/products/${product.slug}`} className="customizer-back"><ArrowLeft size={18} /> Product details</Link>
        <BrandLogo />
        <div className="customizer-safe"><Check size={14} /> Changes appear instantly</div>
      </header>

      <div className="customizer-layout">
        <section className="customizer-stage-wrap">
          <div className="customizer-stage-head">
            <span>Live realistic preview · {productView.label}</span>
            <button className={showBoundary ? "active" : ""} onClick={() => setShowBoundary((visible) => !visible)}>{showBoundary ? <EyeOff size={13} /> : <Eye size={13} />}{showBoundary ? "Hide guides" : "Show print area"}</button>
          </div>
          <MockupStage key={mockupSrc} src={mockupSrc} alt={`${product.name} ${productView.label}`} className="customizer-stage" imageClassName="customizer-product" stageRef={stageRef} onReady={setLoadedMockup} onError={() => setMessage("The product image could not be loaded safely. Reload before ordering.")}>
            <div className="preview-halo" />
            <div
              ref={artworkRef}
              className={`artwork-window ${hasDesign ? "has-design" : ""} active-${effectiveActiveLayer}`}
              style={{ left: `${area.x}%`, top: `${area.y}%`, width: `${area.width}%`, height: `${area.height}%` }}
              onPointerDown={beginDrag}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              {template.tools.images && imageUrl && <div className={`mapped-layer image-layer ${effectiveActiveLayer === "image" ? "selected" : ""}`} style={{ mixBlendMode: previewBlendMode(mappedProps.blendMode, mappedProps.overlayStrength), transform: `rotate(${area.rotation}deg)` }}><WarpedArtwork src={imageUrl} {...mappedProps} onRenderStateChange={setImageRenderState} scale={imageScale} imageRotation={imageRotation} offsetX={imageX} offsetY={imageY} /></div>}
              {template.tools.text && textArtwork && <div className={`mapped-layer text-layer ${effectiveActiveLayer === "text" ? "selected" : ""}`} style={{ mixBlendMode: previewBlendMode(textMappedProps.blendMode, textMappedProps.overlayStrength), transform: `rotate(${area.rotation}deg)` }}><WarpedArtwork src={textArtwork} {...textMappedProps} artworkOpacity={textOpacity / 100} onRenderStateChange={setTextRenderState} scale={1} imageRotation={textRotation} offsetX={textX} offsetY={textY} /></div>}
              {!hasDesign && <div className="art-placeholder"><ImagePlus size={20} /><span>Add photo or text</span></div>}
            </div>
            {(showBoundary || !hasDesign) && <div className="print-boundary" style={{ left: `${area.x}%`, top: `${area.y}%`, width: `${area.width}%`, height: `${area.height}%`, transform: `rotate(${area.rotation}deg)` }} aria-hidden="true"><i style={{ clipPath: maskClipPath(area.maskShape, area.maskPoints) }} /><span>PRINT AREA</span></div>}
          </MockupStage>
          <div className="live-preview-status"><span><Sparkles size={13} /> {area.surface === "fabric" ? surfaceMap ? "Photoshop-style fabric mapping active" : "Manual fabric mapping" : area.precisionWrap ? "Live cylindrical wrap active" : "Live surface mapping active"}</span><span>{template.tools.allowMove ? "Drag the selected layer directly on the product" : "Layer position is locked by this product template"}</span></div>
        </section>

        <aside className="customizer-panel">
          <fieldset className="customizer-purchase-fields" disabled={savingToCart}>
          <div className="customizer-product-info"><p>{product.category}</p><h1>{product.name}</h1><span>{product.finish}</span><div><strong>{formatPrice(product.price)}</strong>{product.compareAt && <del>{formatPrice(product.compareAt)}</del>}</div></div>
          {product.views && <div className="view-switch customer-view-switch" aria-label="Product side">{product.views.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => changeView(item.id)}>{item.label}</button>)}</div>}
          {product.views && <p className="side-save-note">Order files capture the selected {productView.label.toLowerCase()} side. A combined front-and-back print file is not generated.</p>}
          <div className="tool-tabs">
            {template.tools.images && <button className={effectiveActiveLayer === "image" ? "active" : ""} onClick={() => setActiveLayer("image")}><Upload size={17} /> Photo</button>}
            {template.tools.text && <button className={effectiveActiveLayer === "text" ? "active" : ""} onClick={() => setActiveLayer("text")}><Type size={17} /> Text</button>}
          </div>

          {!template.tools.images && !template.tools.text ? <div className="tool-content tool-disabled"><h2>Personalisation unavailable</h2><p>This product template does not currently allow customer photos or text.</p></div> : effectiveActiveLayer === "image" && template.tools.images ? (
            <div className="tool-content">
              <h2>{imageUrl ? "Position your photo" : "Add your photo"}</h2>
              <p>{imageUrl ? "Drag directly on the product, or use the precise controls below. Every change updates the realistic preview immediately." : "Upload a clear JPG, PNG, or WEBP. Inkivo will fit it automatically to the configured product surface."}</p>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} hidden />
              <button className={`upload-zone ${imageUrl ? "compact" : ""}`} onClick={() => fileRef.current?.click()}><span><Upload /></span><strong>{imageUrl ? "Replace photo" : "Upload a photo"}</strong><small>JPG, PNG or WEBP · up to 15 MB</small></button>
              {imageUrl && <>
                {imageMeta && <div className={`upload-quality ${imagePrintDpi !== null && imagePrintDpi < 150 ? "warning" : ""}`}><Check size={14} /><div><strong>Original image preserved</strong><small>{imageMeta.width} × {imageMeta.height} px · approximately {imagePrintDpi} DPI at this print size</small></div></div>}
                {imageSizingEnabled && <label className="control-row"><span><ZoomIn size={16} /> Size / crop <output>{Math.round(imageScale * 100)}%</output></span><input type="range" min="0.35" max="3" step="0.02" value={imageScale} onChange={(event) => setImageScale(Number(event.target.value))} /></label>}
                {template.tools.allowMove && <div className="position-grid"><NumberControl label="Horizontal" value={imageX} onChange={setImageX} /><NumberControl label="Vertical" value={imageY} onChange={setImageY} /></div>}
                {template.tools.allowRotate && <label className="control-row"><span><RotateCcw size={16} /> Rotation <output>{imageRotation}°</output></span><input type="range" min="-180" max="180" step="1" value={imageRotation} onChange={(event) => setImageRotation(Number(event.target.value))} /></label>}
                <button className="remove-artwork" onClick={() => { setImageUrl(null); setImageMeta(null); setOriginalFile(null); }}><Trash2 size={14} /> Remove photo</button>
              </>}
              {imageUrl && imageRenderState === "error" && <p className="editor-message" role="alert">This photo could not be rendered. Choose a different image and try again.</p>}
            </div>
          ) : template.tools.text ? (
            <div className="tool-content">
              <h2>Add realistic text</h2><p>Choose your font, style, opacity, and surface effect. Drag text anywhere in the same print area as your photo.</p>
              <label className="text-field"><span>Your text</span><input value={text} maxLength={40} placeholder={selectedMalayalamFont ? "നിങ്ങളുടെ സന്ദേശം" : "Type your message"} lang={selectedMalayalamFont ? "ml" : undefined} style={selectedMalayalamFont ? { fontFamily: selectedMalayalamFont.family } : undefined} onChange={(event) => setText(event.target.value)} /><small>{text.length}/40</small></label>
              <div className="font-options"><span>Font</span><div><button className={font === "classic" ? "active" : ""} aria-pressed={font === "classic"} onClick={() => setFont("classic")}>Classic</button><button className={font === "clean" ? "active" : ""} aria-pressed={font === "clean"} onClick={() => setFont("clean")}>Clean</button><button className={font === "playful" ? "active" : ""} aria-pressed={font === "playful"} onClick={() => setFont("playful")}>Playful</button>{Object.entries(malayalamFonts).map(([fontId, option]) => <button key={fontId} className={font === fontId ? "active" : ""} aria-pressed={font === fontId} onClick={() => setFont(fontId as TextFont)}><span lang="ml" className="malayalam-font-sample" style={{ fontFamily: option.family }}>മലയാളം</span><span>{option.label}</span></button>)}</div></div>
              <div className="font-options text-style-options" role="group" aria-label="Text style"><span>Style</span><div><button className={textStyle.weight >= 600 ? "active" : ""} aria-pressed={textStyle.weight >= 600} onClick={() => setTextBold(textStyle.weight < 600)}><strong>Bold</strong></button><button className={textStyle.italic ? "active" : ""} aria-pressed={textStyle.italic} onClick={() => setTextItalic(!textStyle.italic)}><em>Italic</em></button></div></div>
              <div className="font-options" role="group" aria-label="Text surface"><span>Surface effect</span><div>{([ ["product", "Product default"], ["normal", "Normal"], ["wrinkled", "Wrinkled"], ["cylindrical", "Cylindrical"] ] as const).map(([value, label]) => <button key={value} className={textSurface === value ? "active" : ""} aria-pressed={textSurface === value} onClick={() => setTextSurface(value)}>{label}</button>)}</div></div>
              {textSurface === "wrinkled" && <>
                <TextEffectSlider label="Wrinkle Intensity" value={textDeformation.wrinkleIntensity} onChange={(wrinkleIntensity) => setTextDeformation((current) => ({ ...current, wrinkleIntensity }))} />
                {needsTextMap && textWrinkleMap?.key !== textMapKey && textDeformation.wrinkleIntensity > 0 && <p className="editor-message" role="status">{textMapError ? "The product wrinkle map could not be loaded. The preview is using sample folds." : "Preparing the product’s wrinkle map…"}</p>}
              </>}
              {textSurface === "cylindrical" && <>
                <TextEffectSlider label="Cylindrical Intensity" value={textDeformation.cylindricalIntensity} onChange={(cylindricalIntensity) => setTextDeformation((current) => ({ ...current, cylindricalIntensity }))} />
                <TextEffectSlider label="Horizontal Curvature" value={textDeformation.horizontalCurvature} onChange={(horizontalCurvature) => setTextDeformation((current) => ({ ...current, horizontalCurvature }))} />
                <TextEffectSlider label="Vertical Deformation" value={textDeformation.verticalDeformation} onChange={(verticalDeformation) => setTextDeformation((current) => ({ ...current, verticalDeformation }))} />
                <TextEffectSlider label="Perspective / Depth" value={textDeformation.perspective} min={-35} max={35} suffix="°" onChange={(perspective) => setTextDeformation((current) => ({ ...current, perspective }))} />
              </>}
              <label className="control-row"><span>Text opacity <output>{textOpacity}%</output></span><input aria-label="Text opacity" type="range" min="0" max="100" step="1" value={textOpacity} onChange={(event) => setTextOpacity(Number(event.target.value))} /></label>
              {Boolean(selectedMalayalamFont) && (malayalamFontStatus !== "ready" || loadedMalayalamFont !== malayalamFontKey) && <p className="editor-message" role="status">{malayalamFontStatus === "error" ? "The Malayalam font could not load. Please reload the page and try again." : "Loading Malayalam font…"}</p>}
              <label className="control-row"><span><Type size={16} /> Text size <output>{textSize}</output></span><input type="range" min="12" max="72" step="1" value={textSize} onChange={(event) => setTextSize(Number(event.target.value))} /></label>
              {template.tools.allowMove && <div className="position-grid"><NumberControl label="Horizontal" value={textX} onChange={setTextX} /><NumberControl label="Vertical" value={textY} onChange={setTextY} /></div>}
              {template.tools.allowRotate && <label className="control-row"><span><RotateCcw size={16} /> Rotation <output>{textRotation}°</output></span><input type="range" min="-180" max="180" step="1" value={textRotation} onChange={(event) => setTextRotation(Number(event.target.value))} /></label>}
              <label className="color-field"><span>Text colour</span><input type="color" value={textColor} onChange={(event) => setTextColor(event.target.value)} /><output>{textColor}</output></label>
              {text && <button className="remove-artwork" onClick={() => setText("")}><Trash2 size={14} /> Remove text</button>}
              {textArtwork && textRenderState === "error" && <p className="editor-message" role="alert">The text preview could not be rendered. Change the surface effect or reload the page to try again.</p>}
            </div>
          ) : null}

          <div className="print-quality"><Check /><div><strong>{area.surface === "fabric" ? "Wrinkle-mapped fabric preview" : area.precisionWrap ? "Precision cylindrical preview" : "Mapped product preview"}</strong><small>{area.widthMm} × {area.heightMm} mm · target {area.targetDpi} DPI · {productView.label} · preview only</small></div></div>
          {isTShirt ? <SizeQuantitySelector quantities={sizeQuantities} onChange={setSizeQuantities} disabled={savingToCart} /> : <QuantitySelector quantity={quantity} onChange={setQuantity} disabled={savingToCart} />}
          <p className="purchase-note">{requirePersonalisation && !hasDesign ? "Add a photo or text to order with personalisation." : hasDesign ? "Your design will be applied to each item in this quantity." : "No artwork added: this item will be ordered without personalisation."}{purchaseIntent === "buy-now" && " When your design is ready, choose Buy now below."}</p>
          <div className="customizer-actions"><button className="reset-button" onClick={reset}><RotateCcw size={16} /> Reset</button>{added ? <Link className="add-cart-button added" href="/?cart=open"><ShoppingBag /> View your cart</Link> : <button className="add-cart-button" disabled={!templateReady || loadedMockup !== mockupSrc || !selectedQuantity || !purchaseContextReady || savingToCart || waitingForTextFont || waitingForTextRender || waitingForImageRender} onClick={() => purchase("cart")}><ShoppingBag /> {savingToCart || (waitingForTextRender && textRenderState === "rendering") || (waitingForImageRender && imageRenderState === "rendering") ? "Preparing files…" : `Add to cart · ${formatPrice(product.price * selectedQuantity)}`}</button>}</div>
          <button className="button customizer-buy-now" disabled={!templateReady || loadedMockup !== mockupSrc || !selectedQuantity || !purchaseContextReady || savingToCart || waitingForTextFont || waitingForTextRender || waitingForImageRender} onClick={() => purchase("buy-now")}>{savingToCart ? "Preparing files…" : `Buy now · ${formatPrice(product.price * selectedQuantity)}`}</button>
          {message && <p className="editor-message" role="status">{message}</p>}
          </fieldset>
        </aside>
      </div>
      {buyNow && <BuyNowCheckout entries={buyNow} product={product} onClose={() => setBuyNow(null)} />}
    </main>
  );
}

function NumberControl({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="position-control"><span>{label}</span><div><button aria-label={`Decrease ${label.toLowerCase()} position`} onClick={() => onChange(value - 5)}>−</button><output>{value}</output><button aria-label={`Increase ${label.toLowerCase()} position`} onClick={() => onChange(value + 5)}>+</button></div></label>;
}

function createTextArtwork(text: string, color: string, font: TextFont, size: number, weight: number, italic: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 720;
  const context = canvas.getContext("2d");
  if (!context) return null;
  const family = getMalayalamFont(font)?.family ?? (font === "clean" ? "Arial, sans-serif" : "Georgia, serif");
  const style = `${italic ? "italic " : ""}${weight}`;
  let pixelSize = size * 4.2;
  context.font = `${style} ${pixelSize}px ${family}`;
  while (context.measureText(text).width > 620 && pixelSize > 34) {
    pixelSize -= 4;
    context.font = `${style} ${pixelSize}px ${family}`;
  }
  context.fillStyle = color;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.shadowColor = "rgba(0,0,0,.12)";
  context.shadowBlur = 2;
  context.fillText(text, 360, 360);
  return canvas.toDataURL("image/png");
}

function readImageDimensions(src: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("The uploaded image dimensions could not be read."));
    image.src = src;
  });
}

async function exportArtworkBlob(artwork: HTMLDivElement) {
  const layers = Array.from(artwork.querySelectorAll("canvas"));
  if (!layers.length) return null;
  const width = Math.max(...layers.map((canvas) => canvas.width), 1);
  const height = Math.max(...layers.map((canvas) => canvas.height), 1);
  const output = document.createElement("canvas");
  output.width = width;
  output.height = height;
  const context = output.getContext("2d");
  if (!context) return null;
  for (const layer of layers) { context.globalCompositeOperation = canvasBlendOperation(layer.dataset.blendMode); context.drawImage(layer, 0, 0, width, height); }
  return exportCanvasBlob(output);
}

async function exportProductPreview(stage: HTMLDivElement, artwork: HTMLDivElement, mockupSrc: string, areaRotation: number) {
  const bounds = stage.getBoundingClientRect();
  const scale = Math.min(2, 1800 / Math.max(bounds.width, bounds.height));
  const output = document.createElement("canvas");
  output.width = Math.max(1, Math.round(bounds.width * scale));
  output.height = Math.max(1, Math.round(bounds.height * scale));
  const context = output.getContext("2d");
  if (!context) return null;
  context.fillStyle = "#e6e2d9";
  context.fillRect(0, 0, output.width, output.height);
  const mockup = await loadCanvasImage(mockupSrc, "The product image could not be loaded for export. Reload and try again.");
  const imageElement = stage.querySelector("img");
  const padding = (imageElement ? Number.parseFloat(getComputedStyle(imageElement).paddingLeft) || 0 : 0) * scale;
  const ratio = Math.min((output.width - padding * 2) / mockup.naturalWidth, (output.height - padding * 2) / mockup.naturalHeight);
  const productWidth = mockup.naturalWidth * ratio;
  const productHeight = mockup.naturalHeight * ratio;
  context.drawImage(mockup, (output.width - productWidth) / 2, (output.height - productHeight) / 2, productWidth, productHeight);
  // Use the unrotated layout box; rotated bounding boxes enlarge and double-warp exports.
  const x = artwork.offsetLeft * scale;
  const y = artwork.offsetTop * scale;
  const width = artwork.offsetWidth * scale;
  const height = artwork.offsetHeight * scale;
  context.save();
  context.translate(x + width / 2, y + height / 2);
  context.rotate((areaRotation * Math.PI) / 180);
  for (const layer of Array.from(artwork.querySelectorAll("canvas"))) { context.globalCompositeOperation = canvasBlendOperation(layer.dataset.blendMode); context.drawImage(layer, -width / 2, -height / 2, width, height); }
  context.restore();
  return exportCanvasBlob(output);
}

function TextEffectSlider({ label, value, onChange, min = 0, max = 100, suffix = "%" }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; suffix?: string }) {
  return <label className="control-row text-effect-slider"><span>{label}<output>{value}{suffix}</output></span><input aria-label={label} type="range" min={min} max={max} step="1" value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}
