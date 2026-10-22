import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DHU 机械学院篮球空间",
  description: "DHU 机械学院男子篮球队的战术教学与赛后分析。把每一次配合，练成球队的默契。",
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
              "(function(){try{var t=localStorage.getItem('mech-hoops-theme');if(t!=='dark'&&t!=='light'&&t!=='blue'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='light';}})();",
          }}
        />
        {children}
      </body>
    </html>
  );
}
