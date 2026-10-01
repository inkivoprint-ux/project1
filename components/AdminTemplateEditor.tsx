"use client";

import { showSuccess } from "@/lib/notifications";

import { maskPointerPosition } from "@/lib/maskEditing";
import { previewBlendMode } from "@/lib/artworkBlend";
import Link from "next/link";
import { ChangeEvent, PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Check, ChevronDown, Eye, EyeOff, ImagePlus, Monitor, Move, RotateCcw, Save, SlidersHorizontal, Smartphone, Sparkles, TestTube2, Triangle, Undo2, Upload, ZoomIn, ZoomOut } from "lucide-react";
import { getMaskPolygon, MASK_PRESETS } from "@/lib/maskShapes";
import { Product } from "@/lib/products";
import { createDefaultTemplate, loadTemplate, maskClipPath, resetTemplate, type MaskShape, SurfaceType, TemplateArea, TemplateConfig } from "@/lib/customization";
import { hasSupabaseConfiguration } from "@/lib/supabase/config";
import { refreshSharedTemplate, saveSharedTemplate } from "@/lib/sharedCatalog";
import { WarpedArtwork } from "./WarpedArtwork";
import { AdminNav } from "./AdminNav";
import { MockupStage } from "./MockupStage";

type ResizeEdge = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";
const resizeEdges: ResizeEdge[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];

