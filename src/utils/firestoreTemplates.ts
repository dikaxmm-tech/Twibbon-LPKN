import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from './firebaseAuth';
import { TwibbonTemplate, StudentSubmission } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Compresses an image file for high-resolution cloud storage in Firestore.
 * Standard size is up to 1000px max dimension, maintaining transparent PNG or high quality WebP.
 * This is optimized to fit inside the Firestore 1MB document limit while looking stunning in HD.
 */
export function compressFrameForFirestore(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const originalResult = event.target?.result as string;
      
      // If original file is already very small (under 600KB), we can use it safely
      if (originalResult && originalResult.length < 800000) {
        resolve(originalResult);
        return;
      }

      const img = new Image();
      img.src = originalResult;
      img.onload = () => {
        let maxDim = 750; // Start with high quality 750px max dimension
        let webpQuality = 0.85;
        let finalDataUrl = '';

        const renderWithDim = (dim: number, quality: number): string => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > dim) {
              height *= dim / width;
              width = dim;
            }
          } else {
            if (height > dim) {
              width *= dim / height;
              height = dim;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) return '';

          // Enable high quality image scaling
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          try {
            // WebP is highly superior for translucent overlays where supported
            const dataUrl = canvas.toDataURL('image/webp', quality);
            if (dataUrl && dataUrl.startsWith('data:image/webp') && dataUrl.length > 100) {
              return dataUrl;
            }
          } catch (e) {
            // WebP not supported, fall through to PNG
          }

          return canvas.toDataURL('image/png');
        };

        // Iteratively downscale until the Base64 string is strictly under 900,000 characters (~650KB binary)
        let attempts = 0;
        while (attempts < 12) {
          finalDataUrl = renderWithDim(maxDim, webpQuality);
          if (finalDataUrl.length < 900000) {
            break;
          }
          maxDim = Math.floor(maxDim * 0.75); // downscale dimension by 25% each cycle
          webpQuality = Math.max(0.35, webpQuality - 0.15); // reduce WebP output factor
          attempts++;
        }

        // Extremely safe fallback: if still too large, return a tiny visual placeholder instead of crashing Firestore
        if (finalDataUrl.length >= 1000000) {
          console.warn('Compressor: downscaled heavily to 200px to avoid Firestore quota crash');
          finalDataUrl = renderWithDim(200, 0.4);
        }

        resolve(finalDataUrl);
      };

      img.onerror = () => {
        // Resolve to a safe empty or slice if original is giant
        if (originalResult.length > 950000) {
          resolve('');
        } else {
          resolve(originalResult);
        }
      };
    };

    reader.onerror = () => {
      resolve('');
    };
  });
}

/**
 * Saves a custom twibbon template to Firestore so that anyone who visits the app
 * and opens the shared link can access and use it instantly.
 */
