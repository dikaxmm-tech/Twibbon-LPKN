import { TwibbonTemplate, StudentSubmission } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface ServerErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
}

export function handleServerError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const errInfo: ServerErrorInfo = {
    error: errMsg,
    operationType,
    path
  };
  console.error('Server Database Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Compresses an image file for high-resolution cloud storage in Server.
 * Standard size is up to 1000px max dimension, maintaining transparent PNG or high quality WebP.
 */
export function compressFrameForStorage(file: File): Promise<string> {
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

        // Iteratively downscale until the Base64 string is under 900,000 characters (~650KB binary)
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

        // Extremely safe fallback: if still too large, return a tiny visual placeholder instead of crashing
        if (finalDataUrl.length >= 1000000) {
          console.warn('Compressor: downscaled heavily to 200px to avoid crash');
          finalDataUrl = renderWithDim(200, 0.4);
        }

        resolve(finalDataUrl);
      };

      img.onerror = () => {
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
 * Saves a custom twibbon template to our Express local API router database center.
 */
export async function saveTemplateToServer(template: TwibbonTemplate): Promise<void> {
  try {
    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(template)
    });
    if (!res.ok) throw new Error(await res.text());
    console.log('Successfully synchronized template to local server:', template.id);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : String(err));
  }
}

/**
 * Deletes a custom shared template from Express API database.
 */
export async function deleteTemplateFromServer(id: string): Promise<void> {
  try {
    const res = await fetch(`/api/templates/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error(await res.text());
    console.log('Successfully deleted template from local server:', id);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : String(err));
  }
}

/**
 * Promotes a specific template to be the global default.
 */
export async function setGlobalDefaultTemplateOnServer(targetId: string, allTemplates: TwibbonTemplate[]): Promise<void> {
  try {
    const res = await fetch('/api/templates/default', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ defaultTemplateId: targetId })
    });
    if (!res.ok) throw new Error(await res.text());
    console.log('Successfully promoted template to global default on local server:', targetId);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : String(err));
  }
}

/**
 * Downloads all shared twibbon templates from the local server database.
 */
export async function getTemplatesFromServer(): Promise<TwibbonTemplate[]> {
  try {
    const res = await fetch('/api/templates');
    if (!res.ok) throw new Error(await res.text());
    const list = await res.json() as TwibbonTemplate[];
    return list;
  } catch (err) {
    console.error('Error fetching templates from local server:', err);
    return [];
  }
}

/**
 * Saves a student's customized twibbon submission to local Express database.
 */
export async function saveStudentSubmissionToServer(submission: StudentSubmission): Promise<void> {
  try {
    const res = await fetch('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submission)
    });
    if (!res.ok) throw new Error(await res.text());
    console.log('Successfully saved student submission to local server:', submission.id);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : String(err));
  }
}

/**
 * Retrieves all student submissions from local Express server.
 */
export async function getStudentSubmissionsFromServer(): Promise<StudentSubmission[]> {
  try {
    const res = await fetch('/api/submissions');
    if (!res.ok) throw new Error(await res.text());
    const list = await res.json() as StudentSubmission[];
    // Sort by newest submissions first
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  } catch (err) {
    console.error('Error retrieving student submissions from local server:', err);
    return [];
  }
}

/**
 * Updates the Google Drive synchronization status for a specific student submission in our local server.
 */
export async function updateSubmissionSyncStatusOnServer(id: string, synced: boolean): Promise<void> {
  try {
    const res = await fetch(`/api/submissions/${id}/sync`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ synced })
    });
    if (!res.ok) throw new Error(await res.text());
    console.log(`Updated sync status for submission on local server: ${id} to ${synced}`);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : String(err));
  }
}

/**
 * Safely deletes a student submission from local server.
 */
export async function deleteSubmissionFromServer(id: string): Promise<void> {
  try {
    const res = await fetch(`/api/submissions/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error(await res.text());
    console.log('Successfully deleted student submission from local server:', id);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : String(err));
  }
}

/**
 * Utility to compress a canvas element into a JPEG data URL.
 */
export async function compressCanvasForStorage(canvas: HTMLCanvasElement): Promise<string> {
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
