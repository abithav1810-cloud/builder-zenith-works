# Doctor Case Sheet UI — Guide

This app provides a modular Case Sheet interface for doctors with dynamic templates, configurable fields, visual annotations, and export features.

## Specializations & Templates

Location: client/components/case/templates.ts

- Includes three example templates: Cardiology, Orthopedics, Neurology.
- Each template contains a `fields` array of `FieldDefinition` objects.
- Add new templates by exporting a new `CaseSheetTemplate` and adding it to `defaultTemplates`.

FieldDefinition shape:
- id: unique string (used to store value)
- label: display label
- type: "text" | "textarea" | "number" | "date" | "select" | "multiselect" | "checkbox"
- required?: true/false
- placeholder?: string
- options?: [{ label, value }] for select/multiselect/checkbox
- min/max/step/unit?: number-based constraints and suffix unit
- sensitive?: mark fields to optionally exclude on export

## Configurable Fields

Within the Case Details panel:
- Add fields: Click "Add Field" → choose type, label, id, options.
- Reorder: Use up/down arrows on each field card.
- Remove: Trash icon.
- Values autosave to localStorage and are restored on reload.

## Visual Aids & Annotations

- Upload an image (X-ray/scan) to annotate.
- Tools: Select, Pen (freehand), Rectangle, Arrow, Text.
- Controls: color picker, stroke size, Undo/Redo, Clear.
- Drag to move existing annotations with Select tool.
- Link an annotation to a field for context using the dropdown when selected.
- All annotations are stored as normalized coordinates for responsive scaling.

## Export

- JSON: Exports full case data (fields, values, image, annotations). Toggle to include/exclude sensitive fields, image, and annotations.
- PNG: Exports the annotated image (base image + overlays) as a PNG.
- Print/PDF: Use the Print action to generate a printer-friendly page and choose “Save as PDF”.

## Accessibility & Security

- Inputs use proper labels and keyboard-friendly controls.
- No images or data leave the browser unless integrated with a backend.
- Mark sensitive fields with `sensitive: true` to control export.

## Integration Hooks

- The CaseSheet component manages a single `CaseSheetData` object.
- To integrate with a backend, observe autosaved data in localStorage key: `case_sheet` or extend CaseSheet to POST on change.

## Extending

- Add new tools to `CaseAnnotations` by extending the `ToolType` and implementing render/export logic.
- Add validation or templates specific to sub-specialties by expanding `FieldDefinition` and generating zod schemas.
