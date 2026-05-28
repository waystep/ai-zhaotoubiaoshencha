import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
  customType,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ==================== 知识库枚举 ====================

/** 知识库类型 */
export const knowledgeBaseTypeEnum = pgEnum("knowledge_base_type", [
  "legal_regulation", // 法律法规
  "bid_template",     // 招标模板
  "risk_item",        // 风险条目
  "custom",           // 自定义
]);

// ==================== 向量类型（与 index.ts 保持一致） ====================

const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return process.env.VECTOR_AVAILABLE === "true" ? "vector(1536)" : "jsonb";
  },
  toDriver(value: number[]): string {
    return JSON.stringify(value);
  },
  fromDriver(value: string): number[] {
    if (typeof value === "string") {
      try { return JSON.parse(value); } catch { return []; }
    }
    return (value as unknown as number[]) || [];
  },
});

// ==================== 知识库 ====================

/** 知识库容器 */
export const knowledgeBases = pgTable("knowledge_bases", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  type: knowledgeBaseTypeEnum("type").notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 50 }),
  organizationId: uuid("organization_id").notNull(),
  isActive: boolean("is_active").default(true),
  documentCount: integer("document_count").default(0),
  totalChunks: integer("total_chunks").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/** 知识条目（通用，类型特定元数据存储在 metadata JSONB 中） */
export const knowledgeItems = pgTable("knowledge_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  knowledgeBaseId: uuid("knowledge_base_id")
    .notNull()
    .references(() => knowledgeBases.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 500 }),
  content: text("content").notNull(),
  source: varchar("source", { length: 255 }),
  metadata: jsonb("metadata"),
  tags: jsonb("tags").default([]),
  isVectorized: boolean("is_vectorized").default(false),
  chunkCount: integer("chunk_count").default(0),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/** 知识条目向量分块（用于 RAG 检索） */
export const knowledgeItemChunks = pgTable("knowledge_item_chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id")
    .notNull()
    .references(() => knowledgeItems.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  embedding: vector("embedding"),
  tokenCount: integer("token_count"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ==================== 知识库关系 ====================

export const knowledgeBasesRelations = relations(knowledgeBases, ({ many }) => ({
  items: many(knowledgeItems),
}));

export const knowledgeItemsRelations = relations(knowledgeItems, ({ one, many }) => ({
  knowledgeBase: one(knowledgeBases, {
    fields: [knowledgeItems.knowledgeBaseId],
    references: [knowledgeBases.id],
  }),
  chunks: many(knowledgeItemChunks),
}));

export const knowledgeItemChunksRelations = relations(knowledgeItemChunks, ({ one }) => ({
  item: one(knowledgeItems, {
    fields: [knowledgeItemChunks.itemId],
    references: [knowledgeItems.id],
  }),
}));
