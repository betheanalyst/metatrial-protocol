import type { Metadata, Viewport } from "next";
import { Inter, Newsreader } from "next/font/google";
import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { Providers } from "./providers";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const serif = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "MetaTrial - reasoned, verifiable determinations for digital disputes",
    template: "%s · MetaTrial",
  },
  description:
    "MetaTrial turns digital disagreements into reasoned, inspectable, verifiable records: evidence, reasoning, determination, and attestation - powered by GenLayer intelligent-contract consensus.",
};

export const viewport: Viewport = {
  themeColor: "#FAF9F5",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body className="min-h-screen bg-paper font-sans text-ink antialiased">
        <Providers>
          <div className="flex min-h-screen flex-col">
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-attest focus:px-4 focus:py-2 focus:text-sm focus:text-paper"
            >
              Skip to content
            </a>
            <SiteHeader />
            <main id="main-content" className="flex-1">
              {children}
            </main>
            <SiteFooter />
          </div>
        </Providers>
      </body>
    </html>
  );
}
