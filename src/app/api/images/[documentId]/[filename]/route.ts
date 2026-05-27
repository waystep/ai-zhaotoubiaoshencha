import { NextResponse } from "next/server";
import { isAuthFailure, requireDocumentAccess } from "@/lib/auth/guards";
import { getImagePath } from "@/lib/storage/image-storage";
import fs from "fs";

interface RouteContext {
  params: Promise<{ documentId: string; filename: string }>;
}

/**
 * GET: 获取解析后的图片
 *
 * 路径: /api/images/[documentId]/[filename]
 */
export async function GET(
  request: Request,
  context: RouteContext
) {
  const { documentId, filename } = await context.params;

  try {
    const access = await requireDocumentAccess(documentId);
    if (isAuthFailure(access)) return access.response;

    // 获取图片路径
    const imagePath = getImagePath(documentId, filename);

    if (!imagePath) {
      return NextResponse.json(
        { error: "图片不存在" },
        { status: 404 }
      );
    }

    // 读取图片文件
    const imageBuffer = fs.readFileSync(imagePath);

    // 根据文件名确定 MIME 类型
    const extension = filename.split(".").pop()?.toLowerCase() || "jpg";
    const mimeTypes: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
    };

    const contentType = mimeTypes[extension] || "image/jpeg";

    // 返回图片
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[Image API] 获取图片失败:", error);
    return NextResponse.json(
      { error: "获取图片失败" },
      { status: 500 }
    );
  }
}
