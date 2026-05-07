import { z } from "zod";

export type AgentStatus = "draft" | "published" | "archived";

export interface AgentTool {
  name: string;
  description: string;
  parameters: z.ZodSchema;
  category: "database" | "http" | "file" | "ai" | "custom";
}

export interface AgentGraphDefinition {
  nodes: AgentNode[];
  edges: AgentEdge[];
}

export interface AgentNode {
  id: string;
  type: "llm" | "tool" | "condition" | "memory" | "knowledge" | "start" | "end";
  position: { x: number; y: number };
  data: LLMNodeData | ToolNodeData | ConditionNodeData | MemoryNodeData;
}

export interface LLMNodeData {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface ToolNodeData {
  toolName: string;
  parameters?: Record<string, unknown>;
}

export interface ConditionNodeData {
  conditions: {
    field: string;
    operator: "equals" | "contains" | "gt" | "lt";
    value: unknown;
  }[];
}

export interface MemoryNodeData {
  memoryType: "short_term" | "long_term" | "vector";
  maxItems?: number;
}

export interface AgentEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}

export interface AgentExecution {
  id: string;
  agentId: string;
  userId?: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  status: "running" | "completed" | "failed";
  error?: string;
  tokensUsed?: number;
  startedAt: Date;
  completedAt?: Date;
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}
