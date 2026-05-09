import { handleChatStream } from "@mastra/ai-sdk";
import { createUIMessageStreamResponse } from "ai";
import { eq } from "drizzle-orm";
import { mastra } from "@/mastra";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import { documents } from "@/lib/db/schema";

export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { documentId, prompt }: { documentId?: string; prompt: string } = await req.json();

    let contextMessage = "";
    if (documentId) {
      const doc = await db.query.documents.findFirst({
        where: eq(documents.id, documentId),
        with: {
          parsedResult: {
            with: {
              blocks: { limit: 100 },
            },
          },
        },
      });

      if (doc?.parsedResult) {
        const fullText = doc.parsedResult.fullText || "";
        const blocksText = doc.parsedResult.blocks
          ?.map((block) => `[页${block.pageNumber}] ${block.content}`)
          .join("\n")
          .slice(0, 5000);

        contextMessage = `\n\n以下是待审查的文档内容（节选）:\n${blocksText || fullText.slice(0, 5000)}`;
      }
    }

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
                text: prompt + contextMessage,
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
      { error: "审查请求处理失败", details: error instanceof Error ? error.message : undefined },
      { status: 500 },
    );
  }
}
