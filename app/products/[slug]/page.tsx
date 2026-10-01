import type { Metadata } from "next";
import { StoredProductPage } from "@/components/StoredProductPage";
import { getSharedProduct } from "@/lib/catalogueServer";
import { isProductAvailable } from "@/lib/productAvailability";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getSharedProduct(slug);
  return product && isProductAvailable(product) ? { title: product.name, description: product.description, alternates: { canonical: `/products/${slug}` }, openGraph: { title: product.name, description: product.description, images: [{ url: product.image, alt: product.name }] } } : { title: "Product unavailable", robots: { index: false, follow: false } };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <StoredProductPage slug={slug} mode="detail" initialProduct={await getSharedProduct(slug)} />;
}
