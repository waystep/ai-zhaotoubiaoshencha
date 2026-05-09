import { NextRequest, NextResponse } from "next/server";
import { mastra } from "@/mastra";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.documentContent || !body.documentType || !body.blocks) {
      return NextResponse.json(
        { error: "缺少必要参数：documentContent, documentType, blocks" },
        { status: 400 },
      );
    }

    const agent = mastra.getAgentById("tender-review-agent");

    const prompt = `
请对以下${body.documentType === "tender_doc" ? "招标文件" : body.documentType === "legal_doc" ? "法律文件" : "投标文件"}进行专业审查分析。

文档内容概要：
${String(body.documentContent).substring(0, 2000)}...

文档包含 ${body.blocks.length} 个内容区块。

请使用 documentAnalysisTool 进行分析，并优先输出结构化的审查结论。
`;

    const result = await agent.generate(prompt);

    return NextResponse.json({
      success: true,
      result: {
        text: result.text,
        toolCalls: result.toolCalls,
        toolResults: result.toolResults,
        usage: result.usage,
      },
    });
  } catch (error) {
    console.error("Mastra Agent 审查失败:", error);
    return NextResponse.json(
      {
        error: "审查过程中发生错误",
        details: error instanceof Error ? error.message : "未知错误",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const action = request.nextUrl.searchParams.get("action");

  if (action === "info") {
    return NextResponse.json({
      agent: {
        id: "tender-review-supervisor",
        name: "招标审查总协调专家",
      },
    });
  }

  return NextResponse.json({
    message: "推荐使用 /api/chat 进行审查会话；该路由仅保留兼容用途。",
  });
}
