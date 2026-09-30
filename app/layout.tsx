import type { Metadata } from "next";
import "./globals.css";
import "./refinements.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://inkivo.in"),
  title: { default: "Inkivo.in — Made personal. Made memorable.", template: "%s | Inkivo.in" },
  description: "Thoughtfully personalised bottles, mugs and gifts, made for the people and moments that matter.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Inkivo.in — Made personal. Made memorable.",
    description: "Create a gift that feels unmistakably theirs.",
    type: "website",
    locale: "en_IN",
    siteName: "Inkivo.in",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
