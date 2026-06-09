export interface PhotoParams {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
}

export interface PhotoFilters {
  brightness: number;  // 100% normal
  contrast: number;    // 100% normal
  saturation: number;  // 100% normal
  grayscale: number;   // 0% normal
  sepia: number;       // 0% normal
  hueRotate: number;   // 0 deg normal
  warmth: number;      // 0% (custom warmth tint)
}

export type TemplateId = string;

export interface TwibbonTemplate {
  id: TemplateId;
  name: string;
  category: string;
  description: string;
  previewColor: string; // Tailwind color class for preview card
  accentColor: string;
  imageUrl?: string; // Optional custom URL for uploaded twibbon templates
  localUrl?: string; // Optional high-performance Blob Object URL for immediate runtime
  isDefault?: boolean; // Optional flag to set as main campaign frame for all students
}

export const TWIBBON_TEMPLATES: TwibbonTemplate[] = [
  {
    id: 'custom',
    name: 'Unggah Bingkai Sendiri',
    category: 'Kustom',
    description: 'Pilih dan gunakan berkas bingkai PNG transparan milik Anda sendiri.',
    previewColor: 'from-gray-700 to-gray-800',
    accentColor: '#374151'
  }
];

export interface StudentSubmission {
  id: string;
  studentName: string;
  studentClass: string;
  fileName: string;
  imageUrl: string; // Base64 data of completed twibbon
  createdAt: string;
  templateId: string;
  syncedToDrive: boolean;
}

