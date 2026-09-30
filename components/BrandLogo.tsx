import Image from "next/image";
import Link from "next/link";

export function BrandLogo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className={`brand-logo ${light ? "brand-logo--light" : ""}`} aria-label="Inkivo home">
      <span className="brand-symbol" aria-hidden="true">
        <Image src="/brand/inkivo-symbol.png" alt="" width={681} height={693} priority />
      </span>
      <span className="brand-wordmark">inkivo.in</span>
    </Link>
  );
}
