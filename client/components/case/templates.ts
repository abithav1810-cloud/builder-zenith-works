import { CaseSheetTemplate } from "./types";

export const cardiologyTemplate: CaseSheetTemplate = {
  id: "cardiology",
  name: "Cardiology",
  description: "Focused on cardiovascular assessments and diagnostics.",
  fields: [
    { id: "patient_name", label: "Patient Name", type: "text", required: true, sensitive: true },
    { id: "age", label: "Age", type: "number", min: 0, max: 120, unit: "years", required: true, sensitive: true },
    { id: "gender", label: "Gender", type: "select", options: [
      { label: "Male", value: "male" },
      { label: "Female", value: "female" },
      { label: "Other", value: "other" },
    ], sensitive: true },
    { id: "symptoms", label: "Symptoms", type: "textarea", placeholder: "Chest pain, shortness of breath..." },
    { id: "bp", label: "Blood Pressure", type: "text", placeholder: "120/80 mmHg" },
    { id: "hr", label: "Heart Rate", type: "number", min: 20, max: 220, unit: "bpm" },
    { id: "lipids", label: "Lipid Profile", type: "textarea" },
    { id: "diagnosis", label: "Diagnosis", type: "textarea", required: true },
    { id: "prescriptions", label: "Prescriptions", type: "textarea" },
    { id: "follow_up", label: "Follow-up Date", type: "date" },
  ],
  suggestions: {
    diagnosis: ["Stable angina", "NSTEMI", "Hypertension", "Atrial fibrillation"],
    prescriptions: ["Aspirin 75mg", "Atorvastatin 20mg", "Beta blocker"],
  },
};

export const orthopedicsTemplate: CaseSheetTemplate = {
  id: "orthopedics",
  name: "Orthopedics",
  description: "Musculoskeletal evaluation and treatment planning.",
  fields: [
    { id: "patient_name", label: "Patient Name", type: "text", required: true, sensitive: true },
    { id: "age", label: "Age", type: "number", min: 0, max: 120, unit: "years", required: true, sensitive: true },
    { id: "injury_site", label: "Injury Site", type: "select", options: [
      { label: "Shoulder", value: "shoulder" },
      { label: "Elbow", value: "elbow" },
      { label: "Wrist", value: "wrist" },
      { label: "Hip", value: "hip" },
      { label: "Knee", value: "knee" },
      { label: "Ankle", value: "ankle" },
    ] },
    { id: "pain_scale", label: "Pain Scale", type: "number", min: 0, max: 10 },
    { id: "symptoms", label: "Symptoms", type: "textarea", placeholder: "Swelling, limited range of motion..." },
    { id: "observations", label: "Observations", type: "textarea" },
    { id: "diagnosis", label: "Diagnosis", type: "textarea" },
    { id: "plan", label: "Treatment Plan", type: "textarea" },
    { id: "follow_up", label: "Follow-up Date", type: "date" },
  ],
};

export const neurologyTemplate: CaseSheetTemplate = {
  id: "neurology",
  name: "Neurology",
  description: "Neurological assessments and cognitive evaluations.",
  fields: [
    { id: "patient_name", label: "Patient Name", type: "text", required: true, sensitive: true },
    { id: "age", label: "Age", type: "number", min: 0, max: 120, unit: "years", required: true, sensitive: true },
    { id: "onset", label: "Onset Date", type: "date" },
    { id: "symptoms", label: "Symptoms", type: "textarea", placeholder: "Headache, dizziness, seizures..." },
    { id: "neuro_exam", label: "Neurological Exam", type: "textarea" },
    { id: "gcs", label: "GCS", type: "number", min: 3, max: 15 },
    { id: "diagnosis", label: "Diagnosis", type: "textarea" },
    { id: "prescriptions", label: "Prescriptions", type: "textarea" },
    { id: "imaging", label: "Imaging Required", type: "checkbox", options: [
      { label: "CT", value: "ct" },
      { label: "MRI", value: "mri" },
      { label: "EEG", value: "eeg" },
    ] },
  ],
};

export const defaultTemplates = [cardiologyTemplate, orthopedicsTemplate, neurologyTemplate];
