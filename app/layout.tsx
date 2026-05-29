import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SeoBar } from "@/components/SeoBar";
import { SiteFooter } from "@/components/SiteFooter";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Press — PDF tools in your browser",
  description:
    "Merge, split, compress, rotate, and watermark PDFs locally in your browser. No uploads, no account — powered by WebAssembly.",
  openGraph: {
    title: "Press — PDF tools in your browser",
    description:
      "Merge, split, compress, rotate, and watermark PDFs locally in your browser.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="flex min-h-full flex-col bg-white font-sans text-neutral-900 antialiased">
        <SiteHeader />
        <SeoBar />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
