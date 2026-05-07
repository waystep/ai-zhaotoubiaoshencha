import type { FieldType } from "@/types/forms";

export interface ValidationRule {
  type: "required" | "min" | "max" | "pattern" | "custom";
  value?: string | number;
  message: string;
}

export interface ConditionalLogic {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "not_empty";
  value: unknown;
}

export interface FieldAppearance {
  width: number;
  order: number;
}

export interface FieldSchema {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  defaultValue?: unknown;
  helpText?: string;
  options?: { label: string; value: string }[];
  validation: ValidationRule[];
  appearance: FieldAppearance;
  condition?: ConditionalLogic;
}

export interface FormSchema {
  fields: FieldSchema[];
  layout?: {
    type: "single-column" | "two-column" | "three-column";
  };
}

export const FIELD_TYPES: Record<FieldType, { label: string; icon: string }> = {
  text: { label: "文本", icon: "Type" },
  textarea: { label: "多行文本", icon: "AlignLeft" },
  number: { label: "数字", icon: "Hash" },
  email: { label: "邮箱", icon: "Mail" },
  phone: { label: "电话", icon: "Phone" },
  date: { label: "日期", icon: "Calendar" },
  datetime: { label: "日期时间", icon: "Clock" },
  select: { label: "下拉选择", icon: "ChevronDown" },
  radio: { label: "单选", icon: "Circle" },
  checkbox: { label: "多选", icon: "CheckSquare" },
  switch: { label: "开关", icon: "ToggleLeft" },
  file: { label: "文件上传", icon: "Upload" },
  image: { label: "图片上传", icon: "Image" },
  richText: { label: "富文本", icon: "FileText" },
  divider: { label: "分隔线", icon: "Minus" },
  reference: { label: "关联字段", icon: "Link" },
};

export function createField(
  type: FieldType,
  overrides?: Partial<FieldSchema>
): FieldSchema {
  return {
    id: `field_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    type,
    label: FIELD_TYPES[type]?.label || type,
    placeholder: "",
    defaultValue: undefined,
    validation: [],
    appearance: {
      width: 12,
      order: 0,
    },
    ...overrides,
  };
}

export function validateField(
  value: unknown,
  rules: ValidationRule[]
): { valid: boolean; message?: string } {
  for (const rule of rules) {
    switch (rule.type) {
      case "required":
        if (
          value === undefined ||
          value === null ||
          value === "" ||
          (Array.isArray(value) && value.length === 0)
        ) {
          return { valid: false, message: rule.message };
        }
        break;
      case "min":
        if (typeof value === "string" && value.length < (rule.value as number)) {
          return { valid: false, message: rule.message };
        }
        if (typeof value === "number" && value < (rule.value as number)) {
          return { valid: false, message: rule.message };
        }
        break;
      case "max":
        if (typeof value === "string" && value.length > (rule.value as number)) {
          return { valid: false, message: rule.message };
        }
        if (typeof value === "number" && value > (rule.value as number)) {
          return { valid: false, message: rule.message };
        }
        break;
      case "pattern":
        if (
          typeof value === "string" &&
          !(rule.value as string) &&
          !new RegExp(rule.value as string).test(value)
        ) {
          return { valid: false, message: rule.message };
        }
        break;
    }
  }
  return { valid: true };
}

export function validateForm(
  data: Record<string, unknown>,
  schema: FormSchema
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  for (const field of schema.fields) {
    if (field.condition && !evaluateCondition(data, field.condition)) {
      continue;
    }

    const result = validateField(data[field.id], field.validation);
    if (!result.valid) {
      errors[field.id] = result.message || "Invalid field value";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

function evaluateCondition(
  data: Record<string, unknown>,
  condition: ConditionalLogic
): boolean {
  const value = data[condition.field];
  switch (condition.operator) {
    case "equals":
      return value === condition.value;
    case "not_equals":
      return value !== condition.value;
    case "contains":
      return String(value).includes(String(condition.value));
    case "not_empty":
      return value !== undefined && value !== null && value !== "";
    default:
      return true;
  }
}
