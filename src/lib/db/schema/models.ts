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
import { users, organizations, tenderProjects } from "./index";

// ==================== 模型管理枚举 ====================

/** AI 模型类型 */
export const modelTypeEnum = pgEnum("model_type", [
  "local",       // 本地部署模型（如 Ollama）
  "cloud",       // 云端 API 模型（如 DeepSeek、智谱、OpenAI）
  "multimodal",  // 多模态模型（支持图文）
]);

// ==================== AI 模型注册表 ====================

export const aiModels = pgTable("ai_models", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  modelType: modelTypeEnum("model_type").notNull(),
  provider: varchar("provider", { length: 100 }).notNull(),  // ollama/zhipu/deepseek/openai 等
  modelId: varchar("model_id", { length: 255 }).notNull(),   // 如 "qwen3:27b", "glm-5.1"
  endpoint: text("endpoint").notNull(),
  apiKey: text("api_key"),
  capabilities: jsonb("capabilities").default([]),
  costPerKInputTokens: integer("cost_per_k_input_tokens"),
  costPerKOutputTokens: integer("cost_per_k_output_tokens"),
  maxTokens: integer("max_tokens").default(4096),
  isActive: boolean("is_active").default(true),
  organizationId: uuid("organization_id")
    .references(() => organizations.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ==================== 预设智能体定义 ====================

export const agentDefinitions = pgTable("agent_definitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentKey: varchar("agent_key", { length: 50 }).notNull().unique(),  // 如 "A1"-"A7"
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 50 }),
  category: varchar("category", { length: 50 }),  // parsing/generation/review/report
  defaultConfig: jsonb("default_config").notNull(),  // {temperature: 0.1, maxTokens: 4096}
  isPreset: boolean("is_preset").default(true),
  organizationId: uuid("organization_id")
    .references(() => organizations.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
});

// ==================== 智能体-模型绑定 ====================

export const agentModelBindings = pgTable("agent_model_bindings", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agentDefinitions.id, { onDelete: "cascade" }),
  modelId: uuid("model_id")
    .notNull()
    .references(() => aiModels.id, { onDelete: "cascade" }),
  isPrimary: boolean("is_primary").default(true),
  customConfig: jsonb("custom_config"),
  organizationId: uuid("organization_id")
    .references(() => organizations.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ==================== 预设模式 ====================

export const presetModes = pgTable("preset_modes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  bindings: jsonb("bindings").notNull(),  // {agentKey: modelId}
  isActive: boolean("is_active").default(false),
  organizationId: uuid("organization_id")
    .references(() => organizations.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
});

// ==================== 调用日志 ====================

export const agentCallLogs = pgTable("agent_call_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  projectId: uuid("project_id")
    .references(() => tenderProjects.id, { onDelete: "set null" }),
  agentId: uuid("agent_id")
    .references(() => agentDefinitions.id, { onDelete: "set null" }),
  modelId: uuid("model_id")
    .references(() => aiModels.id, { onDelete: "set null" }),
  runLocation: varchar("run_location", { length: 10 }).notNull(),  // local/cloud
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  durationMs: integer("duration_ms"),
  status: varchar("status", { length: 20 }).notNull(),  // success/failed/timeout
  errorMessage: text("error_message"),
  triggerType: varchar("trigger_type", { length: 20 }).default("manual"),  // manual/workflow
  createdAt: timestamp("created_at").defaultNow(),
});

// ==================== 模型管理关系 ====================

export const aiModelsRelations = relations(aiModels, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [aiModels.organizationId],
    references: [organizations.id],
  }),
  agentBindings: many(agentModelBindings),
  callLogs: many(agentCallLogs),
}));

export const agentDefinitionsRelations = relations(agentDefinitions, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [agentDefinitions.organizationId],
    references: [organizations.id],
  }),
  modelBindings: many(agentModelBindings),
  callLogs: many(agentCallLogs),
}));

export const agentModelBindingsRelations = relations(agentModelBindings, ({ one }) => ({
  agent: one(agentDefinitions, {
    fields: [agentModelBindings.agentId],
    references: [agentDefinitions.id],
  }),
  model: one(aiModels, {
    fields: [agentModelBindings.modelId],
    references: [aiModels.id],
  }),
  organization: one(organizations, {
    fields: [agentModelBindings.organizationId],
    references: [organizations.id],
  }),
}));

export const presetModesRelations = relations(presetModes, ({ one }) => ({
  organization: one(organizations, {
    fields: [presetModes.organizationId],
    references: [organizations.id],
  }),
}));

export const agentCallLogsRelations = relations(agentCallLogs, ({ one }) => ({
  user: one(users, {
    fields: [agentCallLogs.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [agentCallLogs.organizationId],
    references: [organizations.id],
  }),
  project: one(tenderProjects, {
    fields: [agentCallLogs.projectId],
    references: [tenderProjects.id],
  }),
  agent: one(agentDefinitions, {
    fields: [agentCallLogs.agentId],
    references: [agentDefinitions.id],
  }),
  model: one(aiModels, {
    fields: [agentCallLogs.modelId],
    references: [aiModels.id],
  }),
}));