type DragState =
  | { target: "point"; index: number }
  | { target: "area"; mode: "move" | "resize"; edge: ResizeEdge; clientX: number; clientY: number; area: TemplateConfig["area"] }
  | { target: "artwork"; mode: "move"; clientX: number; clientY: number; offsetX: number; offsetY: number }
  | null;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function AdminTemplateEditor({ product }: { product: Product }) {
  const [template, setTemplate] = useState(() => createDefaultTemplate(product));
  const [artwork, setArtwork] = useState<string>("/brand/inkivo-symbol.png");
  const [tab, setTab] = useState<"placement" | "surface" | "effects" | "tools">("placement");
  const [panPreview, setPanPreview] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [showPrintGuides, setShowPrintGuides] = useState(true);
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [view, setView] = useState<"front" | "back">("front");
  const [editTarget, setEditTarget] = useState<"area" | "artwork" | "mask">("artwork");
  const [notice, setNotice] = useState("Template loaded");
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(!hasSupabaseConfiguration());
  const stageRef = useRef<HTMLDivElement>(null);
  const movePreview = (x: number, y: number) => {
    const frame = stageRef.current?.closest(".template-stage");
    if (frame) frame.scrollBy({ left: x * 100, top: y * 100, behavior: "auto" });
  };
  const centerPreview = () => {
    const frame = stageRef.current?.closest(".template-stage");
    if (frame) frame.scrollTo({ left: (frame.scrollWidth - frame.clientWidth) / 2, top: (frame.scrollHeight - frame.clientHeight) / 2, behavior: "auto" });
  };
  const dragRef = useRef<DragState>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const mockupRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (hasSupabaseConfiguration()) refreshSharedTemplate(product, true).then(() => { setTemplate(loadTemplate(product)); setReady(true); }).catch(() => setNotice("The template could not be loaded. Reload before editing."));
      else setTemplate(loadTemplate(product));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [product]);
  useEffect(() => () => { if (artwork.startsWith("blob:")) URL.revokeObjectURL(artwork); }, [artwork]);

  const area = view === "back" ? template.backArea ?? template.area : template.area;
  const productView = product.views?.find((item) => item.id === view) ?? { id: "front", label: "Front", image: product.image };
  const mockupSrc = template.mockupImages?.[view] ?? productView.image;
  const replaceArea = (current: TemplateConfig, nextArea: TemplateArea): TemplateConfig => view === "back" ? { ...current, status: "draft", backArea: nextArea } : { ...current, status: "draft", area: nextArea };
  const updateArea = <K extends keyof TemplateArea>(key: K, value: TemplateArea[K]) => setTemplate((current) => { const currentArea = view === "back" ? current.backArea ?? current.area : current.area; return replaceArea(current, { ...currentArea, [key]: value }); });
  const updateTool = <K extends keyof TemplateConfig["tools"]>(key: K, value: TemplateConfig["tools"][K]) => setTemplate((current) => ({ ...current, status: "draft", tools: { ...current.tools, [key]: value } }));
  const updateSizingTool = (value: boolean) => setTemplate((current) => ({ ...current, status: "draft", tools: { ...current.tools, allowScale: value, allowCrop: value, maxImages: 1 } }));
  const updatePhysicalWidth = (widthMm: number) => updateArea("widthMm", widthMm);
  const changeSurface = (surface: SurfaceType) => setTemplate((current) => {
    const currentArea = view === "back" ? current.backArea ?? current.area : current.area;
    return replaceArea(current, { ...currentArea, surface, precisionWrap: false });
  });

  function handleArtwork(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 15 * 1024 * 1024) { setNotice("Choose a JPG, PNG, or WebP image smaller than 15 MB"); return; }
    if (artwork.startsWith("blob:")) URL.revokeObjectURL(artwork);
    setArtwork(URL.createObjectURL(file));
    setNotice("Replacement artwork loaded · use Artwork fit to position it");
    setEditTarget("artwork");
    event.target.value = "";
  }

  async function handleMockup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { setNotice("Use a JPG, PNG, or WEBP mockup image"); return; }
    if (file.size > 15 * 1024 * 1024) { setNotice("Mockup images must be smaller than 15 MB"); return; }
    try {
      setNotice("Loading mockup…");
      const prepared = await prepareMockup(file);
      setTemplate((current) => ({ ...current, status: "draft", mockupImages: { ...current.mockupImages, [view]: prepared } }));
      setNotice("Mockup loaded · position the print area manually");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The mockup could not be prepared");
    } finally {
      event.target.value = "";
    }
  }

  function beginDrag(event: ReactPointerEvent<HTMLElement>, mode: "move" | "resize", target = editTarget, edge: ResizeEdge = "se") {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = target === "artwork"
      ? { target: "artwork", mode: "move", clientX: event.clientX, clientY: event.clientY, offsetX: area.defaultArtworkOffsetX ?? 0, offsetY: area.defaultArtworkOffsetY ?? 0 }
      : { target: "area", mode, edge, clientX: event.clientX, clientY: event.clientY, area: { ...area } };
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const stage = stageRef.current;
    if (!drag || !stage) return;
    if (drag.target === "point") {
      const point = pointAtPointer(event);
      setTemplate((current) => {
        const currentArea = view === "back" ? current.backArea ?? current.area : current.area;
        return replaceArea(current, { ...currentArea, maskPoints: (currentArea.maskPoints ?? []).map((existing, index) => index === drag.index ? point : existing) });
      });
      return;
    }
    if (drag.target === "artwork") {
      const artworkBounds = event.currentTarget.getBoundingClientRect();
      const offsetX = clamp(drag.offsetX + ((event.clientX - drag.clientX) / Math.max(1, artworkBounds.width)) * 300, -120, 120);
      const offsetY = clamp(drag.offsetY + ((event.clientY - drag.clientY) / Math.max(1, artworkBounds.height)) * 300, -120, 120);
      setTemplate((current) => { const currentArea = view === "back" ? current.backArea ?? current.area : current.area; return replaceArea(current, { ...currentArea, defaultArtworkOffsetX: Math.round(offsetX), defaultArtworkOffsetY: Math.round(offsetY) }); });
      return;
    }
    const bounds = stage.getBoundingClientRect();
    const deltaX = ((event.clientX - drag.clientX) / bounds.width) * 100;
    const deltaY = ((event.clientY - drag.clientY) / bounds.height) * 100;
    if (drag.mode === "move") {
      setTemplate((current) => { const currentArea = view === "back" ? current.backArea ?? current.area : current.area; return replaceArea(current, { ...currentArea, x: clamp(drag.area.x + deltaX, 0, 100 - currentArea.width), y: clamp(drag.area.y + deltaY, 0, 100 - currentArea.height) }); });
    } else {
      const radians = drag.area.rotation * Math.PI / 180;
      const dx = ((event.clientX - drag.clientX) * Math.cos(radians) + (event.clientY - drag.clientY) * Math.sin(radians)) / previewZoom;
      const dy = (-(event.clientX - drag.clientX) * Math.sin(radians) + (event.clientY - drag.clientY) * Math.cos(radians)) / previewZoom;
      const horizontal = dx / stage.clientWidth * 100;
      const vertical = dy / stage.clientHeight * 100;
      const width = clamp(drag.area.width + (drag.edge.includes("w") ? -horizontal : drag.edge.includes("e") ? horizontal : 0), 6, 100);
      const height = clamp(drag.area.height + (drag.edge.includes("n") ? -vertical : drag.edge.includes("s") ? vertical : 0), 8, 100);
      const shiftX = (width - drag.area.width) * stage.clientWidth / 100 / 2 * (drag.edge.includes("w") ? -1 : 1);
      const shiftY = (height - drag.area.height) * stage.clientHeight / 100 / 2 * (drag.edge.includes("n") ? -1 : 1);
      const x = clamp(drag.area.x + (shiftX * Math.cos(radians) - shiftY * Math.sin(radians)) / stage.clientWidth * 100 - (width - drag.area.width) / 2, 0, 100 - width);
      const y = clamp(drag.area.y + (shiftX * Math.sin(radians) + shiftY * Math.cos(radians)) / stage.clientHeight * 100 - (height - drag.area.height) / 2, 0, 100 - height);
      setTemplate((current) => { const currentArea = view === "back" ? current.backArea ?? current.area : current.area; return replaceArea(current, { ...currentArea, x, y, width, height }); });
    }
  }

  function endDrag() { dragRef.current = null; }
  function chooseMaskShape(shape: MaskShape) {
    setTemplate((current) => {
      const currentArea = view === "back" ? current.backArea ?? current.area : current.area;
      const points = shape === "custom" ? currentArea.maskPoints ?? [] : [];
      return replaceArea(current, { ...currentArea, maskShape: shape, maskPoints: points });
    });
    setEditTarget("mask");
    setNotice(shape === "custom" ? "Click around the printable shape to add mask points" : `${shape} mask applied`);
  }

  function pointAtPointer(event: ReactPointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return maskPointerPosition(event.clientX, event.clientY, bounds.left + bounds.width / 2, bounds.top + bounds.height / 2, event.currentTarget.offsetWidth * previewZoom, event.currentTarget.offsetHeight * previewZoom, area.rotation);
  }

  function beginPointDrag(event: ReactPointerEvent<HTMLButtonElement>, index: number) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { target: "point", index };
  }

  function addMaskPoint(event: ReactPointerEvent<HTMLDivElement>) {
    if ((area.maskShape ?? "rectangle") !== "custom") return;
    event.preventDefault();
    event.stopPropagation();
    const point = pointAtPointer(event);
    const points = [...(area.maskPoints ?? []), point].slice(0, 24);
    updateArea("maskPoints", points);
    setNotice(`${points.length} mask point${points.length === 1 ? "" : "s"} added${points.length < 3 ? " · add at least 3" : " · polygon active"}`);
  }

  function undoMaskPoint() {
    updateArea("maskPoints", (area.maskPoints ?? []).slice(0, -1));
    setNotice("Last mask point removed");
  }

  async function persist(publish: boolean) { if (saving || !ready) return; setSaving(true); try { const saved = await saveSharedTemplate(product, template, publish); setTemplate(saved); showSuccess(publish ? "Template published successfully. The updated design is now available to customers." : "Template draft saved successfully."); setNotice(publish ? `Published version ${saved.version}` : "Draft saved · customer version unchanged"); } catch (error) { setNotice(error instanceof Error ? error.message : "Template could not be saved. Try smaller mockup files."); } finally { setSaving(false); } }
  function restore() { try { setTemplate(hasSupabaseConfiguration() ? createDefaultTemplate(product) : resetTemplate(product)); setNotice("Default draft restored · publish to update customers"); } catch { setNotice("Template could not be reset."); } }

  const areaStyle = { left: `${area.x}%`, top: `${area.y}%`, width: `${area.width}%`, height: `${area.height}%`, transform: `rotate(${area.rotation}deg)`, mixBlendMode: previewBlendMode(area.blendMode, area.overlayStrength) };
  const cylindricalSurface = area.surface === "cylinder" || area.surface === "tapered-cylinder";
  const bleedX = clamp((area.bleedMm / Math.max(1, area.widthMm)) * 100, 0, 25);
  const bleedY = clamp((area.bleedMm / Math.max(1, area.heightMm)) * 100, 0, 25);
  const safeX = clamp((area.safeMarginMm / Math.max(1, area.widthMm)) * 100, 0, 35);
  const safeY = clamp((area.safeMarginMm / Math.max(1, area.heightMm)) * 100, 0, 35);
  const outputWidth = Math.round(((area.widthMm + area.bleedMm * 2) / 25.4) * area.targetDpi);
  const outputHeight = Math.round(((area.heightMm + area.bleedMm * 2) / 25.4) * area.targetDpi);

  return (
    <main className="admin-shell template-editor-shell">
      <AdminNav />
      <section className="admin-main">
        <header className="template-topbar"><div><Link href="/admin"><ArrowLeft size={17} /> Products</Link><i /><span>{product.name}</span></div><div className="save-state" role="status"><Check size={13} /> {notice}</div><div className="template-actions"><button disabled={saving || !ready} onClick={() => persist(false)}><Save size={15} /> Save draft</button><button disabled={saving || !ready} className="admin-primary" onClick={() => persist(true)}>Publish template</button></div></header>
        <div className="template-workspace">
          <aside className="template-controls">
            <div className="control-heading"><span className="admin-kicker">TEMPLATE EDITOR</span><h1>{area.name}</h1><p>Position the sample artwork exactly where production should print the customer’s design.</p>{product.views && <div className="view-switch compact">{product.views.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}>{item.label}</button>)}</div>}</div>
            <div className="editor-tabs">
              <button className={tab === "placement" ? "active" : ""} onClick={() => setTab("placement")}><Move />Placement</button>
              <button className={tab === "surface" ? "active" : ""} onClick={() => setTab("surface")}><SlidersHorizontal />Surface</button>
              <button className={tab === "effects" ? "active" : ""} onClick={() => setTab("effects")}><Sparkles />Effects</button>
              <button className={tab === "tools" ? "active" : ""} onClick={() => setTab("tools")}><TestTube2 />Tools</button>
            </div>

            <div className="editor-control-scroll">
              {tab === "placement" && <>
                <div className="placement-mode-switch three" aria-label="Placement editing mode"><button className={editTarget === "artwork" ? "active" : ""} onClick={() => setEditTarget("artwork")}><ImagePlus size={14} /> Artwork</button><button className={editTarget === "area" ? "active" : ""} onClick={() => setEditTarget("area")}><Move size={14} /> Area</button><button className={editTarget === "mask" ? "active" : ""} onClick={() => setEditTarget("mask")}><Triangle size={14} /> Shape</button></div>
                {editTarget === "artwork" ? <>
                  <ControlSection title="Artwork fitting" description="Adjust only the sample photo. The product print-area box remains fixed.">
                    <RangeField label="Size / crop" value={Math.round((area.defaultArtworkScale ?? 1) * 100)} min={35} max={300} onChange={(v) => updateArea("defaultArtworkScale", v / 100)} suffix="%" />
                    <div className="number-grid"><NumberField label="Horizontal" value={area.defaultArtworkOffsetX ?? 0} onChange={(v) => updateArea("defaultArtworkOffsetX", clamp(v, -120, 120))} /><NumberField label="Vertical" value={area.defaultArtworkOffsetY ?? 0} onChange={(v) => updateArea("defaultArtworkOffsetY", clamp(v, -120, 120))} /></div>
                    <RangeField label="Artwork rotation" value={area.defaultArtworkRotation ?? 0} min={-180} max={180} onChange={(v) => updateArea("defaultArtworkRotation", v)} suffix="°" />
                    <button className="secondary-upload" onClick={() => uploadRef.current?.click()}><Upload size={15} /> Replace test photo</button>
                  </ControlSection>
                </> : editTarget === "area" ? <>
                  <ControlSection title="Print area placement" description="Drag the complete box on the preview or enter exact values.">
                    <div className="number-grid"><NumberField label="X" value={area.x} onChange={(v) => updateArea("x", v)} suffix="%" /><NumberField label="Y" value={area.y} onChange={(v) => updateArea("y", v)} suffix="%" /><NumberField label="Width" value={area.width} onChange={(v) => updateArea("width", v)} suffix="%" /><NumberField label="Height" value={area.height} onChange={(v) => updateArea("height", v)} suffix="%" /></div>
                    <RangeField label="Area rotation" value={area.rotation} min={-45} max={45} onChange={(v) => updateArea("rotation", v)} suffix="°" />
                  </ControlSection>
                  <ControlSection title="Production dimensions" description="Used to calculate print-ready output resolution.">
                    <div className="number-grid"><NumberField label="Width" value={area.widthMm} onChange={updatePhysicalWidth} suffix="mm" /><NumberField label="Height" value={area.heightMm} onChange={(v) => updateArea("heightMm", v)} suffix="mm" /><NumberField label="Bleed" value={area.bleedMm} onChange={(v) => updateArea("bleedMm", v)} suffix="mm" /><NumberField label="Safe margin" value={area.safeMarginMm} onChange={(v) => updateArea("safeMarginMm", v)} suffix="mm" /></div>
                    <NumberField label="Target DPI" value={area.targetDpi} onChange={(v) => updateArea("targetDpi", v)} suffix="dpi" />
                    <div className="production-output-status"><Check size={14} /><div><strong>{outputWidth} × {outputHeight} px required</strong><small>Includes {area.bleedMm} mm bleed · dashed inner line is the {area.safeMarginMm} mm safe margin.</small></div></div>
                  </ControlSection>
                </> : <>
                  <div className="custom-mask-card">
                    <div><Triangle size={16} /><div><strong>Custom printable shape</strong><small>Choose a preset or draw the exact outline. Artwork outside this mask will be hidden in both admin and customer previews.</small></div></div>
                  </div>
                  <ControlSection title="Mask shape" description="For unusual keychains, badges, curved panels, and irregular printable zones.">
                    <div className="mask-shape-grid">
                      {MASK_PRESETS.map((shape) => <button key={shape.id} aria-pressed={(area.maskShape ?? "rectangle") === shape.id} className={(area.maskShape ?? "rectangle") === shape.id ? "active" : ""} onClick={() => chooseMaskShape(shape.id)}><svg viewBox="-5 -5 110 110" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="6">{shape.id === "rectangle" ? <rect width="100" height="100" rx="8" /> : shape.id === "ellipse" ? <ellipse cx="50" cy="50" rx="50" ry="50" /> : <polygon points={getMaskPolygon(shape.id)?.map(({ x, y }) => `${x},${y}`).join(" ")} />}</svg>{shape.label}</button>)}
                      <button aria-pressed={area.maskShape === "custom"} className={area.maskShape === "custom" ? "active" : ""} onClick={() => chooseMaskShape("custom")}><Move /> Draw custom</button>
                    </div>
                    {area.maskShape === "custom" && <div className="custom-mask-instructions"><strong>Click to add points; drag existing points</strong><small>{area.maskPoints?.length ?? 0} / 24 points · resize the outline using the edge and corner handles.</small><div><button onClick={undoMaskPoint} disabled={!area.maskPoints?.length}><Undo2 size={13} /> Undo point</button><button onClick={() => updateArea("maskPoints", [])} disabled={!area.maskPoints?.length}><RotateCcw size={13} /> Clear</button></div></div>}
                    {(area.maskShape ?? "rectangle") === "rectangle" && <RangeField label="Corner radius" value={area.maskRadius} min={0} max={50} onChange={(v) => updateArea("maskRadius", v)} suffix="%" />}
                    <button className="secondary-upload" disabled={area.maskShape === "custom" && (area.maskPoints?.length ?? 0) < 3} onClick={() => { setEditTarget("artwork"); setNotice("Mask saved · now fit the artwork inside it"); }}><Check size={15} /> Finish shape and fit artwork</button>
                  </ControlSection>
                </>}
              </>}
              {tab === "surface" && <ControlSection title="Surface renderer" description="Choose how artwork conforms to this product.">
                <label className="select-field"><span>Surface type</span><select value={area.surface} onChange={(e) => changeSurface(e.target.value as SurfaceType)}><option value="flat">Flat</option><option value="perspective">Perspective</option><option value="cylinder">Cylinder</option><option value="tapered-cylinder">Tapered cylinder</option><option value="custom-mask">Custom mask</option><option value="fabric">Fabric / wrinkles</option></select><ChevronDown /></label>
                {cylindricalSurface && <>
                  <RangeField label="Cylindrical curvature" value={area.curvature} min={0} max={100} onChange={(v) => { updateArea("precisionWrap", false); updateArea("curvature", v); }} suffix="%" />
                  <RangeField label="Edge fade" value={area.edgeFade ?? 9} min={0} max={24} onChange={(v) => updateArea("edgeFade", v)} suffix="%" />
                </>}
                {!cylindricalSurface && <RangeField label={area.surface === "fabric" ? "Wrinkle displacement" : "Surface curvature"} value={area.curvature} min={0} max={100} onChange={(v) => updateArea("curvature", v)} suffix="%" />}
                <RangeField label="Perspective" value={area.perspective} min={-35} max={35} onChange={(v) => updateArea("perspective", v)} suffix="°" />
                <RangeField label="Taper" value={area.taper} min={-50} max={50} onChange={(v) => updateArea("taper", v)} suffix="%" />
              </ControlSection>}
              {tab === "effects" && <ControlSection title="Artwork finishing" description="Blend the print naturally with the product photograph.">
                <label className="select-field"><span>Blend mode</span><select value={area.blendMode} onChange={(e) => updateArea("blendMode", e.target.value as TemplateArea["blendMode"])}><option value="normal">Normal</option><option value="screen">Screen</option><option value="multiply">Multiply</option><option value="overlay">Overlay</option></select><ChevronDown /></label>
                {area.blendMode === "overlay" && <RangeField label="Overlay strength" value={area.overlayStrength ?? 100} min={0} max={100} onChange={(v) => updateArea("overlayStrength", v)} suffix="%" />}
                <RangeField label="Brightness" value={area.brightness ?? 100} min={0} max={200} onChange={(v) => updateArea("brightness", v)} suffix="%" />
                <RangeField label="Contrast" value={area.contrast ?? 100} min={0} max={200} onChange={(v) => updateArea("contrast", v)} suffix="%" />
                <RangeField label="Saturation" value={area.saturation ?? 100} min={0} max={200} onChange={(v) => updateArea("saturation", v)} suffix="%" />
                <button className="secondary-upload" type="button" onClick={() => { updateArea("brightness", 100); updateArea("contrast", 100); updateArea("saturation", 100); }}><RotateCcw size={15} /> Reset colour adjustments</button>
                {area.surface === "fabric" && <RangeField label="Fold displacement strength" value={area.displacementStrength ?? 62} min={0} max={100} onChange={(v) => updateArea("displacementStrength", v)} suffix="%" />}
                {area.surface === "fabric" && <RangeField label="Wrinkle shadows & highlights" value={area.fabricBlendStrength ?? 48} min={0} max={100} onChange={(v) => updateArea("fabricBlendStrength", v)} suffix="%" />}
                {area.surface === "fabric" && <RangeField label="Fabric texture detail" value={area.fabricTextureStrength ?? 18} min={0} max={100} onChange={(v) => updateArea("fabricTextureStrength", v)} suffix="%" />}
                {area.surface === "fabric" && <div className="fabric-render-status"><Sparkles size={15} /><div><strong>Photoshop-style fabric composite</strong><small>High-resolution displacement + clipped shirt shadows + controlled highlights + textile detail.</small></div></div>}
                <RangeField label="Opacity" value={Math.round(area.opacity * 100)} min={10} max={100} onChange={(v) => updateArea("opacity", v / 100)} suffix="%" />
                {(area.maskShape ?? "rectangle") === "rectangle" && <RangeField label="Mask corner radius" value={area.maskRadius} min={0} max={50} onChange={(v) => updateArea("maskRadius", v)} suffix="%" />}
                <button className="secondary-upload" onClick={() => uploadRef.current?.click()}><Upload size={15} /> Test replacement artwork</button>
              </ControlSection>}
              {tab === "tools" && <ControlSection title="Customer tools" description="Control what shoppers can change for this product.">
                <Toggle label="Allow image upload" checked={template.tools.images} onChange={(v) => updateTool("images", v)} />
                <Toggle label="Allow text" checked={template.tools.text} onChange={(v) => updateTool("text", v)} />
                <Toggle label="Move artwork" checked={template.tools.allowMove} onChange={(v) => updateTool("allowMove", v)} />
                <Toggle label="Resize / crop artwork" checked={template.tools.allowScale || template.tools.allowCrop} onChange={updateSizingTool} />
                <Toggle label="Rotate artwork" checked={template.tools.allowRotate} onChange={(v) => updateTool("allowRotate", v)} />
                <div className="tool-scope-note"><Check size={14} /><div><strong>One high-resolution photo layer per side</strong><small>Customers can combine that photo with a separate realistic text layer.</small></div></div>
              </ControlSection>}
            </div>
            <div className="editor-control-footer"><button onClick={restore}><RotateCcw size={15} /> Reset template</button></div>
          </aside>

          <section className="template-preview-panel">
            <div className="preview-toolbar"><div><button className={viewport === "desktop" ? "active" : ""} onClick={() => setViewport("desktop")}><Monitor /> Desktop</button><button className={viewport === "mobile" ? "active" : ""} onClick={() => setViewport("mobile")}><Smartphone /> Mobile</button></div><div className="preview-zoom-controls" role="group" aria-label="Product preview zoom"><button type="button" aria-label="Zoom out product" disabled={previewZoom <= 0.5} onClick={() => setPreviewZoom((zoom) => Math.max(0.5, zoom - 0.25))}><ZoomOut /></button><button type="button" aria-label="Reset product zoom" onClick={() => { setPreviewZoom(1); setPanPreview(false); stageRef.current?.closest(".template-stage")?.scrollTo(0, 0); }}>{Math.round(previewZoom * 100)}%</button><button type="button" aria-label="Zoom in product" disabled={previewZoom >= 3} onClick={() => setPreviewZoom((zoom) => Math.min(3, zoom + 0.25))}><ZoomIn /></button></div>{previewZoom > 1 && <div className="preview-pan-controls" role="group" aria-label="Move zoomed product preview"><button type="button" aria-label="Move view left" onClick={() => movePreview(-1, 0)}><ArrowLeft /></button><button type="button" aria-label="Move view up" onClick={() => movePreview(0, -1)}><ArrowUp /></button><button type="button" aria-label="Move view down" onClick={() => movePreview(0, 1)}><ArrowDown /></button><button type="button" aria-label="Move view right" onClick={() => movePreview(1, 0)}><ArrowRight /></button><button type="button" onClick={centerPreview}>Centre</button><button type="button" className={panPreview ? "active" : ""} aria-pressed={panPreview} onClick={() => { endDrag(); setPanPreview((active) => !active); }}><Move />{panPreview ? "Edit artwork" : "Move preview"}</button></div>}<button type="button" className="print-guides-toggle" aria-pressed={showPrintGuides} aria-label="Show print guides" onClick={() => { endDrag(); setShowPrintGuides((visible) => !visible); }}>{showPrintGuides ? <EyeOff size={14} /> : <Eye size={14} />}{showPrintGuides ? "Hide print guides" : "Show print guides"}</button></div>
            <div className={`template-stage-frame ${viewport}`}>
              <MockupStage key={mockupSrc} src={mockupSrc} alt={`${product.name} ${productView.label}`} zoom={previewZoom} enablePan={panPreview && previewZoom > 1} className={`template-stage${previewZoom > 1 ? ` is-zoomed${panPreview ? " pan-preview" : ""}` : ""}`} imageClassName="template-product-image" stageRef={stageRef}>
                <div className={`editable-print-area editing-${editTarget}${showPrintGuides ? "" : " guides-hidden"}`} style={areaStyle} onPointerDown={(e) => editTarget === "mask" ? addMaskPoint(e) : beginDrag(e, "move")} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}>
                  <WarpedArtwork src={artwork} curvature={area.curvature} perspective={area.perspective} taper={area.taper} opacity={area.opacity} blendMode={area.blendMode} overlayStrength={area.overlayStrength} mockupSrc={mockupSrc} backdropArea={area} brightness={area.brightness} contrast={area.contrast} saturation={area.saturation} maskRadius={area.maskRadius} maskShape={area.maskShape} maskPoints={area.maskPoints} surface={area.surface} precisionWrap={area.precisionWrap} wrapAngle={area.wrapAngle} edgeFade={area.edgeFade} surfaceMap={area.surfaceMap} displacementStrength={area.displacementStrength} fabricBlendStrength={area.fabricBlendStrength} fabricTextureStrength={area.fabricTextureStrength} scale={area.defaultArtworkScale ?? 1} imageRotation={area.defaultArtworkRotation ?? 0} offsetX={area.defaultArtworkOffsetX ?? 0} offsetY={area.defaultArtworkOffsetY ?? 0} />
                  {showPrintGuides && editTarget === "mask" && <><div className="mask-outline" style={{ clipPath: maskClipPath(area.maskShape, area.maskPoints) }} />{area.maskShape === "custom" && (area.maskPoints ?? []).map((point, index) => <button key={index} type="button" aria-label={`Move shape point ${index + 1}`} className="mask-point" onPointerDown={(event) => beginPointDrag(event, index)} style={{ left: `${point.x}%`, top: `${point.y}%` }}><b>{index + 1}</b></button>)}</>}
                  {showPrintGuides && editTarget === "area" && <><div className="production-bleed-guide" style={{ left: `${-bleedX}%`, right: `${-bleedX}%`, top: `${-bleedY}%`, bottom: `${-bleedY}%` }}><span>BLEED</span></div><div className="production-safe-guide" style={{ left: `${safeX}%`, right: `${safeX}%`, top: `${safeY}%`, bottom: `${safeY}%` }}><span>SAFE</span></div></>}
                  {showPrintGuides && <span className="area-tag">{editTarget === "artwork" ? "Drag artwork" : editTarget === "mask" ? area.maskShape === "custom" ? "Click to draw mask" : `${area.maskShape ?? "rectangle"} mask` : area.name}</span>}{showPrintGuides && (editTarget === "area" || editTarget === "mask") && resizeEdges.map((edge) => <button key={edge} type="button" aria-label={`Resize print area ${edge}`} className={`resize-handle resize-${edge}`} onPointerDown={(e) => { e.stopPropagation(); beginDrag(e, "resize", "area", edge); }} />)}
                </div>
              </MockupStage>
            </div>
            <div className="template-preview-foot"><div><strong>{product.name} · {productView.label}</strong><small>{area.surface.replace("-", " ")} · {area.widthMm} × {area.heightMm} mm · {area.targetDpi} DPI</small></div><button onClick={() => mockupRef.current?.click()}><Upload size={15} /> Replace product photo</button><button onClick={() => uploadRef.current?.click()}><ImagePlus size={15} /> Replace test image</button></div>
            <input ref={uploadRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleArtwork} />
            <input ref={mockupRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleMockup} />
          </section>
        </div>
      </section>
    </main>
  );
}

function ControlSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <section className="control-section"><div><h2>{title}</h2><p>{description}</p></div>{children}</section>; }
function NumberField({ label, value, suffix, onChange }: { label: string; value: number; suffix?: string; onChange: (value: number) => void }) { return <label className="number-field"><span>{label}</span><div><input type="number" value={Math.round(value * 10) / 10} onChange={(e) => onChange(Number(e.target.value))} /><small>{suffix}</small></div></label>; }
function RangeField({ label, value, min, max, suffix, onChange }: { label: string; value: number; min: number; max: number; suffix: string; onChange: (value: number) => void }) { return <label className="range-field"><span>{label}<output>{Math.round(value)}{suffix}</output></span><input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} /></label>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="toggle-row"><span>{label}</span><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><i /></label>; }

function prepareMockup(file: File) {
  return new Promise<string>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      const maxDimension = 1600;
      const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) { URL.revokeObjectURL(objectUrl); reject(new Error("Canvas processing is unavailable")); return; }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/webp", 0.88));
    };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("The mockup image could not be read")); };
    image.src = objectUrl;
  });
}
