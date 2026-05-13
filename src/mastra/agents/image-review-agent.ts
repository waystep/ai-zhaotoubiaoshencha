// 图像风险分析智能体 - 分析图片内容，识别潜在风险，返回结构化结果
import { Agent } from "@mastra/core/agent";

export const imageReviewAgent = new Agent({
  id: "image-review-agent",
  name: "图像风险分析专家",
  description: `分析图片内容，识别潜在风险并返回结构化数据。

输出：
{
  "hasRisk": true,
  "riskType": "企业Logo",
  "riskText": "某某建设集团",
  "confidence": 0.82,
  "reason": "图片右上角存在企业标识及企业名称"
}

风险类型：企业Logo、水印、印章、签名、资质证书、技术图纸等
`,
  instructions: `
分析图片是否存在招标审查风险，只输出JSON。

风险类型：LOGO（企业标识）、其他项目名称

输出格式：
{"hasRisk":true/false,"riskType":"类型","riskText":"风险文字","confidence":0.85}

规则：
- 只报告明确可见的风险，不做推测
- reason/suggestion 不要输出，保持精简
- 无风险返回 {"hasRisk":false}
`,
  model: process.env.ALIBABA_CODING_PLAN_API_KEY
    ? "alibaba-coding-plan-cn/qwen3.6-plus"
    : "alibaba/qwen3.6-plus",
  tools: {},
});

// 辅助函数：读取图片并分析
export async function analyzeImage(imagePath: string, mimeType: string = "image/jpeg") {
  const fs = await import("fs");
  const imageBuffer = fs.readFileSync(imagePath);

  const result = await imageReviewAgent.generate([
    {
      role: "user",
      content: [
        { type: "image", image: imageBuffer, mimeType },
        { type: "text", text: "分析这张图片是否存在招标审查风险，输出结构化JSON结果。" },
      ],
    },
  ]);

  return result;
}