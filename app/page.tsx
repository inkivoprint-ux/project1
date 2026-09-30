import { Storefront } from "@/components/Storefront";
import { getSharedCatalogue } from "@/lib/catalogueServer";

export const dynamic = "force-dynamic";
export default async function Home() {
  return <Storefront initialProducts={await getSharedCatalogue()} />;
}
