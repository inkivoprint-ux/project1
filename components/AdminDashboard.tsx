"use client";

import { showSuccess } from "@/lib/notifications";
import { prepareProductPhoto, validateImageUpload, IMAGE_UPLOAD_HINT } from "@/lib/imageUpload";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleAlert, Clock3, ImagePlus, Layers3, PackageOpen, Pencil, Plus, Search, Upload, X } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { createDefaultTemplate, loadTemplate, loadLocalCustomerTemplate, subscribeToTemplates, TemplateConfig } from "@/lib/customization";
import { filterProducts, loadAllProducts, loadLocalProducts, saveCustomProduct, slugifyProductName, subscribeToProductCatalog } from "@/lib/productCatalog";
import { formatPrice, products, type Product } from "@/lib/products";
import { AdminNav } from "./AdminNav";
import { AdminInventory } from "./AdminInventory";
import { AdminSalesReports } from "./AdminSalesReports";
import { AdminOrders } from "./AdminOrders";
import { useDialog } from "@/lib/useDialog";
import { hasSupabaseConfiguration } from "@/lib/supabase/config";
import { refreshSharedProducts, refreshSharedTemplate, saveSharedProduct, saveSharedTemplate } from "@/lib/sharedCatalog";

type ProductForm = {
  name: string; shortName: string; category: string; price: string; frontBackPrice: string; compareAt: string;
  finish: string; description: string; image: string; badge: string; displayOrder: string;
  surface: Product["printArea"]["surface"]; widthMm: string; heightMm: string; diameterMm: string;
};

const emptyProduct: ProductForm = {
  name: "", shortName: "", category: "", price: "", frontBackPrice: "", compareAt: "", finish: "", description: "", image: "", badge: "New", displayOrder: "1",
  surface: "cylinder", widthMm: "80", heightMm: "110", diameterMm: "75",
};

