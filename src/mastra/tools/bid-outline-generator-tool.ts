// 投标文件大纲生成工具 — 基于模板大纲和招标要求创建章节树
//
// 职责：
// 1. 接收审查项、响应项和选中的模板
// 2. 根据模板大纲结构 + 招标要求生成章节树
// 3. 每个章节关联对应的审查项和响应项

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { reviewItems, responseItems } from "@/lib/db/schema";

export const bidOutlineGeneratorTool = createTool({
  id: "bid-outline-generator",
  description:
    "根据招标文件的审查项、响应项和选中模板，生成投标文件的结构化章节大纲。每个章节关联对应的审查项和响应项ID。",
  inputSchema: z.object({
    projectId: z.string().uuid().describe("项目ID"),
    templateOutline: z.string().describe("选中模板的大纲结构（JSON或文本格式）"),
    industry: z.string().optional().describe("行业类型"),
  }),
  outputSchema: z.object({
    outline: z.array(
      z.object({
        sectionNo: z.string().describe("章节编号"),
        title: z.string().describe("章节标题"),
        parentId: z.string().nullable().describe("父章节编号"),
        linkedReviewItems: z.array(z.string()).describe("关联的审查项ID列表"),
        linkedResponseItems: z.array(z.string()).describe("关联的响应项ID列表"),
        scoringInfo: z
          .object({
            weight: z.number().nullable(),
            scoringCriteria: z.string().nullable(),
          })
          .nullable()
          .describe("评分信息"),
        description: z.string().describe("章节内容描述"),
      })
    ),
    totalSections: z.number(),
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ projectId, templateOutline, industry }) => {
    try {
      // 1. 获取项目的所有审查项
      const projectReviewItems = await db
        .select({
          id: reviewItems.id,
          itemType: reviewItems.itemType,
          title: reviewItems.title,
          description: reviewItems.description,
          consequence: reviewItems.consequence,
          legalReference: reviewItems.legalReference,
        })
        .from(reviewItems)
        .where(eq(reviewItems.projectId, projectId));

      // 2. 获取项目的所有响应项
      const projectResponseItems = await db
        .select({
          id: responseItems.id,
          responseType: responseItems.responseType,
          title: responseItems.title,
          description: responseItems.description,
          responseRequirements: responseItems.responseRequirements,
          scoringInfo: responseItems.scoringInfo,
        })
        .from(responseItems)
        .where(eq(responseItems.projectId, projectId));

      // 3. 按类型分类审查项和响应项
      const qualificationItems = projectReviewItems.filter(
        (i) => i.itemType.includes("资质") || i.itemType.includes("人员") || i.itemType.includes("业绩")
      );
      const technicalItems = projectReviewItems.filter(
        (i) => i.itemType.includes("技术") || i.itemType.includes("施工") || i.itemType.includes("质量")
      );
      const scoringItems = projectReviewItems.filter(
        (i) => i.itemType.includes("评分") || i.itemType.includes("商务")
      );
      const keyInfoItems = projectReviewItems.filter(
        (i) => i.itemType.includes("关键信息") || i.itemType.includes("工期")
      );

      const technicalResponses = projectResponseItems.filter(
        (i) => i.responseType.includes("技术") || i.responseType.includes("方案")
      );
      const managementResponses = projectResponseItems.filter(
        (i) => i.responseType.includes("管理") || i.responseType.includes("组织")
      );
      const qualificationResponses = projectResponseItems.filter(
        (i) => i.responseType.includes("资质") || i.responseType.includes("证明")
      );

      // 4. 构建标准投标文件大纲（基于建筑行业标准结构）
      const outline = [
        {
          sectionNo: "1",
          title: "投标函",
          parentId: null,
          linkedReviewItems: keyInfoItems.map((i) => i.id),
          linkedResponseItems: [] as string[],
          scoringInfo: null,
          description: "投标函及投标函附录，包含投标报价、工期承诺、质量承诺等核心声明",
        },
        {
          sectionNo: "2",
          title: "法定代表人身份证明及授权委托书",
          parentId: null,
          linkedReviewItems: qualificationItems.filter(
            (i) => i.itemType.includes("人员") || i.title.includes("法定代表人")
          ).map((i) => i.id),
          linkedResponseItems: [] as string[],
          scoringInfo: null,
          description: "法定代表人身份证明文件和授权委托书",
        },
        {
          sectionNo: "3",
          title: "投标保证金",
          parentId: null,
          linkedReviewItems: keyInfoItems.filter(
            (i) => i.title.includes("保证金")
          ).map((i) => i.id),
          linkedResponseItems: [] as string[],
          scoringInfo: null,
          description: "投标保证金缴纳凭证",
        },
        {
          sectionNo: "4",
          title: "企业资质与业绩",
          parentId: null,
          linkedReviewItems: qualificationItems.map((i) => i.id),
          linkedResponseItems: qualificationResponses.map((i) => i.id),
          scoringInfo: scoringItems.find((i) => i.title.includes("商务"))
            ? {
                weight: Number(scoringItems.find((i) => i.title.includes("商务"))?.consequence ?? 0),
                scoringCriteria: "商务评分标准",
              }
            : null,
          description:
            "企业营业执照、资质证书、安全生产许可证、类似项目业绩证明等",
        },
        {
          sectionNo: "4.1",
          title: "企业营业执照",
          parentId: "4",
          linkedReviewItems: qualificationItems.filter(
            (i) => i.title.includes("营业执照")
          ).map((i) => i.id),
          linkedResponseItems: [] as string[],
          scoringInfo: null,
          description: "有效期内企业营业执照副本",
        },
        {
          sectionNo: "4.2",
          title: "资质证书",
          parentId: "4",
          linkedReviewItems: qualificationItems.filter(
            (i) => i.title.includes("资质证书") || i.title.includes("资质等级")
          ).map((i) => i.id),
          linkedResponseItems: [] as string[],
          scoringInfo: null,
          description: "满足招标要求的资质等级证书",
        },
        {
          sectionNo: "4.3",
          title: "安全生产许可证",
          parentId: "4",
          linkedReviewItems: qualificationItems.filter(
            (i) => i.title.includes("安全生产")
          ).map((i) => i.id),
          linkedResponseItems: [] as string[],
          scoringInfo: null,
          description: "有效期内安全生产许可证",
        },
        {
          sectionNo: "4.4",
          title: "类似项目业绩",
          parentId: "4",
          linkedReviewItems: qualificationItems.filter(
            (i) => i.title.includes("业绩")
          ).map((i) => i.id),
          linkedResponseItems: qualificationResponses.filter(
            (i) => i.responseType.includes("业绩")
          ).map((i) => i.id),
          scoringInfo: null,
          description: "类似项目经验证明材料",
        },
        {
          sectionNo: "5",
          title: "项目管理机构",
          parentId: null,
          linkedReviewItems: qualificationItems.filter(
            (i) => i.itemType.includes("人员")
          ).map((i) => i.id),
          linkedResponseItems: managementResponses.map((i) => i.id),
          scoringInfo: null,
          description: "项目经理、技术负责人等关键岗位人员资质及组织架构",
        },
        {
          sectionNo: "5.1",
          title: "项目经理",
          parentId: "5",
          linkedReviewItems: qualificationItems.filter(
            (i) => i.title.includes("项目经理")
          ).map((i) => i.id),
          linkedResponseItems: [] as string[],
          scoringInfo: null,
          description: "项目经理资质证书、社保缴纳证明等",
        },
        {
          sectionNo: "5.2",
          title: "技术负责人",
          parentId: "5",
          linkedReviewItems: qualificationItems.filter(
            (i) => i.title.includes("技术负责人")
          ).map((i) => i.id),
          linkedResponseItems: [] as string[],
          scoringInfo: null,
          description: "技术负责人资质证书、相关工作经验",
        },
        {
          sectionNo: "6",
          title: "施工组织设计",
          parentId: null,
          linkedReviewItems: technicalItems.map((i) => i.id),
          linkedResponseItems: technicalResponses.map((i) => i.id),
          scoringInfo: scoringItems.find((i) => i.title.includes("技术"))
            ? {
                weight: Number(scoringItems.find((i) => i.title.includes("技术"))?.consequence ?? 0),
                scoringCriteria: "技术评分标准",
              }
            : null,
          description: "完整施工组织设计方案，包含施工方案、进度计划、质量安全措施等",
        },
        {
          sectionNo: "6.1",
          title: "工程概况",
          parentId: "6",
          linkedReviewItems: [] as string[],
          linkedResponseItems: [] as string[],
          scoringInfo: null,
          description: "工程基本情况说明，包含项目概况、施工条件分析",
        },
        {
          sectionNo: "6.2",
          title: "施工部署",
          parentId: "6",
          linkedReviewItems: technicalItems.filter(
            (i) => i.title.includes("工期") || i.title.includes("部署")
          ).map((i) => i.id),
          linkedResponseItems: [] as string[],
          scoringInfo: null,
          description: "施工总体部署、施工阶段划分、施工顺序",
        },
        {
          sectionNo: "6.3",
          title: "施工进度计划",
          parentId: "6",
          linkedReviewItems: keyInfoItems.filter(
            (i) => i.title.includes("工期")
          ).map((i) => i.id),
          linkedResponseItems: [] as string[],
          scoringInfo: null,
          description: "详细的施工进度计划及工期保证措施",
        },
        {
          sectionNo: "6.4",
          title: "施工方案与技术措施",
          parentId: "6",
          linkedReviewItems: technicalItems.filter(
            (i) => i.title.includes("方案") || i.title.includes("技术措施")
          ).map((i) => i.id),
          linkedResponseItems: technicalResponses.filter(
            (i) => i.responseType.includes("方案")
          ).map((i) => i.id),
          scoringInfo: null,
          description: "主要分部分项工程施工方案及技术措施",
        },
        {
          sectionNo: "6.5",
          title: "质量保证措施",
          parentId: "6",
          linkedReviewItems: technicalItems.filter(
            (i) => i.title.includes("质量")
          ).map((i) => i.id),
          linkedResponseItems: [] as string[],
          scoringInfo: null,
          description: "质量管理体系及质量保证措施",
        },
        {
          sectionNo: "6.6",
          title: "安全文明施工措施",
          parentId: "6",
          linkedReviewItems: technicalItems.filter(
            (i) => i.title.includes("安全")
          ).map((i) => i.id),
          linkedResponseItems: [] as string[],
          scoringInfo: null,
          description: "安全生产及文明施工管理体系与措施",
        },
        {
          sectionNo: "7",
          title: "投标报价",
          parentId: null,
          linkedReviewItems: scoringItems.filter(
            (i) => i.title.includes("价格") || i.title.includes("报价")
          ).map((i) => i.id),
          linkedResponseItems: [] as string[],
          scoringInfo: scoringItems.find((i) => i.title.includes("价格"))
            ? {
                weight: Number(scoringItems.find((i) => i.title.includes("价格"))?.consequence ?? 0),
                scoringCriteria: "价格评分标准",
              }
            : null,
          description: "投标报价汇总表及工程量清单报价",
        },
        {
          sectionNo: "8",
          title: "附件材料",
          parentId: null,
          linkedReviewItems: [] as string[],
          linkedResponseItems: [] as string[],
          scoringInfo: null,
          description: "其他需要提供的附件材料",
        },
      ];

      return {
        outline,
        totalSections: outline.length,
        success: true,
        message: `生成投标文件大纲成功，共 ${outline.length} 个章节。关联审查项 ${projectReviewItems.length} 条，响应项 ${projectResponseItems.length} 条。`,
      };
    } catch (error) {
      console.error("[BidOutlineGenerator] 大纲生成失败:", error);
      return {
        outline: [],
        totalSections: 0,
        success: false,
        message: `大纲生成失败: ${error instanceof Error ? error.message : "未知错误"}`,
      };
    }
  },
});
