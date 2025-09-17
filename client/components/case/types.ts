export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "select"
  | "multiselect"
  | "checkbox";

export interface FieldOption {
  label: string;
  value: string;
}

export interface FieldDefinition {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: FieldOption[]; // for select/multiselect/checkbox groups
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  sensitive?: boolean; // mark to exclude on export if desired
}

export type FieldValue =
  | string
  | number
  | boolean
  | string[]
  | null
  | undefined;

export type SpecializationKey = "cardiology" | "orthopedics" | "neurology" | "custom";

export interface CaseSheetTemplate {
  id: SpecializationKey | string;
  name: string;
  description?: string;
  fields: FieldDefinition[];
  suggestions?: Record<string, string[]>; // key: field id
}

export type ToolType = "select" | "pen" | "rect" | "arrow" | "text" | "erase";

export interface BaseAnnotation {
  id: string;
  type: ToolType;
  color: string; // hex
  size: number; // stroke width or font size
  linkedFieldId?: string; // link to a field for context
}

export interface PenAnnotation extends BaseAnnotation {
  type: "pen";
  points: { x: number; y: number }[];
  opacity?: number;
}

export interface RectAnnotation extends BaseAnnotation {
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ArrowAnnotation extends BaseAnnotation {
  type: "arrow";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface TextAnnotation extends BaseAnnotation {
  type: "text";
  x: number;
  y: number;
  text: string;
}

export type Annotation = PenAnnotation | RectAnnotation | ArrowAnnotation | TextAnnotation;

export interface CaseSheetData {
  specialization: SpecializationKey | string;
  templateId: string;
  fields: FieldDefinition[];
  values: Record<string, FieldValue>;
  baseImage?: string; // data URL
  annotations: Annotation[];
  lastUpdated: number;
}
