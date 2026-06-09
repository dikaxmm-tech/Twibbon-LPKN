import { TemplateId } from '../types';

/**
 * Helper to draw text with standard canvas parameters
 */
function drawStyledText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  color: string,
  align: CanvasTextAlign = 'center',
  maxWidth?: number,
  strokeColor?: string,
  strokeWidth?: number
) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';

  if (strokeColor && strokeWidth) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.strokeText(text, x, y, maxWidth);
  }
  ctx.fillText(text, x, y, maxWidth);
}

/**
 * Helper to draw a rounded rectangle path on canvas
 */
function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Draw a beautiful botanical branch for the minimalist frame
 */
function drawBotanicalBranch(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  // Main branch stem
  ctx.beginPath();
  ctx.moveTo(0, 100);
  ctx.bezierCurveTo(-15, 60, -10, 20, 15, -60);
  ctx.strokeStyle = '#5c5246';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Draw leaf pairs along the stem
  const leafPositions = [
    { t: 0.1, angle: -45, len: 14, w: 7 },
    { t: 0.25, angle: 50, len: 16, w: 8 },
    { t: 0.4, angle: -40, len: 18, w: 9 },
    { t: 0.55, angle: 45, len: 18, w: 9 },
    { t: 0.7, angle: -35, len: 16, w: 8 },
    { t: 0.85, angle: 30, len: 14, w: 7 },
    { t: 0.98, angle: -10, len: 12, w: 6 }
  ];

  leafPositions.forEach(pos => {
    // Math to find point on main stem bezier
    // Simple linear approximation is fine for drawing aesthetic leaves
    const t = pos.t;
    const y = 100 - t * 160;
    const x = t * 15 - (1 - t) * (1 - t) * 15; // custom curved displacement

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((pos.angle * Math.PI) / 180);

    // Draw the leaf shapes (Sage green / terracotta soft tones)
    ctx.beginPath();
    ctx.ellipse(pos.len / 2, 0, pos.len / 2, pos.w / 2, 0, 0, 2 * Math.PI);
    ctx.fillStyle = pos.angle > 0 ? '#8f9e8b' : '#c89d7c';
    ctx.fill();
    ctx.strokeStyle = '#5c5246';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  });

  ctx.restore();
}

/**
 * Primary function that draws the 4:5 template decorations over a canvas
 * It applies 'destination-out' to carve a transparent hole for the user photo to peer through.
 */
