import { drizzle } from "drizzle-orm/postgres-js";
import { getConnectionString as getNetlifyConnectionString } from "@netlify/database";
import postgres from "postgres";
import * as schema from "./schema";

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

  throw new Error("DATABASE_URL or NETLIFY_DB_URL is required.");
}

const connectionString = getConnectionString();

const client = postgres(connectionString, {
  max: 10,            // 最大连接数
  idle_timeout: 20,   // 空闲连接 20 秒后释放
  connect_timeout: 10,
});
export const db = drizzle(client, { schema });

export type Database = typeof db;
