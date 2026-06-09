import React, { useRef, useState } from 'react';
import { PhotoParams, PhotoFilters, TemplateId, TwibbonTemplate } from '../types';
import {
  Upload,
  RotateCw,
  ZoomIn,
  SlidersHorizontal,
  RefreshCw,
  Sun,
  Palette,
  Camera,
  Trash2,
  FlipHorizontal,
  FlipVertical,
  CloudLightning,
  Cloud,
  Loader2
} from 'lucide-react';

interface PhotoControlsProps {
  selectedTemplateId: TemplateId;
  activeTemplate?: TwibbonTemplate;
  params: PhotoParams;
  filters: PhotoFilters;
  canvasBgColor: string;
  onChangeParams: (params: PhotoParams) => void;
  onChangeFilters: (filters: PhotoFilters) => void;
  onChangeBgColor: (color: string) => void;
  onUploadPhoto: (file: File) => void;
  onUploadFrame: (file: File) => void;
  onResetParams: () => void;
  hasPhoto: boolean;
  hasCustomFrame: boolean;
  onRemovePhoto: () => void;
  onRemoveFrame: () => void;
  isDriveConnected?: boolean;
  isUploadingToDrive?: boolean;
  driveFolderLink?: string;
}

export default function PhotoControls({
  selectedTemplateId,
  activeTemplate,
  params,
  filters,
  canvasBgColor,
  onChangeParams,
  onChangeFilters,
  onChangeBgColor,
  onUploadPhoto,
  onUploadFrame,
  onResetParams,
  hasPhoto,
  hasCustomFrame,
  onRemovePhoto,
  onRemoveFrame,
  isDriveConnected = false,
  isUploadingToDrive = false,
  driveFolderLink = "https://drive.google.com/drive/folders/1TTV0Z30uA_A5nU4cvdyuI3JlZyME3121"
}: PhotoControlsProps) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const frameInputRef = useRef<HTMLInputElement>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Drag over states
  const [isDragOverPhoto, setIsDragOverPhoto] = useState(false);
  const [isDragOverFrame, setIsDragOverFrame] = useState(false);

  // File Handlers
  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadPhoto(e.target.files[0]);
    }
  };

  const handleFrameFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadFrame(e.target.files[0]);
    }
  };

  const triggerPhotoUpload = () => photoInputRef.current?.click();
  const triggerFrameUpload = () => frameInputRef.current?.click();

  // Drag-and-Drop photo
  const handlePhotoDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverPhoto(true);
  };
  const handlePhotoDragLeave = () => setIsDragOverPhoto(false);
  const handlePhotoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverPhoto(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onUploadPhoto(e.dataTransfer.files[0]);
    }
  };

  // Drag-and-Drop custom frame
  const handleFrameDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverFrame(true);
  };
  const handleFrameDragLeave = () => setIsDragOverFrame(false);
  const handleFrameDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverFrame(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onUploadFrame(e.dataTransfer.files[0]);
    }
  };

  // Param Adjusters
  const updateParam = (key: keyof PhotoParams, val: number | boolean) => {
    onChangeParams({
      ...params,
      [key]: val
    });
  };

  // Filter Adjusters
  const updateFilter = (key: keyof PhotoFilters, val: number) => {
    onChangeFilters({
      ...filters,
      [key]: val
    });
  };

  // Custom directional nudges if dragging is hard
  const nudgePhoto = (dx: number, dy: number) => {
    onChangeParams({
      ...params,
      x: params.x + dx,
      y: params.y + dy
    });
  };

  const PRESET_BG_COLORS = [
    '#ffffff', // White
    '#000000', // Black
    '#f1f5f9', // Light Gray
    '#fef2f2', // Soft Red
    '#eff6ff', // Soft Blue
    '#faf5ff', // Soft Purple
    '#fdf9c4', // Soft Yellow
  ];

  return (
    <div className="space-y-6">
      {/* Google Drive Status Alert Box */}
      <div className={`p-4 rounded-2xl border transition-all ${
        isDriveConnected 
          ? 'bg-emerald-50/55 border-emerald-200 text-emerald-800' 
          : 'bg-amber-50/55 border-amber-200 text-amber-800'
      }`}>
        <div className="flex items-start space-x-3 text-left">
          <div className="mt-0.5">
            {isDriveConnected ? (
              isUploadingToDrive ? (
                <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
              ) : (
                <Cloud className="w-5 h-5 text-emerald-600 fill-emerald-100" />
              )
            ) : (
              <CloudLightning className="w-5 h-5 text-amber-500" />
            )}
          </div>
          <div className="text-xs">
            <h5 className="font-bold">
              {isDriveConnected ? 'Google Drive Aktif & Tersinkronisasi' : 'Sinkronisasi Google Drive Aktif'}
            </h5>
            <p className={`mt-1 font-medium leading-normal ${isDriveConnected ? 'text-emerald-700' : 'text-amber-700'}`}>
              {isDriveConnected 
                ? 'Terhubung dengan sukses! Setiap berkas foto dan bingkai kustom terunggah dikirim otomatis ke cloud.'
                : 'Situs terintegrasi penuh. Silakan masuk akun Google demi kelancaran pencadangan berkas otomatis.'}
            </p>
          </div>
        </div>
      </div>

      {/* 1. LAYER FRAMES UPLOAD */}
      {selectedTemplateId === 'custom' ? (
        <div className="space-y-3">
          <label className="text-[13px] font-bold text-slate-700 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold">1</span>
              Unggah Bingkai Kustom Anda (.png)
            </span>
            {hasCustomFrame && (
              <button
                onClick={onRemoveFrame}
                className="text-xs text-rose-500 hover:text-rose-600 font-semibold flex items-center gap-1 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Hapus
              </button>
            )}
          </label>
          
          <input
            ref={frameInputRef}
            type="file"
            accept="image/png, image/jpeg, image/jpg, image/webp"
            style={{ opacity: 0, position: 'absolute', width: '1px', height: '1px', pointerEvents: 'none' }}
            onChange={handleFrameFileChange}
          />

          {!hasCustomFrame ? (
            <div
              onDragOver={handleFrameDragOver}
              onDragLeave={handleFrameDragLeave}
              onDrop={handleFrameDrop}
              onClick={triggerFrameUpload}
              className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all duration-300 ${
                isDragOverFrame
                  ? 'border-indigo-600 bg-indigo-50/50'
                  : 'border-gray-200 hover:border-indigo-400 bg-white hover:bg-gray-50/30'
              }`}
            >
              <div className="mx-auto w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 mb-2">
                <Upload className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-slate-800">Unggah berkas bingkai twibbon</p>
              <p className="text-xs text-slate-400 mt-1">Sangat direkomendasikan berkas PNG transparan rasio 4:5</p>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">PNG</div>
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-800 line-clamp-1">Bingkai Kustom Aktif</p>
                  <p className="text-[10px] text-slate-400">Siap pasangkan foto Anda</p>
                </div>
              </div>
              <button
                onClick={triggerFrameUpload}
                className="text-xs bg-white text-indigo-600 font-semibold px-2.5 py-1.5 rounded-lg border border-indigo-200 hover:bg-indigo-50 transition-colors"
              >
                Ganti
              </button>
            </div>
          )}
        </div>
      ) : activeTemplate ? (
        <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200 flex items-center justify-between">
          <div className="flex items-center space-x-3 text-left">
            <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-inner">
              ✓
            </span>
            <div>
              <h5 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                Bingkai Kampus Aktif
              </h5>
              <p className="text-[11px] text-emerald-800 font-medium line-clamp-1">{activeTemplate.name}</p>
            </div>
          </div>
          <span className="text-[10px] bg-emerald-100 text-emerald-900 border border-emerald-250 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
            Siswa Siap Pakai
          </span>
        </div>
      ) : null}

      {/* 2. USER PHOTO UPLOAD ZONE */}
      <div className="space-y-3">
        <label className="text-[13px] font-bold text-slate-700 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-lg bg-indigo-55 text-indigo-600 bg-indigo-50 flex items-center justify-center text-xs font-bold">
              {selectedTemplateId === 'custom' ? '2' : '1'}
            </span>
            Unggah Foto Anda (Latar Belakang)
          </span>
          {hasPhoto && (
            <button
              onClick={onRemovePhoto}
              className="text-xs text-rose-500 hover:text-rose-600 font-semibold flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Hapus
            </button>
          )}
        </label>
        
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          style={{ opacity: 0, position: 'absolute', width: '1px', height: '1px', pointerEvents: 'none' }}
          onChange={handlePhotoFileChange}
        />

        {!hasPhoto ? (
          <div
            onDragOver={handlePhotoDragOver}
            onDragLeave={handlePhotoDragLeave}
            onDrop={handlePhotoDrop}
            onClick={triggerPhotoUpload}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-300 ${
              isDragOverPhoto
                ? 'border-indigo-600 bg-indigo-50/50'
                : 'border-gray-200 hover:border-indigo-400 bg-white hover:bg-gray-50/30'
            }`}
          >
            <div className="mx-auto w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 mb-2.5">
              <Camera className="w-5 h-5" />
            </div>
            <p className="text-sm font-bold text-slate-850">Pilih atau Seret Foto Anda di Sini</p>
            <p className="text-xs text-slate-400 mt-1">Mendukung berkas JPEG, PNG, WEBP, atau HEIC</p>
          </div>
        ) : (
          <div className="flex items-center justify-between p-3.5 bg-indigo-50/40 rounded-xl border border-indigo-100">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-inner">
                <Camera className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-slate-800">Foto Anda Terpasang</p>
                <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full">
                  Siap Diedit
                </span>
              </div>
            </div>
            <div className="flex space-x-1.5">
              <button
                onClick={triggerPhotoUpload}
                className="text-xs bg-white text-indigo-700 font-bold px-2.5 py-1.5 rounded-lg border border-indigo-200 hover:bg-indigo-50 transition-colors"
              >
                Ganti Foto
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. PHOTO ADJUSTMENTS PANELS (ONLY enabled when photo exists) */}
      {hasPhoto && (
        <div className="space-y-4 border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between pb-1">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
              Atur Posisi & Skala Foto
            </h4>
            <button
              onClick={onResetParams}
              className="text-xs text-slate-500 hover:text-indigo-600 font-semibold flex items-center gap-1 transition-colors"
              title="Reset ke pengaturan awal"
            >
              <RefreshCw className="w-3 h-3" /> Reset
            </button>
          </div>

          <p className="text-[11px] text-slate-400 italic">
            Tips: Anda juga bisa menggeser foto secara langsung dengan menyeret (drag) preview di samping!
          </p>

          {/* Scale Slider */}
          <div className="space-y-1.5 p-3.5 bg-gray-50 rounded-xl border border-gray-200/50">
            <div className="flex justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1">
                <ZoomIn className="w-3.5 h-3.5 text-slate-400" /> Ukuran (Skala)
              </span>
              <span className="font-mono text-slate-500">{params.scale.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="4.0"
              step="0.01"
              value={params.scale}
              onChange={(e) => updateParam('scale', parseFloat(e.target.value))}
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
          </div>

          {/* Rotate Slider */}
          <div className="space-y-1.5 p-3.5 bg-gray-50 rounded-xl border border-gray-200/50">
            <div className="flex justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1">
                <RotateCw className="w-3.5 h-3.5 text-slate-400" /> Rotasi Bingkai
              </span>
              <span className="font-mono text-slate-500">{params.rotation}°</span>
            </div>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={params.rotation}
              onChange={(e) => updateParam('rotation', parseInt(e.target.value))}
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
          </div>

          {/* Horizontal / Vertical Mirrors and Micro displacement buttons */}
          <div className="grid grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Balik Foto</span>
              <div className="flex space-x-1.5">
                <button
                  onClick={() => updateParam('flipH', !params.flipH)}
                  className={`flex-1 p-2 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                    params.flipH
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                      : 'bg-white border-gray-300 text-slate-700 hover:bg-gray-50'
                  }`}
                >
                  <FlipHorizontal className="w-3.5 h-3.5" /> Horizontal
                </button>
                <button
                  onClick={() => updateParam('flipV', !params.flipV)}
                  className={`flex-1 p-2 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                    params.flipV
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                      : 'bg-white border-gray-300 text-slate-700 hover:bg-gray-50'
                  }`}
                >
                  <FlipVertical className="w-3.5 h-3.5" /> Vertikal
                </button>
              </div>
            </div>

            {/* D-Pad controls for precise offset tuning */}
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Geser Presisi</span>
              <div className="grid grid-cols-4 gap-1 p-1 bg-gray-100 rounded-lg border border-gray-200">
                <button
                  type="button"
                  onClick={() => nudgePhoto(-10, 0)}
                  className="p-1 rounded bg-white border border-gray-300 text-slate-700 hover:bg-gray-50 flex items-center justify-center active:scale-95 transition-transform font-mono"
                  title="Geser Kiri"
                >
                  ◀
                </button>
                <button
                  type="button"
                  onClick={() => nudgePhoto(0, -10)}
                  className="p-1 rounded bg-white border border-gray-300 text-slate-700 hover:bg-gray-50 flex items-center justify-center active:scale-95 transition-transform font-mono"
                  title="Geser Atas"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => nudgePhoto(0, 10)}
                  className="p-1 rounded bg-white border border-gray-300 text-slate-700 hover:bg-gray-50 flex items-center justify-center active:scale-95 transition-transform font-mono"
                  title="Geser Bawah"
                >
                  ▼
                </button>
                <button
                  type="button"
                  onClick={() => nudgePhoto(10, 0)}
                  className="p-1 rounded bg-white border border-gray-300 text-slate-700 hover:bg-gray-50 flex items-center justify-center active:scale-95 transition-transform font-mono"
                  title="Geser Kanan"
                >
                  ▶
                </button>
              </div>
            </div>
          </div>

          {/* collapsible filter sliders to match look and colors */}
          <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="w-full flex items-center justify-between p-3.5 bg-gray-50 border-b border-gray-100 text-slate-700 hover:bg-gray-100/70 transition-colors"
            >
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Sun className="w-4 h-4 text-amber-500" />
                Penyesuaian Efek / Filter Warna Foto
              </span>
              <span className="text-xs text-indigo-600 font-semibold">
                {showFilters ? 'Sembunyikan ▲' : 'Tampilkan Efek ▼'}
              </span>
            </button>

            {showFilters && (
              <div className="p-4 space-y-3 bg-white text-left text-xs text-slate-600">
                {/* Brightness */}
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-700">Kecerahan (Brightness)</span>
                    <span className="font-mono text-slate-500">{filters.brightness}%</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="180"
                    value={filters.brightness}
                    onChange={(e) => updateFilter('brightness', parseInt(e.target.value))}
                    className="w-full h-1 bg-gray-200 rounded accent-indigo-600 cursor-pointer"
                  />
                </div>

                {/* Contrast */}
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-700">Kontras (Contrast)</span>
                    <span className="font-mono text-slate-500">{filters.contrast}%</span>
                  </div>
                  <input
                    type="range"
                    min="55"
                    max="160"
                    value={filters.contrast}
                    onChange={(e) => updateFilter('contrast', parseInt(e.target.value))}
                    className="w-full h-1 bg-gray-200 rounded accent-indigo-600 cursor-pointer"
                  />
                </div>

                {/* Saturation */}
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-700">Saturasi Warna</span>
                    <span className="font-mono text-slate-500">{filters.saturation}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={filters.saturation}
                    onChange={(e) => updateFilter('saturation', parseInt(e.target.value))}
                    className="w-full h-1 bg-gray-200 rounded accent-indigo-600 cursor-pointer"
                  />
                </div>

                {/* Warmth (Sepia) */}
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-700">Kehangatan Warna (Warmth)</span>
                    <span className="font-mono text-slate-500">{filters.warmth}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={filters.warmth}
                    onChange={(e) => updateFilter('warmth', parseInt(e.target.value))}
                    className="w-full h-1 bg-gray-200 rounded accent-indigo-600 cursor-pointer"
                  />
                </div>

                {/* Grayscale */}
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-700">Hitam Putih (Grayscale)</span>
                    <span className="font-mono text-slate-500">{filters.grayscale}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={filters.grayscale}
                    onChange={(e) => updateFilter('grayscale', parseInt(e.target.value))}
                    className="w-full h-1 bg-gray-200 rounded accent-indigo-600 cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. CANVAS BACKGROUND COLOR PICKER (Useful for fitting smaller pictures) */}
      <div className="space-y-2 border-t border-gray-100 pt-4">
        <label className="text-[13px] font-bold text-slate-700 flex items-center gap-1.5">
          <Palette className="w-4 h-4 text-indigo-600" />
          Warna Latar Belakang Kanvas
        </label>
        <p className="text-xs text-slate-400">
          Warna ini akan mengisi bagian yang kosong jika foto Anda tidak menutupi seluruh bingkai.
        </p>
        <div className="flex items-center space-x-2">
          {PRESET_BG_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onChangeBgColor(color)}
              className={`w-6 h-6 rounded-full border shadow-sm flex-shrink-0 transition-all ${
                canvasBgColor.toLowerCase() === color.toLowerCase()
                  ? 'ring-2 ring-indigo-500 ring-offset-2 border-transparent scale-110'
                  : 'border-gray-200 hover:scale-105'
              }`}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
          {/* Custom Hex input */}
          <input
            type="color"
            value={canvasBgColor}
            onChange={(e) => onChangeBgColor(e.target.value)}
            className="w-8 h-7 rounded p-0 cursor-pointer border border-gray-200"
            title="Warna Kustom"
          />
        </div>
      </div>
    </div>
  );
}
