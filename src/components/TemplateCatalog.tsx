import React, { useState } from 'react';
import { TemplateId, TwibbonTemplate } from '../types';
import { Upload, Layout, Award, Map, Heart, Share2, Check, Star } from 'lucide-react';

interface TemplateCatalogProps {
  selectedId: TemplateId;
  onSelect: (id: TemplateId) => void;
  templates: TwibbonTemplate[];
  onSetDefault?: (id: string) => void;
}

export default function TemplateCatalog({ selectedId, onSelect, templates, onSetDefault }: TemplateCatalogProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleShare = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Avoid triggering template selection action on card click
    const shareUrl = `${window.location.origin}${window.location.pathname}?id=${id}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(err => {
      console.error('Failed to copy share link:', err);
    });
  };

  const handleSetDefault = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Avoid triggering template selection action
    if (onSetDefault) {
      onSetDefault(id);
    }
  };

  // Helper to resolve category icons representing each model
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Nasional':
        return <Map className="w-4 h-4" />;
      case 'Akademik':
        return <Award className="w-4 h-4" />;
      case 'Gaya Hidup':
        return <Heart className="w-4 h-4 text-rose-500" />;
      default:
        return <Upload className="w-4 h-4 text-indigo-600" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-gray-100">
        <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
          <Layout className="w-4 h-4 text-indigo-600" />
          Pilih Bingkai Twibbon
        </h3>
        <span className="text-[11px] font-semibold text-slate-500 bg-gray-100 px-2 py-0.5 rounded-md">
          {templates.length} Bingkai Tersedia
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {templates.map((tmpl) => {
          const isSelected = selectedId === tmpl.id;
          const isBaseCustom = tmpl.id === 'custom';
          return (
            <div
              key={tmpl.id}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(tmpl.id);
                }
              }}
              onClick={() => onSelect(tmpl.id)}
              className={`cursor-pointer group relative text-left p-4.5 rounded-2xl border transition-all duration-300 flex flex-col justify-between ${
                isSelected
                  ? 'border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-500/10'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50'
              }`}
            >
              {/* Category tag */}
              <div className="flex items-center justify-between w-full mb-3.5">
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full ${
                  isBaseCustom
                    ? 'bg-indigo-100 text-indigo-800'
                    : tmpl.isDefault
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {getCategoryIcon(tmpl.category)}
                  <span className="ml-1">{tmpl.category}</span>
                </span>
                
                {tmpl.isDefault ? (
                  <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 animate-pulse">
                    <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                    Utama
                  </span>
                ) : isBaseCustom ? (
                  <span className="text-[10px] text-slate-400 font-medium">Bebas & Transparan</span>
                ) : (
                  <span className="text-[10px] text-emerald-500 font-semibold">Tersimpan</span>
                )}
              </div>

              {/* Main content */}
              <div>
                <h4 className="text-sm font-extrabold text-slate-800 tracking-tight group-hover:text-indigo-700 transition-colors">
                  {tmpl.name}
                </h4>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                  {tmpl.description}
                </p>
              </div>

              {/* Decorative mini preview or actual custom thumbnail */}
              <div className="mt-4 flex items-center justify-between w-full gap-2">
                <div className="flex items-center gap-2">
                  {tmpl.imageUrl ? (
                    <img
                      src={tmpl.imageUrl}
                      alt={tmpl.name}
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 rounded-lg object-contain border border-indigo-200 bg-gray-150 flex-shrink-0 shadow-inner"
                    />
                  ) : (
                    <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${tmpl.previewColor} border border-gray-200/20 shadow-inner flex-shrink-0`} />
                  )}
                  <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">Rasio 4:5</span>
                </div>
                
                {tmpl.id !== 'custom' && (
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {onSetDefault && !tmpl.isDefault && (
                      <button
                        type="button"
                        onClick={(e) => handleSetDefault(e, tmpl.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 shadow-sm"
                        title="Atur sebagai bingkai utama untuk seluruh siswa"
                      >
                        <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                        Jadikan Default
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleShare(e, tmpl.id)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all border shadow-sm ${
                        copiedId === tmpl.id
                          ? 'bg-emerald-600 text-white border-emerald-650 shadow-emerald-500/10'
                          : 'bg-white text-slate-700 hover:bg-slate-50 border-gray-200'
                      }`}
                    >
                      {copiedId === tmpl.id ? (
                        <>
                          <Check className="w-3 h-3 text-white" />
                          Tersalin
                        </>
                      ) : (
                        <>
                          <Share2 className="w-3 h-3 text-slate-500 group-hover:text-amber-500" />
                          Bagikan
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Selected indicator checkmark wrapper */}
              {isSelected && (
                <div className="absolute top-2 right-2 w-4 h-4 bg-indigo-600 rounded-full flex items-center justify-center border border-white shadow-sm">
                  <div className="w-1.5 h-1.5 bg-white rounded-full" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
