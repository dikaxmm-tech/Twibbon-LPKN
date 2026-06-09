/**
 * Compresses an image file down to a tiny web-safe thumbnail base64 string
 * to prevent localStorage QuotaExceeded errors on mobile devices.
 */
export function createCompressedThumbnail(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        
        // Max dimension for the thumbnail card (e.g. 150px)
        const maxDim = 150;
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > maxDim) {
            height *= maxDim / width;
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width *= maxDim / height;
            height = maxDim;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Draw image to target thumbnail size
          ctx.drawImage(img, 0, 0, width, height);
          
          // Export high compression WebP or JPEG
          // WebP is highly supported and extremely small
          resolve(canvas.toDataURL('image/webp', 0.6) || canvas.toDataURL('image/jpeg', 0.6));
          return;
        }
        
        // Fallback to original base64 if canvas is unavailable
        resolve(event.target?.result as string);
      };
      
      img.onerror = () => {
        resolve(event.target?.result as string);
      };
    };
    
    reader.onerror = () => {
      resolve('');
    };
  });
}
