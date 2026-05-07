import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { nanoid } from "nanoid";

// 文件上传 API
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // 检查文件类型
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only PDF and Office documents are allowed." },
        { status: 400 }
      );
    }

    
    // 生成唯一文件名
    const fileExtension = file.name.split(".").pop() || "pdf";
    const uniqueFileName = `${nanoid(10)}_${Date.now()}.${fileExtension}`;

    // 创建上传目录
    const uploadDir = join(process.cwd(), "uploads");
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // 按用户 ID 组织文件
    const userDir = join(uploadDir, session.user.id);
    if (!existsSync(userDir)) {
      await mkdir(userDir, { recursive: true });
    }

    // 保存文件
    const filePath = join(userDir, uniqueFileName);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // 返回文件信息
    return NextResponse.json({
      success: true,
      file: {
        originalName: file.name,
        storagePath: filePath,
        fileName: uniqueFileName,
        fileSize: file.size,
        mimeType: file.type,
      },
    });
  } catch (error) {
    console.error("File upload error:", error);
    return NextResponse.json(
      { error: "Internal server error during file upload" },
      { status: 500 }
    );
  }
}