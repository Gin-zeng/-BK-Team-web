import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "机械学院 · 篮球战术室",
  description: "把每一次配合，练成球队的默契。机械学院男子篮球队战术教学与赛后分析。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
