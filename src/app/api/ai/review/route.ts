import { handleChatStream } from "@mastra/ai-sdk";
import { createUIMessageStreamResponse } from "ai";

import { mastra } from "@/mastra";
import { auth } from "@/lib/auth/config";

export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const {
      reportId,
      projectId,
      bidDocumentId,
      documentId,
      prompt,
    }: {
      reportId?: string;
      projectId?: string;
      bidDocumentId?: string;
      documentId?: string;
      prompt?: string;
    } = await req.json();

    const targetBidDocumentId = bidDocumentId || documentId;

    if (!projectId || !targetBidDocumentId) {
      return Response.json(
        { error: "缺少必要参数：projectId, bidDocumentId" },
        { status: 400 }
      );
    }

    const reviewPrompt = `
请审查该项目中的投标文件，并将结构化结果保存到数据库。

输入：
- reportId: ${reportId || "未提供"}
- projectId: ${projectId}
- bidDocumentId: ${targetBidDocumentId}

补充说明：
${prompt || "无"}
`;

    const stream = await handleChatStream({
      mastra,
      agentId: "tender-review-agent",
      version: "v6",
      params: {
        messages: [
          {
            id: "review-user-message",
            role: "user",
            parts: [
              {
                type: "text",
                text: reviewPrompt,
              },
            ],
          },
        ],
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    console.error("AI review error:", error);
    return Response.json(
      {
        error: "审查请求处理失败",
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
