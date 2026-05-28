/**
 * Webhook Schema
 *
 * Webhook configuration and delivery log tables for the M7 integration
 * output module. Webhooks are triggered by analysis pipeline events
 * (analysis.completed, review.completed, report.completed, draft.generated)
 * and push structured JSON payloads to registered external endpoints.
 */

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
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations, users, tenderProjects } from "./index";

// ==================== Webhook 枚举 ====================

/** Webhook 事件类型 */
export const webhookEvents = pgEnum("webhook_event", [
  "analysis.completed",   // A1 招标解析完成
  "draft.generated",      // A2 投标样稿生成完成
  "review.completed",     // A3 投标预审完成
  "report.completed",     // A6 分析报告完成
]);

// ==================== Webhook 配置表 ====================

/**
 * Stores webhook endpoint configurations.
 * Each webhook subscribes to one or more events and defines
 * the target URL, optional HMAC secret, custom headers, and retry policy.
 */
export const webhooks = pgTable("webhooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  url: text("url").notNull(),
  secret: varchar("secret", { length: 255 }),               // HMAC 签名密钥
  events: jsonb("events").$type<string[]>().notNull(),       // 订阅的事件列表
  headers: jsonb("headers"),                                  // 自定义请求头 { "key": "value" }
  isActive: boolean("is_active").default(true),
  retryCount: integer("retry_count").default(3),
  organizationId: uuid("organization_id")
    .references(() => organizations.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by")
    .references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

// ==================== Webhook 推送日志表 ====================

/**
 * Stores delivery attempt logs for each webhook dispatch.
 * Includes request/response details for debugging and monitoring.
 */
export const webhookDeliveryLogs = pgTable("webhook_delivery_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  webhookId: uuid("webhook_id")
    .notNull()
    .references(() => webhooks.id, { onDelete: "cascade" }),
  event: webhookEvents("event").notNull(),
  projectId: uuid("project_id")
    .references(() => tenderProjects.id, { onDelete: "set null" }),
  requestPayload: jsonb("request_payload"),
  responseStatus: integer("response_status"),
  responseBody: text("response_body"),
  durationMs: integer("duration_ms"),
  success: boolean("success"),
  attemptCount: integer("attempt_count").default(1),
  nextRetryAt: timestamp("next_retry_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

// ==================== Webhook 关系 ====================

export const webhooksRelations = relations(webhooks, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [webhooks.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [webhooks.createdBy],
    references: [users.id],
  }),
  deliveryLogs: many(webhookDeliveryLogs),
}));

export const webhookDeliveryLogsRelations = relations(webhookDeliveryLogs, ({ one }) => ({
  webhook: one(webhooks, {
    fields: [webhookDeliveryLogs.webhookId],
    references: [webhooks.id],
  }),
  project: one(tenderProjects, {
    fields: [webhookDeliveryLogs.projectId],
    references: [tenderProjects.id],
  }),
}));
