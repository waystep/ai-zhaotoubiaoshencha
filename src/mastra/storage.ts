// Mastra Storage 配置 - 避免循环依赖
import { PostgresStore, PgVector } from "@mastra/pg";
import { getConnectionString as getNetlifyConnectionString } from "@netlify/database";

function getConnectionString() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  if (process.env.NETLIFY_DB_URL) {
    return getNetlifyConnectionString();
  }

  if (process.env.NEXT_PHASE === "phase-production-build") {
    return "postgresql://build:build@localhost:5432/build";
  }

  throw new Error("DATABASE_URL is required for Mastra storage");
}

const connectionString = getConnectionString();

// ========== PostgreSQL Storage 配置 ==========
// 使用已有的DATABASE_URL（与主应用共享数据库）
export const pgStore = new PostgresStore({
  id: "mastra-storage",
  connectionString,
});

// ========== PostgreSQL Vector Store（用于语义搜索）==========
export const pgVector = new PgVector({
  id: "mastra-vector",
  connectionString,
});
