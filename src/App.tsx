import { useState, useEffect } from 'react';
import Header from './components/Header';
import TemplateCatalog from './components/TemplateCatalog';
import PhotoControls from './components/PhotoControls';
import TwibbonCanvas from './components/TwibbonCanvas';
import { exportToHD } from './utils/exporter';
import { TWIBBON_TEMPLATES, TemplateId, TwibbonTemplate, PhotoParams, PhotoFilters, StudentSubmission } from './types';
import { motion } from 'motion/react';
import {
  Download,
  Info,
  Layers,
  Heart,
  Sparkles,
  CheckCircle,
  Smartphone,
  Cloud,
  Check,
  Users,
  RefreshCw,
  Trash2,
  ExternalLink,
  Lock
} from 'lucide-react';
import { initAuth, googleSignIn, logout, getAccessToken } from './utils/firebaseAuth';
import { uploadFileToDrive } from './utils/googleDrive';
import { User } from 'firebase/auth';
import { getFrameBlob, setFrameBlob, getCustomTemplatesList, setCustomTemplatesList } from './utils/idb';
import { createCompressedThumbnail } from './utils/thumbnail';
import { 
  compressFrameForFirestore, 
  saveTemplateToFirestore, 
  getTemplatesFromFirestore, 
  setGlobalDefaultTemplateInFirestore,
  saveStudentSubmissionToFirestore,
  getStudentSubmissionsFromFirestore,
  updateSubmissionSyncStatusInFirestore,
  deleteSubmissionFromFirestore,
  compressCanvasForFirestore
} from './utils/firestoreTemplates';

const INITIAL_PARAMS: PhotoParams = {
  x: 0,
  y: 0,
  scale: 1.0,
  rotation: 0,
  flipH: false,
  flipV: false
};

const INITIAL_FILTERS: PhotoFilters = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  grayscale: 0,
  sepia: 0,
  hueRotate: 0,
  warmth: 0
};

