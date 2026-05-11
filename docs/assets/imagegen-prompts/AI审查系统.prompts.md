# AI审查系统配图提示词

## ai-review-agent-collaboration.png

- 目标文档: `docs/modules/AI审查系统.md`
- 插入小节: `2.2 协作流程图`
- 用途: 概览 AI 审查系统中各 Agent 的协作链路。
- 最终 prompt:

```text
Use case: infographic-diagram
Asset type: technical documentation overview image
Primary request: Create a 16:9 AI review agent collaboration overview for a tender compliance review platform.
Scene/backdrop: white documentation canvas with subtle grid lines.
Subject: a Supervisor Agent orchestration lane at the top, flowing into specialist agents: Extraction Agent, Content Review Agent, Image Review Agent, and Report Generation Agent. Show inputs as tender documents and outputs as issues, scores, and recommendations.
Style/medium: polished flat SaaS architecture infographic, crisp vector-like bitmap.
Composition/framing: wide landscape, process lanes with arrows, central emphasis on Supervisor.
Lighting/mood: bright, precise, professional.
Color palette: white, light gray, blue, teal, small red/orange issue markers.
Text (verbatim): "Supervisor Agent", "提取 Agent", "内容审查 Agent", "图像审查 Agent", "报告生成 Agent", "问题"
Constraints: use Chinese for all non-technical labels, keep only established technical terms in English such as Supervisor Agent and Agent; short readable labels only, no long paragraphs, no logos, no watermark.
Avoid: photorealistic people, chat bubbles as the main focus, dense unreadable labels, dark theme.
```

## ai-image-review-agent.png

- 目标文档: `docs/modules/AI审查系统.md`
- 插入小节: `3.4 image-review-agent`
- 用途: 展示 image-review-agent 对图表、印章、签字和图片清晰度的审查能力。
- 最终 prompt:

```text
Use case: infographic-diagram
Asset type: technical documentation overview image
Primary request: Create a 16:9 capability overview for an image review agent in a tender document compliance system.
Scene/backdrop: clean white technical canvas with subtle grid.
Subject: central AI vision review module inspecting document image blocks. Around it show four concise visual checks: chart data, stamp integrity, signature validity, image clarity. Include an output panel for detected issues.
Style/medium: flat enterprise technical infographic, vector-like bitmap, clean UI-inspired shapes.
Composition/framing: central module with four surrounding capability cards and one output stream.
Lighting/mood: bright, analytical, trustworthy.
Color palette: white, light gray, blue and teal accents, small amber/red issue markers.
Text (verbatim): "图像审查 Agent", "图表", "印章", "签字", "清晰度", "问题"
Constraints: use Chinese for all non-technical labels, keep only established technical terms in English such as Agent; short readable labels only, no long text, no logos, no watermark.
Avoid: realistic official seals, real signatures, sensitive personal data, clutter, dark theme.
```
