import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { CaseFields } from "./CaseFields";
import { ExportPanel } from "./ExportPanel";
import { defaultTemplates } from "./templates";
import { Annotation, CaseSheetData, FieldDefinition, FieldValue, SpecializationKey } from "./types";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Download, Sparkles } from "lucide-react";

const templates = defaultTemplates;

export default function CaseSheet() {
  const [saved, setSaved] = useLocalStorage<CaseSheetData | null>("case_sheet", null);
  const initial = useMemo<CaseSheetData>(() => {
    const tpl = templates[0];
    return saved ?? {
      specialization: tpl.id,
      templateId: tpl.id,
      fields: tpl.fields,
      values: {},
      baseImage: undefined,
      annotations: [],
      lastUpdated: Date.now(),
    };
  }, []);

  const [specialization, setSpecialization] = useState<string>(initial.specialization);
  const [fields, setFields] = useState<FieldDefinition[]>(initial.fields);
  const [values, setValues] = useState<Record<string, FieldValue>>(initial.values);
  const [baseImage, setBaseImage] = useState<string | undefined>(initial.baseImage);
  const [annotations, setAnnotations] = useState<Annotation[]>(initial.annotations);

  useEffect(() => {
    const data: CaseSheetData = {
      specialization,
      templateId: String(specialization),
      fields,
      values,
      baseImage,
      annotations,
      lastUpdated: Date.now(),
    };
    setSaved(data);
  }, [specialization, fields, values, baseImage, annotations]);

  function applyTemplate(id: string) {
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    setSpecialization(tpl.id);
    setFields(tpl.fields);
    setValues({});
  }

  function onChangeValue(id: string, value: FieldValue) {
    setValues((v) => ({ ...v, [id]: value }));
  }

  const fieldOptions = fields.map((f) => ({ id: f.id, label: f.label }));
  const currentTemplate = templates.find((t) => String(t.id) === String(specialization));

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-cyan-50 to-teal-50">
      <header className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded bg-primary/10 grid place-items-center text-primary font-bold">MD</div>
            <div>
              <h1 className="text-base font-semibold leading-tight">CaseSheets MD</h1>
              <p className="text-xs text-muted-foreground">Doctor Case Sheet</p>
            </div>
          </div>
          <Separator orientation="vertical" className="h-8" />
          <div className="flex items-center gap-2">
            <Label htmlFor="spec" className="text-sm">Specialization</Label>
            <Select value={specialization} onValueChange={applyTemplate}>
              <SelectTrigger id="spec" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Badge variant="secondary" className="hidden sm:inline-flex">Autosaved</Badge>
            <Button variant="outline" size="sm"><Sparkles className="mr-2 size-4" /> Templates</Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 print:px-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-sm">
            <CardContent className="p-4 sm:p-6">
              <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="details">Case Details</TabsTrigger>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                </TabsList>
                <TabsContent value="details" className="space-y-4 mt-4">
                  <CaseFields
                    fields={fields}
                    values={values}
                    onChangeFields={setFields}
                    onChangeValue={onChangeValue}
                    suggestions={currentTemplate?.suggestions}
                  />
                </TabsContent>
                <TabsContent value="notes" className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="general_notes">General Notes</Label>
                    <Input id="general_notes" placeholder="e.g., Follow-up reminders, lifestyle advice" onChange={(e) => onChangeValue("general_notes", e.target.value)} />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <ExportPanel
            caseData={{ specialization, templateId: String(specialization), fields, values, baseImage, annotations, lastUpdated: Date.now() }}
            fieldsForLink={fieldOptions}
            onUpdateImage={setBaseImage}
            onUpdateAnnotations={setAnnotations}
            onImportCase={(data) => {
              setSpecialization(data.specialization);
              setFields(data.fields);
              setValues(data.values);
              setAnnotations(data.annotations);
              setBaseImage(data.baseImage);
            }}
          />
        </div>
      </main>
    </div>
  );
}