export async function saveTemplateToFirestore(template: TwibbonTemplate): Promise<void> {
  const path = `shared_templates/${template.id}`;
  try {
    const docRef = doc(db, 'shared_templates', template.id);
    await setDoc(docRef, {
      id: template.id,
      name: template.name,
      category: template.category,
      description: template.description,
      previewColor: template.previewColor,
      accentColor: template.accentColor,
      imageUrl: template.imageUrl || '',
      createdAt: new Date().toISOString(),
      isDefault: template.isDefault || false
    });
    console.log('Successfully synchronized template to cloud Firestore:', template.id);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Promotes a specific template to be the global default.
 * This is highly optimized to save to a small global_default_campaign document,
 * avoiding write operations on huge Base64 values which would exceed Firestore's 1MB limit.
 */
export async function setGlobalDefaultTemplateInFirestore(targetId: string, allTemplates: TwibbonTemplate[]): Promise<void> {
  const path = 'shared_templates/global_default_campaign';
  try {
    const docRef = doc(db, 'shared_templates', 'global_default_campaign');
    await setDoc(docRef, {
      id: 'global_default_campaign',
      defaultTemplateId: targetId,
      updatedAt: new Date().toISOString()
    });
    console.log('Successfully set global default configuration doc:', targetId);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Downloads all shared twibbon templates from Firestore.
 */
export async function getTemplatesFromFirestore(): Promise<TwibbonTemplate[]> {
  const path = 'shared_templates';
  try {
    const colRef = collection(db, 'shared_templates');
    const snapshot = await getDocs(colRef);
    const list: TwibbonTemplate[] = [];
    
    // Find designated default template configuration
    let defaultId = '';
    const configDoc = snapshot.docs.find(d => d.id === 'global_default_campaign');
    if (configDoc) {
      defaultId = configDoc.data().defaultTemplateId || '';
    }
    
    snapshot.forEach((doc) => {
      if (doc.id === 'global_default_campaign') return; // Skip settings configuration document
      const data = doc.data();
      list.push({
        id: data.id,
        name: data.name,
        category: data.category || 'Kustom',
        description: data.description || '',
        previewColor: data.previewColor || 'from-emerald-600 to-teal-500',
        accentColor: data.accentColor || '#10b981',
        imageUrl: data.imageUrl,
        isDefault: data.id === defaultId, // Mark default dynamically in-memory
      });
    });
    
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return []; // fallback but error is already thrown by handleFirestoreError
  }
}

/**
 * Saves a student's customized twibbon submission to Firestore.
 */
export async function saveStudentSubmissionToFirestore(submission: StudentSubmission): Promise<void> {
  const path = `student_submissions/${submission.id}`;
  try {
    const docRef = doc(db, 'student_submissions', submission.id);
    await setDoc(docRef, submission);
    console.log('Successfully saved student submission to Firestore:', submission.id);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Retrieves all student submissions from Firestore.
 */
export async function getStudentSubmissionsFromFirestore(): Promise<StudentSubmission[]> {
  const path = 'student_submissions';
  try {
    const colRef = collection(db, 'student_submissions');
    const snapshot = await getDocs(colRef);
    const list: StudentSubmission[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      list.push({
        id: data.id,
        studentName: data.studentName || 'Siswa Tanpa Nama',
        studentClass: data.studentClass || '',
        fileName: data.fileName || 'twibbon-hasil.png',
        imageUrl: data.imageUrl || '',
        createdAt: data.createdAt || new Date().toISOString(),
        templateId: data.templateId || 'custom',
        syncedToDrive: data.syncedToDrive || false,
      });
    });

    // Sort by newest submissions first
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return []; // fallback
  }
}

/**
 * Updates the Google Drive synchronization status for a specific student submission.
 */
export async function updateSubmissionSyncStatusInFirestore(id: string, synced: boolean): Promise<void> {
  const path = `student_submissions/${id}`;
  try {
    const docRef = doc(db, 'student_submissions', id);
    await updateDoc(docRef, { syncedToDrive: synced });
    console.log(`Updated sync status for submission: ${id} to ${synced}`);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Safely deletes a student submission from Firestore database (useful for managing storage/queue).
 */
export async function deleteSubmissionFromFirestore(id: string): Promise<void> {
  const path = `student_submissions/${id}`;
  try {
    const docRef = doc(db, 'student_submissions', id);
    await deleteDoc(docRef);
    console.log('Successfully deleted student submission from Firestore:', id);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Utility to compress a canvas element into a JPEG data URL strictly under 900,000 characters.
 */
export async function compressCanvasForFirestore(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve) => {
    let quality = 0.8;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    
    // If already small, return it
    if (dataUrl.length < 900000) {
      resolve(dataUrl);
      return;
    }
    
    // Lower JPEG quality
    while (dataUrl.length >= 900000 && quality > 0.3) {
      quality -= 0.1;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }
    
    // If still too large, downscale dimension to 640x800
    if (dataUrl.length >= 900000) {
      const scaleCanvas = document.createElement('canvas');
      scaleCanvas.width = 640;
      scaleCanvas.height = 800; // maintains 4:5 portrait ratio
      const ctx = scaleCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(canvas, 0, 0, 640, 800);
        dataUrl = scaleCanvas.toDataURL('image/jpeg', 0.75);
      }
    }
    
    resolve(dataUrl);
  });
}


