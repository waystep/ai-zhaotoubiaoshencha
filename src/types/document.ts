import { z } from "zod";

// 文档类型
export type DocType =
  | "tender_doc"     // 招标文件
  | "legal_doc"      // 法律文件
  | "bid_doc"        // 投标文件
  | "review_report"; // 审查报告

// 解析状态
export type ParseStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

// 文档信息
export interface Document {
  id: string;
  projectId: string;
  uploadedBy: string;
  docType: DocType;
  name: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  parseStatus: ParseStatus;
  parseError?: string;
  parsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 文档解析结果
export interface DocumentParsedResult {
  id: string;
  documentId: string;
  totalPages: number;
  fullText?: string;
  structuredContent?: Record<string, unknown>;
  mineruRawData?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// 文档区块 - 用于精确定位
export interface DocumentBlock {
  id: string;
  parsedResultId: string;
  pageNumber: number;
  blockIndex: number;
  blockType?: string;  // text, table, title, paragraph
  content: string;
  bbox?: BoundingBox;
  parentBlockId?: string;
  createdAt: Date;
}

// 边界框坐标
export interface BoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

// 上传文档 Schema
export const uploadDocumentSchema = z.object({
  projectId: z.string().uuid(),
  docType: z.enum(["tender_doc", "legal_doc", "bid_doc", "review_report"]),
  name: z.string().optional(),
});