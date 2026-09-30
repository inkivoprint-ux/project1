import type { Metadata } from "next";
import { StoredProductPage } from "@/components/StoredProductPage";
import { getSharedProduct } from "@/lib/catalogueServer";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getSharedProduct(slug);
  return product ? { title: `Personalise ${product.name}`, description: product.description, alternates: { canonical: `/customize/${slug}` }, openGraph: { title: product.name, description: product.description, images: [{ url: product.image, alt: product.name }] } } : { title: "Personalise your product", robots: { index: false, follow: false } };
}

export default async function CustomizePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getSharedProduct(slug);
  return <StoredProductPage slug={slug} mode="customize" initialProduct={product} />;
}
