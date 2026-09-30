"use client";

import Image from "next/image";
import Link from "next/link";
import { ChangeEvent, PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronDown, Eye, Focus, ImagePlus, Monitor, Move, RotateCcw, Save, SlidersHorizontal, Smartphone, Sparkles, TestTube2, Triangle, Undo2, Upload, ZoomIn } from "lucide-react";
import { getMaskPolygon, MASK_PRESETS } from "@/lib/maskShapes";
import { Product } from "@/lib/products";
import { createDefaultTemplate, loadTemplate, maskClipPath, resetTemplate, type MaskShape, SurfaceType, TemplateArea, TemplateConfig } from "@/lib/customization";
import { hasSupabaseConfiguration } from "@/lib/supabase/config";
import { refreshSharedTemplate, saveSharedTemplate } from "@/lib/sharedCatalog";
import { analyseMockupImage, generateSurfaceMap } from "@/lib/smartMockup";
import { WarpedArtwork } from "./WarpedArtwork";
import { AdminNav } from "./AdminNav";

type DragState =
  | { target: "area"; mode: "move" | "resize"; clientX: number; clientY: number; area: TemplateConfig["area"] }
  | { target: "artwork"; mode: "move"; clientX: number; clientY: number; offsetX: number; offsetY: number }
  | null;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const wrapAngleFor = (widthMm: number, diameterMm: number) => Math.round(clamp((widthMm / (Math.PI * Math.max(1, diameterMm))) * 360, 30, 170));

