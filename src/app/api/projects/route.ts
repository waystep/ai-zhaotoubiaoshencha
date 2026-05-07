import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import { tenderProjects } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { createProjectSchema } from "@/types/tender";

// GET: 获取项目列表
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const projects = await db.query.tenderProjects.findMany({
      where: eq(tenderProjects.orgId, session.user.orgId!),
      orderBy: [desc(tenderProjects.createdAt)],
      with: {
        creator: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ projects });
  } catch (error) {
    console.error("获取项目列表失败:", error);
    return NextResponse.json(
      { error: "获取项目列表失败" },
      { status: 500 }
    );
  }
}

// POST: 创建新项目
export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validatedData = createProjectSchema.parse(body);

    // 生成项目编号（如果未提供）
    const projectNo = validatedData.projectNo || `TEND-${Date.now()}`;

    const [project] = await db
      .insert(tenderProjects)
      .values({
        orgId: session.user.orgId!,
        createdBy: session.user.id,
        name: validatedData.name,
        projectNo,
        description: validatedData.description,
        tenderType: validatedData.tenderType,
        budget: validatedData.budget?.toString(),
        deadline: validatedData.deadline ? new Date(validatedData.deadline) : undefined,
        requirements: validatedData.requirements,
        scoringRules: validatedData.scoringRules,
        status: "draft",
      })
      .returning();

    return NextResponse.json({ project });
  } catch (error) {
    console.error("创建项目失败:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "数据验证失败", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "创建项目失败" },
      { status: 500 }
    );
  }
}