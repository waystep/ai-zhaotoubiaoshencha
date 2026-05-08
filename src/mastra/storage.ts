// Mastra Storage 配置 - 避免循环依赖
import { PostgresStore, PgVector } from "@mastra/pg";

// ========== PostgreSQL Storage 配置 ==========
// 使用已有的DATABASE_URL（与主应用共享数据库）
export const pgStore = new PostgresStore({
  id: "mastra-storage",
  connectionString: process.env.DATABASE_URL!,
});

// ========== PostgreSQL Vector Store（用于语义搜索）==========
export const pgVector = new PgVector({
  id: "mastra-vector",
  connectionString: process.env.DATABASE_URL!,
});