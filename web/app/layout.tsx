import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HK Growth — Cockpit",
  description: "Verwurzeltes Wachstum — deine zentrale Schaltzentrale.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
