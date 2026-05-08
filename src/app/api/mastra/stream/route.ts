// Mastra Agent 流式审查 API 路由
import { NextRequest } from "next/server";
import { mastra } from "@/mastra";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.documentContent || !body.documentType || !body.blocks) {
      return new Response(
        JSON.stringify({ error: "缺少必要参数" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const agent = mastra.getAgentById("tender-review-agent");

    const prompt = `
请对以下${body.documentType === "tender_doc" ? "招标文件" : body.documentType === "legal_doc" ? "法律文件" : "投标文件"}进行审查分析。

文档内容：${body.documentContent.substring(0, 2000)}...
`;

    const stream = await agent.stream(prompt);

    const readableStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of stream.textStream) {
            controller.enqueue(encoder.encode(chunk));
          }
          const toolResults = await stream.toolResults;
          controller.enqueue(
            encoder.encode(`\n\n---META---\n${JSON.stringify({ toolResults })}`)
          );
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "未知错误" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}