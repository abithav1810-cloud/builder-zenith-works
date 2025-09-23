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
import { ArrowBigDown, ArrowBigUp, ArrowRight, Eraser, Image as ImageIcon, MousePointer, Pencil, Redo2, RectangleHorizontal, Type, Undo2, X, Plus, Minus, Copy } from "lucide-react";

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
  const svgRef = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [drawing, setDrawing] = useState<null | { 
    type: ToolType; 
    startX: number; 
    startY: number; 
    points?: {x:number;y:number}[];
    currentX?: number;
    currentY?: number;
  }>(null);

  const [undoStack, setUndoStack] = useState<Annotation[][]>([]);
  const [redoStack, setRedoStack] = useState<Annotation[][]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [zoom, setZoom] = useState(1);
  const dragRef = useRef<{
    mode: "move" | "resizeRect" | "arrowStart" | "arrowEnd";
    id: string;
    corner?: "nw" | "ne" | "sw" | "se";
    prevX: number;
    prevY: number;
  } | null>(null);

  function pushHistory(next: Annotation[]) {
    setUndoStack((s) => [...s, annotations]);
    setRedoStack([]);
    onChange(next);
  }

  function undo() {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack((r) => [...r, annotations]);
    onChange(prev);
    setUndoStack((s) => s.slice(0, -1));
  }

  function redo() {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((u) => [...u, annotations]);
    onChange(next);
    setRedoStack((r) => r.slice(0, -1));
  }

  function clearAll() {
    if (annotations.length === 0) return;
    pushHistory([]);
    setSelectedId(null);
    setEditingTextId(null);
  }

  function removeImage() {
    onBaseImageChange(undefined);
    pushHistory([]);
    setSelectedId(null);
    setEditingTextId(null);
  }

  function clamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(max, v));
  }

  function imageDims() {
    const img = imgRef.current;
    const cont = containerRef.current;
    if (!img || !cont) return { left: 0, top: 0, width: 1, height: 1 };
    const rect = cont.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();
    return { 
      left: imgRect.left - rect.left, 
      top: imgRect.top - rect.top, 
      width: imgRect.width, 
      height: imgRect.height 
    };
  }

  function toNorm(clientX: number, clientY: number) {
    const cont = containerRef.current;
    if (!cont) return { x: 0, y: 0 };
    const rect = cont.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const { width, height, left, top } = imageDims();
    return { 
      x: Math.max(0, Math.min(1, (x - left) / width)), 
      y: Math.max(0, Math.min(1, (y - top) / height)) 
    };
  }

  function fromNorm(x: number, y: number) {
    const { width, height, left, top } = imageDims();
    return { x: left + x * width, y: top + y * height };
  }

  function getAnnotationAt(clientX: number, clientY: number): string | null {
    const norm = toNorm(clientX, clientY);
    
    // Check annotations in reverse order (top to bottom)
    for (let i = annotations.length - 1; i >= 0; i--) {
      const a = annotations[i];
      const tolerance = 0.02; // 2% tolerance for selection
      
      if (a.type === "rect") {
        if (norm.x >= a.x - tolerance && norm.x <= a.x + a.width + tolerance &&
            norm.y >= a.y - tolerance && norm.y <= a.y + a.height + tolerance) {
          return a.id;
        }
      } else if (a.type === "text") {
        if (Math.abs(norm.x - a.x) < tolerance && Math.abs(norm.y - a.y) < tolerance) {
          return a.id;
        }
      } else if (a.type === "arrow") {
        // Check if point is near the line
        const dist = distanceToLine(norm.x, norm.y, a.x1, a.y1, a.x2, a.y2);
        if (dist < tolerance) {
          return a.id;
        }
      } else if (a.type === "pen") {
        // Check if point is near any segment of the pen stroke
        for (let j = 0; j < a.points.length - 1; j++) {
          const dist = distanceToLine(norm.x, norm.y, a.points[j].x, a.points[j].y, a.points[j + 1].x, a.points[j + 1].y);
          if (dist < tolerance) {
            return a.id;
          }
        }
      }
    }
    return null;
  }

  function distanceToLine(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;
    let xx, yy;
    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }
    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!baseImage) return;
    e.preventDefault();
    
    const norm = toNorm(e.clientX, e.clientY);

    if (tool === "select") {
      const hitId = getAnnotationAt(e.clientX, e.clientY);
      if (hitId) {
        setSelectedId(hitId);
        const a = annotations.find(x => x.id === hitId)!;
        const cont = containerRef.current!;
        const rect = cont.getBoundingClientRect();
        const localX = e.clientX - rect.left;
        const localY = e.clientY - rect.top;

        let started = false;
        if (a.type === "rect") {
          const p1 = fromNorm(a.x, a.y);
          const p2 = fromNorm(a.x + a.width, a.y + a.height);
          const handles = [
            { corner: "nw" as const, x: p1.x, y: p1.y },
            { corner: "ne" as const, x: p2.x, y: p1.y },
            { corner: "sw" as const, x: p1.x, y: p2.y },
            { corner: "se" as const, x: p2.x, y: p2.y },
          ];
          const hit = handles.find(h => Math.hypot(h.x - localX, h.y - localY) < 10);
          if (hit) {
            dragRef.current = { mode: "resizeRect", id: hitId, corner: hit.corner, prevX: toNorm(e.clientX, e.clientY).x, prevY: toNorm(e.clientX, e.clientY).y };
            started = true;
          }
        } else if (a.type === "arrow") {
          const p1 = fromNorm(a.x1, a.y1);
          const p2 = fromNorm(a.x2, a.y2);
          const nearP1 = Math.hypot(p1.x - localX, p1.y - localY) < 10;
          const nearP2 = Math.hypot(p2.x - localX, p2.y - localY) < 10;
          if (nearP1) {
            dragRef.current = { mode: "arrowStart", id: hitId, prevX: toNorm(e.clientX, e.clientY).x, prevY: toNorm(e.clientX, e.clientY).y };
            started = true;
          } else if (nearP2) {
            dragRef.current = { mode: "arrowEnd", id: hitId, prevX: toNorm(e.clientX, e.clientY).x, prevY: toNorm(e.clientX, e.clientY).y };
            started = true;
          }
        }
        if (!started) {
          dragRef.current = { mode: "move", id: hitId, prevX: toNorm(e.clientX, e.clientY).x, prevY: toNorm(e.clientX, e.clientY).y };
        }
        setIsDragging(true);
        if (a.type === "text") {
          setEditingTextId(hitId);
        }
        setUndoStack((s) => [...s, annotations]);
        setRedoStack([]);
      } else {
        setSelectedId(null);
        setEditingTextId(null);
      }
    } else if (tool === "pen") {
      setDrawing({ type: "pen", startX: norm.x, startY: norm.y, points: [norm] });
    } else if (tool === "rect") {
      setDrawing({ type: "rect", startX: norm.x, startY: norm.y, currentX: norm.x, currentY: norm.y });
    } else if (tool === "arrow") {
      setDrawing({ type: "arrow", startX: norm.x, startY: norm.y, currentX: norm.x, currentY: norm.y });
    } else if (tool === "text") {
      const id = `ann_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const newAnn: TextAnnotation = { 
        id, 
        type: "text", 
        x: norm.x, 
        y: norm.y, 
        text: "Click to edit", 
        color, 
        size 
      };
      pushHistory([...annotations, newAnn]);
      setSelectedId(id);
      setEditingTextId(id);
    } else if (tool === "erase") {
      const hitId = getAnnotationAt(e.clientX, e.clientY);
      if (hitId) {
        const next = annotations.filter(a => a.id !== hitId);
        pushHistory(next);
        if (selectedId === hitId) {
          setSelectedId(null);
          setEditingTextId(null);
        }
      }
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!baseImage) return;
    
    const norm = toNorm(e.clientX, e.clientY);

    if (drawing) {
      if (drawing.type === "pen") {
        setDrawing({ ...drawing, points: [...(drawing.points || []), norm] });
      } else if (drawing.type === "rect" || drawing.type === "arrow") {
        setDrawing({ ...drawing, currentX: norm.x, currentY: norm.y });
      }
    } else if (isDragging && selectedId && tool === "select" && dragRef.current) {
      const dr = dragRef.current;
      const prevX = dr.prevX;
      const prevY = dr.prevY;
      const dx = norm.x - prevX;
      const dy = norm.y - prevY;
      const idx = annotations.findIndex(a => a.id === dr.id);
      if (idx >= 0) {
        const a = annotations[idx];
        let updated: Annotation = a;
        if (dr.mode === "move") {
          if (a.type === "rect") {
            updated = { ...a, x: clamp(a.x + dx, 0, 1 - a.width), y: clamp(a.y + dy, 0, 1 - a.height) };
          } else if (a.type === "arrow") {
            updated = {
              ...a,
              x1: clamp(a.x1 + dx, 0, 1), y1: clamp(a.y1 + dy, 0, 1),
              x2: clamp(a.x2 + dx, 0, 1), y2: clamp(a.y2 + dy, 0, 1),
            };
          } else if (a.type === "text") {
            updated = { ...a, x: clamp(a.x + dx, 0, 1), y: clamp(a.y + dy, 0, 1) };
          } else if (a.type === "pen") {
            updated = { ...a, points: a.points.map(p => ({ x: clamp(p.x + dx, 0, 1), y: clamp(p.y + dy, 0, 1) })) };
          }
        } else if (dr.mode === "resizeRect" && a.type === "rect") {
          const x = a.x, y = a.y, w = a.width, h = a.height;
          let nx = x, ny = y, nw = w, nh = h;
          if (dr.corner === "nw") {
            nx = clamp(norm.x, 0, x + w);
            ny = clamp(norm.y, 0, y + h);
            nw = (x + w) - nx;
            nh = (y + h) - ny;
          } else if (dr.corner === "ne") {
            ny = clamp(norm.y, 0, y + h);
            nw = clamp(norm.x - x, 0, 1 - x);
            nh = (y + h) - ny;
          } else if (dr.corner === "sw") {
            nx = clamp(norm.x, 0, x + w);
            nw = (x + w) - nx;
            nh = clamp(norm.y - y, 0, 1 - y);
          } else if (dr.corner === "se") {
            nw = clamp(norm.x - x, 0, 1 - x);
            nh = clamp(norm.y - y, 0, 1 - y);
          }
          updated = { ...a, x: nx, y: ny, width: nw, height: nh };
        } else if (a.type === "arrow" && (dr.mode === "arrowStart" || dr.mode === "arrowEnd")) {
          if (dr.mode === "arrowStart") {
            updated = { ...a, x1: clamp(norm.x, 0, 1), y1: clamp(norm.y, 0, 1) };
          } else {
            updated = { ...a, x2: clamp(norm.x, 0, 1), y2: clamp(norm.y, 0, 1) };
          }
        }
        const next = [...annotations];
        next[idx] = updated;
        onChange(next);
        dragRef.current.prevX = norm.x;
        dragRef.current.prevY = norm.y;
      }
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!baseImage) return;
    
    const norm = toNorm(e.clientX, e.clientY);

    if (drawing) {
      if (drawing.type === "pen" && drawing.points && drawing.points.length > 1) {
        const id = `ann_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const newAnn: PenAnnotation = { id, type: "pen", points: drawing.points, color, size };
        pushHistory([...annotations, newAnn]);
        setSelectedId(id);
      } else if (drawing.type === "rect" && drawing.currentX !== undefined && drawing.currentY !== undefined) {
        const x = Math.min(drawing.startX, drawing.currentX);
        const y = Math.min(drawing.startY, drawing.currentY);
        const width = Math.abs(drawing.currentX - drawing.startX);
        const height = Math.abs(drawing.currentY - drawing.startY);
        
        if (width > 0.01 && height > 0.01) { // Minimum size threshold
          const id = `ann_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          const newAnn: RectAnnotation = { id, type: "rect", x, y, width, height, color, size };
          pushHistory([...annotations, newAnn]);
          setSelectedId(id);
        }
      } else if (drawing.type === "arrow" && drawing.currentX !== undefined && drawing.currentY !== undefined) {
        const distance = Math.sqrt(
          Math.pow(drawing.currentX - drawing.startX, 2) + 
          Math.pow(drawing.currentY - drawing.startY, 2)
        );
        
        if (distance > 0.02) { // Minimum distance threshold
          const id = `ann_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          const newAnn: ArrowAnnotation = { 
            id, 
            type: "arrow", 
            x1: drawing.startX, 
            y1: drawing.startY, 
            x2: drawing.currentX, 
            y2: drawing.currentY, 
            color, 
            size 
          };
          pushHistory([...annotations, newAnn]);
          setSelectedId(id);
        }
      }
    }
    
    setDrawing(null);
    setIsDragging(false);
    dragRef.current = null;
  }

  function updateSelectedAnnotation(partial: Partial<Annotation>) {
    if (!selectedId) return;
    const idx = annotations.findIndex(a => a.id === selectedId);
    if (idx < 0) return;
    const next = [...annotations];
    next[idx] = { ...next[idx], ...partial } as Annotation;
    pushHistory(next);
  }

  function removeSelected() {
    if (!selectedId) return;
    const next = annotations.filter(a => a.id !== selectedId);
    pushHistory(next);
    setSelectedId(null);
    setEditingTextId(null);
  }

  async function exportPNG(): Promise<string | undefined> {
    if (!baseImage) return undefined;
    
    const img = imgRef.current;
    if (!img) return undefined;
    
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;
    
    // Load and draw base image
    const tempImg = new Image();
    tempImg.crossOrigin = "anonymous";
    tempImg.src = baseImage;
    
    return new Promise<string | undefined>((resolve) => {
      tempImg.onload = () => {
        ctx.drawImage(tempImg, 0, 0, canvas.width, canvas.height);
        
        // Draw annotations
        annotations.forEach((a) => {
          ctx.save();
          ctx.strokeStyle = a.color;
          ctx.fillStyle = a.color;
          ctx.lineWidth = a.size;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          
          if (a.type === "rect") {
            ctx.strokeRect(
              a.x * canvas.width, 
              a.y * canvas.height, 
              a.width * canvas.width, 
              a.height * canvas.height
            );
          } else if (a.type === "arrow") {
            const x1 = a.x1 * canvas.width;
            const y1 = a.y1 * canvas.height;
            const x2 = a.x2 * canvas.width;
            const y2 = a.y2 * canvas.height;
            
            // Draw line
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            
            // Draw arrowhead
            const angle = Math.atan2(y2 - y1, x2 - x1);
            const headLength = 10 + a.size * 2;
            ctx.beginPath();
            ctx.moveTo(x2, y2);
            ctx.lineTo(
              x2 - headLength * Math.cos(angle - Math.PI / 6),
              y2 - headLength * Math.sin(angle - Math.PI / 6)
            );
            ctx.lineTo(
              x2 - headLength * Math.cos(angle + Math.PI / 6),
              y2 - headLength * Math.sin(angle + Math.PI / 6)
            );
            ctx.closePath();
            ctx.fill();
          } else if (a.type === "pen") {
            if (a.points.length > 1) {
              ctx.beginPath();
              ctx.moveTo(a.points[0].x * canvas.width, a.points[0].y * canvas.height);
              for (let i = 1; i < a.points.length; i++) {
                ctx.lineTo(a.points[i].x * canvas.width, a.points[i].y * canvas.height);
              }
              ctx.stroke();
            }
          } else if (a.type === "text") {
            ctx.font = `${12 + a.size * 2}px Arial, sans-serif`;
            ctx.textBaseline = "top";
            ctx.fillText(a.text, a.x * canvas.width, a.y * canvas.height);
          }
          ctx.restore();
        });
        
        resolve(canvas.toDataURL("image/png"));
      };
      
      tempImg.onerror = () => resolve(undefined);
    });
  }

  useImperativeHandle(ref, () => ({ exportPNG }), [annotations, baseImage]);

  const selectedAnnotation = selectedId ? annotations.find(a => a.id === selectedId) : null;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/30 rounded-lg">
        <div className="flex items-center gap-2">
          <input 
            ref={fileInputRef}
            type="file" 
            accept="image/*" 
            className="hidden" 
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const data = await dataUrlFromFile(file);
                onBaseImageChange(data);
                // Clear annotations when new image is loaded
                onChange([]);
                setSelectedId(null);
                setEditingTextId(null);
              } catch (error) {
                console.error("Error loading image:", error);
              }
            }} 
          />
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageIcon className="mr-2 size-4" /> Upload Image
          </Button>
          {baseImage && (
            <>
              <Badge variant="secondary">Image loaded</Badge>
              <Button variant="ghost" size="sm" onClick={removeImage}>
                <X className="size-4" />
              </Button>
            </>
          )}
        </div>
        
        <Separator orientation="vertical" className="h-6" />
        
        {/* Tools */}
        <div className="flex items-center gap-1">
          <ToolButton 
            icon={<MousePointer />} 
            active={tool === "select"} 
            onClick={() => setTool("select")} 
            label="Select & Move" 
          />
          <ToolButton 
            icon={<Pencil />} 
            active={tool === "pen"} 
            onClick={() => setTool("pen")} 
            label="Pen" 
          />
          <ToolButton 
            icon={<RectangleHorizontal />} 
            active={tool === "rect"} 
            onClick={() => setTool("rect")} 
            label="Rectangle" 
          />
          <ToolButton 
            icon={<ArrowRight />} 
            active={tool === "arrow"} 
            onClick={() => setTool("arrow")} 
            label="Arrow" 
          />
          <ToolButton 
            icon={<Type />} 
            active={tool === "text"} 
            onClick={() => setTool("text")} 
            label="Text" 
          />
          <ToolButton 
            icon={<Eraser />} 
            active={tool === "erase"} 
            onClick={() => setTool("erase")} 
            label="Eraser" 
          />
        </div>
        
        <Separator orientation="vertical" className="h-6" />
        
        {/* Style controls */}
        <div className="flex items-center gap-2">
          <Label htmlFor="color-picker" className="text-sm">Color:</Label>
          <Input 
            id="color-picker"
            type="color" 
            value={color} 
            onChange={(e) => setColor(e.target.value)} 
            className="w-12 h-8 p-1 border rounded cursor-pointer" 
          />
          <Label htmlFor="size-slider" className="text-sm">Size:</Label>
          <div className="w-24">
            <Slider 
              id="size-slider"
              value={[size]} 
              min={1} 
              max={12} 
              step={1} 
              onValueChange={(v) => setSize(v[0] ?? 3)} 
            />
          </div>
          <span className="text-xs text-muted-foreground w-6">{size}</span>
        </div>
        
        <Separator orientation="vertical" className="h-6" />
        
        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={undo} 
            disabled={undoStack.length === 0}
            aria-label="Undo"
          >
            <Undo2 className="size-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={redo} 
            disabled={redoStack.length === 0}
            aria-label="Redo"
          >
            <Redo2 className="size-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearAll}
            disabled={annotations.length === 0}
          >
            Clear All
          </Button>
          {selectedId && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={removeSelected}
              className="text-destructive hover:text-destructive"
            >
              Delete Selected
            </Button>
          )}
        </div>
      </div>

      {/* Canvas Area */}
      <div
        ref={containerRef}
        className={cn(
          "relative border-2 border-dashed rounded-lg overflow-hidden bg-muted/20 select-none",
          !baseImage && "aspect-video grid place-items-center min-h-[400px]",
          baseImage && "border-solid"
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ touchAction: "none" }}
      >
        {!baseImage ? (
          <div className="text-center p-8">
            <ImageIcon className="size-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium text-muted-foreground mb-2">No image uploaded</p>
            <p className="text-sm text-muted-foreground mb-4">
              Upload an image (X-ray, scan, diagram) to start annotating
            </p>
            <Button onClick={() => fileInputRef.current?.click()}>
              <ImageIcon className="mr-2 size-4" /> Upload Image
            </Button>
          </div>
        ) : (
          <>
            <img 
              ref={imgRef} 
              src={baseImage} 
              alt="Medical image for annotation" 
              className="block max-h-[70vh] w-auto mx-auto select-none pointer-events-none" 
              draggable={false}
            />
            
            {/* SVG Overlay for annotations */}
            <svg 
              ref={svgRef}
              className="absolute inset-0 w-full h-full pointer-events-none" 
              style={{ pointerEvents: "none" }}
            >
              <defs>
                <marker 
                  id="arrowhead" 
                  markerWidth="10" 
                  markerHeight="7" 
                  refX="10" 
                  refY="3.5" 
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" />
                </marker>
              </defs>
              
              {/* Render existing annotations */}
              {annotations.map((a) => {
                const isSelected = selectedId === a.id;
                const opacity = isSelected ? 0.8 : 1;
                
                if (a.type === "rect") {
                  const p = fromNorm(a.x, a.y);
                  const p2 = fromNorm(a.x + a.width, a.y + a.height);
                  return (
                    <g key={a.id}>
                      <rect 
                        x={p.x} 
                        y={p.y} 
                        width={p2.x - p.x} 
                        height={p2.y - p.y} 
                        stroke={a.color} 
                        fill="transparent" 
                        strokeWidth={a.size}
                        opacity={opacity}
                        className={cn(isSelected && "stroke-dashed")}
                        style={{ strokeDasharray: isSelected ? "5,5" : "none" }}
                      />
                      {isSelected && (
                        <circle 
                          cx={p.x + (p2.x - p.x) / 2} 
                          cy={p.y + (p2.y - p.y) / 2} 
                          r="4" 
                          fill={a.color} 
                          opacity={0.7}
                        />
                      )}
                    </g>
                  );
                } else if (a.type === "arrow") {
                  const p1 = fromNorm(a.x1, a.y1);
                  const p2 = fromNorm(a.x2, a.y2);
                  return (
                    <g key={a.id}>
                      <line 
                        x1={p1.x} 
                        y1={p1.y} 
                        x2={p2.x} 
                        y2={p2.y} 
                        stroke={a.color} 
                        strokeWidth={a.size} 
                        markerEnd="url(#arrowhead)"
                        opacity={opacity}
                        className={cn(isSelected && "stroke-dashed")}
                        style={{ strokeDasharray: isSelected ? "5,5" : "none" }}
                      />
                      {isSelected && (
                        <>
                          <circle cx={p1.x} cy={p1.y} r="3" fill={a.color} opacity={0.7} />
                          <circle cx={p2.x} cy={p2.y} r="3" fill={a.color} opacity={0.7} />
                        </>
                      )}
                    </g>
                  );
                } else if (a.type === "pen") {
                  const d = a.points.map((pt, i) => {
                    const p = fromNorm(pt.x, pt.y);
                    return `${i === 0 ? "M" : "L"}${p.x},${p.y}`;
                  }).join(" ");
                  return (
                    <g key={a.id}>
                      <path 
                        d={d} 
                        stroke={a.color} 
                        strokeWidth={a.size} 
                        fill="none"
                        opacity={opacity}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={cn(isSelected && "stroke-dashed")}
                        style={{ strokeDasharray: isSelected ? "5,5" : "none" }}
                      />
                      {isSelected && a.points.length > 0 && (
                        <circle 
                          cx={fromNorm(a.points[0].x, a.points[0].y).x} 
                          cy={fromNorm(a.points[0].x, a.points[0].y).y} 
                          r="3" 
                          fill={a.color} 
                          opacity={0.7} 
                        />
                      )}
                    </g>
                  );
                } else if (a.type === "text") {
                  const p = fromNorm(a.x, a.y);
                  return (
                    <g key={a.id}>
                      <text 
                        x={p.x} 
                        y={p.y} 
                        fontSize={12 + a.size * 2} 
                        fill={a.color}
                        opacity={opacity}
                        fontFamily="Arial, sans-serif"
                        dominantBaseline="hanging"
                      >
                        {a.text}
                      </text>
                      {isSelected && (
                        <circle cx={p.x} cy={p.y} r="3" fill={a.color} opacity={0.7} />
                      )}
                    </g>
                  );
                }
                return null;
              })}
              
              {/* Render drawing preview */}
              {drawing && (
                <>
                  {drawing.type === "pen" && drawing.points && drawing.points.length > 1 && (
                    <path 
                      d={drawing.points.map((pt, i) => {
                        const p = fromNorm(pt.x, pt.y);
                        return `${i === 0 ? "M" : "L"}${p.x},${p.y}`;
                      }).join(" ")}
                      stroke={color} 
                      strokeWidth={size} 
                      fill="none"
                      opacity={0.7}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                  {drawing.type === "rect" && drawing.currentX !== undefined && drawing.currentY !== undefined && (
                    <rect 
                      x={fromNorm(Math.min(drawing.startX, drawing.currentX), 0).x}
                      y={fromNorm(0, Math.min(drawing.startY, drawing.currentY)).y}
                      width={Math.abs(fromNorm(drawing.currentX, 0).x - fromNorm(drawing.startX, 0).x)}
                      height={Math.abs(fromNorm(0, drawing.currentY).y - fromNorm(0, drawing.startY).y)}
                      stroke={color} 
                      fill="transparent" 
                      strokeWidth={size}
                      opacity={0.7}
                    />
                  )}
                  {drawing.type === "arrow" && drawing.currentX !== undefined && drawing.currentY !== undefined && (
                    <line 
                      x1={fromNorm(drawing.startX, drawing.startY).x}
                      y1={fromNorm(drawing.startX, drawing.startY).y}
                      x2={fromNorm(drawing.currentX, drawing.currentY).x}
                      y2={fromNorm(drawing.currentX, drawing.currentY).y}
                      stroke={color} 
                      strokeWidth={size} 
                      markerEnd="url(#arrowhead)"
                      opacity={0.7}
                    />
                  )}
                </>
              )}
            </svg>
            
            {/* Text editing overlay */}
            {editingTextId && (() => {
              const textAnn = annotations.find(a => a.id === editingTextId) as TextAnnotation | undefined;
              if (!textAnn) return null;
              const p = fromNorm(textAnn.x, textAnn.y);
              return (
                <input
                  className="absolute bg-background border rounded px-2 py-1 text-sm shadow-lg z-10"
                  style={{ 
                    left: p.x, 
                    top: p.y,
                    fontSize: `${12 + textAnn.size * 2}px`,
                    color: textAnn.color
                  }}
                  value={textAnn.text}
                  onChange={(e) => updateSelectedAnnotation({ text: e.target.value })}
                  onBlur={() => setEditingTextId(null)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setEditingTextId(null);
                    }
                  }}
                  autoFocus
                  placeholder="Enter text..."
                />
              );
            })()}
          </>
        )}
      </div>

      {/* Selected annotation controls */}
      {selectedAnnotation && (
        <div className="p-3 bg-muted/30 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Selected: {selectedAnnotation.type} annotation</h4>
            <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
              <X className="size-4" />
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="selected-color">Color</Label>
              <Input 
                id="selected-color"
                type="color" 
                value={selectedAnnotation.color} 
                onChange={(e) => updateSelectedAnnotation({ color: e.target.value })}
                className="w-full h-10 p-1"
              />
            </div>
            <div>
              <Label htmlFor="selected-size">Size: {selectedAnnotation.size}</Label>
              <Slider 
                id="selected-size"
                value={[selectedAnnotation.size]} 
                min={1} 
                max={12} 
                step={1} 
                onValueChange={(v) => updateSelectedAnnotation({ size: v[0] ?? 3 })}
              />
            </div>
            <div>
              <Label htmlFor="linked-field">Link to field</Label>
              <Select
                value={selectedAnnotation.linkedFieldId ?? "none"}
                onValueChange={(v) => updateSelectedAnnotation({ linkedFieldId: v === "none" ? undefined : v })}
              >
                <SelectTrigger id="linked-field">
                  <SelectValue placeholder="Select field" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {fieldsForLink.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {selectedAnnotation.type === "text" && (
            <div>
              <Label htmlFor="text-content">Text Content</Label>
              <Input 
                id="text-content"
                value={(selectedAnnotation as TextAnnotation).text}
                onChange={(e) => updateSelectedAnnotation({ text: e.target.value })}
                placeholder="Enter text..."
              />
            </div>
          )}
        </div>
      )}

      {/* Annotations list */}
      {annotations.length > 0 && (
        <div className="p-3 bg-muted/30 rounded-lg">
          <h4 className="font-medium mb-2">Annotations ({annotations.length})</h4>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {annotations.map((a, index) => (
              <div 
                key={a.id}
                className={cn(
                  "flex items-center justify-between p-2 rounded text-sm cursor-pointer hover:bg-muted/50",
                  selectedId === a.id && "bg-muted"
                )}
                onClick={() => setSelectedId(a.id)}
              >
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded border" 
                    style={{ backgroundColor: a.color }}
                  />
                  <span className="capitalize">{a.type}</span>
                  {a.type === "text" && (
                    <span className="text-muted-foreground">
                      "{(a as TextAnnotation).text.slice(0, 20)}{(a as TextAnnotation).text.length > 20 ? "..." : ""}"
                    </span>
                  )}
                  {a.linkedFieldId && (
                    <Badge variant="outline" className="text-xs">
                      {fieldsForLink.find(f => f.id === a.linkedFieldId)?.label || "Linked"}
                    </Badge>
                  )}
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = annotations.filter(ann => ann.id !== a.id);
                    pushHistory(next);
                    if (selectedId === a.id) {
                      setSelectedId(null);
                      setEditingTextId(null);
                    }
                  }}
                  className="text-destructive hover:text-destructive"
                >
                  <X className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

function ToolButton({ 
  icon, 
  label, 
  active, 
  onClick 
}: { 
  icon: React.ReactNode; 
  label: string; 
  active?: boolean; 
  onClick?: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button 
          variant={active ? "default" : "ghost"} 
          size="sm" 
          onClick={onClick} 
          aria-label={label}
          className={cn(active && "bg-primary text-primary-foreground")}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