export default function App() {
  // App Core States
  const [selectedTemplateId, setSelectedTemplateId] = useState<TemplateId>('custom');
  const [params, setParams] = useState<PhotoParams>(INITIAL_PARAMS);
  const [filters, setFilters] = useState<PhotoFilters>(INITIAL_FILTERS);
  const [canvasBgColor, setCanvasBgColor] = useState<string>('#ffffff');

  // Dynamic Template list (combining default and dynamically saved uploads)
  const [templates, setTemplates] = useState<TwibbonTemplate[]>(TWIBBON_TEMPLATES);

  // Google OAuth Drive Access States
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState<boolean>(false);

  // Image Object States (for rendering in canvas)
  const [userPhotoImg, setUserPhotoImg] = useState<HTMLImageElement | null>(null);
  const [customFrameImg, setCustomFrameImg] = useState<HTMLImageElement | null>(null);

  // Keep track of the actual File objects so we can upload them on connection
  const [activePhotoFile, setActivePhotoFile] = useState<File | null>(null);
  const [activeFrameFile, setActiveFrameFile] = useState<File | null>(null);

  // Raw files URLs for clean revoking
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [frameUrl, setFrameUrl] = useState<string>('');

  // Exporter configs
  const [exportFileName, setExportFileName] = useState<string>('twibbon-kreatif-45');
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg'>('png');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportSuccess, setExportSuccess] = useState<boolean>(false);

  // Check if loaded inside an iframe (e.g., inside AI Studio preview)
  const [isIframe, setIsIframe] = useState<boolean>(false);

  useEffect(() => {
    setIsIframe(window.self !== window.top);
  }, []);

  // Student details and submissions logic
  const [studentName, setStudentName] = useState<string>('');
  const [studentClass, setStudentClass] = useState<string>('');
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [isSyncingAll, setIsSyncingAll] = useState<boolean>(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  // Password-protected deletion states
  const [deletePromptId, setDeletePromptId] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState<string>('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Helper helper to convert base64 to Blob safely
  const base64ToBlob = (base64: string, mimeType: string = 'image/jpeg'): Blob => {
    const parts = base64.split(',');
    const byteCharacters = atob(parts[1] || parts[0]);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  };

  // Floating notifications state (eliminates browser alert overlays for a native workspace feel)
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const triggerNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 6000);
  };

  // Revoke URLs on unmount to prevent leaks
  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      if (frameUrl) URL.revokeObjectURL(frameUrl);
    };
  }, [photoUrl, frameUrl]);

  // Load custom templates from localStorage, IndexedDB, and Cloud Firestore (highly optimized for iOS Safari)
  useEffect(() => {
    const loadSavedTemplates = async () => {
      let unifiedCustomList: TwibbonTemplate[] = [];
      
      // 1. First probe localStorage (synchronous fallback)
      try {
        const saved = localStorage.getItem('twibbon_custom_templates');
        if (saved) {
          const parsed = JSON.parse(saved) as TwibbonTemplate[];
          // Clean the old blob URLs right away so we don't try to use dead reference blobs
          unifiedCustomList = parsed.map(t => ({ ...t, localUrl: undefined }));
        }
      } catch (err) {
        console.error('Failed to load custom templates from localStorage:', err);
      }

      // 2. Query IndexedDB custom list (extremely stable, bypasses Safari's 5MB private quota)
      try {
        const idbSaved = await getCustomTemplatesList();
        if (idbSaved && Array.isArray(idbSaved)) {
          // Merge lists prioritizing IndexedDB metadata, cleansing stale localUrls
          const idbCleaned = idbSaved.map(t => ({ ...t, localUrl: undefined }));
          
          // Build a set of existing IDs from localStorage to merge uniquely
          const seenIds = new Set(unifiedCustomList.map(t => t.id));
          
          for (const item of idbCleaned) {
            if (!seenIds.has(item.id)) {
              unifiedCustomList.push(item);
            } else {
              // override/update if ID already exists (IndexedDB is superior because it's guaranteed)
              unifiedCustomList = unifiedCustomList.map(t => t.id === item.id ? item : t);
            }
          }
        }
      } catch (idbErr) {
        console.error('Failed to load custom templates from IndexedDB:', idbErr);
      }

      // 3. Query Cloud Firestore shared templates (accessible to any student globally!)
      try {
        const cloudTemplates = await getTemplatesFromFirestore();
        if (cloudTemplates && cloudTemplates.length > 0) {
          const cloudCleaned = cloudTemplates.map(t => ({ ...t, localUrl: undefined }));
          const seenIds = new Set(unifiedCustomList.map(t => t.id));
          
          for (const item of cloudCleaned) {
            if (!seenIds.has(item.id)) {
              unifiedCustomList.push(item);
            } else {
              // override/update if ID already exists
              unifiedCustomList = unifiedCustomList.map(t => t.id === item.id ? item : t);
            }
          }
        }
      } catch (cloudErr) {
        console.error('Failed to load shared templates from Firestore cloud database:', cloudErr);
      }

      // Update the react state in one single render frame
      const combinedTemplates = [...TWIBBON_TEMPLATES, ...unifiedCustomList];
      setTemplates(combinedTemplates);

      // 4. Handle auto-selection of shared template from URL parameter or global default Campaign (ideal for school campaigns!)
      try {
        const urlParams = new URLSearchParams(window.location.search);
        let urlId = urlParams.get('id') || urlParams.get('templateId') || urlParams.get('template');
        
        // If no explicit ID in the URL, check if there is a designated global default frame inside Firestore
        if (!urlId) {
          const defaultCampaign = combinedTemplates.find(t => t.isDefault);
          if (defaultCampaign) {
            urlId = defaultCampaign.id;
          }
        }

        if (urlId) {
          const matched = combinedTemplates.find(t => t.id === urlId);
          if (matched) {
            setSelectedTemplateId(urlId);
            setParams(INITIAL_PARAMS);
            
            if (matched.imageUrl) {
              const img = new Image();
              img.src = matched.imageUrl;
              img.onload = () => {
                setCustomFrameImg(img);
              };
            } else if (matched.id.startsWith('custom-')) {
              const blob = await getFrameBlob(matched.id);
              if (blob) {
                const reconstructedUrl = URL.createObjectURL(blob);
                setTemplates(prev => prev.map(t => t.id === urlId ? { ...t, localUrl: reconstructedUrl } : t));
                const img = new Image();
                img.src = reconstructedUrl;
                img.onload = () => {
                  setCustomFrameImg(img);
                };
              }
            }
          }
        }
      } catch (urlErr) {
        console.error('Failed to parse sharing parameters from URL:', urlErr);
      }
    };

    loadSavedTemplates();
  }, []);

  // Initialize Auth state listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setAccessToken(token);
      },
      () => {
        setUser(null);
        setAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Sync loaded files to Google Drive automatically once Drive gets connected
  useEffect(() => {
    if (user && accessToken) {
      if (activePhotoFile) {
        uploadToDrive(activePhotoFile, `user-photo-${Date.now()}-${activePhotoFile.name}`, activePhotoFile.type);
      }
      if (activeFrameFile) {
        uploadToDrive(activeFrameFile, `twibbon-frame-${Date.now()}-${activeFrameFile.name}`, activeFrameFile.type);
      }
    }
  }, [user, accessToken]);

  // Helper to convert binary File to base64 DataURL for offline catalog storage
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // Google Sign-In & Auth Actions
  const handleLogin = async () => {
    setIsConnecting(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
        triggerNotification('Berhasil terhubung dengan Google Drive Admin!', 'success');
      }
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      if (err?.code === 'auth/popup-closed-by-user' || err?.message?.includes('popup-closed-by-user')) {
        triggerNotification(
          'Gagal masuk: Jendela login ditutup sebelum selesai. Jika Anda berada di iFrame, klik tombol "Buka di Tab Baru" di panel sinkronisasi di bawah.', 
          'error'
        );
      } else {
        triggerNotification(`Gagal terhubung ke Google Drive: ${err?.message || 'Error tidak diketahui'}`, 'error');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setAccessToken(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Upload background file to Drive helper
  const uploadToDrive = async (file: Blob | File, filename: string, mimeType: string) => {
    if (!accessToken) {
      console.log('Skipping Drive upload: login token not found');
      return null;
    }

    setIsUploadingToDrive(true);
    try {
      const result = await uploadFileToDrive(file, filename, mimeType, accessToken);
      console.log('File successfully uploaded to Google Drive folder:', result);
      return result;
    } catch (err) {
      console.error('Drive upload failed:', err);
      return null;
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  const loadSubmissionsAndSync = async (autoUpload: boolean = false) => {
    try {
      const list = await getStudentSubmissionsFromFirestore();
      setSubmissions(list);

      // Auto Upload logic for Admin (if accessToken is present)
      if (autoUpload && accessToken && list.length > 0) {
        const unsynced = list.filter(sub => !sub.syncedToDrive);
        if (unsynced.length > 0) {
          setIsSyncingAll(true);
          let successCount = 0;
          for (const sub of unsynced) {
            try {
              // Convert base64 data to Blob
              const blob = base64ToBlob(sub.imageUrl, 'image/jpeg');
              
              // Upload to Google Drive target folder (specified in googleDrive.ts)
              const driveResult = await uploadFileToDrive(
                blob,
                `Submisi_${sub.studentClass}_${sub.studentName.replace(/\s+/g, '_')}_${Date.now()}.jpg`,
                'image/jpeg',
                accessToken
              );

              if (driveResult) {
                // Update Firestore synced status
                await updateSubmissionSyncStatusInFirestore(sub.id, true);
                successCount++;
              }
            } catch (syncErr) {
              console.error(`Gagal sinkronisasi submisi ${sub.id}:`, syncErr);
            }
          }

          if (successCount > 0) {
            triggerNotification(`Berhasil menyinkronkan ${successCount} karya siswa ke Google Drive Anda!`, 'success');
            // Reload the updated submissions list from firestore
            const updatedList = await getStudentSubmissionsFromFirestore();
            setSubmissions(updatedList);
          }
          setIsSyncingAll(false);
        }
      }
    } catch (err) {
      console.error('Error loading or syncing submissions:', err);
    }
  };

  const handleDeleteSubmission = (id: string) => {
    setDeletePromptId(id);
    setDeletePassword('');
    setDeleteError(null);
  };

  const confirmDeleteSubmission = async () => {
    if (!deletePromptId) return;
    if (deletePassword !== 'zamrud') {
      setDeleteError('Sandi salah! Silakan gunakan sandi yang benar.');
      return;
    }

    const id = deletePromptId;
    setDeletePromptId(null);
    setDeletePassword('');
    setDeleteError(null);

    setIsDeletingId(id);
    try {
      await deleteSubmissionFromFirestore(id);
      triggerNotification('Submisi siswa berhasil dihapus.', 'success');
      loadSubmissionsAndSync(false);
    } catch (err) {
      console.error('Failed to delete submission:', err);
      triggerNotification('Gagal menghapus submisi siswa.', 'error');
    } finally {
      setIsDeletingId(null);
    }
  };

  // Auto trigger check when connection is established or component updates
  useEffect(() => {
    if (accessToken) {
      loadSubmissionsAndSync(true);
    } else {
      loadSubmissionsAndSync(false);
    }
  }, [accessToken]);

  // Handle Photo Upload
  const handleUploadPhoto = async (file: File) => {
    setActivePhotoFile(file);
    if (photoUrl) {
      URL.revokeObjectURL(photoUrl);
    }
    const url = URL.createObjectURL(file);
    setPhotoUrl(url);

    const img = new Image();
    img.src = url;
    img.onload = () => {
      setUserPhotoImg(img);
      // Reset position parameters on new photo attachment
      setParams(INITIAL_PARAMS);
    };

    // Auto Google Drive Sync if active
    if (accessToken) {
      await uploadToDrive(file, `user-photo-${Date.now()}-${file.name}`, file.type);
    }
  };

  // Handle Custom Frame Upload & Template Auto-Saving
  const handleUploadFrame = async (file: File) => {
    setActiveFrameFile(file);
    try {
      // 1. Create local URL for instantaneous canvas rendering (extremely performant on mobile)
      if (frameUrl) {
        URL.revokeObjectURL(frameUrl);
      }
      const localUrl = URL.createObjectURL(file);
      setFrameUrl(localUrl);

      // Load image immediately so user sees their custom frame on mobile without any lag
      const img = new Image();
      img.src = localUrl;
      img.onload = () => {
        setCustomFrameImg(img);
      };

      // 2. Establish a safe timestamp-driven custom ID synchronously
      const newTmplId = `custom-${Date.now()}`;

      // 3. Formulate the dynamic template database representation using the fast localUrl
      const totalCustom = templates.filter(t => t.id !== 'custom').length;
      
      const cleanName = file.name
        .replace(/\.[^/.]+$/, "") // remove extension
        .replace(/[_-]/g, " ")     // replace characters like dashes/underscores with spaces
        .split(" ")
        .filter(Boolean)
        .map(word => {
          const upper = word.toUpperCase();
          if (upper === 'LPKN' || upper === 'POMB' || upper === 'PKKMB' || upper === 'MABA') {
            return upper;
          }
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(" ");

      const nameToUse = cleanName || `Bingkai Kustom #${totalCustom + 1}`;

      const newTmpl: TwibbonTemplate = {
        id: newTmplId,
        name: nameToUse,
        category: 'Kustom',
        description: `Eksklusif terunggah pada ${new Date().toLocaleTimeString('id-ID')} WIB`,
        previewColor: 'from-emerald-600 to-teal-500',
        accentColor: '#10b981',
        imageUrl: localUrl, // Use localUrl for instant thumbnail display too
        localUrl: localUrl
      };

      // 4. Update memory catalog instantly and select it so there's zero lag
      const updatedList = [...templates, newTmpl];
      setTemplates(updatedList);
      setSelectedTemplateId(newTmplId);

      // Immediately write templates list to IndexedDB to guarantee persistence even if compression is rejected
      const initialCustomListClean = updatedList.filter(t => t.id !== 'custom').map(t => ({ ...t, localUrl: undefined }));
      setCustomTemplatesList(initialCustomListClean).catch(err => console.error('Immediate IndexedDB sync list error:', err));

      // 5. Fire off asynchronous backup/compression operations in the background without blocking the UI flow
      Promise.all([
        (async () => {
          try {
            const thumbnailBase64 = await createCompressedThumbnail(file);
            if (thumbnailBase64) {
              setTemplates(prev => {
                const refreshed = prev.map(t => t.id === newTmplId ? { ...t, imageUrl: thumbnailBase64 } : t);
                
                // Keep IndexedDB synced with full metadata list
                const finalCustom = refreshed.filter(t => t.id !== 'custom').map(t => ({ ...t, localUrl: undefined }));
                setCustomTemplatesList(finalCustom).catch(e => console.error('Final IDB list save err:', e));
                
                return refreshed;
              });

              // Update localStorage with the compressed version
              const saved = localStorage.getItem('twibbon_custom_templates');
              let customSaved: TwibbonTemplate[] = [];
              if (saved) {
                try {
                  customSaved = JSON.parse(saved);
                } catch {
                  customSaved = [];
                }
              }
              const updatedNewTmpl = { ...newTmpl, imageUrl: thumbnailBase64, localUrl: undefined };
              const filtered = customSaved.filter(t => t.id !== newTmplId && t.id !== 'custom').map(t => ({ ...t, localUrl: undefined }));
              const newCustomSaved = [...filtered, updatedNewTmpl];
              
              try {
                localStorage.setItem('twibbon_custom_templates', JSON.stringify(newCustomSaved));
              } catch (quotaError) {
                console.warn('LocalStorage size exceeded, keeping frame in memory.');
              }
            }
          } catch (compErr) {
            console.error('Failed background thumbnail creation / localStorage backup:', compErr);
          }
        })(),

        (async () => {
          try {
            await setFrameBlob(newTmplId, file);
          } catch (idbErr) {
            console.error('Failed background IndexedDB storage:', idbErr);
          }
        })(),

        (async () => {
          try {
            const firestoreBase64 = await compressFrameForFirestore(file);
            if (firestoreBase64) {
              const cloudTmpl: TwibbonTemplate = {
                ...newTmpl,
                imageUrl: firestoreBase64,
                localUrl: undefined
              };
              await saveTemplateToFirestore(cloudTmpl);
            }
          } catch (cloudErr) {
            console.error('Failed to sync custom template to Firestore cloud:', cloudErr);
          }
        })()
      ]).catch(e => console.error('Error in background processing task:', e));

      // 6. Push to Google Drive automatically if signed in
      if (accessToken) {
        uploadToDrive(file, `twibbon-frame-${Date.now()}-${file.name}`, file.type).catch(err => {
          console.error('Background Google Drive upload failed:', err);
        });
      }
    } catch (err) {
      console.error('Failed processing loaded template frame:', err);
    }
  };

  // Promotes a selected template to be the global default frame (autoloaded for anyone accessing)
  const handleSetDefaultTemplate = async (id: string) => {
    try {
      const updated = templates.map(t => {
        if (t.id === 'custom') return t;
        return {
          ...t,
          isDefault: t.id === id
        };
      });
      setTemplates(updated);
      
      await setGlobalDefaultTemplateInFirestore(id, updated);
      triggerNotification('Bingkai Berhasil Diaktifkan! Sekarang seluruh siswa yang mengakses link ini akan otomatis memuat bingkai ini sebagai default!', 'success');
    } catch (err) {
      console.error('Failed to set global template default:', err);
      triggerNotification('Gagal mengaktifkan bingkai utama secara global. Pastikan koneksi Firestore terkoneksi.', 'error');
    }
  };

  // Handle choosing template from the dynamic catalog list
  const handleSelectTemplate = async (id: TemplateId) => {
    setSelectedTemplateId(id);
    setParams(INITIAL_PARAMS); // reset positioning parameters
    
    const matched = templates.find(t => t.id === id);
    if (matched) {
      if (matched.id.startsWith('custom-')) {
        // High-speed resolution: prioritize the native Blob Object URL
        if (matched.localUrl) {
          const img = new Image();
          img.src = matched.localUrl;
          img.onload = () => {
            setCustomFrameImg(img);
          };
        } else {
          // Fallback if the tab was refreshed: retrieve original high-res from IndexedDB
          const blob = await getFrameBlob(matched.id);
          if (blob) {
            const reconstructedUrl = URL.createObjectURL(blob);
            setTemplates(prev => prev.map(t => t.id === id ? { ...t, localUrl: reconstructedUrl } : t));
            
            const img = new Image();
            img.src = reconstructedUrl;
            img.onload = () => {
              setCustomFrameImg(img);
            };
          } else if (matched.imageUrl) {
            // Extreme fallback / Cloud Loaded Base64 or standard URL
            const img = new Image();
            img.src = matched.imageUrl;
            img.onload = () => {
              setCustomFrameImg(img);
            };
          }
        }
      } else if (matched.imageUrl) {
        // Non-custom defaults
        const img = new Image();
        img.src = matched.imageUrl;
        img.onload = () => {
          setCustomFrameImg(img);
        };
      }
    } else if (id === 'custom') {
      // Reset back to base blank custom frame
      setCustomFrameImg(null);
    }
  };

  const handleRemovePhoto = () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl('');
    setUserPhotoImg(null);
    setActivePhotoFile(null);
  };

  const handleRemoveFrame = () => {
    if (frameUrl) URL.revokeObjectURL(frameUrl);
    setFrameUrl('');
    setCustomFrameImg(null);
    setActiveFrameFile(null);
    setSelectedTemplateId('custom'); // Reset back to default custom uploader
  };

  const handleResetParams = () => {
    setParams(INITIAL_PARAMS);
    setFilters(INITIAL_FILTERS);
    setCanvasBgColor('#ffffff');
  };

  // HD Export Trigger and Auto Google Drive Backup
  const handleDownload = async () => {
    if (!studentName.trim()) {
      triggerNotification('Mohon lengkapi Nama Anda terlebih dahulu sebelum mengunduh.', 'error');
      return;
    }
    if (!studentClass.trim()) {
      triggerNotification('Mohon lengkapi Kelas / Regu Anda terlebih dahulu sebelum mengunduh.', 'error');
      return;
    }

    setIsExporting(true);
    setExportSuccess(false);

    try {
      const sanitizedName = studentName.trim().replace(/[^a-zA-Z0-9_\s-]/g, '');
      const sanitizedClass = studentClass.trim().replace(/[^a-zA-Z0-9_\s-]/g, '');
      const fullFileName = `${sanitizedClass}_${sanitizedName.replace(/\s+/g, '_')}_${exportFileName}`;

      const result = await exportToHD({
        templateId: selectedTemplateId,
        params,
        filters,
        canvasBgColor,
        userPhotoImg,
        customFrameImg,
        fileName: fullFileName,
        format: exportFormat
      });

      if (result) {
        setExportSuccess(true);

        const canvas = document.getElementById('twibbon-preview-canvas') as HTMLCanvasElement;
        if (canvas) {
          try {
            // Compress canvas specifically for Firestore (optimized small size < 1MB limit)
            const base64Image = await compressCanvasForFirestore(canvas);
            
            const submissionId = `sub-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            const newSubmission: StudentSubmission = {
              id: submissionId,
              studentName: studentName.trim(),
              studentClass: studentClass.trim(),
              fileName: `${fullFileName}.${exportFormat}`,
              imageUrl: base64Image,
              createdAt: new Date().toISOString(),
              templateId: selectedTemplateId,
              syncedToDrive: false
            };

            // Save to firestore!
            await saveStudentSubmissionToFirestore(newSubmission);
            console.log('Submission saved successfully to Firestore Queue!');

            // If an admin/authorized Google Drive user is connected right now, sync it immediately to Drive too!
            if (accessToken) {
              canvas.toBlob(async (blob) => {
                if (blob) {
                  const driveResult = await uploadToDrive(
                    blob,
                    `Submisi_${sanitizedClass}_${sanitizedName.replace(/\s+/g, '_')}_${Date.now()}.png`,
                    'image/png'
                  );
                  if (driveResult) {
                    await updateSubmissionSyncStatusInFirestore(submissionId, true);
                    console.log('Immediate Google Drive sync completed for student!');
                  }
                }
              }, 'image/png');
            }

            // Reload submissions list
            loadSubmissionsAndSync(false);

          } catch (dbErr) {
            console.error('Error saving submission to Firestore:', dbErr);
          }
        }

        // Clear success notification after 4 seconds
        setTimeout(() => setExportSuccess(false), 4000);
      }
    } catch (e) {
      console.error('Unduh twibbon gagal:', e);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans select-none overflow-x-hidden text-left bg-gray-50 text-slate-800">
      <Header user={user} onLogin={handleLogin} onLogout={handleLogout} isConnecting={isConnecting} />

      {/* Main Workspace Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Intro Hero Section */}
        <div className="mb-8 text-left">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-800 rounded-full text-xs font-bold border border-indigo-100/60 shadow-sm mb-3">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
            Situs Pembuat Twibbon Tercepat
          </span>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight sm:text-4xl">
            Kreasi Twibbon Impian Anda
          </h2>
          <p className="mt-2 text-sm sm:text-base text-slate-500 max-w-2xl leading-relaxed">
            Pasangkan foto terbaik Anda pada berbagai bingkai twibbon berformat <strong className="text-slate-800 font-bold">rasio 4:5</strong> (Instagram Portrait). Bebas atur posisi, putar, perbesar, beri filter visual, serta unduh dalam resolusi HD secara instan tanpa watermark.
          </p>
        </div>

        {/* Workspace Panels Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left / Middle: Configuration Panels (Step Columns) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* STEP 1: SELECT FRAME OR CUSTOM UPLOAD */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="bg-white rounded-3xl p-6 shadow-sm border border-gray-150"
            >
              <TemplateCatalog
                selectedId={selectedTemplateId}
                onSelect={handleSelectTemplate}
                templates={templates}
                onSetDefault={handleSetDefaultTemplate}
              />
            </motion.div>

            {/* STEP 2: PHOTO INGESTION AND STYLING FILTERS */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="bg-white rounded-3xl p-6 shadow-sm border border-gray-150"
            >
              <div className="pb-3 mb-5 border-b border-gray-100">
                <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  Atur Latar Foto Anda
                </h3>
              </div>

              <PhotoControls
                selectedTemplateId={selectedTemplateId}
                activeTemplate={templates.find(t => t.id === selectedTemplateId)}
                params={params}
                filters={filters}
                canvasBgColor={canvasBgColor}
                onChangeParams={setParams}
                onChangeFilters={setFilters}
                onChangeBgColor={setCanvasBgColor}
                onUploadPhoto={handleUploadPhoto}
                onUploadFrame={handleUploadFrame}
                onResetParams={handleResetParams}
                hasPhoto={!!userPhotoImg}
                hasCustomFrame={!!customFrameImg}
                onRemovePhoto={handleRemovePhoto}
                onRemoveFrame={handleRemoveFrame}
                isDriveConnected={!!user && !!accessToken}
                isUploadingToDrive={isUploadingToDrive}
              />
            </motion.div>
          </div>

          {/* Right Column: Visual Stage and Exporter controls */}
          <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-6">
            
            {/* CANVAS CONTAINER CARD */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="bg-white rounded-3xl p-6 shadow-sm border border-gray-150 flex flex-col items-center justify-center text-center"
            >
              <div className="w-full pb-3 mb-5 border-b border-gray-100 flex items-center justify-between text-left">
                <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-indigo-600" />
                  Pratinjau Twibbon
                </h3>
                <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400">Rasio 4:5</span>
              </div>

              <TwibbonCanvas
                selectedTemplateId={selectedTemplateId}
                params={params}
                filters={filters}
                canvasBgColor={canvasBgColor}
                userPhotoImg={userPhotoImg}
                customFrameImg={customFrameImg}
                onChangeParams={setParams}
              />
            </motion.div>

            {/* EXPORTER ACTION CARD */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="bg-white rounded-3xl p-6 shadow-sm border border-gray-150 space-y-4"
            >
              <div className="pb-3 border-b border-gray-100">
                <h3 className="text-sm font-bold text-slate-800 tracking-tight">Keluarkan Hasil Eksporan</h3>
              </div>

              {/* Student Identity Section */}
              <div className="bg-slate-50 p-4.5 rounded-2xl border border-slate-100 flex flex-col gap-3 text-left">
                <div className="flex items-center gap-1.5 pb-2 border-b border-gray-200">
                  <div className="w-1.5 h-3.5 bg-indigo-600 rounded-full" />
                  <span className="text-xs font-extrabold text-slate-800 uppercase tracking-tight">Identitas Siswa (Arsip Admin)</span>
                </div>
                
                <div className="space-y-1 text-[11px]">
                  <label className="font-bold text-slate-600">Nama Lengkap Siswa <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="Contoh: Budi Santoso"
                    className="w-full p-2.5 rounded-xl border border-gray-200 bg-white focus:border-indigo-500 focus:outline-none transition-colors font-bold text-slate-800 shadow-sm"
                  />
                </div>

                <div className="space-y-1 text-[11px]">
                  <label className="font-bold text-slate-600">Kelas / Regu <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={studentClass}
                    onChange={(e) => setStudentClass(e.target.value)}
                    placeholder="Contoh: X MIPA 2 / Regu Elang"
                    className="w-full p-2.5 rounded-xl border border-gray-200 bg-white focus:border-indigo-500 focus:outline-none transition-colors font-bold text-slate-800 shadow-sm"
                  />
                </div>
                
                <p className="text-[10px] text-slate-400 mt-0.5 leading-normal">
                  Identitas ini digunakan untuk mengelompokkan berkas Anda di Google Drive admin secara otomatis saat Anda mengunduh.
                </p>
              </div>

              {/* Set export filename */}
              <div className="space-y-1.5 text-left text-xs">
                <label className="font-bold text-slate-700">Nama Berkas Unduhan</label>
                <input
                  type="text"
                  value={exportFileName}
                  onChange={(e) => setExportFileName(e.target.value)}
                  placeholder="twibbon-kreatif"
                  className="w-full p-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 focus:outline-none transition-colors"
                />
              </div>

              {/* Format Select buttons */}
              <div className="space-y-1.5 text-left text-xs">
                <label className="font-bold text-slate-700">Format Gambar</label>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setExportFormat('png')}
                    className={`flex-1 p-2.5 rounded-xl border text-xs font-bold tracking-wider transition-all ${
                      exportFormat === 'png'
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'bg-white border-gray-200 text-slate-600 hover:border-gray-350'
                    }`}
                  >
                    PNG (Transparan HD)
                  </button>
                  <button
                    onClick={() => setExportFormat('jpeg')}
                    className={`flex-1 p-2.5 rounded-xl border text-xs font-bold tracking-wider transition-all ${
                      exportFormat === 'jpeg'
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'bg-white border-gray-200 text-slate-600 hover:border-gray-350'
                    }`}
                  >
                    JPEG (Kompresi 95%)
                  </button>
                </div>
              </div>

              {/* Big primary Download Button */}
              <button
                onClick={handleDownload}
                disabled={isExporting || (!userPhotoImg && selectedTemplateId !== 'custom')}
                className={`w-full py-4 px-5 rounded-2xl font-bold flex items-center justify-center gap-2.5 shadow-lg transition-all duration-300 ${
                  (!userPhotoImg && selectedTemplateId !== 'custom')
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none border border-gray-200'
                    : isExporting
                    ? 'bg-indigo-700 text-white cursor-wait animate-pulse'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:-translate-y-0.5 active:translate-y-0 shadow-indigo-650/10 hover:shadow-indigo-650/20'
                }`}
              >
                <Download className="w-5 h-5" />
                {isExporting ? 'Sedang Memproses HD...' : 'Unduh Twibbon HD Sekarang'}
              </button>

              {/* Notification Banner */}
              {exportSuccess && (
                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-left flex items-start space-x-2.5 text-indigo-800 animate-slide-up">
                  <CheckCircle className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold">Berhasil Diunduh!</p>
                    <p className="text-[11px] text-indigo-700/90 mt-0.5">Twibbon berhasil disimpan dengan resolusi tinggi 1080 × 1350 piksel.</p>
                  </div>
                </div>
              )}

              {(!userPhotoImg && selectedTemplateId !== 'custom') && (
                <p className="text-[10px] text-slate-400 text-center italic mt-2 leading-normal">
                  *Silakan unggah foto Anda terlebih dahulu untuk mengaktifkan tombol unduh.
                </p>
              )}
            </motion.div>
          </div>
        </div>

        {/* STEP 3: Portal Monitoring Karya Siswa / Admin Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-12 bg-white rounded-3xl p-6 shadow-sm border border-gray-150 text-left"
        >
          <div className="pb-4 mb-6 border-b border-gray-150 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                Daftar Hasil Siswa &amp; Sinkronisasi Drive
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                Memonitor semua karya siswa dan mengunggahnya secara otomatis ke folder Google Drive utama Admin.
              </p>
            </div>

            {/* Admin Portal Global Controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => loadSubmissionsAndSync(false)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-stone-50 hover:bg-stone-100 text-stone-700 hover:text-stone-900 rounded-xl border border-stone-200 text-xs font-bold transition-all active:scale-95 shadow-sm"
                title="Muat Ulang Data Siswa"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Muat Ulang</span>
              </button>

              {user && accessToken ? (
                <button
                  type="button"
                  onClick={() => loadSubmissionsAndSync(true)}
                  disabled={isSyncingAll || submissions.every(s => s.syncedToDrive)}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
                    submissions.every(s => s.syncedToDrive)
                      ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed shadow-none'
                      : isSyncingAll
                      ? 'bg-indigo-700 text-white cursor-wait animate-pulse'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/10 hover:-translate-y-0.5 active:translate-y-0'
                  }`}
                >
                  <Cloud className="w-4 h-4" />
                  <span>{isSyncingAll ? 'Sinkronisasi...' : 'Sinkronkan Sekarang'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleLogin}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:-translate-y-0.5 active:translate-y-0 shadow-indigo-650/10"
                >
                  <Cloud className="w-4 h-4 fill-current" />
                  <span>Sambung Drive Admin</span>
                </button>
              )}
            </div>
          </div>

          {/* If inside an iframe, show a prominent notice with a direct Open-in-New-Tab button */}
          {isIframe && !user && (
            <div className="mb-6 p-4.5 rounded-2xl bg-rose-50 border border-rose-150 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
              <div className="flex items-start gap-2.5">
                <Info className="w-4.5 h-4.5 text-rose-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-rose-950 uppercase tracking-tight">Perhatian: Pembatasan Keamanan iFrame Google AI Studio</p>
                  <p className="text-rose-800/90 mt-1">
                    Anda sedang menjalankan aplikasi ini di dalam bidang pratinjau iFrame AI Studio. Google tidak menyetujui penayangan dan interaksi jendela pop-up login Google Auth di dalam iFrame cross-origin.
                  </p>
                  <p className="text-rose-800/85 mt-1 font-bold">
                    Untuk masuk/menyambungkan Google Drive Admin tanpa eror populasi tab (popup-closed-by-user), mohon buka aplikasi di tab mandiri dengan mengeklik tombol "Buka Tab Baru" berikut.
                  </p>
                </div>
              </div>
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:-translate-y-0.5 active:translate-y-0 flex-shrink-0 text-center"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Buka di Tab Baru</span>
              </a>
            </div>
          )}

          {/* Drive Folder Connection Info Banner */}
          <div className="mb-6 p-4 rounded-2xl bg-amber-50/50 border border-amber-100 flex flex-col md:flex-row md:items-center justify-between gap-3 text-amber-900 leading-relaxed text-xs">
            <div className="flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-950">Informasi Folder Google Drive Admin:</p>
                <p className="text-amber-800/90 mt-0.5">
                  Folder target diatur otomatis ke: <strong className="font-bold underline text-indigo-900">1TTV0Z30uA_A5nU4cvdyuI3JlZyME3121</strong>. 
                  Siswa yang mengunduh twibbon akan tersimpan sebagai submisi di sistem, dan admin dapat mengunggah semuanya ke Google Drive sekali klik atau secara otomatis.
                </p>
              </div>
            </div>
          </div>

          {/* Submissions List Grid */}
          {submissions.length === 0 ? (
            <div className="py-12 bg-gray-50/50 rounded-2xl border border-dashed border-gray-150 text-center flex flex-col items-center justify-center p-6">
              <div className="p-3.5 bg-indigo-50 text-indigo-650 rounded-full mb-3.5 flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <h4 className="text-slate-800 font-bold text-sm tracking-tight">Belum Ada Submisi Siswa</h4>
              <p className="text-slate-400 font-medium text-xs mt-1.5 max-w-sm leading-normal">
                Saat siswa selesai memasang fotonya dan mengunduh twibbon, karyanya akan langsung terekam rapi di tabel ini secara realtime beserta nama &amp; kelasnya.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {submissions.map((sub) => (
                <div 
                  key={sub.id} 
                  className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md hover:border-gray-300 transition-all flex flex-col"
                >
                  {/* Image Thumbnail wrapper */}
                  <div className="relative aspect-[4/5] bg-stone-150 overflow-hidden group">
                    {sub.imageUrl ? (
                      <img 
                        src={sub.imageUrl} 
                        alt={sub.studentName} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-50 font-mono text-[10px]">
                        Null Image
                      </div>
                    )}
                    
                    {/* Status Badge overlays */}
                    <div className="absolute top-2.5 right-2 tracking-wide">
                      {sub.syncedToDrive ? (
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500 text-white font-extrabold text-[9px] shadow-sm uppercase">
                          <Check className="w-2.5 h-2.5" />
                          <span>DI DRIVE</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500 text-white font-extrabold text-[9px] shadow-sm uppercase">
                          <Cloud className="w-2.5 h-2.5 animate-pulse" />
                          <span>PENDING</span>
                        </span>
                      )}
                    </div>

                    {/* Date/Time badge */}
                    <div className="absolute bottom-2 left-2 bg-slate-900/65 backdrop-blur-md px-2 py-0.5 rounded text-[9px] text-white font-mono font-bold">
                      {new Date(sub.createdAt).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  {/* Student description footer */}
                  <div className="p-3.5 flex-1 flex flex-col justify-between text-left gap-3.5">
                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight line-clamp-1">{sub.studentName}</h4>
                      <p className="text-[11px] font-bold text-indigo-650 bg-indigo-50/50 inline-block px-2 py-0.5 rounded-md mt-1 leading-none">{sub.studentClass}</p>
                    </div>

                    <div className="flex items-center justify-between gap-1.5 pt-2.5 border-t border-gray-100">
                      {/* Manual PNG Downloader */}
                      <a 
                        href={sub.imageUrl} 
                        download={sub.fileName}
                        className="flex-1 py-1.5 px-2.5 rounded-lg bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-700 hover:text-stone-900 text-[10.5px] font-bold flex items-center justify-center gap-1 transition-all"
                        title="Unduh ke Lokal"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Unduh</span>
                      </a>

                      {/* Manual trigger to single-sync if necessary */}
                      {!sub.syncedToDrive && accessToken && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const blob = base64ToBlob(sub.imageUrl, 'image/jpeg');
                              const res = await uploadFileToDrive(
                                blob,
                                `Submisi_${sub.studentClass}_${sub.studentName.replace(/\s+/g, '_')}_${Date.now()}.jpg`,
                                'image/jpeg',
                                accessToken
                              );
                              if (res) {
                                await updateSubmissionSyncStatusInFirestore(sub.id, true);
                                triggerNotification(`Submisi ${sub.studentName} berhasil diunggah ke Google Drive!`);
                                loadSubmissionsAndSync(false);
                              }
                            } catch (err) {
                              console.error('Manual drive upload failed:', err);
                              triggerNotification('Unggahan ke Drive gagal.', 'error');
                            }
                          }}
                          className="py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all border border-indigo-150"
                          title="Unggah ke Google Drive"
                        >
                          <Cloud className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Delete Entry button */}
                      <button
                        type="button"
                        onClick={() => handleDeleteSubmission(sub.id)}
                        disabled={isDeletingId === sub.id}
                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 transition-all border border-rose-100 flex items-center justify-center disabled:opacity-50"
                        title="Hapus Submisi"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

      </main>

      {/* Footer component */}
      <footer className="border-t border-gray-200 bg-white mt-16 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-400 font-semibold">
          <p>© 2026 TwibonStudio – Aplikasi Pembuat Twibbon Format 4:5 Instan.</p>
          <div className="flex justify-center space-x-1.5 mt-2.5 items-center">
            <span>Dibuat penuh dengan</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 animate-pulse" />
            <span>untuk mempermudah kampanye Anda</span>
          </div>
        </div>
      </footer>

      {/* Floating Global Custom Toast Notifications */}
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="fixed bottom-6 right-6 z-50 max-w-sm w-full p-4.5 rounded-2xl bg-slate-900 border border-slate-800 text-white shadow-2xl flex items-start gap-3.5"
        >
          <div className={`p-2 rounded-xl flex-shrink-0 ${notification.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
            {notification.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <Info className="w-5 h-5" />}
          </div>
          <div className="text-xs text-left">
            <p className="font-extrabold tracking-tight text-white font-sans text-[11px] uppercase tracking-wider text-slate-400">Notifikasi Sistem</p>
            <p className="text-slate-300 leading-relaxed font-semibold mt-1 text-[11px]">{notification.message}</p>
          </div>
        </motion.div>
      )}

      {/* Password Confirmation Modal for deleting submissions */}
      {deletePromptId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-gray-100"
          >
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="p-2.5 rounded-2xl bg-rose-50 text-rose-600">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Konfirmasi Penghapusan</h3>
                <p className="text-xs text-slate-500">Penghapusan memerlukan kata sandi.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Anda sedang mencoba menghapus salah satu karya siswa dari server. Masukkan kata sandi admin untuk melanjutkan:
            </p>

            <div className="space-y-3">
              <input
                type="password"
                placeholder="Kata sandi..."
                value={deletePassword}
                onChange={(e) => {
                  setDeletePassword(e.target.value);
                  setDeleteError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    confirmDeleteSubmission();
                  }
                }}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all placeholder:text-slate-400 text-slate-800"
                autoFocus
              />

              {deleteError && (
                <p className="text-[11px] text-rose-600 font-bold bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100">
                  {deleteError}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setDeletePromptId(null);
                    setDeletePassword('');
                    setDeleteError(null);
                  }}
                  className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteSubmission}
                  className="w-1/2 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md hover:-translate-y-0.5 transition-all"
                >
                  Hapus
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
