import { and, eq } from "drizzle-orm";
import type { Database } from "../client";
import { aiModels } from "../schema";

const DEFAULT_MODELS = [
  {
    name: "本地-Qwen3.6-27B",
    modelType: "local" as const,
    provider: "ollama",
    modelId: "qwen3:27b",
    endpoint: "http://localhost:11434",
    capabilities: ["text", "reasoning"],
    maxTokens: 4096,
  },
  {
    name: "本地-Qwen2.5-VL-7B",
    modelType: "multimodal" as const,
    provider: "ollama",
    modelId: "qwen2.5-vl:7b",
    endpoint: "http://localhost:11434",
    capabilities: ["text", "vision"],
    maxTokens: 4096,
  },
] as const;

export async function seedModels(db: Database) {
  console.log("Seeding default local models...");

  for (const model of DEFAULT_MODELS) {
    const existing = await db.query.aiModels.findFirst({
      where: and(
        eq(aiModels.modelId, model.modelId),
        eq(aiModels.provider, model.provider),
      ),
    });

    if (existing) {
      console.log(`  Model [${model.modelId}] ${model.name} already exists, skipping.`);
      continue;
    }

    await db.insert(aiModels).values({
      name: model.name,
      modelType: model.modelType,
      provider: model.provider,
      modelId: model.modelId,
      endpoint: model.endpoint,
      capabilities: model.capabilities,
      maxTokens: model.maxTokens,
      isActive: true,
    });

    console.log(`  Model [${model.modelId}] ${model.name} inserted.`);
  }

  console.log(`Default models seeded (${DEFAULT_MODELS.length} total).`);
}
