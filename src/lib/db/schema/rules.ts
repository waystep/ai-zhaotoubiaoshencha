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
import { agentDefinitions } from "./models";

// ==================== 规则集枚举 ====================

/** 检测类型 */
export const ruleDetectionTypeEnum = pgEnum("rule_detection_type", [
  "keyword",    // 关键词检测
  "comparison", // 比较检测
  "semantic",   // 语义检测
  "existence",  // 存在性检测
]);

// ==================== 规则集 ====================

/** 规则集容器 */
export const ruleSets = pgTable("rule_sets", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  industry: varchar("industry", { length: 100 }),
  agentId: uuid("agent_id")
    .references(() => agentDefinitions.id, { onDelete: "set null" }),
  isActive: boolean("is_active").default(true),
  organizationId: uuid("organization_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/** 规则条目 */
export const ruleItems = pgTable("rule_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  ruleSetId: uuid("rule_set_id")
    .notNull()
    .references(() => ruleSets.id, { onDelete: "cascade" }),
  ruleNo: varchar("rule_no", { length: 20 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  detectionType: ruleDetectionTypeEnum("detection_type"),
  severity: varchar("severity", { length: 10 }).notNull(),
  description: text("description").notNull(),
  parameters: jsonb("parameters"),
  isEnabled: boolean("is_enabled").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// ==================== 规则集关系 ====================

export const ruleSetsRelations = relations(ruleSets, ({ one, many }) => ({
  agent: one(agentDefinitions, {
    fields: [ruleSets.agentId],
    references: [agentDefinitions.id],
  }),
  rules: many(ruleItems),
}));

export const ruleItemsRelations = relations(ruleItems, ({ one }) => ({
  ruleSet: one(ruleSets, {
    fields: [ruleItems.ruleSetId],
    references: [ruleSets.id],
  }),
}));