export function AdminTemplateEditor({ product }: { product: Product }) {
  const [template, setTemplate] = useState(() => createDefaultTemplate(product));
  const [artwork, setArtwork] = useState<string>("/brand/inkivo-symbol.png");
  const [tab, setTab] = useState<"placement" | "surface" | "effects" | "tools">("placement");
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [view, setView] = useState<"front" | "back">("front");
  const [editTarget, setEditTarget] = useState<"area" | "artwork" | "mask">("artwork");
  const [notice, setNotice] = useState("Template loaded");
  const [detecting, setDetecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(!hasSupabaseConfiguration());
  const [detectionConfidence, setDetectionConfidence] = useState<number | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const mockupRef = useRef<HTMLInputElement>(null);
  const surfaceMapRef = useRef<HTMLInputElement>(null);

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
  const updatePhysicalWidth = (widthMm: number) => setTemplate((current) => { const currentArea = view === "back" ? current.backArea ?? current.area : current.area; const cylindrical = currentArea.surface === "cylinder" || currentArea.surface === "tapered-cylinder"; const wrapAngle = cylindrical && (currentArea.precisionWrap ?? true) && currentArea.diameterMm ? wrapAngleFor(widthMm, currentArea.diameterMm) : currentArea.wrapAngle; return replaceArea(current, { ...currentArea, widthMm, wrapAngle }); });
  const updateDiameter = (diameterMm: number) => setTemplate((current) => { const currentArea = view === "back" ? current.backArea ?? current.area : current.area; return replaceArea(current, { ...currentArea, diameterMm, wrapAngle: wrapAngleFor(currentArea.widthMm, diameterMm) }); });
  const togglePrecisionWrap = (precisionWrap: boolean) => setTemplate((current) => {
    const currentArea = view === "back" ? current.backArea ?? current.area : current.area;
    const diameterMm = currentArea.diameterMm ?? product.printArea.diameterMm ?? 75;
    return replaceArea(current, { ...currentArea, precisionWrap, diameterMm, wrapAngle: precisionWrap ? wrapAngleFor(currentArea.widthMm, diameterMm) : currentArea.wrapAngle });
  });
  const changeSurface = (surface: SurfaceType) => setTemplate((current) => {
    const currentArea = view === "back" ? current.backArea ?? current.area : current.area;
    const cylindrical = surface === "cylinder" || surface === "tapered-cylinder";
    const diameterMm = currentArea.diameterMm ?? product.printArea.diameterMm ?? 75;
    return replaceArea(current, {
      ...currentArea,
      surface,
      precisionWrap: cylindrical,
      diameterMm: cylindrical ? diameterMm : currentArea.diameterMm,
      wrapAngle: cylindrical ? wrapAngleFor(currentArea.widthMm, diameterMm) : currentArea.wrapAngle,
      displacementStrength: surface === "fabric" ? currentArea.displacementStrength || 62 : currentArea.displacementStrength,
      fabricBlendStrength: surface === "fabric" ? currentArea.fabricBlendStrength || 48 : currentArea.fabricBlendStrength,
      fabricTextureStrength: surface === "fabric" ? currentArea.fabricTextureStrength || 18 : currentArea.fabricTextureStrength,
      maskShape: surface === "tapered-cylinder" && (!currentArea.maskShape || currentArea.maskShape === "rectangle" || currentArea.maskShape === "tapered") ? "tapered" : currentArea.maskShape,
    });
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
      setNotice("Preparing smart mockup…");
      const prepared = await prepareMockup(file);
      setTemplate((current) => ({ ...current, status: "draft", mockupImages: { ...current.mockupImages, [view]: prepared } }));
      await runAutoDetect(prepared);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The mockup could not be prepared");
    } finally {
      event.target.value = "";
    }
  }

  async function runAutoDetect(src = mockupSrc) {
    const stage = stageRef.current;
    if (!stage) return;
    setDetecting(true);
    setNotice("Scanning product shape and surface…");
    try {
      const bounds = stage.getBoundingClientRect();
      const suggestion = await analyseMockupImage(src, area.surface, bounds.width, bounds.height);
      const suggestedArea = {
        ...area,
        x: suggestion.x,
        y: suggestion.y,
        width: suggestion.width,
        height: suggestion.height,
        surface: suggestion.surface,
        curvature: suggestion.curvature,
        taper: suggestion.taper,
        maskRadius: suggestion.maskRadius,
        opacity: suggestion.opacity,
        blendMode: suggestion.blendMode,
        maskShape: suggestion.surface === "tapered-cylinder" ? "tapered" as const : suggestion.surface === "custom-mask" ? "custom" as const : "rectangle" as const,
        maskPoints: suggestion.surface === "custom-mask" ? (area.maskPoints?.length ? area.maskPoints : [{ x: 8, y: 8 }, { x: 92, y: 8 }, { x: 96, y: 50 }, { x: 88, y: 94 }, { x: 12, y: 94 }, { x: 4, y: 50 }]) : [],
      };
      if (suggestion.surface === "fabric") {
        suggestedArea.surfaceMap = await generateSurfaceMap(src, suggestedArea, bounds.width, bounds.height);
        suggestedArea.displacementStrength = area.displacementStrength ?? 62;
        suggestedArea.fabricBlendStrength = area.fabricBlendStrength ?? 48;
        suggestedArea.fabricTextureStrength = area.fabricTextureStrength ?? 18;
      }
      setTemplate((current) => {
        return replaceArea(current, suggestedArea);
      });
      setDetectionConfidence(suggestion.confidence);
      setNotice(`${suggestion.surface === "fabric" ? "Print area + wrinkle map" : "Smart area"} detected · ${suggestion.confidence}% confidence`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Automatic detection failed");
    } finally {
      setDetecting(false);
    }
  }

  async function buildSurfaceMap() {
    const stage = stageRef.current;
    if (!stage) return;
    setDetecting(true);
    setNotice("Reading folds, shadows, and highlights…");
    try {
      const bounds = stage.getBoundingClientRect();
      const map = await generateSurfaceMap(mockupSrc, area, bounds.width, bounds.height);
      updateArea("surfaceMap", map);
      if (!area.displacementStrength) updateArea("displacementStrength", 62);
      setNotice("Product-specific surface map generated");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Surface map generation failed");
    } finally {
      setDetecting(false);
    }
  }

  async function handleSurfaceMap(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 15 * 1024 * 1024) { setNotice("Choose a JPG, PNG, or WebP map smaller than 15 MB"); return; }
    try {
      const map = await prepareSurfaceMap(file);
      updateArea("surfaceMap", map);
      setNotice("Custom displacement map loaded");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The displacement map could not be read");
    } finally {
      event.target.value = "";
    }
  }

  function beginDrag(event: ReactPointerEvent<HTMLElement>, mode: "move" | "resize", target = editTarget) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = target === "artwork"
      ? { target: "artwork", mode: "move", clientX: event.clientX, clientY: event.clientY, offsetX: area.defaultArtworkOffsetX ?? 0, offsetY: area.defaultArtworkOffsetY ?? 0 }
      : { target: "area", mode, clientX: event.clientX, clientY: event.clientY, area: { ...area } };
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const stage = stageRef.current;
    if (!drag || !stage) return;
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
      setTemplate((current) => { const currentArea = view === "back" ? current.backArea ?? current.area : current.area; return replaceArea(current, { ...currentArea, width: clamp(drag.area.width + deltaX, 6, 100 - currentArea.x), height: clamp(drag.area.height + deltaY, 8, 100 - currentArea.y) }); });
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

  function addMaskPoint(event: ReactPointerEvent<HTMLDivElement>) {
    if ((area.maskShape ?? "rectangle") !== "custom") return;
    event.preventDefault();
    event.stopPropagation();
    const bounds = event.currentTarget.getBoundingClientRect();
    const point = {
      x: Math.round(clamp(((event.clientX - bounds.left) / Math.max(1, bounds.width)) * 100, 0, 100) * 10) / 10,
      y: Math.round(clamp(((event.clientY - bounds.top) / Math.max(1, bounds.height)) * 100, 0, 100) * 10) / 10,
    };
    const points = [...(area.maskPoints ?? []), point].slice(0, 24);
    updateArea("maskPoints", points);
    setNotice(`${points.length} mask point${points.length === 1 ? "" : "s"} added${points.length < 3 ? " · add at least 3" : " · polygon active"}`);
  }

  function undoMaskPoint() {
    updateArea("maskPoints", (area.maskPoints ?? []).slice(0, -1));
    setNotice("Last mask point removed");
  }

  function autoMask() {
    const shape: MaskShape = area.surface === "tapered-cylinder" ? "tapered" : area.surface === "custom-mask" ? "custom" : "rectangle";
    const points = shape === "custom" ? [{ x: 8, y: 8 }, { x: 92, y: 8 }, { x: 96, y: 50 }, { x: 88, y: 94 }, { x: 12, y: 94 }, { x: 4, y: 50 }] : [];
    setTemplate((current) => {
      const currentArea = view === "back" ? current.backArea ?? current.area : current.area;
      return replaceArea(current, { ...currentArea, maskShape: shape, maskPoints: points });
    });
    setEditTarget("mask");
    setNotice(`Automatic ${shape} mask applied · refine if needed`);
  }

  function fitArtwork(mode: "fit" | "fill" | "centre") {
    setTemplate((current) => {
      const currentArea = view === "back" ? current.backArea ?? current.area : current.area;
      return replaceArea(current, {
        ...currentArea,
        defaultArtworkScale: mode === "fill" ? 1.35 : mode === "centre" ? currentArea.defaultArtworkScale ?? 1 : 1,
        defaultArtworkRotation: mode === "centre" ? currentArea.defaultArtworkRotation ?? 0 : 0,
        defaultArtworkOffsetX: 0,
        defaultArtworkOffsetY: 0,
      });
    });
    setNotice(mode === "fill" ? "Artwork fills the print area" : mode === "centre" ? "Artwork centred" : "Artwork fitted automatically");
  }
  async function persist(publish: boolean) { if (saving || !ready) return; setSaving(true); try { const saved = await saveSharedTemplate(product, template, publish); setTemplate(saved); setNotice(publish ? `Published version ${saved.version}` : "Draft saved · customer version unchanged"); } catch (error) { setNotice(error instanceof Error ? error.message : "Template could not be saved. Try smaller mockup files."); } finally { setSaving(false); } }
  function restore() { try { setTemplate(hasSupabaseConfiguration() ? createDefaultTemplate(product) : resetTemplate(product)); setNotice("Default draft restored · publish to update customers"); } catch { setNotice("Template could not be reset."); } }

  const areaStyle = { left: `${area.x}%`, top: `${area.y}%`, width: `${area.width}%`, height: `${area.height}%`, transform: `rotate(${area.rotation}deg)` };
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
        <header className="template-topbar"><div><Link href="/admin"><ArrowLeft size={17} /> Products</Link><i /><span>{product.name}</span></div><div className="save-state" role="status"><Check size={13} /> {notice}</div><div className="template-actions"><button disabled={detecting || saving || !ready} onClick={() => persist(false)}><Save size={15} /> Save draft</button><button disabled={detecting || saving || !ready} className="admin-primary" onClick={() => persist(true)}>Publish template</button></div></header>
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
                  <div className="artwork-fit-card"><div><Sparkles size={16} /><div><strong>Fit the replacement photo</strong><small>Drag the artwork directly inside the print area. These settings become the customer’s starting placement.</small></div></div><div className="artwork-fit-actions"><button onClick={() => fitArtwork("fit")}><Sparkles size={14} /> Auto fit</button><button onClick={() => fitArtwork("fill")}><ZoomIn size={14} /> Fill area</button><button onClick={() => fitArtwork("centre")}><Focus size={14} /> Centre</button></div></div>
                  <ControlSection title="Artwork fitting" description="Adjust only the sample photo. The product print-area box remains fixed.">
                    <RangeField label="Size / crop" value={Math.round((area.defaultArtworkScale ?? 1) * 100)} min={35} max={300} onChange={(v) => updateArea("defaultArtworkScale", v / 100)} suffix="%" />
                    <div className="number-grid"><NumberField label="Horizontal" value={area.defaultArtworkOffsetX ?? 0} onChange={(v) => updateArea("defaultArtworkOffsetX", clamp(v, -120, 120))} /><NumberField label="Vertical" value={area.defaultArtworkOffsetY ?? 0} onChange={(v) => updateArea("defaultArtworkOffsetY", clamp(v, -120, 120))} /></div>
                    <RangeField label="Artwork rotation" value={area.defaultArtworkRotation ?? 0} min={-180} max={180} onChange={(v) => updateArea("defaultArtworkRotation", v)} suffix="°" />
                    <button className="secondary-upload" onClick={() => uploadRef.current?.click()}><Upload size={15} /> Replace test photo</button>
                  </ControlSection>
                </> : editTarget === "area" ? <>
                  <div className="smart-object-card">
                    <div><span><Sparkles size={16} /></span><div><strong>Smart mockup setup</strong><small>Upload a clean product photo or scan the current one. Inkivo detects the product bounds and proposes a mapped print layer.</small></div></div>
                    <div className="smart-object-actions"><button onClick={() => mockupRef.current?.click()}><Upload size={14} /> Upload mockup</button><button className="smart-detect-button" onClick={() => runAutoDetect()} disabled={detecting}><Sparkles size={14} /> {detecting ? "Detecting…" : "Auto-detect"}</button></div>
                    {detectionConfidence !== null && <p><Check size={12} /> Detection confidence: <strong>{detectionConfidence}%</strong> · Review the suggested box before publishing.</p>}
                  </div>
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
                    <button className="auto-mask-button" onClick={autoMask}><Sparkles size={14} /> Auto-select for this product</button>
                  </div>
                  <ControlSection title="Mask shape" description="For unusual keychains, badges, curved panels, and irregular printable zones.">
                    <div className="mask-shape-grid">
                      {MASK_PRESETS.map((shape) => <button key={shape.id} aria-pressed={(area.maskShape ?? "rectangle") === shape.id} className={(area.maskShape ?? "rectangle") === shape.id ? "active" : ""} onClick={() => chooseMaskShape(shape.id)}><svg viewBox="-5 -5 110 110" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="6">{shape.id === "rectangle" ? <rect width="100" height="100" rx="8" /> : shape.id === "ellipse" ? <ellipse cx="50" cy="50" rx="50" ry="50" /> : <polygon points={getMaskPolygon(shape.id)?.map(({ x, y }) => `${x},${y}`).join(" ")} />}</svg>{shape.label}</button>)}
                      <button aria-pressed={area.maskShape === "custom"} className={area.maskShape === "custom" ? "active" : ""} onClick={() => chooseMaskShape("custom")}><Move /> Draw custom</button>
                    </div>
                    {area.maskShape === "custom" && <div className="custom-mask-instructions"><strong>Click points clockwise around the shape</strong><small>{area.maskPoints?.length ?? 0} / 24 points · the last point automatically connects to the first.</small><div><button onClick={undoMaskPoint} disabled={!area.maskPoints?.length}><Undo2 size={13} /> Undo point</button><button onClick={() => updateArea("maskPoints", [])} disabled={!area.maskPoints?.length}><RotateCcw size={13} /> Clear</button></div></div>}
                    {(area.maskShape ?? "rectangle") === "rectangle" && <RangeField label="Corner radius" value={area.maskRadius} min={0} max={50} onChange={(v) => updateArea("maskRadius", v)} suffix="%" />}
                    <button className="secondary-upload" disabled={area.maskShape === "custom" && (area.maskPoints?.length ?? 0) < 3} onClick={() => { setEditTarget("artwork"); setNotice("Mask saved · now fit the artwork inside it"); }}><Check size={15} /> Finish shape and fit artwork</button>
                  </ControlSection>
                </>}
              </>}
              {tab === "surface" && <ControlSection title="Surface renderer" description="Choose how artwork conforms to this product.">
                <label className="select-field"><span>Surface type</span><select value={area.surface} onChange={(e) => changeSurface(e.target.value as SurfaceType)}><option value="flat">Flat</option><option value="perspective">Perspective</option><option value="cylinder">Cylinder</option><option value="tapered-cylinder">Tapered cylinder</option><option value="custom-mask">Custom mask</option><option value="fabric">Fabric / wrinkles</option></select><ChevronDown /></label>
                {cylindricalSurface && <>
                  <Toggle label="Automatic precision wrap" checked={area.precisionWrap ?? true} onChange={togglePrecisionWrap} />
                  {(area.precisionWrap ?? true) && <NumberField label="Product diameter" value={area.diameterMm ?? product.printArea.diameterMm ?? 75} onChange={updateDiameter} suffix="mm" />}
                  {(area.precisionWrap ?? true) ? <div className="precision-wrap-status"><Sparkles size={15} /><div><strong>Physically calibrated curve</strong><small>{area.widthMm} mm print width · {area.diameterMm ?? product.printArea.diameterMm ?? "estimated"} mm diameter · {area.wrapAngle ?? 110}° visible wrap</small></div></div> : <RangeField label="Manual cylindrical curvature" value={area.curvature} min={0} max={100} onChange={(v) => updateArea("curvature", v)} suffix="%" />}
                  <RangeField label="Edge fade" value={area.edgeFade ?? 9} min={0} max={24} onChange={(v) => updateArea("edgeFade", v)} suffix="%" />
                </>}
                {!cylindricalSurface && <RangeField label={area.surface === "fabric" ? "Wrinkle displacement" : "Surface curvature"} value={area.curvature} min={0} max={100} onChange={(v) => updateArea("curvature", v)} suffix="%" />}
                <RangeField label="Perspective" value={area.perspective} min={-35} max={35} onChange={(v) => updateArea("perspective", v)} suffix="°" />
                <RangeField label="Taper" value={area.taper} min={-50} max={50} onChange={(v) => updateArea("taper", v)} suffix="%" />
              </ControlSection>}
              {tab === "effects" && <ControlSection title="Artwork finishing" description="Blend the print naturally with the product photograph.">
                {area.surface === "fabric" && <div className={`surface-map-card ${area.surfaceMap ? "ready" : ""}`}>
                  <div><span><Sparkles size={16} /></span><div><strong>Fabric wrinkle map</strong><small>{area.surfaceMap ? "A product-specific map is bending artwork along this shirt’s actual folds." : "Generate a map from the mockup to follow its wrinkles, shadows, and highlights."}</small></div></div>
                  <div className="smart-object-actions"><button onClick={buildSurfaceMap} disabled={detecting}><Sparkles size={14} /> {detecting ? "Analysing…" : area.surfaceMap ? "Regenerate" : "Generate from mockup"}</button><button onClick={() => surfaceMapRef.current?.click()}><Upload size={14} /> Upload map</button></div>
                  {area.surfaceMap && <p><Check size={12} /> Surface map active</p>}
                </div>}
                <label className="select-field"><span>Blend mode</span><select value={area.blendMode} onChange={(e) => updateArea("blendMode", e.target.value as TemplateArea["blendMode"])}><option value="normal">Normal</option><option value="screen">Screen</option><option value="multiply">Multiply</option><option value="overlay">Overlay</option></select><ChevronDown /></label>
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
            <div className="preview-toolbar"><div><button className={viewport === "desktop" ? "active" : ""} onClick={() => setViewport("desktop")}><Monitor /> Desktop</button><button className={viewport === "mobile" ? "active" : ""} onClick={() => setViewport("mobile")}><Smartphone /> Mobile</button></div><span><Eye size={14} /> Customer preview</span></div>
            <div className={`template-stage-frame ${viewport}`}>
              <div className="template-stage" ref={stageRef}>
                <Image src={mockupSrc} alt={`${product.name} ${productView.label}`} width={1024} height={1536} priority unoptimized={mockupSrc.startsWith("data:")} className="template-product-image" />
                <div className={`editable-print-area editing-${editTarget}`} style={areaStyle} onPointerDown={(e) => editTarget === "mask" ? addMaskPoint(e) : beginDrag(e, "move")} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
                  <WarpedArtwork src={artwork} curvature={area.curvature} perspective={area.perspective} taper={area.taper} opacity={area.opacity} blendMode={area.blendMode} maskRadius={area.maskRadius} maskShape={area.maskShape} maskPoints={area.maskPoints} surface={area.surface} precisionWrap={area.precisionWrap} wrapAngle={area.wrapAngle} edgeFade={area.edgeFade} surfaceMap={area.surfaceMap} displacementStrength={area.displacementStrength} fabricBlendStrength={area.fabricBlendStrength} fabricTextureStrength={area.fabricTextureStrength} scale={area.defaultArtworkScale ?? 1} imageRotation={area.defaultArtworkRotation ?? 0} offsetX={area.defaultArtworkOffsetX ?? 0} offsetY={area.defaultArtworkOffsetY ?? 0} />
                  {editTarget === "mask" && <><div className="mask-outline" style={{ clipPath: maskClipPath(area.maskShape, area.maskPoints) }} />{area.maskShape === "custom" && (area.maskPoints ?? []).map((point, index) => <i key={`${point.x}-${point.y}-${index}`} className="mask-point" style={{ left: `${point.x}%`, top: `${point.y}%` }}><b>{index + 1}</b></i>)}</>}
                  {editTarget === "area" && <><div className="production-bleed-guide" style={{ left: `${-bleedX}%`, right: `${-bleedX}%`, top: `${-bleedY}%`, bottom: `${-bleedY}%` }}><span>BLEED</span></div><div className="production-safe-guide" style={{ left: `${safeX}%`, right: `${safeX}%`, top: `${safeY}%`, bottom: `${safeY}%` }}><span>SAFE</span></div></>}
                  <span className="area-tag">{editTarget === "artwork" ? "Drag artwork" : editTarget === "mask" ? area.maskShape === "custom" ? "Click to draw mask" : `${area.maskShape ?? "rectangle"} mask` : area.name}</span>{editTarget === "area" && <i className="resize-handle" onPointerDown={(e) => { e.stopPropagation(); beginDrag(e, "resize", "area"); }} />}
                </div>
              </div>
            </div>
            <div className="template-preview-foot"><div><strong>{product.name} · {productView.label}</strong><small>{area.surface.replace("-", " ")} · {area.widthMm} × {area.heightMm} mm · {area.targetDpi} DPI</small></div><button onClick={() => uploadRef.current?.click()}><ImagePlus size={15} /> Replace test image</button></div>
            <input ref={uploadRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleArtwork} />
            <input ref={mockupRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleMockup} />
            <input ref={surfaceMapRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleSurfaceMap} />
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

function prepareSurfaceMap(file: File) {
  return new Promise<string>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      const size = 512;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) { URL.revokeObjectURL(objectUrl); reject(new Error("Canvas processing is unavailable")); return; }
      context.fillStyle = "rgb(128,128,128)";
      context.fillRect(0, 0, size, size);
      context.drawImage(image, 0, 0, size, size);
      const pixels = context.getImageData(0, 0, size, size);
      for (let index = 0; index < pixels.data.length; index += 4) {
        const value = Math.round(pixels.data[index] * 0.299 + pixels.data[index + 1] * 0.587 + pixels.data[index + 2] * 0.114);
        pixels.data[index] = value;
        pixels.data[index + 1] = value;
        pixels.data[index + 2] = value;
        pixels.data[index + 3] = 255;
      }
      context.putImageData(pixels, 0, 0);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/webp", 0.88));
    };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("The surface map could not be read")); };
    image.src = objectUrl;
  });
}
