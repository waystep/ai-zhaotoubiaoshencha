import { NextRequest } from "next/server";

import {
  isAuthFailure,
  requireDocumentAccess,
  requireProjectAccess,
} from "@/lib/auth/guards";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const projectId = body.projectId;
    const bidDocumentId = body.bidDocumentId || body.documentId;
    const reportId = body.reportId;

    if (!projectId || !bidDocumentId) {
      return new Response(
        JSON.stringify({ error: "缺少必要参数：projectId, bidDocumentId" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const projectAccess = await requireProjectAccess(projectId);
    if (isAuthFailure(projectAccess)) return projectAccess.response;

    const documentAccess = await requireDocumentAccess(bidDocumentId);
    if (isAuthFailure(documentAccess)) return documentAccess.response;
    if (documentAccess.document.projectId !== projectId) {
      return new Response(JSON.stringify({ error: "文档不属于该项目" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { mastra } = await import("@/mastra");
    const agent = mastra.getAgentById("tender-review-agent");
    const prompt = `
请审查该项目中的投标文件，并将结构化结果保存到数据库。

输入：
- reportId: ${reportId || "未提供"}
- projectId: ${projectId}
- bidDocumentId: ${bidDocumentId}
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
      JSON.stringify({
        error: error instanceof Error ? error.message : "未知错误",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
