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
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased">
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('mech-hoops-theme');if(t!=='dark'&&t!=='light'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='light';}})();",
          }}
        />
        {children}
      </body>
    </html>
  );
}