export function AdminDashboard() {
  const cloud = hasSupabaseConfiguration();
  const [catalogue, setCatalogue] = useState<Product[]>(products);
  const [catalogueReady, setCatalogueReady] = useState(false);
  const [templates, setTemplates] = useState<Record<string, TemplateConfig>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [orderCount, setOrderCount] = useState(0);
  const [form, setForm] = useState<ProductForm>(emptyProduct);
  const [formError, setFormError] = useState("");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [workspaceError, setWorkspaceError] = useState("");
  const modalRef = useDialog(addOpen, () => setAddOpen(false));

  const refreshCatalogue = () => {
    const nextProducts = loadAllProducts();
    setCatalogue(nextProducts);
    setCatalogueReady(true);
    setTemplates(Object.fromEntries(nextProducts.map((product) => [product.id, loadTemplate(product)])));
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (cloud) refreshSharedProducts().then(async (items) => { await Promise.all(items.map((item) => refreshSharedTemplate(item, true))); refreshCatalogue(); }).catch(() => setWorkspaceError("The shared catalogue could not be loaded. Check the Supabase connection and migrations."));
      else refreshCatalogue();
    }, 0);
    const unsubscribe = subscribeToProductCatalog(refreshCatalogue);
    const unsubscribeTemplates = subscribeToTemplates(refreshCatalogue);
    return () => { window.clearTimeout(timer); unsubscribe(); unsubscribeTemplates(); };
  }, [cloud]);

  useEffect(() => {
    if (!addOpen) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setAddOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [addOpen]);

  const visibleProducts = useMemo(() => filterProducts(catalogue, searchQuery), [catalogue, searchQuery]);
  const setField = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => setForm((current) => ({ ...current, [key]: value }));

  const readProductImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try { validateImageUpload(file); setField("image", await prepareProductPhoto(file)); setFormError(""); }
    catch (error) { setFormError((error as Error).message); event.target.value = ""; }
  };

  const addProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const slug = slugifyProductName(form.name);
    if (!slug || !form.category.trim() || !form.finish.trim() || !form.description.trim() || !form.image) return setFormError("Complete every required field and upload a clean product image.");
    if (!editingProduct && catalogue.some((product) => product.slug === slug)) return setFormError("A product with this name already exists. Use a more specific product name.");
    const price = Number(form.price), widthMm = Number(form.widthMm), heightMm = Number(form.heightMm), diameterMm = Number(form.diameterMm);
    if (![price, widthMm, heightMm].every((value) => Number.isFinite(value) && value > 0) || (form.surface !== "fabric" && !(Number.isFinite(diameterMm) && diameterMm > 0))) return setFormError("Enter valid price and production dimensions greater than zero.");

    if (form.frontBackPrice && !(Number.isFinite(Number(form.frontBackPrice)) && Number(form.frontBackPrice) > 0)) return setFormError("Enter a valid front + back price.");
    const product: Product = {
      ...editingProduct,
      id: editingProduct?.id ?? `custom-${slug}`, slug: editingProduct?.slug ?? slug, name: form.name.trim(), shortName: form.shortName.trim() || form.name.trim(),
      category: form.category.trim(), price, frontBackPrice: /t[\s-]?shirt/i.test(form.category) && form.frontBackPrice ? Number(form.frontBackPrice) : undefined, compareAt: Number(form.compareAt) > price ? Number(form.compareAt) : undefined,
      image: form.image, finish: form.finish.trim(), badge: form.badge || undefined, displayOrder: Number(form.displayOrder), description: form.description.trim(),
      printArea: editingProduct?.printArea ?? { surface: form.surface, widthMm, heightMm, diameterMm: form.surface === "fabric" ? undefined : diameterMm },
    };
    try {
      setSaving(true);
      if (cloud) await saveSharedProduct(product); else saveCustomProduct(product);
      setTemplates((current) => ({ ...current, [product.id]: loadTemplate(product) }));
      setForm(emptyProduct); setFormError(""); setSearchQuery(""); setAddOpen(false);
      showSuccess(editingProduct ? "Product updated successfully." : "Product added successfully.");
      window.setTimeout(() => document.querySelector("#products")?.scrollIntoView({ behavior: "smooth" }), 0);
    } catch (error) { setFormError(error instanceof Error ? error.message : "The product could not be saved. Try again."); }
    finally { setSaving(false); }
  };

  const importCatalogue = async () => {
    if (saving || catalogue.length) return;
    if (!window.confirm("Publish the catalogue and customer templates saved on this device to Supabase? Only use this for an empty shared catalogue.")) return;
    setSaving(true); setWorkspaceError("");
    try {
      for (const item of loadLocalProducts()) { await saveSharedProduct(item); await saveSharedTemplate(item, loadLocalCustomerTemplate(item), true); }
      refreshCatalogue();
    } catch (error) { setWorkspaceError(error instanceof Error ? error.message : "Import stopped. Review the saved products before retrying."); }
    finally { setSaving(false); }
  };

  const editProduct = (product: Product) => {
    if (!catalogueReady) return;
    setEditingProduct(product);
    setForm({ name: product.name, shortName: product.shortName, category: product.category, price: String(product.price), frontBackPrice: product.frontBackPrice ? String(product.frontBackPrice) : "", compareAt: product.compareAt ? String(product.compareAt) : "", finish: product.finish, description: product.description, image: product.image, badge: product.badge ?? "", displayOrder: String(catalogue.findIndex((item) => item.id === product.id) + 1), surface: product.printArea.surface, widthMm: String(product.printArea.widthMm), heightMm: String(product.printArea.heightMm), diameterMm: String(product.printArea.diameterMm ?? 75) });
    setFormError(""); setAddOpen(true);
  };

  return (
    <main className="admin-shell">
      <AdminNav />
      <section className="admin-main">
        <header className="admin-topbar"><div><span>Workspace</span><strong>Inkivo.in</strong></div><label className="admin-search"><Search size={15} /><span className="sr-only">Search products</span><input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} aria-label="Search products" placeholder="Search products by name, category, or finish" />{searchQuery && <button onClick={() => setSearchQuery("")} aria-label="Clear search"><X size={13} /></button>}</label></header>
        <div className="admin-content">
          <div className="admin-heading"><div><span className="admin-kicker">CONTROL CENTRE</span><h1>Your Inkivo workspace.</h1><p>Manage products, configure print templates, and keep order files organised.</p></div><button type="button" className="admin-primary" onClick={() => { setEditingProduct(null); setForm({ ...emptyProduct, displayOrder: String(catalogue.length + 1) }); setFormError(""); setAddOpen(true); }}><Plus size={17} /> Add product</button></div>
          {workspaceError && <p role="alert" className="editor-message">{workspaceError}</p>}
          {cloud && catalogueReady && catalogue.length === 0 && <div className="setup-banner"><div><CircleAlert /><span><strong>Your shared catalogue is empty</strong><small>Publish the existing catalogue from this device to make it available to customers.</small></span></div><button disabled={saving} onClick={importCatalogue}>{saving ? "Publishing…" : "Publish this device’s catalogue"}</button></div>}
          <div className="admin-stats">
            <article><span className="stat-icon green"><PackageOpen /></span><small>Products</small><strong>{catalogue.length}</strong><em>All active</em></article>
            <article><span className="stat-icon amber"><Layers3 /></span><small>Templates</small><strong>{Object.values(templates).filter((item) => item.status === "published").length}/{catalogue.length}</strong><em>Published</em></article>
            <article><span className="stat-icon blue"><Clock3 /></span><small>New orders</small><strong>{orderCount}</strong><em>{orderCount === 1 ? "Order ready for review" : "Orders ready for review"}</em></article>
          </div>
          <section className="admin-card" id="products">
            <div className="admin-card-head"><div><h2>Products & print templates</h2><p>{searchQuery ? `${visibleProducts.length} matching ${visibleProducts.length === 1 ? "product" : "products"}` : "Open a product to configure exactly where customer artwork will be printed."}</p></div>{searchQuery && <button onClick={() => setSearchQuery("")}><X size={14} /> Clear search</button>}</div>
            <div className="admin-product-table" id="templates">
              <div className="table-head"><span>Product</span><span>Print surface</span><span>Template</span><span>Price</span><span /></div>
              {visibleProducts.map((product) => {
                const template = templates[product.id] ?? createDefaultTemplate(product);
                return <div className="table-row" key={product.id}>
                  <div className="admin-product-name"><span><Image src={product.image} alt="" width={54} height={70} unoptimized={product.image.startsWith("data:")} /></span><div><strong>{product.name}</strong><small>{product.finish}</small><small className="product-merchandising">{product.stockQuantity == null ? "Stock not tracked" : `${product.stockQuantity} in stock`} · Position {catalogue.findIndex((item) => item.id === product.id) + 1} · {product.badge || "No badge"}</small></div></div>
                  <div><span className="surface-chip">{template.area.surface.replace("-", " ")}</span><small>{template.area.widthMm} × {template.area.heightMm} mm</small></div>
                  <div><span className={`status-chip ${template.status}`}>{template.status === "published" ? <CheckCircle2 size={12} /> : <Clock3 size={12} />}{template.status}</span><small>Version {template.version}</small></div>
                  <strong>{formatPrice(product.price)}</strong>
                  <div className="product-row-actions"><button type="button" disabled={!catalogueReady} onClick={() => editProduct(product)}><Pencil size={14} /> Edit product</button><Link href={`/admin/templates/${product.slug}`}>Edit template <ArrowRight size={15} /></Link></div>
                </div>;
              })}
              {visibleProducts.length === 0 && <div className="admin-table-empty"><Search size={24} /><strong>No products found</strong><span>Try a different name, category, or finish.</span><button onClick={() => setSearchQuery("")}>Show all products</button></div>}
            </div>
          </section>
          <AdminInventory products={catalogue} />
          <AdminOrders onCount={setOrderCount} /><AdminOrders channel="offline" />
          <AdminSalesReports />
        </div>
      </section>
      {addOpen && <div ref={modalRef} className="product-modal" role="dialog" aria-modal="true" aria-labelledby="add-product-title">
        <button className="product-modal-scrim" tabIndex={-1} aria-label="Close product editor" onClick={() => setAddOpen(false)} />
        <form className="product-modal-panel" onSubmit={addProduct}>
          <header><div><span className="admin-kicker">CATALOGUE DETAILS</span><h2 id="add-product-title">{editingProduct ? "Edit product" : "Add a product"}</h2><p>{cloud ? "Changes are saved to the shared catalogue." : "Changes are saved on this development device."}</p></div><button data-dialog-focus type="button" className="icon-button" disabled={saving} onClick={() => setAddOpen(false)} aria-label="Close"><X /></button></header>
          <div className="product-form-scroll">
            <section className="product-image-field">
              <label htmlFor="new-product-image">{form.image ? <Image src={form.image} alt="Product preview" width={220} height={260} unoptimized /> : <span><ImagePlus size={28} /><strong>Upload product image</strong></span>}<small>{IMAGE_UPLOAD_HINT}</small></label>
              <input id="new-product-image" type="file" accept="image/png,image/jpeg,image/webp" onChange={readProductImage} />
              <label className="product-upload-button" htmlFor="new-product-image"><Upload size={15} /> {form.image ? "Replace image" : "Choose image"}</label>
            </section>
            <div className="product-form-grid">
              <label><span>Product name *</span><input required value={form.name} onChange={(event) => setField("name", event.target.value)} placeholder="Classic Ceramic Mug" /></label>
              <label><span>Short name</span><input value={form.shortName} onChange={(event) => setField("shortName", event.target.value)} placeholder="Ceramic Mug" /></label>
              <label><span>Category *</span><input required value={form.category} onChange={(event) => setField("category", event.target.value)} placeholder="Mugs" /></label>
              <label><span>Finish / capacity *</span><input required value={form.finish} onChange={(event) => setField("finish", event.target.value)} placeholder="Gloss white · 330 ml" /></label>
              <label><span>Selling price / T-shirt front only (₹) *</span><input required min="1" step="1" type="number" value={form.price} onChange={(event) => setField("price", event.target.value)} placeholder="699" /></label>
              {/t[\s-]?shirt/i.test(form.category) && <label><span>T-shirt front + back price (₹)</span><input min="1" step="1" type="number" value={form.frontBackPrice} onChange={(event) => setField("frontBackPrice", event.target.value)} placeholder="Leave blank to use front price" /></label>}
              <label><span>Compare-at price (₹)</span><input min="1" step="1" type="number" value={form.compareAt} onChange={(event) => setField("compareAt", event.target.value)} placeholder="799" /></label>
              <label><span>Product badge</span><select value={form.badge} onChange={(event) => setField("badge", event.target.value)}><option value="">No badge</option><option value="Bestseller">Bestseller</option><option value="New">New</option>{form.badge && !["Bestseller", "New"].includes(form.badge) && <option value={form.badge}>{form.badge}</option>}</select></label>
              <label><span>Display position</span><select value={form.displayOrder} onChange={(event) => setField("displayOrder", event.target.value)}>{Array.from({ length: catalogue.length + (editingProduct ? 0 : 1) }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}{index === 0 ? " — First" : ""}</option>)}</select><small>Other products shift automatically.</small></label>
              <label className="full"><span>Description *</span><textarea required value={form.description} onChange={(event) => setField("description", event.target.value)} placeholder="Describe the product and its personalisation surface." /></label>
            </div>
            {!editingProduct && <section className="product-surface-form">
              <div><h3>Print surface setup</h3><p>This creates the first editable template. You can visually adjust it after saving.</p></div>
              <div className="product-form-grid">
                <label><span>Surface *</span><select value={form.surface} onChange={(event) => setField("surface", event.target.value as ProductForm["surface"])}><option value="cylinder">Cylinder</option><option value="tapered-cylinder">Tapered cylinder</option><option value="fabric">Fabric / T-shirt</option></select></label>
                <label><span>Printable width (mm) *</span><input required min="1" type="number" value={form.widthMm} onChange={(event) => setField("widthMm", event.target.value)} /></label>
                <label><span>Printable height (mm) *</span><input required min="1" type="number" value={form.heightMm} onChange={(event) => setField("heightMm", event.target.value)} /></label>
                {form.surface !== "fabric" && <label><span>Product diameter (mm) *</span><input required min="1" type="number" value={form.diameterMm} onChange={(event) => setField("diameterMm", event.target.value)} /></label>}
              </div>
            </section>}
            {formError && <p className="product-form-error" role="alert"><CircleAlert size={15} /> {formError}</p>}
          </div>
          <footer><button disabled={saving} type="button" onClick={() => setAddOpen(false)}>Cancel</button><button disabled={saving} className="admin-primary" type="submit"><CheckCircle2 size={16} /> {saving ? "Saving…" : editingProduct ? "Save changes" : "Add product"}</button></footer>
        </form>
      </div>}
    </main>
  );
}
