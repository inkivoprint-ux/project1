import type { Metadata } from "next";
import { StoredProductPage } from "@/components/StoredProductPage";
import { getSharedProduct } from "@/lib/catalogueServer";

export const metadata: Metadata = { title: "Template editor", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function TemplateEditorPage({ params }: PageProps<"/admin/templates/[slug]">) {
  const { slug } = await params;
  const product = await getSharedProduct(slug);
  return <StoredProductPage slug={slug} mode="template" initialProduct={product} />;
}
