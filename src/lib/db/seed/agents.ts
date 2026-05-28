import { eq } from "drizzle-orm";
import type { Database } from "../client";
import { agentDefinitions } from "../schema";

const PRESET_AGENTS = [
  {
    agentKey: "A1",
    name: "招标文件解析",
    description:
      "按规则拆解招标文件，提取审查项、评分标准、资质要求等结构化数据，自动扫描法规引用并验证",
    category: "parsing",
    icon: "FileSearch",
    defaultConfig: { temperature: 0.1, maxTokens: 4096 },
  },
  {
    agentKey: "A2",
    name: "投标文件生成",
    description:
      "基于招标解析结果和知识库模板，生成投标文件 v1.0 样稿",
    category: "generation",
    icon: "FilePlus",
    defaultConfig: { temperature: 0.7, maxTokens: 8192 },
  },
  {
    agentKey: "A3",
    name: "投标预审",
    description:
      "多维度风险检测，结合规则集和法规验证，输出风险项列表",
    category: "review",
    icon: "ShieldCheck",
    defaultConfig: { temperature: 0.1, maxTokens: 4096 },
  },
  {
    agentKey: "A4",
    name: "风险定位",
    description:
      "在投标文件原文中精准定位风险项位置（页码/段落/块坐标）",
    category: "review",
    icon: "Crosshair",
    defaultConfig: { temperature: 0.1, maxTokens: 2048 },
  },
  {
    agentKey: "A5",
    name: "法律法规解析",
    description:
      "检索法律法规库最新条款，验证引用是否过期或错误",
    category: "parsing",
    icon: "Scale",
    defaultConfig: { temperature: 0.1, maxTokens: 2048 },
  },
  {
    agentKey: "A6",
    name: "投标分析报告",
    description:
      "汇总审查结果，生成结构化预审报告（评分、统计、建议）",
    category: "report",
    icon: "FileBarChart",
    defaultConfig: { temperature: 0.3, maxTokens: 8192 },
  },
  {
    agentKey: "A7",
    name: "投标文件解析",
    description:
      "结构化提取投标文件的章节、内容和关键信息",
    category: "parsing",
    icon: "FileText",
    defaultConfig: { temperature: 0.1, maxTokens: 4096 },
  },
] as const;

export async function seedAgents(db: Database) {
  console.log("Seeding preset agent definitions...");

  for (const agent of PRESET_AGENTS) {
    const existing = await db.query.agentDefinitions.findFirst({
      where: eq(agentDefinitions.agentKey, agent.agentKey),
    });

    if (existing) {
      console.log(`  Agent [${agent.agentKey}] ${agent.name} already exists, skipping.`);
      continue;
    }

    await db.insert(agentDefinitions).values({
      agentKey: agent.agentKey,
      name: agent.name,
      description: agent.description,
      category: agent.category,
      icon: agent.icon,
      defaultConfig: agent.defaultConfig,
      isPreset: true,
    });

    console.log(`  Agent [${agent.agentKey}] ${agent.name} inserted.`);
  }

  console.log(`Preset agents seeded (${PRESET_AGENTS.length} total).`);
}
