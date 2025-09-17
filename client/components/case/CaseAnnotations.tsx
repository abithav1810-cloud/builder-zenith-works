import React, { useEffect, useMemo, useRef, useState, useImperativeHandle } from "react";
import { Annotation, ArrowAnnotation, PenAnnotation, RectAnnotation, TextAnnotation, ToolType } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ArrowBigDown, ArrowBigUp, ArrowRight, Eraser, Image as ImageIcon, MousePointer, Pencil, Redo2, RectangleHorizontal, Type, Undo2 } from "lucide-react";

export function dataUrlFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export interface CaseAnnotationsProps {
  fieldsForLink: { id: string; label: string }[];
  baseImage?: string;
  onBaseImageChange: (dataUrl?: string) => void;
  annotations: Annotation[];
  onChange: (ann: Annotation[]) => void;
}

export type CaseAnnotationsHandle = { exportPNG: () => Promise<string | undefined> };

export const CaseAnnotations = React.forwardRef<CaseAnnotationsHandle, CaseAnnotationsProps>(function CaseAnnotations(
  { fieldsForLink, baseImage, onBaseImageChange, annotations, onChange }: CaseAnnotationsProps,
  ref,
) {
  const [tool, setTool] = useState<ToolType>("select");
  const [color, setColor] = useState<string>("#e11d48");
  const [size, setSize] = useState<number>(3);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [drawing, setDrawing] = useState<null | { type: ToolType; startX: number; startY: number; points?: {x:number;y:number}[] }>(null);

  const [undoStack, setUndoStack] = useState<Annotation[][]>([]);
  const [redoStack, setRedoStack] = useState<Annotation[][]>([]);

  function pushHistory(next: Annotation[]) {
    setUndoStack((s) => [...s, annotations]);
    setRedoStack([]);
    onChange(next);
  }

  function undo() {
    setUndoStack((s) => {
      if (s.length === 0) return s;
      const prev = s[s.length - 1];
      setRedoStack((r) => [...r, annotations]);
      onChange(prev);
      return s.slice(0, -1);
    });
  }

  function redo() {
    setRedoStack((r) => {
      if (r.length === 0) return r;
      const next = r[r.length - 1];
      setUndoStack((u) => [...u, annotations]);
      onChange(next);
      return r.slice(0, -1);
    });
  }

  function clearAll() {
    if (annotations.length === 0) return;
    pushHistory([]);
    setSelectedId(null);
  }

  function imageDims() {
    const img = imgRef.current;
    const cont = containerRef.current;
    if (!img || !cont) return { left: 0, top: 0, width: 1, height: 1 };
    const rect = cont.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();
    return { left: imgRect.left - rect.left, top: imgRect.top - rect.top, width: imgRect.width, height: imgRect.height };
  }

  function toNorm(x: number, y: number) {
    const { width, height, left, top } = imageDims();
    return { x: (x - left) / width, y: (y - top) / height };
  }
  function fromNorm(x: number, y: number) {
    const { width, height, left, top } = imageDims();
    return { x: left + x * width, y: top + y * height };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!baseImage) return;
    const cont = containerRef.current;
    if (!cont) return;
    const pos = { x: e.clientX, y: e.clientY };
    const n = toNorm(pos.x, pos.y);

    if (tool === "pen") {
      setDrawing({ type: "pen", startX: n.x, startY: n.y, points: [n] });
    } else if (tool === "rect") {
      setDrawing({ type: "rect", startX: n.x, startY: n.y });
    } else if (tool === "arrow") {
      setDrawing({ type: "arrow", startX: n.x, startY: n.y });
    } else if (tool === "text") {
      const id = `ann_${Math.random().toString(36).slice(2, 7)}`;
      const newAnn: TextAnnotation = { id, type: "text", x: n.x, y: n.y, text: "Note", color, size, };
      pushHistory([...annotations, newAnn]);
      setSelectedId(id);
      setEditingTextId(id);
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drawing) return;
    const pos = { x: e.clientX, y: e.clientY };
    const n = toNorm(pos.x, pos.y);
    if (drawing.type === "pen") {
      setDrawing({ ...drawing, points: [...(drawing.points || []), n] });
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!drawing) return;
    const pos = { x: e.clientX, y: e.clientY };
    const n = toNorm(pos.x, pos.y);

    if (drawing.type === "pen") {
      const id = `ann_${Math.random().toString(36).slice(2, 7)}`;
      const newAnn: PenAnnotation = { id, type: "pen", points: drawing.points || [], color, size };
      pushHistory([...annotations, newAnn]);
    } else if (drawing.type === "rect") {
      const id = `ann_${Math.random().toString(36).slice(2, 7)}`;
      const x = Math.min(drawing.startX, n.x);
      const y = Math.min(drawing.startY, n.y);
      const width = Math.abs(n.x - drawing.startX);
      const height = Math.abs(n.y - drawing.startY);
      const newAnn: RectAnnotation = { id, type: "rect", x, y, width, height, color, size };
      pushHistory([...annotations, newAnn]);
      setSelectedId(id);
    } else if (drawing.type === "arrow") {
      const id = `ann_${Math.random().toString(36).slice(2, 7)}`;
      const newAnn: ArrowAnnotation = { id, type: "arrow", x1: drawing.startX, y1: drawing.startY, x2: n.x, y2: n.y, color, size };
      pushHistory([...annotations, newAnn]);
      setSelectedId(id);
    }
    setDrawing(null);
  }

  function selectAnn(id: string) {
    setSelectedId(id);
    setEditingTextId(null);
  }

  function updateAnn(partial: Partial<Annotation>) {
    const idx = annotations.findIndex((a) => a.id === selectedId);
    if (idx < 0) return;
    const next = [...annotations];
    next[idx] = { ...next[idx], ...partial } as Annotation;
    pushHistory(next);
  }

  function onDragSelected(dx: number, dy: number) {
    if (!selectedId) return;
    const idx = annotations.findIndex((a) => a.id === selectedId);
    if (idx < 0) return;
    const a = annotations[idx];

    function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }

    let updated: Annotation = a;
    if (a.type === "rect") {
      updated = { ...a, x: clamp01(a.x + dx), y: clamp01(a.y + dy) };
    } else if (a.type === "arrow") {
      updated = { ...a, x1: clamp01(a.x1 + dx), y1: clamp01(a.y1 + dy), x2: clamp01(a.x2 + dx), y2: clamp01(a.y2 + dy) };
    } else if (a.type === "text") {
      updated = { ...a, x: clamp01(a.x + dx), y: clamp01(a.y + dy) };
    } else if (a.type === "pen") {
      updated = { ...a, points: a.points.map((p) => ({ x: clamp01(p.x + dx), y: clamp01(p.y + dy) })) };
    }
    const next = [...annotations];
    next[idx] = updated;
    pushHistory(next);
  }

  // simple dragging when on select tool
  const dragRef = useRef<null | { startX: number; startY: number }>(null);
  function onAnnPointerDown(e: React.PointerEvent, id: string) {
    if (tool !== "select") return;
    e.stopPropagation();
    selectAnn(id);
    dragRef.current = { startX: e.clientX, startY: e.clientY };
  }
  function onAnnPointerMove(e: React.PointerEvent) {
    if (!dragRef.current || tool !== "select") return;
    const { startX, startY } = dragRef.current;
    const { x, y } = toNorm(e.clientX, e.clientY);
    const { x: sx, y: sy } = toNorm(startX, startY);
    onDragSelected(x - sx, y - sy);
    dragRef.current = { startX: e.clientX, startY: e.clientY };
  }
  function onAnnPointerUp() {
    dragRef.current = null;
  }

  function removeSelected() {
    if (!selectedId) return;
    const next = annotations.filter((a) => a.id !== selectedId);
    pushHistory(next);
    setSelectedId(null);
  }

  function exportPNG(): Promise<string | undefined> {
    if (!baseImage) return Promise.resolve(undefined);
    const img = imgRef.current;
    const cont = containerRef.current;
    if (!img || !cont) return undefined;
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;
    const tempImg = new Image();
    tempImg.src = baseImage;
    return new Promise<string | undefined>((resolve) => {
      tempImg.onload = () => {
        ctx.drawImage(tempImg, 0, 0, canvas.width, canvas.height);
        // draw annotations
        annotations.forEach((a) => {
          ctx.save();
          ctx.strokeStyle = a.color;
          ctx.fillStyle = a.color;
          ctx.lineWidth = a.size;
          if (a.type === "rect") {
            ctx.strokeRect(a.x * canvas.width, a.y * canvas.height, a.width * canvas.width, a.height * canvas.height);
          } else if (a.type === "arrow") {
            const x1 = a.x1 * canvas.width, y1 = a.y1 * canvas.height, x2 = a.x2 * canvas.width, y2 = a.y2 * canvas.height;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            const angle = Math.atan2(y2 - y1, x2 - x1);
            const head = 10 + a.size * 2;
            ctx.beginPath();
            ctx.moveTo(x2, y2);
            ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
            ctx.closePath();
            ctx.fill();
          } else if (a.type === "pen") {
            const pts = a.points;
            if (pts.length > 1) {
              ctx.beginPath();
              ctx.moveTo(pts[0].x * canvas.width, pts[0].y * canvas.height);
              for (let i = 1; i < pts.length; i++) {
                ctx.lineTo(pts[i].x * canvas.width, pts[i].y * canvas.height);
              }
              ctx.stroke();
            }
          } else if (a.type === "text") {
            ctx.font = `${12 + a.size * 2}px sans-serif`;
            ctx.fillText(a.text, a.x * canvas.width, a.y * canvas.height);
          }
          ctx.restore();
        });
        resolve(canvas.toDataURL("image/png"));
      };
    });
  }

  useImperativeHandle(ref, () => ({ exportPNG }), [annotations, baseImage]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <input id="img" type="file" accept="image/*" className="hidden" onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const data = await dataUrlFromFile(file);
            onBaseImageChange(data);
          }} />
          <Label htmlFor="img" className="cursor-pointer">
            <Button variant="outline" size="sm">
              <ImageIcon className="mr-2 size-4" /> Upload Image
            </Button>
          </Label>
          {baseImage && (
            <Badge variant="secondary">Image loaded</Badge>
          )}
        </div>
        <Separator orientation="vertical" className="h-6" />
        <div className="flex items-center gap-1">
          <ToolButton icon={<MousePointer />} active={tool === "select"} onClick={() => setTool("select")} label="Select" />
          <ToolButton icon={<Pencil />} active={tool === "pen"} onClick={() => setTool("pen")} label="Pen" />
          <ToolButton icon={<RectangleHorizontal />} active={tool === "rect"} onClick={() => setTool("rect")} label="Rectangle" />
          <ToolButton icon={<ArrowRight />} active={tool === "arrow"} onClick={() => setTool("arrow")} label="Arrow" />
          <ToolButton icon={<Type />} active={tool === "text"} onClick={() => setTool("text")} label="Text" />
          <ToolButton icon={<Eraser />} active={false} onClick={removeSelected} label="Delete Selected" />
        </div>
        <Separator orientation="vertical" className="h-6" />
        <div className="flex items-center gap-2">
          <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-10 h-10 p-1" aria-label="Color" />
          <div className="w-32">
            <Slider value={[size]} min={1} max={12} step={1} onValueChange={(v) => setSize(v[0] ?? 3)} />
          </div>
        </div>
        <Separator orientation="vertical" className="h-6" />
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={undo} aria-label="Undo"><Undo2 className="size-4" /></Button>
          <Button variant="ghost" size="sm" onClick={redo} aria-label="Redo"><Redo2 className="size-4" /></Button>
          <Button variant="ghost" size="sm" onClick={clearAll}>Clear</Button>
        </div>
      </div>

      <div
        ref={containerRef}
        className={cn("relative border rounded-lg overflow-hidden bg-muted/30", !baseImage && "aspect-video grid place-items-center")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {!baseImage && (
          <div className="text-sm text-muted-foreground p-6 text-center">Upload an image (e.g., X-ray, scan) to annotate.</div>
        )}
        {baseImage && (
          <>
            <img ref={imgRef} src={baseImage} alt="Uploaded for annotation" className="block max-h-[60vh] w-auto mx-auto select-none" />
            <svg className="absolute inset-0 w-full h-full" onPointerDown={(e) => e.stopPropagation()} onPointerMove={onAnnPointerMove} onPointerUp={onAnnPointerUp}>
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" />
                </marker>
              </defs>
              {annotations.map((a) => {
                if (a.type === "rect") {
                  const p = fromNorm(a.x, a.y);
                  const p2 = fromNorm(a.x + a.width, a.y + a.height);
                  return (
                    <rect key={a.id} x={p.x} y={p.y} width={p2.x - p.x} height={p2.y - p.y} stroke={a.color} fill="transparent" strokeWidth={a.size} className={cn("cursor-move", selectedId === a.id && "opacity-90")}
                      onPointerDown={(e) => onAnnPointerDown(e, a.id)} />
                  );
                } else if (a.type === "arrow") {
                  const p1 = fromNorm(a.x1, a.y1); const p2 = fromNorm(a.x2, a.y2);
                  return (
                    <line key={a.id} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={a.color} strokeWidth={a.size} markerEnd="url(#arrowhead)" className="cursor-move" onPointerDown={(e) => onAnnPointerDown(e, a.id)} />
                  );
                } else if (a.type === "pen") {
                  const d = a.points.map((pt, i) => {
                    const p = fromNorm(pt.x, pt.y);
                    return `${i === 0 ? "M" : "L"}${p.x},${p.y}`;
                  }).join(" ");
                  return (
                    <path key={a.id} d={d} stroke={a.color} strokeWidth={a.size} fill="none" className="cursor-move" onPointerDown={(e) => onAnnPointerDown(e, a.id)} />
                  );
                } else if (a.type === "text") {
                  const p = fromNorm(a.x, a.y);
                  return (
                    <g key={a.id} onPointerDown={(e) => onAnnPointerDown(e, a.id)} className="cursor-move">
                      <text x={p.x} y={p.y} fontSize={12 + a.size * 2} fill={a.color}>
                        {a.text}
                      </text>
                    </g>
                  );
                }
              })}
            </svg>
            {/* Inline editor for text */}
            {editingTextId && (
              (() => {
                const a = annotations.find((x) => x.id === editingTextId) as TextAnnotation | undefined;
                if (!a) return null;
                const p = fromNorm(a.x, a.y);
                return (
                  <input
                    className="absolute bg-background border rounded px-2 py-1 text-sm"
                    style={{ left: p.x, top: p.y }}
                    value={a.text}
                    onChange={(e) => updateAnn({ text: e.target.value } as any)}
                    onBlur={() => setEditingTextId(null)}
                    autoFocus
                  />
                );
              })()
            )}
          </>
        )}
      </div>

      {selectedId && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Link to field:</span>
          <Select onValueChange={(v) => updateAnn({ linkedFieldId: v })}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Select field" /></SelectTrigger>
            <SelectContent>
              {fieldsForLink.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground ml-auto">Selected: {selectedId}</span>
        </div>
      )}
    </div>
  );
});

function ToolButton({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant={active ? "secondary" : "ghost"} size="sm" onClick={onClick} aria-label={label}>
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
