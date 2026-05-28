import "dotenv/config";

import { getConnectionString as getNetlifyConnectionString } from "@netlify/database";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../schema";
import { seedAgents } from "./agents";
import { seedKnowledge } from "./knowledge";
import { seedModels } from "./models";

function getSeedConnectionString() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  if (process.env.NETLIFY_DB_URL) {
    return getNetlifyConnectionString();
  }

  throw new Error(
    "DATABASE_URL or NETLIFY_DB_URL is required to seed the database."
  );
}

const seedClient = postgres(getSeedConnectionString(), {
  max: 1,
  idle_timeout: 5,
  connect_timeout: 10,
});
const db = drizzle(seedClient, { schema });

async function main() {
  await seedModels(db);
  await seedAgents(db);
  await seedKnowledge(db);

  console.log("Seed completed.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await seedClient.end({ timeout: 5 });
    process.exit();
  });
