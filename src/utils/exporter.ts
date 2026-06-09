import { TemplateId, PhotoParams, PhotoFilters } from '../types';
import { drawTemplate } from './templateDrawer';

interface ExportParams {
  templateId: TemplateId;
  params: PhotoParams;
  filters: PhotoFilters;
  canvasBgColor: string;
  userPhotoImg: HTMLImageElement | null;
  customFrameImg: HTMLImageElement | null;
  fileName?: string;
  format?: 'png' | 'jpeg';
}

/**
 * HD Exporter creating an offscreen canvas at 1080x1350.
 * Scaling coordinate parameters up to maintain identical relative compositing ratios.
 */
export function exportToHD({
  templateId,
  params,
  filters,
  canvasBgColor,
  userPhotoImg,
  customFrameImg,
  fileName = 'twibbon-bingkaikita-45',
  format = 'png'
}: ExportParams): Promise<boolean> {
  return new Promise((resolve) => {
    // 1080 x 1350 is the optimal Instagram portrait sizes
    const HD_WIDTH = 1080;
    const HD_HEIGHT = 1350;

    // Scale ratio compared to our preview canvas coordinates (800x1000)
    const scaleRatio = HD_WIDTH / 800; // 1.35x

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = HD_WIDTH;
    exportCanvas.height = HD_HEIGHT;

    const ctx = exportCanvas.getContext('2d');
    if (!ctx) {
      resolve(false);
      return;
    }

    // A. Paint background color
    ctx.fillStyle = canvasBgColor;
    ctx.fillRect(0, 0, HD_WIDTH, HD_HEIGHT);

    // B. Draw User Photo (Behind) with high precision
    if (userPhotoImg) {
      ctx.save();

      // Set filters
      const filterStr = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%) sepia(${filters.warmth}%) grayscale(${filters.grayscale}%)`;
      ctx.filter = filterStr;

      // Translate with scaled offsets
      const transX = HD_WIDTH / 2 + params.x * scaleRatio;
      const transY = HD_HEIGHT / 2 + params.y * scaleRatio;
      ctx.translate(transX, transY);

      // Rotate
      ctx.rotate((params.rotation * Math.PI) / 180);

      // Flip
      ctx.scale(params.flipH ? -1 : 1, params.flipV ? -1 : 1);

      // Raw proportions
      const imgW = userPhotoImg.width;
      const imgH = userPhotoImg.height;
      const baseScale = Math.min(HD_WIDTH / imgW, HD_HEIGHT / imgH) * 1.1;

      // Compound final size
      const finalW = imgW * baseScale * params.scale;
      const finalH = imgH * baseScale * params.scale;

      ctx.drawImage(userPhotoImg, -finalW / 2, -finalH / 2, finalW, finalH);
      ctx.restore();
    }

    // C. Overlap frame (preset or custom frame)
    drawTemplate(ctx, templateId, HD_WIDTH, HD_HEIGHT, customFrameImg);

    // D. Trigger browser download
    try {
      const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
      const quality = format === 'jpeg' ? 0.95 : undefined;
      const dataUrl = exportCanvas.toDataURL(mimeType, quality);

      const link = document.createElement('a');
      link.download = `${fileName.replace(/\s+/g, '-').toLowerCase()}.${format}`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      resolve(true);
    } catch (e) {
      console.error('Failed to export canvas', e);
      resolve(false);
    }
  });
}
