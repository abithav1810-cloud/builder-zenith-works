import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CaseAnnotations, CaseAnnotationsHandle } from "./CaseAnnotations";
import { Annotation, CaseSheetData, FieldDefinition } from "./types";

export interface ExportPanelProps {
  caseData: CaseSheetData;
  fieldsForLink: { id: string; label: string }[];
  onUpdateImage: (dataUrl?: string) => void;
  onUpdateAnnotations: (a: Annotation[]) => void;
}

export function ExportPanel({ caseData, fieldsForLink, onUpdateImage, onUpdateAnnotations }: ExportPanelProps) {
  const annRef = useRef<CaseAnnotationsHandle>(null);
  const [includeSensitive, setIncludeSensitive] = useState(false);
  const [includeImage, setIncludeImage] = useState(true);
  const [includeAnnotations, setIncludeAnnotations] = useState(true);

  async function downloadJSON() {
    const payload: CaseSheetData = {
      ...caseData,
      fields: caseData.fields.map((f) => ({ ...f })),
      values: Object.fromEntries(
        Object.entries(caseData.values).filter(([id]) => includeSensitive || !caseData.fields.find((f) => f.id === id)?.sensitive),
      ),
      baseImage: includeImage ? caseData.baseImage : undefined,
      annotations: includeAnnotations ? caseData.annotations : [],
      lastUpdated: Date.now(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `case_${caseData.specialization}_${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadPNG() {
    const dataUrl = await annRef.current?.exportPNG();
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `annotations_${new Date().toISOString()}.png`;
    a.click();
  }

  function print() {
    window.print();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Visual Aids & Export</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <CaseAnnotations
          ref={annRef}
          fieldsForLink={fieldsForLink}
          baseImage={caseData.baseImage}
          onBaseImageChange={onUpdateImage}
          annotations={caseData.annotations}
          onChange={onUpdateAnnotations}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
          <div className="flex items-center gap-2">
            <Switch id="sens" checked={includeSensitive} onCheckedChange={setIncludeSensitive} />
            <Label htmlFor="sens">Include sensitive details</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="img" checked={includeImage} onCheckedChange={setIncludeImage} />
            <Label htmlFor="img">Include images</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="ann" checked={includeAnnotations} onCheckedChange={setIncludeAnnotations} />
            <Label htmlFor="ann">Include annotations</Label>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={downloadJSON}>Export JSON</Button>
          <Button variant="outline" onClick={downloadPNG}>Export Annotated Image (PNG)</Button>
          <Button variant="ghost" onClick={print}>Print / Save as PDF</Button>
        </div>
      </CardContent>
    </Card>
  );
}
