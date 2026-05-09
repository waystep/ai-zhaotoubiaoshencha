import { NextResponse } from "next/server";

interface RouteContext {
  params: Promise<{ reportId: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  const { reportId } = await context.params;

  return NextResponse.json(
    {
      error: "该接口已停用，请使用 /api/chat 发起审查会话。",
      redirectTo: `/reports/${reportId}/chat`,
    },
    { status: 410 },
  );
}
