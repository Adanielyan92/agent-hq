import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import "../styles/sprites.css";

export const metadata: Metadata = {
  title: "Agent HQ",
  description: "Visualize GitHub Actions CI/CD workflows as animated pixel-art agents",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className={`${GeistSans.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}