export function drawTemplate(
  ctx: CanvasRenderingContext2D,
  templateId: TemplateId,
  w: number,
  h: number,
  customFrameImg?: HTMLImageElement | null
) {
  if (templateId === 'custom' || templateId.startsWith('custom-')) {
    if (customFrameImg) {
      // Draw uploaded transparent image over everything
      ctx.drawImage(customFrameImg, 0, 0, w, h);
    }
    return;
  }

  // Save state
  ctx.save();

  // Draw the solid template design
  switch (templateId) {
    case 'kemerdekaan': {
      // 1. Solid Red/Rose Deep Gradient Background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, '#c21515'); // Merah bendera tua
      bgGrad.addColorStop(0.3, '#dc2626'); // Merah terang
      bgGrad.addColorStop(0.7, '#e11d48'); // Merah rose
      bgGrad.addColorStop(1, '#881337'); // Merah maroon tua
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Aesthetic background stripes/starburst in background
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = w * 0.02;
      for (let i = -w; i < w * 2; i += w * 0.12) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + w * 0.5, h);
        ctx.stroke();
      }
      ctx.restore();

      // Draw subtle white bottom area
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(0, h * 0.75);
      ctx.bezierCurveTo(w * 0.25, h * 0.72, w * 0.75, h * 0.78, w, h * 0.73);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();

      // 2. Punch Cutout Circle centered at (w/2, h*0.42)
      const cx = w * 0.5;
      const cy = h * 0.43;
      const r = w * 0.29;

      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 3. Draw border and embellishments (Source-Over)
      // Double circle border (white & shiny gold)
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = w * 0.022; // white rim
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, r + w * 0.015, 0, Math.PI * 2);
      ctx.strokeStyle = '#FBBF24'; // Gold outer outline
      ctx.lineWidth = w * 0.008;
      ctx.stroke();

      // Draw glowing stars on top of the circle
      for (let i = -2; i <= 2; i++) {
        const starX = cx + i * (w * 0.09);
        const starY = cy - r - (w * 0.04) + Math.abs(i) * (w * 0.01);
        ctx.save();
        ctx.fillStyle = '#FBBF24';
        ctx.shadowColor = '#FBBF24';
        ctx.shadowBlur = w * 0.015;
        // Drawing simple star
        ctx.beginPath();
        ctx.arc(starX, starY, w * 0.015, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Draw small Ribbon at Left Top
      ctx.save();
      ctx.translate(w * 0.15, h * 0.12);
      ctx.rotate(-Math.PI / 8);
      // Red portion
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(-w * 0.1, -w * 0.03, w * 0.2, w * 0.03);
      // White portion
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-w * 0.1, 0, w * 0.2, w * 0.03);
      // Border outline
      ctx.strokeStyle = '#991b1b';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-w * 0.1, -w * 0.03, w * 0.2, w * 0.06);
      ctx.restore();

      // Draw red-white ribbon sash flowing at bottom of circle
      ctx.fillStyle = '#e11d48';
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.35, cy + r * 0.7);
      ctx.quadraticCurveTo(cx, cy + r * 1.1, cx + w * 0.35, cy + r * 0.7);
      ctx.lineTo(cx + w * 0.28, cy + r * 0.85);
      ctx.quadraticCurveTo(cx, cy + r * 1.25, cx - w * 0.28, cy + r * 0.85);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.32, cy + r * 0.83);
      ctx.quadraticCurveTo(cx, cy + r * 1.2, cx + w * 0.32, cy + r * 0.83);
      ctx.lineTo(cx + w * 0.28, cy + r * 0.95);
      ctx.quadraticCurveTo(cx, cy + r * 1.3, cx - w * 0.28, cy + r * 0.95);
      ctx.closePath();
      ctx.fill();

      // Red and white bunting in the upper sections
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      drawStyledText(ctx, 'HUT REPUBLIK INDONESIA', cx, h * 0.08, 'bold ' + Math.floor(w * 0.04) + 'px "Plus Jakarta Sans", sans-serif', '#FFFFFF', 'center', w * 0.8);
      ctx.restore();

      // Draw huge elegant "79" on red background
      drawStyledText(
        ctx,
        '79',
        cx,
        h * 0.19,
        'bold ' + Math.floor(w * 0.14) + 'px "Plus Jakarta Sans", "Inter", sans-serif',
        '#FBBF24', // Yellow Gold
        'center',
        w * 0.8,
        '#FFFFFF', // White stroke
        w * 0.02
      );

      // Text in the bottom section (white area)
      drawStyledText(
        ctx,
        'DIRGAHAYU INDONESIA',
        cx,
        h * 0.80,
        '900 ' + Math.floor(w * 0.07) + 'px "Plus Jakarta Sans", "Inter", sans-serif',
        '#be123c', // Deep Crimson Red
        'center',
        w * 0.9
      );

      drawStyledText(
        ctx,
        'Nusantara Baru, Indonesia Maju',
        cx,
        h * 0.87,
        'bold ' + Math.floor(w * 0.038) + 'px "Inter", sans-serif',
        '#475569', // Slate Gray
        'center',
        w * 0.85
      );

      drawStyledText(
        ctx,
        '#BanggaIndonesia #HUTRI79',
        cx,
        h * 0.93,
        'bold italic ' + Math.floor(w * 0.03) + 'px "Inter", monospace',
        '#059669', // Emerald Green accents
        'center',
        w * 0.8
      );
      break;
    }

    case 'wisuda': {
      // 1. Luxurious dark royal blue background gradient with diagonal geometric shades
      const bgGrad = ctx.createLinearGradient(0, 0, w, h);
      bgGrad.addColorStop(0, '#0f172a'); // Very dark slate
      bgGrad.addColorStop(0.4, '#1e3a8a'); // Royal blue
      bgGrad.addColorStop(1, '#172554'); // Darkest blue
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Add sparkling gold points in background
      ctx.fillStyle = 'rgba(251, 191, 36, 0.4)';
      for (let i = 0; i < 20; i++) {
        const pX = (Math.sin(i * 37) * 0.5 + 0.5) * w;
        const pY = (Math.cos(i * 83) * 0.5 + 0.5) * h;
        const size = (i % 3) + 1;
        ctx.beginPath();
        ctx.arc(pX, pY, size, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Punch Cutout: Large Rounded Rectangle centered
      const rx = w * 0.16;
      const ry = h * 0.20;
      const rw = w * 0.68;
      const rh = h * 0.51;
      const rRad = w * 0.05;

      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      drawRoundedRectPath(ctx, rx, ry, rw, rh, rRad);
      ctx.fill();
      ctx.restore();

      // 3. Draw border outline
      ctx.save();
      drawRoundedRectPath(ctx, rx, ry, rw, rh, rRad);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = w * 0.016;
      ctx.stroke();

      // Shiny Gold Outer thin border
      const gap = w * 0.012;
      drawRoundedRectPath(ctx, rx - gap, ry - gap, rw + gap * 2, rh + gap * 2, rRad + gap);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = w * 0.005;
      ctx.stroke();
      ctx.restore();

      // Draw stylized golden Laurel Leaves framing the corners
      ctx.save();
      ctx.translate(w * 0.5, h * 0.70);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      // Soft curves on both sides
      ctx.beginPath();
      ctx.arc(-w * 0.22, -h * 0.01, w * 0.1, 0, Math.PI, true);
      ctx.stroke();
      ctx.restore();

      // Top Header text
      drawStyledText(
        ctx,
        'HAPPY GRADUATION',
        w * 0.5,
        h * 0.09,
        'bold tracking-wider ' + Math.floor(w * 0.05) + 'px "Plus Jakarta Sans", sans-serif',
        '#fbbf24', // Amber/gold
        'center',
        w * 0.8,
        '#000000',
        w * 0.01
      );

      drawStyledText(
        ctx,
        'SELAMAT & SUKSES',
        w * 0.5,
        h * 0.14,
        'bold ' + Math.floor(w * 0.032) + 'px "Inter", sans-serif',
        '#ffffff',
        'center',
        w * 0.8
      );

      // Icon: Graduation cap overlapping the corner of cutout
      ctx.save();
      ctx.translate(rx + w * 0.04, ry - w * 0.02);
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 8;
      // Draw cap rhombus
      ctx.beginPath();
      ctx.moveTo(0, -w * 0.04);
      ctx.lineTo(w * 0.08, -w * 0.07);
      ctx.lineTo(w * 0.16, -w * 0.04);
      ctx.lineTo(w * 0.08, -w * 0.01);
      ctx.closePath();
      ctx.fillStyle = '#1e293b';
      ctx.fill();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Cap under-cap band
      ctx.beginPath();
      ctx.moveTo(w * 0.04, -w * 0.023);
      ctx.quadraticCurveTo(w * 0.08, -w * 0.005, w * 0.12, -w * 0.023);
      ctx.lineTo(w * 0.12, -w * 0.005);
      ctx.quadraticCurveTo(w * 0.08, w * 0.01, w * 0.04, -w * 0.005);
      ctx.closePath();
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      ctx.stroke();

      // Tassel
      ctx.beginPath();
      ctx.moveTo(w * 0.08, -w * 0.04);
      ctx.lineTo(w * 0.14, -w * 0.02);
      ctx.lineTo(w * 0.14, w * 0.03);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(w * 0.14, w * 0.03, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#fbbf24';
      ctx.fill();
      ctx.restore();

      // Text in the bottom section
      drawStyledText(
        ctx,
        'Congratulations on Your Success!',
        w * 0.5,
        h * 0.77,
        'italic ' + Math.floor(w * 0.045) + 'px Georgia, serif',
        '#ffffff',
        'center',
        w * 0.85
      );

      drawStyledText(
        ctx,
        'Satu langkah telah dicapai, gerbang petualangan baru kini menanti di depan mata. Teruslah berkarya dan raih cita-citamu!',
        w * 0.5,
        h * 0.85,
        Math.floor(w * 0.031) + 'px "Inter", sans-serif',
        '#94a3b8',
        'center',
        w * 0.82
      );

      // Gold badge at bottom center
      ctx.save();
      const bY = h * 0.94;
      ctx.fillStyle = '#fbbf24';
      drawStyledText(ctx, '🎓 CLASS OF 2026', w * 0.5, bY, 'bold tracking-widest ' + Math.floor(w * 0.03) + 'px "Inter", sans-serif', '#1e293b');
      ctx.restore();
      break;
    }

    case 'estetik': {
      // 1. Cozy aesthetic background colors (Soft warm beige base)
      ctx.fillStyle = '#f5ede3';
      ctx.fillRect(0, 0, w, h);

      // Draw aesthetic organic blobs (soft terracotta, clay sage, and ochre paths)
      ctx.save();
      // Orange-terracotta blob bottom-left
      ctx.fillStyle = 'rgba(217, 136, 108, 0.4)';
      ctx.beginPath();
      ctx.arc(w * 0.1, h * 0.8, w * 0.35, 0, Math.PI * 2);
      ctx.fill();

      // Sage-green circular blob top-right
      ctx.fillStyle = 'rgba(143, 158, 139, 0.3)';
      ctx.beginPath();
      ctx.arc(w * 0.9, h * 0.15, w * 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Warm sand clay blob middle-left
      ctx.fillStyle = 'rgba(225, 179, 130, 0.25)';
      ctx.beginPath();
      ctx.arc(w * -0.05, h * 0.35, w * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 2. Punch Cutout: Elegant Classical Arch (Rectangle + semicircle on top)
      // Height of layout is h. Semicircle at top.
      const archW = w * 0.62;
      const archL = w * 0.19; // Left point
      const archRad = archW / 2;
      const archTopY = h * 0.38; // Semicircle center point (vertical height of transition)
      const archBottomY = h * 0.72; // Base height of portal

      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      // Arc on top
      ctx.arc(archL + archRad, archTopY, archRad, Math.PI, 0, false);
      // Rect lines down
      ctx.lineTo(archL + archW, archBottomY);
      ctx.lineTo(archL, archBottomY);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // 3. Draw clean earthy border outline around the arch
      ctx.save();
      ctx.strokeStyle = '#6e6153';
      ctx.lineWidth = w * 0.012;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.arc(archL + archRad, archTopY, archRad, Math.PI, 0, false);
      ctx.lineTo(archL + archW, archBottomY);
      ctx.lineTo(archL, archBottomY);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      // Draw beautiful stylized botanical branch overlapping the arch on the right side
      drawBotanicalBranch(ctx, w * 0.88, h * 0.48, w * 0.0016);

      // Text designs
      drawStyledText(
        ctx,
        '• THE FUTURE IS YOURS •',
        w * 0.5,
        h * 0.12,
        'bold tracking-[0.2em] ' + Math.floor(w * 0.038) + 'px "Plus Jakarta Sans", sans-serif',
        '#4a3f35',
        'center',
        w * 0.8
      );

      // Bottom minimalist quotes
      drawStyledText(
        ctx,
        'Langkah Kecil Setiap Hari',
        w * 0.5,
        h * 0.80,
        '650 italic ' + Math.floor(w * 0.046) + 'px Georgia, serif',
        '#614e3d',
        'center',
        w * 0.85
      );

      drawStyledText(
        ctx,
        'Hiduplah dengan penuh kesadaran, melangkah perlahan namun pasti.',
        w * 0.5,
        h * 0.86,
        Math.floor(w * 0.032) + 'px "Inter", sans-serif',
        '#7c6e62',
        'center',
        w * 0.8
      );

      drawStyledText(
        ctx,
        'A E S T H E T I C  •  M I N I M A L I S T',
        w * 0.5,
        h * 0.94,
        'letter-spacing-wide ' + Math.floor(w * 0.024) + 'px "Inter", sans-serif',
        '#a08f80',
        'center',
        w * 0.8
      );
      break;
    }

    case 'pancasila': {
      // 1. Deep elegant teal/emerald-green background gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, '#042f2e'); // Deep teal darkest
      bgGrad.addColorStop(0.5, '#0f766e'); // Teal medium
      bgGrad.addColorStop(1, '#022c22'); // Emerald darkest
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Draw geometric mandala-like radiating lines inside background
      ctx.save();
      ctx.globalAlpha = 0.06;
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1;
      const tX = w * 0.5;
      const tY = h * 0.45;
      for (let angle = 0; angle < 360; angle += 15) {
        ctx.beginPath();
        ctx.moveTo(tX, tY);
        const rad = (angle * Math.PI) / 180;
        ctx.lineTo(tX + Math.cos(rad) * w * 1.5, tY + Math.sin(rad) * w * 1.5);
        ctx.stroke();
      }
      ctx.restore();

      // 2. Circular Cutout
      const pCx = w * 0.5;
      const pCy = h * 0.44;
      const pRadius = w * 0.28;

      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(pCx, pCy, pRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 3. Decorative golden frames around circular cutout
      ctx.save();
      // Outer border circle
      ctx.beginPath();
      ctx.arc(pCx, pCy, pRadius, 0, Math.PI * 2);
      ctx.strokeStyle = '#f59e0b'; // Amber Gold
      ctx.lineWidth = w * 0.015;
      ctx.stroke();

      // Sunray-like gold petals around the circle
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
      ctx.lineWidth = 2;
      for (let angle = 0; angle < 360; angle += 12) {
        const rad = (angle * Math.PI) / 180;
        const outerR = pRadius + w * 0.024;
        const oX = pCx + Math.cos(rad) * outerR;
        const oY = pCy + Math.sin(rad) * outerR;
        ctx.beginPath();
        ctx.arc(oX, oY, w * 0.006, 0, Math.PI * 2);
        ctx.fillStyle = '#fbbf24';
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();

      // Core texts on top
      drawStyledText(
        ctx,
        'HARI LAHIR PANCASILA',
        w * 0.5,
        h * 0.08,
        'bold tracking-wider ' + Math.floor(w * 0.046) + 'px "Plus Jakarta Sans", sans-serif',
        '#FFFFFF',
        'center',
        w * 0.8
      );

      drawStyledText(
        ctx,
        '1 JUNI',
        w * 0.5,
        h * 0.14,
        '900 ' + Math.floor(w * 0.08) + 'px "Plus Jakarta Sans", sans-serif',
        '#fbbf24',
        'center',
        w * 0.8
      );

      // Red and gold elegant star/shield symbol at the top center
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 8;
      // Small symbolic shield or circle
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.15 + w * 0.07, w * 0.025, 0, Math.PI * 2);
      ctx.fillStyle = '#dc2626'; // Red core
      ctx.fill();
      ctx.strokeStyle = '#f59e0b'; // Gold border
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // Bottom card
      ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
      ctx.fillRect(0, h * 0.76, w, h * 0.24);

      drawStyledText(
        ctx,
        'KITA INDONESIA, KITA PANCASILA',
        w * 0.5,
        h * 0.82,
        'bold tracking-wide ' + Math.floor(w * 0.042) + 'px "Plus Jakarta Sans", sans-serif',
        '#fbbf24',
        'center',
        w * 0.95
      );

      drawStyledText(
        ctx,
        'Menjaga persatuan, menumbuhkan kepedulian, dan mempererat tali persaudaraan demi kemajuan NKRI.',
        w * 0.5,
        h * 0.89,
        Math.floor(w * 0.03) + 'px "Inter", sans-serif',
        '#cbd5e1',
        'center',
        w * 0.82
      );

      break;
    }
  }

  // Restore state
  ctx.restore();
}
