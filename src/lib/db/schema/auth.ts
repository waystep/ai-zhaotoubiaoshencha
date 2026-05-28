import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./index";
import { smsPurposeEnum, loginMethodEnum } from "./enums";

// ==================== 认证扩展枚举 ====================

// enums are defined in ./enums.ts to avoid circular imports

// ==================== 认证扩展表 ====================

/** 手机短信验证码 */
export const smsVerificationCodes = pgTable("sms_verification_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  phone: varchar("phone", { length: 20 }).notNull(),
  code: varchar("code", { length: 10 }).notNull(),
  purpose: smsPurposeEnum("purpose").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at").defaultNow(),
});

/** 第三方身份绑定（OAuth / SSO） */
export const userOAuthIdentities = pgTable("user_oauth_identities", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 50 }).notNull(),           // feishu / wechat / sso_saml / sso_oidc
  providerAccountId: text("provider_account_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  profileData: jsonb("profile_data").default({}),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/** SSO 配置（按组织维度） */
export const ssoConfigurations = pgTable("sso_configurations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id"),  // 留空表示全局配置
  name: varchar("name", { length: 255 }).notNull(),
  protocol: varchar("protocol", { length: 20 }).notNull(),           // saml / oidc
  config: jsonb("config").notNull().default({}),                     // 协议相关配置（endpoint, cert 等）
  fieldMappings: jsonb("field_mappings").default({}),                // 字段映射（provider 字段 → 本系统字段）
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/** 登录日志 */
export const loginLogs = pgTable("login_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "set null" }),
  loginMethod: loginMethodEnum("login_method").notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  success: boolean("success").notNull().default(true),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

/** 登录锁定（防暴力破解） */
export const loginLockouts = pgTable("login_lockouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  identifier: varchar("identifier", { length: 255 }).notNull(),      // 可以是 email / phone / ip
  failCount: integer("fail_count").notNull().default(0),
  lockedUntil: timestamp("locked_until"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ==================== 认证扩展关系 ====================

export const userOAuthIdentitiesRelations = relations(userOAuthIdentities, ({ one }) => ({
  user: one(users, {
    fields: [userOAuthIdentities.userId],
    references: [users.id],
  }),
}));

export const loginLogsRelations = relations(loginLogs, ({ one }) => ({
  user: one(users, {
    fields: [loginLogs.userId],
    references: [users.id],
  }),
}));
