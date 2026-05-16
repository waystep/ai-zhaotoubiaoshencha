import type { Metadata } from "next";
import "@/styles/globals.css";
import { AuthProvider } from "@/components/providers/auth-provider";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: {
    default: "智能投标预审智能体",
    template: "%s · 智能投标预审智能体",
  },
  description:
    "一站式智能投标预审智能体应用，支持招标文件解析、审查项与应答提炼、合规分析、图文风险研判与结构化报告生成。",
  keywords: [
    "招投标",
    "招标文件",
    "投标文件",
    "标书审查",
    "智能预审",
    "合规审查",
    "AI 审查",
    "文档解析",
    "审查报告",
    "投标预审",
  ],
  authors: [{ name: "智能投标预审智能体" }],
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
  },
  openGraph: {
    title: "智能投标预审智能体",
    description:
      "AI 驱动的招标与投标材料解析、审查项管理、合规分析与报告汇总，赋能投标预审与标书自检。",
    locale: "zh_CN",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning className="h-full">
      <body className="h-full bg-background antialiased">
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
