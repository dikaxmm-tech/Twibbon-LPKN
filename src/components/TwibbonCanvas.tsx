import React, { useRef, useEffect, useState } from 'react';
import { PhotoParams, PhotoFilters, TemplateId } from '../types';
import { drawTemplate } from '../utils/templateDrawer';
import { 
  Move, 
  Image, 
  HelpCircle, 
  ZoomIn, 
  ZoomOut, 
  Lock, 
  Unlock, 
  ArrowUp, 
  ArrowDown, 
  ArrowLeft, 
  ArrowRight 
} from 'lucide-react';

interface TwibbonCanvasProps {
  selectedTemplateId: TemplateId;
  params: PhotoParams;
  filters: PhotoFilters;
  canvasBgColor: string;
  userPhotoImg: HTMLImageElement | null;
  customFrameImg: HTMLImageElement | null;
  onChangeParams: (params: PhotoParams) => void;
}

export default function TwibbonCanvas({
  selectedTemplateId,
  params,
  filters,
  canvasBgColor,
  userPhotoImg,
  customFrameImg,
  onChangeParams
}: TwibbonCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Dragging interaction state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Safety lock state to prevent touch devices from triggering accidental or overly sensitive drags.
  // Locked by default (false) so scrolling the page on Android/iOS is 100% fluid and doesn't scroll/jump the photo.
  const [enableTouchDrag, setEnableTouchDrag] = useState(false);

  // Canvas Internal Dimensions (High Resolution 4:5 aspect ratio)
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 1000;

  // Draw cycle
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Clear background and paint canvas bg color
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = canvasBgColor;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 2. Draw User Photo (Behind Frame)
    if (userPhotoImg) {
      ctx.save();

      // Configure CSS filters dynamically on context
      const filterStr = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%) sepia(${filters.warmth}%) grayscale(${filters.grayscale}%)`;
      ctx.filter = filterStr;

      // Translate coordinate origin to center point + current user drag displacement
      ctx.translate(CANVAS_WIDTH / 2 + params.x, CANVAS_HEIGHT / 2 + params.y);
      
      // Rotate
      ctx.rotate((params.rotation * Math.PI) / 180);
      
      // Flip Horizontal / Vertical
      ctx.scale(params.flipH ? -1 : 1, params.flipV ? -1 : 1);

      // Scale photo to cover the area nicely while preserving aspect ratio
      const imgW = userPhotoImg.width;
      const imgH = userPhotoImg.height;
      const baseScale = Math.min(CANVAS_WIDTH / imgW, CANVAS_HEIGHT / imgH) * 1.1; // modest magnification default

      const finalW = imgW * baseScale * params.scale;
      const finalH = imgH * baseScale * params.scale;

      // Draw centered
      ctx.drawImage(userPhotoImg, -finalW / 2, -finalH / 2, finalW, finalH);
      
      ctx.restore();
    } else {
      // Draw grid placeholder if no photo exists
      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.15)'; // faint emerald
      ctx.beginPath();
      // Draw standard photography thirds-grid inside the frame
      for (let i = 1; i < 3; i++) {
        // Vertical lines
        ctx.moveTo((CANVAS_WIDTH * i) / 3, 0);
        ctx.lineTo((CANVAS_WIDTH * i) / 3, CANVAS_HEIGHT);
        // Horizontal lines
        ctx.moveTo(0, (CANVAS_HEIGHT * i) / 3);
        ctx.lineTo(CANVAS_WIDTH, (CANVAS_HEIGHT * i) / 3);
      }
      ctx.stroke();
      
      // Draw guidance circle
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
      ctx.beginPath();
      ctx.arc(CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.44, CANVAS_WIDTH * 0.25, 0, Math.PI * 2);
      ctx.setLineDash([10, 8]);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Draw Twibbon Frame Overlay on top of Photo
    // Custom drawing or vector preset
    drawTemplate(ctx, selectedTemplateId, CANVAS_WIDTH, CANVAS_HEIGHT, customFrameImg);

    // 4. Draw Guide Label if no user photo
    if (!userPhotoImg) {
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.beginPath();
      const textBlockW = CANVAS_WIDTH * 0.58;
      const textBlockH = CANVAS_HEIGHT * 0.08;
      const rx = (CANVAS_WIDTH - textBlockW) / 2;
      const ry = CANVAS_HEIGHT * 0.44 - textBlockH / 2;
      
      // Draw mini card
      ctx.roundRect ? ctx.roundRect(rx, ry, textBlockW, textBlockH, 12) : ctx.rect(rx, ry, textBlockW, textBlockH);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 22px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Silakan Unggah Foto Anda', CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.44);
      ctx.restore();
    }

  }, [
    selectedTemplateId,
    params,
    filters,
    canvasBgColor,
    userPhotoImg,
    customFrameImg,
    CANVAS_WIDTH,
    CANVAS_HEIGHT
  ]);

  // Precise HUD on-canvas adjustments
  const handleZoomIn = () => {
    onChangeParams({
      ...params,
      scale: Math.min(4.0, params.scale + 0.05)
    });
  };

  const handleZoomOut = () => {
    onChangeParams({
      ...params,
      scale: Math.max(0.1, params.scale - 0.05)
    });
  };

  const handleMoveLeft = () => {
    onChangeParams({
      ...params,
      x: params.x - 8
    });
  };

  const handleMoveRight = () => {
    onChangeParams({
      ...params,
      x: params.x + 8
    });
  };

  const handleMoveUp = () => {
    onChangeParams({
      ...params,
      y: params.y - 8
    });
  };

  const handleMoveDown = () => {
    onChangeParams({
      ...params,
      y: params.y + 8
    });
  };

  const handleStart = (clientX: number, clientY: number) => {
    if (!userPhotoImg || !enableTouchDrag) return; // ignore dragging if no photo loaded or touch drag is disabled
    setIsDragging(true);
    setDragStart({ x: clientX, y: clientY });
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;

    const deltaX = clientX - dragStart.x;
    const deltaY = clientY - dragStart.y;

    // Convert screen drag delta to internal canvas space pixels
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;

    const scaleFactor = CANVAS_WIDTH / canvasElement.clientWidth;

    onChangeParams({
      ...params,
      x: params.x + deltaX * scaleFactor,
      y: params.y + deltaY * scaleFactor
    });

    setDragStart({ x: clientX, y: clientY });
  };

  const handleEnd = () => {
    setIsDragging(false);
  };

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    handleStart(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    handleMove(e.clientX, e.clientY);
  };

  // Touch Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches && e.touches[0]) {
      handleStart(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches && e.touches[0]) {
      // Prevent browser scrolling only if drag is explicitly enabled to avoid breaking mobile scrolling
      if (enableTouchDrag) {
        e.preventDefault();
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }
  };

  const stopPropagationHelper = (e: React.MouseEvent | React.TouchEvent | React.SyntheticEvent) => {
    e.stopPropagation();
  };

  return (
    <div className="flex flex-col items-center select-none" ref={containerRef}>
      {/* 4:5 Stage Container with gorgeous drop shadow */}
      <div 
        className={`relative w-full max-w-[390px] aspect-[4/5] bg-stone-100 rounded-3xl overflow-hidden shadow-2xl border-4 transition-all ${
          isDragging 
            ? 'border-emerald-500 cursor-grabbing shadow-emerald-500/15' 
            : 'border-white hover:border-stone-100 cursor-grab shadow-black/8'
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleEnd}
      >
        <canvas
          id="twibbon-preview-canvas"
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-full object-contain block bg-transparent"
        />

        {/* Drag status indicators layer */}
        {userPhotoImg && (
          <div className="absolute top-3.5 right-3.5 bg-black/65 backdrop-blur-md text-white text-[10px] px-2.5 py-1.5 rounded-full font-bold flex items-center gap-1.5 border border-white/10 select-none pointer-events-none">
            <div className={`w-2 h-2 rounded-full ${enableTouchDrag ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
            <span>{enableTouchDrag ? 'Sentuhan Geser: Aktif' : 'Sentuhan Geser: Kunci (Aman)'}</span>
          </div>
        )}

        {/* 4:5 Flag Label */}
        {!userPhotoImg && (
          <div className="absolute bottom-3.5 left-3.5 bg-black/55 backdrop-blur-md text-slate-100 text-[10px] px-2.5 py-1 rounded-md font-mono tracking-wider pointer-events-none">
            PORTRAIT • 4:5
          </div>
        )}

        {/* Floating Layout Precise Controller HUD Overlay */}
        {userPhotoImg && (
          <div 
            className="absolute inset-x-2 bottom-2 z-30 flex flex-col gap-1.5 select-none"
            onMouseDown={stopPropagationHelper}
            onTouchStart={stopPropagationHelper}
          >
            {/* Control HUD Bar */}
            <div className="flex items-center justify-between bg-slate-950/85 backdrop-blur-lg px-2.5 py-2 rounded-2xl border border-white/10 shadow-xl gap-2">
              {/* Touch Drag Lock Toggle */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setEnableTouchDrag(!enableTouchDrag); }}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-[10px] font-extrabold tracking-tight transition-all duration-300 ${
                  enableTouchDrag 
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                    : 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {enableTouchDrag ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                <span>{enableTouchDrag ? 'Seret: On' : 'Seret: Off'}</span>
              </button>

              {/* Zoom Buttons / Percentage */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all flex items-center justify-center shadow-md active:scale-95"
                  title="Perkecil Foto (Zoom Out)"
                >
                  <ZoomOut className="w-3.5 h-3.5" strokeWidth={2.5} />
                </button>
                <span className="text-[10px] text-white font-mono font-bold w-9 text-center">
                  {(params.scale * 100).toFixed(0)}%
                </span>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all flex items-center justify-center shadow-md active:scale-95"
                  title="Perbesar Foto (Zoom In)"
                >
                  <ZoomIn className="w-3.5 h-3.5" strokeWidth={2.5} />
                </button>
              </div>

              {/* D-Pad compact controls */}
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={handleMoveLeft}
                  className="w-6 h-6 rounded-md bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/10 active:scale-95"
                  title="Geser Kiri"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={handleMoveUp}
                    className="w-6 h-5 rounded-md bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/10 active:scale-95"
                    title="Geser Atas"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={handleMoveDown}
                    className="w-6 h-5 rounded-md bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/10 active:scale-95"
                    title="Geser Bawah"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleMoveRight}
                  className="w-6 h-6 rounded-md bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/10 active:scale-95"
                  title="Geser Kanan"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>
          </div>
        )}
      </div>

      <div className="mt-3.5 flex items-center gap-1.5 text-xs text-stone-500 font-medium max-w-[370px]">
        <HelpCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        <span className="text-left leading-normal">
          {enableTouchDrag 
            ? 'Layar Sentuh Aktif: Seret foto langsung dengan jari Anda.' 
            : 'Sentuhan dikunci agar posisi foto aman tidak tergeser saat layar scroll. Gunakan tombol HUD atas atau panel samping.'}
        </span>
      </div>
    </div>
  );
}
