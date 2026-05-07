import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import { documents, tenderProjects } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

// GET: 获取全部文档列表
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 获取用户组织的所有项目
    const projects = await db.query.tenderProjects.findMany({
      where: eq(tenderProjects.orgId, session.user?.orgId!),
      columns: {
        id: true,
        name: true,
      },
    });

    const projectIds = projects.map((p) => p.id);

    // 获取这些项目的所有文档
    const allDocs = await db.query.documents.findMany({
      orderBy: [desc(documents.createdAt)],
      limit: 100,
      with: {
        project: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    });

    // 过滤出用户组织的文档
    const userDocs = allDocs.filter((d) => projectIds.includes(d.projectId));

    return NextResponse.json({ documents: userDocs });
  } catch (error) {
    console.error("获取文档列表失败:", error);
    return NextResponse.json(
      { error: "获取文档列表失败" },
      { status: 500 }
    );
  }
}