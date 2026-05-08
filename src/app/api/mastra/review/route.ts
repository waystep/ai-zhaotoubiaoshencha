// Mastra Agent 审查 API 路由
import { NextRequest, NextResponse } from "next/server";
import { mastra } from "@/mastra";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.documentContent || !body.documentType || !body.blocks) {
      return NextResponse.json(
        { error: "缺少必要参数：documentContent, documentType, blocks" },
        { status: 400 }
      );
    }

    const agent = mastra.getAgentById("tender-review-agent");

    const prompt = `
请对以下${body.documentType === "tender_doc" ? "招标文件" : body.documentType === "legal_doc" ? "法律文件" : "投标文件"}进行专业审查分析。

文档内容概要：
${body.documentContent.substring(0, 2000)}...

文档包含 ${body.blocks.length} 个内容区块。

请使用 documentAnalysisTool 进行分析，然后给出你的专业审查意见和整改建议。
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
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get("action");

  if (action === "info") {
    return NextResponse.json({
      agent: {
        id: "tender-review-agent",
        name: "招标文件审查专家",
      },
    });
  }

  return NextResponse.json({
    message: "使用 POST 提交审查，或 GET ?action=info 获取信息",
  });
}