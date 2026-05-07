export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "email"
  | "phone"
  | "date"
  | "datetime"
  | "select"
  | "radio"
  | "checkbox"
  | "switch"
  | "file"
  | "image"
  | "richText"
  | "divider"
  | "reference";

export type FormStatus = "draft" | "published" | "archived";

export type FormSubmission = {
  id: string;
  formId: string;
  data: Record<string, unknown>;
  submittedBy?: string;
  createdAt: Date;
};
