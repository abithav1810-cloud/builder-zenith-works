import { useMemo, useState } from "react";
import { FieldDefinition, FieldType, FieldValue } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

export interface CaseFieldsProps {
  fields: FieldDefinition[];
  values: Record<string, FieldValue>;
  onChangeFields: (fields: FieldDefinition[]) => void;
  onChangeValue: (id: string, value: FieldValue) => void;
  suggestions?: Record<string, string[]>;
}

export function CaseFields({ fields, values, onChangeFields, onChangeValue, suggestions }: CaseFieldsProps) {
  const [showConfig, setShowConfig] = useState(false);

  function move(id: string, dir: -1 | 1) {
    const idx = fields.findIndex((f) => f.id === id);
    if (idx < 0) return;
    const newIndex = idx + dir;
    if (newIndex < 0 || newIndex >= fields.length) return;
    const copy = [...fields];
    const [item] = copy.splice(idx, 1);
    copy.splice(newIndex, 0, item);
    onChangeFields(copy);
  }

  function remove(id: string) {
    onChangeFields(fields.filter((f) => f.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Case Details</h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowConfig((s) => !s)}>
            <Plus className="size-4" /> Add Field
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map((f) => (
          <FieldRow
            key={f.id}
            field={f}
            value={values[f.id]}
            onChange={(v) => onChangeValue(f.id, v)}
            onMoveUp={() => move(f.id, -1)}
            onMoveDown={() => move(f.id, 1)}
            onRemove={() => remove(f.id)}
            suggestions={suggestions?.[f.id]}
          />
        ))}
      </div>
      {showConfig && (
        <FieldEditor
          onClose={() => setShowConfig(false)}
          onAdd={(created) => {
            onChangeFields([...fields, created]);
            setShowConfig(false);
          }}
        />
      )}
    </div>
  );
}

function FieldRow({
  field,
  value,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  field: FieldDefinition;
  value: FieldValue;
  onChange: (v: FieldValue) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  suggestions?: string[];
}) {
  const required = field.required;
  const label = (
    <div className="flex items-center gap-2">
      <Label htmlFor={field.id}>{field.label}</Label>
      {required && <Badge variant="secondary">Required</Badge>}
      {field.unit && <Badge variant="outline">{field.unit}</Badge>}
    </div>
  );

  const invalid = field.required && (
    value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)
  );

  return (
    <Card className="border-muted/60">
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {label}
        </CardTitle>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Move up" onClick={onMoveUp}>
                <ArrowUp />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Move up</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Move down" onClick={onMoveDown}>
                <ArrowDown />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Move down</TooltipContent>
          </Tooltip>
          <Separator orientation="vertical" className="mx-1 h-6" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Remove" onClick={onRemove}>
                <Trash2 className="text-destructive" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Remove</TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className={cn(invalid && "ring-2 ring-destructive/40 rounded-md p-1")}>
          <FieldInput field={field} value={value} onChange={onChange} />
        </div>
        {invalid && (
          <p className="mt-2 text-xs text-destructive">This field is required.</p>
        )}
        {field.helpText && (
          <p className="mt-2 text-xs text-muted-foreground">{field.helpText}</p>
        )}
        {suggestions && suggestions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <Button key={s} size="sm" variant="outline" onClick={() => onChange(s)}>
                {s}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDefinition;
  value: FieldValue;
  onChange: (v: FieldValue) => void;
}) {
  const commonProps = {
    id: field.id,
    placeholder: field.placeholder,
    "aria-required": field.required || undefined,
  } as const;

  switch (field.type) {
    case "text":
      return (
        <Input
          {...commonProps}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "textarea":
      return (
        <Textarea
          {...commonProps}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
        />
      );
    case "number":
      return (
        <Input
          {...commonProps}
          type="number"
          value={value === undefined || value === null ? "" : String(value)}
          min={field.min}
          max={field.max}
          step={field.step}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === "" ? undefined : Number(v));
          }}
        />
      );
    case "date":
      return (
        <Input
          {...commonProps}
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "select":
      return (
        <Select
          value={(value as string) ?? ""}
          onValueChange={(v) => onChange(v)}
        >
          <SelectTrigger id={field.id}>
            <SelectValue placeholder={field.placeholder ?? "Select"} />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "multiselect":
      return (
        <div className="flex flex-wrap gap-2">
          {field.options?.map((opt) => {
            const arr = (value as string[]) ?? [];
            const checked = arr.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  const next = checked
                    ? arr.filter((v) => v !== opt.value)
                    : [...arr, opt.value];
                  onChange(next);
                }}
                className={cn(
                  "px-3 py-1 rounded-md border text-sm",
                  checked ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent",
                )}
                aria-pressed={checked}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      );
    case "checkbox":
      return (
        <div className="flex flex-wrap gap-3">
          {field.options?.map((opt) => {
            const arr = (value as string[]) ?? [];
            const checked = arr.includes(opt.value);
            return (
              <label key={opt.value} className="inline-flex items-center gap-2">
                <Switch
                  checked={checked}
                  onCheckedChange={(c) => {
                    const next = c
                      ? [...arr, opt.value]
                      : arr.filter((v) => v !== opt.value);
                    onChange(next);
                  }}
                  aria-label={opt.label}
                />
                <span>{opt.label}</span>
              </label>
            );
          })}
        </div>
      );
    default:
      return null;
  }
}

function FieldEditor({ onClose, onAdd }: { onClose: () => void; onAdd: (f: FieldDefinition) => void }) {
  const [type, setType] = useState<FieldType>("text");
  const [label, setLabel] = useState("");
  const [id, setId] = useState("");
  const [required, setRequired] = useState(false);
  const [placeholder, setPlaceholder] = useState("");
  const [sensitive, setSensitive] = useState(false);
  const [options, setOptions] = useState<string>("");

  function handleAdd() {
    const baseId = id || label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    const def: FieldDefinition = {
      id: baseId || `field_${Math.random().toString(36).slice(2, 7)}`,
      label: label || "Untitled",
      type,
      required,
      placeholder: placeholder || undefined,
      sensitive,
      options: (type === "select" || type === "multiselect" || type === "checkbox")
        ? options
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
            .map((s) => ({ label: s, value: s.toLowerCase().replace(/\s+/g, "-") }))
        : undefined,
    };
    onAdd(def);
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <h4 className="font-semibold mb-3">Add Field</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="fe_label">Label</Label>
          <Input id="fe_label" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="fe_id">Field ID</Label>
          <Input id="fe_id" value={id} onChange={(e) => setId(e.target.value)} placeholder="auto" />
        </div>
        <div>
          <Label htmlFor="fe_type">Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as FieldType)}>
            <SelectTrigger id="fe_type"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(["text","textarea","number","date","select","multiselect","checkbox"] as FieldType[]).map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3 mt-6">
          <Switch checked={required} onCheckedChange={setRequired} id="fe_required" />
          <Label htmlFor="fe_required">Required</Label>
          <Switch checked={sensitive} onCheckedChange={setSensitive} id="fe_sensitive" />
          <Label htmlFor="fe_sensitive">Sensitive</Label>
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="fe_placeholder">Placeholder</Label>
          <Input id="fe_placeholder" value={placeholder} onChange={(e) => setPlaceholder(e.target.value)} />
        </div>
        {(type === "select" || type === "multiselect" || type === "checkbox") && (
          <div className="md:col-span-2">
            <Label htmlFor="fe_options">Options (one per line)</Label>
            <Textarea id="fe_options" value={options} onChange={(e) => setOptions(e.target.value)} rows={4} />
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={handleAdd}>Add</Button>
      </div>
    </div>
  );
}
