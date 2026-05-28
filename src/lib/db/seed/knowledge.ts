import { and, eq } from "drizzle-orm";
import type { Database } from "../client";
import {
  agentDefinitions,
  knowledgeBases,
  organizations,
  ruleItems,
  ruleSets,
} from "../schema";

// ==================== 默认知识库 ====================

const DEFAULT_KNOWLEDGE_BASES = [
  {
    name: "法律法规库",
    type: "legal_regulation" as const,
    icon: "Scale",
    description: "国家法律、行业法规、地方规章、国标/行标",
  },
  {
    name: "企业模板库",
    type: "bid_template" as const,
    icon: "FileStack",
    description: "投标函模板、技术标模板、商务标模板、资信标模板",
  },
  {
    name: "风险项库",
    type: "risk_item" as const,
    icon: "AlertTriangle",
    description: "废标风险项、格式风险项、合规风险项、业绩风险项",
  },
] as const;

// ==================== 基础废标检测规则 ====================

const DEFAULT_RULES = [
  {
    ruleNo: "R001",
    name: "投标函签字盖章检查",
    detectionType: "existence" as const,
    severity: "high",
    description: "检查投标函是否有法定代表人或授权代表签字并加盖公章",
    sortOrder: 1,
  },
  {
    ruleNo: "R002",
    name: "投标有效期检查",
    detectionType: "comparison" as const,
    severity: "high",
    description: "投标有效期不得少于招标文件要求的天数",
    sortOrder: 2,
  },
  {
    ruleNo: "R003",
    name: "保证金金额检查",
    detectionType: "comparison" as const,
    severity: "high",
    description: "投标保证金金额必须与招标文件要求一致",
    sortOrder: 3,
  },
  {
    ruleNo: "R004",
    name: "资质证书有效期",
    detectionType: "comparison" as const,
    severity: "medium",
    description: "资质证书必须在有效期内",
    sortOrder: 4,
  },
  {
    ruleNo: "R005",
    name: "技术方案完整性",
    detectionType: "semantic" as const,
    severity: "medium",
    description: "技术方案应覆盖招标文件中所有评分项",
    sortOrder: 5,
  },
] as const;

// ==================== Seed 函数 ====================

export async function seedKnowledge(db: Database) {
  console.log("Seeding default knowledge bases and review rules...");

  // 查询所有组织
  const allOrgs = await db.query.organizations.findMany();

  if (allOrgs.length === 0) {
    console.log("  No organizations found. Skipping knowledge base and rule seeding.");
    return;
  }

  // 查找 A3 (投标预审) 智能体
  const a3Agent = await db.query.agentDefinitions.findFirst({
    where: eq(agentDefinitions.agentKey, "A3"),
  });

  if (!a3Agent) {
    console.log("  Agent A3 (投标预审) not found. Rule set seeding will be skipped.");
  }

  for (const org of allOrgs) {
    console.log(`  Seeding for organization: ${org.name} (${org.id})`);

    // --- 为每个组织创建默认知识库 ---
    for (const kb of DEFAULT_KNOWLEDGE_BASES) {
      const existing = await db.query.knowledgeBases.findFirst({
        where: and(
          eq(knowledgeBases.organizationId, org.id),
          eq(knowledgeBases.name, kb.name),
        ),
      });

      if (existing) {
        console.log(`    Knowledge base [${kb.name}] already exists, skipping.`);
        continue;
      }

      await db.insert(knowledgeBases).values({
        name: kb.name,
        type: kb.type,
        icon: kb.icon,
        description: kb.description,
        organizationId: org.id,
        isActive: true,
        documentCount: 0,
        totalChunks: 0,
      });

      console.log(`    Knowledge base [${kb.name}] inserted.`);
    }

    // --- 为 A3 创建基础废标检测规则集 ---
    if (a3Agent) {
      const existingRuleSet = await db.query.ruleSets.findFirst({
        where: and(
          eq(ruleSets.organizationId, org.id),
          eq(ruleSets.agentId, a3Agent.id),
          eq(ruleSets.name, "基础废标检测规则"),
        ),
      });

      if (existingRuleSet) {
        console.log(`    Rule set [基础废标检测规则] already exists, skipping.`);
        continue;
      }

      const [newRuleSet] = await db
        .insert(ruleSets)
        .values({
          name: "基础废标检测规则",
          description: "投标预审基础规则集，覆盖签字盖章、有效期、保证金、资质、技术方案等关键检测项",
          agentId: a3Agent.id,
          organizationId: org.id,
          isActive: true,
        })
        .returning();

      // 插入规则条目
      for (const rule of DEFAULT_RULES) {
        await db.insert(ruleItems).values({
          ruleSetId: newRuleSet.id,
          ruleNo: rule.ruleNo,
          name: rule.name,
          detectionType: rule.detectionType,
          severity: rule.severity,
          description: rule.description,
          isEnabled: true,
          sortOrder: rule.sortOrder,
        });
      }

      console.log(
        `    Rule set [基础废标检测规则] inserted with ${DEFAULT_RULES.length} rules.`
      );
    }
  }

  console.log(
    `Knowledge seed completed (${allOrgs.length} org(s), ${DEFAULT_KNOWLEDGE_BASES.length} knowledge bases, ${DEFAULT_RULES.length} rules).`
  );
}
