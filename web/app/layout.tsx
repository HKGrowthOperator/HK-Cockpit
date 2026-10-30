import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Die Hausschriften von HK Growth (wie auf der Webstudio-Seite), selbst
// gehostet — kein Abruf bei Google, kein Netz beim Bauen nötig. Lizenz: OFL.
const fraunces = localFont({
  src: "./fonts/fraunces-latin.woff2",
  weight: "100 900",
  variable: "--font-fraunces",
  display: "swap",
});
const inter = localFont({
  src: "./fonts/inter-latin.woff2",
  weight: "100 900",
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HK Growth — Cockpit",
  description: "Verwurzeltes Wachstum — die Zentrale für alle HK-Apps.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className={`h-full antialiased ${fraunces.variable} ${inter.variable}`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
