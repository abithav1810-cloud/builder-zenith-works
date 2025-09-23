import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { CaseAnnotations, CaseAnnotationsHandle } from "./CaseAnnotations";
import { Annotation, CaseSheetData, FieldDefinition } from "./types";
import { Download, FileText, Image, Printer, Upload } from "lucide-react";

export interface ExportPanelProps {
  caseData: CaseSheetData;
  fieldsForLink: { id: string; label: string }[];
  onUpdateImage: (dataUrl?: string) => void;
  onUpdateAnnotations: (a: Annotation[]) => void;
  onImportCase: (data: CaseSheetData) => void;
}

export function ExportPanel({ caseData, fieldsForLink, onUpdateImage, onUpdateAnnotations, onImportCase }: ExportPanelProps) {
  const annRef = useRef<CaseAnnotationsHandle>(null);
  const [includeSensitive, setIncludeSensitive] = useState(false);
  const [includeImage, setIncludeImage] = useState(true);
  const [includeAnnotations, setIncludeAnnotations] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  async function downloadJSON() {
    setIsExporting(true);
    try {
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
      a.download = `case_${caseData.specialization}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
      
      toast({
        title: "Export successful",
        description: "Case data exported as JSON file",
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export failed",
        description: "Failed to export case data",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  }

  async function downloadPNG() {
    setIsExporting(true);
    try {
    const dataUrl = await annRef.current?.exportPNG();
      if (!dataUrl) {
        toast({
          title: "Export failed",
          description: "No annotated image to export",
          variant: "destructive",
        });
        return;
      }
      
    const a = document.createElement("a");
    a.href = dataUrl;
      a.download = `annotations_${caseData.specialization}_${new Date().toISOString().split('T')[0]}.png`;
    a.click();
      
      toast({
        title: "Export successful",
        description: "Annotated image exported as PNG file",
      });
    } catch (error) {
      console.error("PNG export error:", error);
      toast({
        title: "Export failed",
        description: "Failed to export annotated image",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  }

  function print() {
    try {
      window.print();
      toast({
        title: "Print dialog opened",
        description: "Use your browser's print dialog to save as PDF or print",
      });
    } catch (error) {
      console.error("Print error:", error);
      toast({
        title: "Print failed",
        description: "Failed to open print dialog",
        variant: "destructive",
      });
    }
  }

  async function importJSON(file: File) {
    try {
      const text = await file.text();
      const data = JSON.parse(text) as CaseSheetData;
      
      // Validate the imported data structure
      if (!data.specialization || !data.fields || !Array.isArray(data.fields)) {
        throw new Error("Invalid case data format");
      }
      
      onImportCase(data);
      toast({
        title: "Import successful",
        description: `Imported case data for ${data.specialization}`,
      });
    } catch (error) {
      console.error("Import error:", error);
      toast({
        title: "Import failed",
        description: "Failed to import case data. Please check the file format.",
        variant: "destructive",
      });
    }
  }

  const sensitiveFieldsCount = caseData.fields.filter(f => f.sensitive).length;
  const totalFieldsCount = caseData.fields.length;
  const annotationsCount = caseData.annotations.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="size-5" />
          Visual Aids & Export
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Visual Aids Section */}
        <CaseAnnotations
          ref={annRef}
          fieldsForLink={fieldsForLink}
          baseImage={caseData.baseImage}
          onBaseImageChange={onUpdateImage}
          annotations={caseData.annotations}
          onChange={onUpdateAnnotations}
        />

        <Separator />
        
        {/* Export Options */}
        <div>
          <h4 className="font-medium mb-3">Export Options</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <Switch 
                id="sens" 
                checked={includeSensitive} 
                onCheckedChange={setIncludeSensitive} 
              />
              <Label htmlFor="sens" className="text-sm">
                Include sensitive data
                {sensitiveFieldsCount > 0 && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    {sensitiveFieldsCount}/{totalFieldsCount} fields
                  </Badge>
                )}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                id="img" 
                checked={includeImage} 
                onCheckedChange={setIncludeImage} 
              />
              <Label htmlFor="img" className="text-sm">
                Include images
                {caseData.baseImage && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    1 image
                  </Badge>
                )}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                id="ann" 
                checked={includeAnnotations} 
                onCheckedChange={setIncludeAnnotations} 
              />
              <Label htmlFor="ann" className="text-sm">
                Include annotations
                {annotationsCount > 0 && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    {annotationsCount} annotations
                  </Badge>
                )}
              </Label>
            </div>
          </div>
        </div>
        
        <Separator />
        
        {/* Export Actions */}
        <div>
          <h4 className="font-medium mb-3">Export & Import</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {/* Import */}
            <div>
              <input 
                id="import_json" 
                type="file" 
                accept="application/json,.json" 
                className="hidden" 
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importJSON(f);
                  // Reset input value to allow importing the same file again
                  e.target.value = '';
                }} 
              />
              <Label htmlFor="import_json" className="w-full">
                <Button variant="outline" className="w-full" disabled={isExporting}>
                  <Upload className="mr-2 size-4" />
                  Import JSON
                </Button>
              </Label>
            </div>
            
            {/* Export JSON */}
            <Button 
              onClick={downloadJSON} 
              disabled={isExporting || totalFieldsCount === 0}
              className="w-full"
            >
              <Download className="mr-2 size-4" />
              Export JSON
            </Button>
            
            {/* Export PNG */}
            <Button 
              variant="outline" 
              onClick={downloadPNG} 
              disabled={isExporting || !caseData.baseImage}
              className="w-full"
            >
              <Image className="mr-2 size-4" />
              Export PNG
            </Button>
            
            {/* Print/PDF */}
            <Button 
              variant="ghost" 
              onClick={print}
              disabled={isExporting}
              className="w-full"
            >
              <Printer className="mr-2 size-4" />
              Print / PDF
            </Button>
          </div>
        </div>
        
        {/* Export Summary */}
        {(totalFieldsCount > 0 || annotationsCount > 0 || caseData.baseImage) && (
          <div className="flex items-center gap-2">
            <div className="text-xs text-muted-foreground">
              Export will include: {totalFieldsCount} fields
              {caseData.baseImage && includeImage && ", 1 image"}
              {annotationsCount > 0 && includeAnnotations && `, ${annotationsCount} annotations`}
              {sensitiveFieldsCount > 0 && !includeSensitive && ` (${sensitiveFieldsCount} sensitive fields excluded)`}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
