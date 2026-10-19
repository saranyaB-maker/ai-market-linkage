import React, { useState, useRef, useEffect } from 'react';
import {
  Camera, Upload, X, Check, AlertCircle, Sparkles, RefreshCw,
  Calculator, ChevronDown, ChevronUp, Image as ImageIcon,
  CheckCircle2, Info, ArrowRight, ArrowLeft, ShieldCheck, Wand2, Eye,
  Mic, MicOff, Volume2, VolumeX, Edit2, Play, Pause
} from 'lucide-react';
import api from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import { ProductImage } from '../common/ProductImage';

interface AddProductModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onSuccess: (newProduct?: any) => void;
  initialMode?: 'manual' | 'voice';
}

const CRAFT_CATEGORIES = [
  'Pottery & Ceramics',
  'Household Goods, Water Jugs & Pitchers',
  'Pottery & Terracotta',
  'Handloom & Textiles',
  'Bags & Natural Fiber Crafts',
  'Jute & Natural Fiber Crafts',
  'Woodwork & Carving',
  'Metal & Bell Metal Crafts',
  'Jewellery & Beadwork',
  'Bamboo & Cane Crafts',
  'Stone & Marble Carving',
  'Handmade Paper & Leather',
  'Painting & Folk Art',
  'Other Traditional Crafts'
];

const COMMON_UNITS = [
  'piece',
  'set',
  'meter',
  'kg',
  'pair',
  'dozen',
  'box'
];

export const AddProductModal: React.FC<AddProductModalProps> = ({
  isOpen = true,
  onClose,
  onSuccess,
  initialMode = 'manual',
}) => {
  if (!isOpen) return null;

  const { language, t } = useLanguage();

  // Mode Selection: 'manual' | 'voice'
  const [inputMode, setInputMode] = useState<'manual' | 'voice'>(initialMode);
  const [voiceLang, setVoiceLang] = useState<'ta' | 'en'>(language === 'ta' ? 'ta' : 'ta');

  // Photo Source Tab: 'upload' | 'camera'
  const [imageSourceTab, setImageSourceTab] = useState<'upload' | 'camera'>('upload');

  // Camera stream state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string>('');

  // Selected file and previews (SHARED ACROSS MANUAL & VOICE)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>('');
  const [imageHash, setImageHash] = useState<string>('');

  // Background Removal & Studio Enhancement state
  const [enhancedImageUrl, setEnhancedImageUrl] = useState<string>('');
  const [selectedImageChoice, setSelectedImageChoice] = useState<'enhanced' | 'original'>('original');
  const [enhancementLoading, setEnhancementLoading] = useState(false);
  const [enhancementDisclaimer, setEnhancementDisclaimer] = useState<string>('');
  const [backdropStyle, setBackdropStyle] = useState<'warm_studio' | 'pure_white' | 'neutral_grey'>('warm_studio');

  // AI Analysis state
  const [artisanNotes, setArtisanNotes] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalyzed, setAiAnalyzed] = useState(false);
  const [isAiPowered, setIsAiPowered] = useState<boolean | null>(null);
  const [aiDisclaimer, setAiDisclaimer] = useState<string>('');
  const [duplicateWarning, setDuplicateWarning] = useState<string>('');
  const [materialUnconfirmed, setMaterialUnconfirmed] = useState(false);

  // Form Fields (SHARED STATE ACROSS MANUAL & VOICE)
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState<number | ''>('');
  const [unit, setUnit] = useState('piece');
  const [stockQuantity, setStockQuantity] = useState<number | ''>(10);
  const [moq, setMoq] = useState<number | ''>(1);
  const [leadTimeDays, setLeadTimeDays] = useState<number | ''>(7);
  const [monthlyCapacity, setMonthlyCapacity] = useState<number | ''>(50);
  const [materials, setMaterials] = useState('');
  const [dimensions, setDimensions] = useState('');
  const [productionMethod, setProductionMethod] = useState('Handcrafted');
  const [description, setDescription] = useState('');

  // Cost Calculator State
  const [showCalculator, setShowCalculator] = useState(false);
  const [rawMaterialsCost, setRawMaterialsCost] = useState<number>(300);
  const [laborCost, setLaborCost] = useState<number>(250);
  const [packagingCost, setPackagingCost] = useState<number>(50);
  const [overheadCost, setOverheadCost] = useState<number>(50);
  const [batchQuantity, setBatchQuantity] = useState<number>(1);
  const [desiredMarginPct, setDesiredMarginPct] = useState<number>(25);

  // Voice Assistant Flow State
  const [voiceStepIndex, setVoiceStepIndex] = useState<number>(0);
  const [voiceQuestions, setVoiceQuestions] = useState<any[]>([]);
  const [micState, setMicState] = useState<'ready' | 'listening' | 'processing' | 'error'>('ready');
  const [spokenTranscript, setSpokenTranscript] = useState<string>('');
  const [micErrorMessage, setMicErrorMessage] = useState<string>('');
  const [manualVoiceAnswer, setManualVoiceAnswer] = useState<string>('');
  const [showManualVoiceInput, setShowManualVoiceInput] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [voiceReviewPending, setVoiceReviewPending] = useState<{
    original_text: string;
    english_value: string;
    display_text: string;
    field: string;
    category?: string;
    materials?: string;
    price?: number;
    stock?: number;
    price_suggestion?: any;
    confidence?: string;
  } | null>(null);

  const recognitionRef = useRef<any>(null);

  // Submission & Success state
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successProduct, setSuccessProduct] = useState<any | null>(null);

  // Stop camera when unmounting
  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCameraStream();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  // Fetch Voice Curriculum Questions
  useEffect(() => {
    const loadVoiceQuestions = async () => {
      try {
        const res = await api.getVoiceQuestions(voiceLang);
        if (res.success && res.questions) {
          setVoiceQuestions(res.questions);
        }
      } catch (err) {
        console.error('Failed to load voice questions:', err);
      }
    };
    loadVoiceQuestions();
  }, [voiceLang]);

  // Read current question aloud when voice step changes
  useEffect(() => {
    if (inputMode === 'voice' && voiceQuestions.length > 0 && voiceStepIndex < voiceQuestions.length) {
      const q = voiceQuestions[voiceStepIndex];
      const textToSpeak = voiceLang === 'ta' ? (q.tts_text_ta || q.question_ta) : (q.tts_text_en || q.question_en);
      speakQuestion(textToSpeak, voiceLang);
    }
  }, [voiceStepIndex, inputMode, voiceLang, voiceQuestions]);

  // Start Camera
  const startCamera = async (facing: 'environment' | 'user' = cameraFacingMode) => {
    stopCameraStream();
    setCameraError('');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          'Live camera stream is not supported in this browser. Please use the mobile capture or file upload option.'
        );
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
      setCameraFacingMode(facing);
    } catch (err: any) {
      console.error('Camera stream access failed:', err);
      setCameraError(
        'Could not access your device camera. Please check permissions or upload an image directly from your gallery.'
      );
      setCameraActive(false);
    }
  };

  const toggleCameraFacing = () => {
    const nextFacing = cameraFacingMode === 'environment' ? 'user' : 'environment';
    startCamera(nextFacing);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `craft_capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
        handlePhotoSelected(file);
      }
    }, 'image/jpeg', 0.92);

    stopCameraStream();
  };

  const handlePhotoSelected = async (file: File) => {
    setSelectedFile(file);
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);
    setEnhancedImageUrl('');
    setSelectedImageChoice('original');
    setDuplicateWarning('');
    setErrorMessage('');

    setAiLoading(true);
    try {
      const res = await api.aiCatalogGenerate({
        image: file,
        notes: artisanNotes,
        auto_enhance: true,
      });

      if (res.image_url) {
        setUploadedImageUrl(res.image_url);
      }

      if (res.hashes?.phash) {
        setImageHash(res.hashes.phash);
      }

      if (res.enhanced_image?.enhanced_url) {
        setEnhancedImageUrl(res.enhanced_image.enhanced_url);
        setSelectedImageChoice('enhanced');
        setEnhancementDisclaimer(res.enhanced_image.disclaimer || '');
      }

      if (res.duplicate_warnings && res.duplicate_warnings.length > 0) {
        setDuplicateWarning(
          `Notice: An image matching this craft was previously registered (#${res.duplicate_warnings[0].product_id?.slice(-6)}). Authentic handmade items are permitted, but please confirm this listing is authentic.`
        );
      }

      if (res.suggestion) {
        const s = res.suggestion;
        setIsAiPowered(Boolean(s.ai_configured && s.recognized));
        setAiDisclaimer(s.disclaimer || '');
        setAiAnalyzed(true);

        if (s.title && !title) setTitle(s.title);
        if (s.category && !category) setCategory(s.category);
        if (s.estimated_material && !materials) setMaterials(s.estimated_material);
        if (s.description && !description) setDescription(s.description);
        if (s.production_method && !productionMethod) setProductionMethod(s.production_method);
        if (s.suggested_min_price_inr && !pricePerUnit) setPricePerUnit(s.suggested_min_price_inr);
        setMaterialUnconfirmed(Boolean(s.material_needs_confirmation));
      }
    } catch (err: any) {
      console.error('AI Catalog analysis error:', err);
      setIsAiPowered(false);
      setAiAnalyzed(true);
    } finally {
      setAiLoading(false);
    }
  };

  const handleClearPhoto = () => {
    setSelectedFile(null);
    setPreviewUrl('');
    setUploadedImageUrl('');
    setEnhancedImageUrl('');
    setSelectedImageChoice('original');
    setImageHash('');
    setAiAnalyzed(false);
    stopCameraStream();
  };

  const handleRetryEnhancement = async (style: 'warm_studio' | 'pure_white' | 'neutral_grey') => {
    if (!selectedFile && !uploadedImageUrl) return;
    setBackdropStyle(style);
    setEnhancementLoading(true);
    try {
      const res = await api.enhanceImage({
        image: selectedFile || undefined,
        image_url: uploadedImageUrl || undefined,
        backdrop_style: style,
        artisan_controlled: true,
      });
      if (res.enhanced_image_url) {
        setEnhancedImageUrl(res.enhanced_image_url);
        setSelectedImageChoice('enhanced');
        setEnhancementDisclaimer(res.disclaimer || '');
      }
    } catch (err: any) {
      console.error('Enhancement retry failed:', err);
    } finally {
      setEnhancementLoading(false);
    }
  };

  // --- VOICE SPEECH SYNTHESIS & RECOGNITION ---
  const speakQuestion = (text: string, language: 'ta' | 'en') => {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === 'ta' ? 'ta-IN' : 'en-IN';
      utterance.rate = 0.95;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error('TTS error:', e);
      setIsSpeaking(false);
    }
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  const startListening = () => {
    stopSpeaking();
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicState('error');
      setMicErrorMessage(
        voiceLang === 'ta'
          ? 'இந்த உலாவியில் குரல் அறிதல் ஆதரிக்கப்படவில்லை. கீழே உள்ள கட்டத்தில் தட்டச்சு செய்யவும்.'
          : 'Speech recognition is not supported in this browser. Please type your answer below.'
      );
      setShowManualVoiceInput(true);
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = voiceLang === 'ta' ? 'ta-IN' : 'en-IN';
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setMicState('listening');
        setSpokenTranscript('');
        setMicErrorMessage('');
        setVoiceReviewPending(null);
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setSpokenTranscript(currentTranscript);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setMicState('error');
        if (event.error === 'not-allowed') {
          setMicErrorMessage(
            voiceLang === 'ta'
              ? 'மைக்ரோஃபோன் அனுமதி மறுக்கப்பட்டது. உலாவி அமைப்பில் அனுமதியை இயக்கவும்.'
              : 'Microphone access denied. Please allow microphone permissions in browser settings.'
          );
        } else {
          setMicErrorMessage(
            voiceLang === 'ta'
              ? 'குரல் தெளிவாகப் பதிவாகவில்லை. மீண்டும் பேசவும்.'
              : 'Could not capture speech clearly. Please try again.'
          );
        }
      };

      recognition.onend = () => {
        if (micState === 'listening' || recognitionRef.current) {
          // If we captured speech, process it automatically
          setMicState('processing');
        }
      };

      recognition.start();
    } catch (err: any) {
      console.error('Speech recognition start failed:', err);
      setMicState('error');
      setMicErrorMessage(err.message || 'Microphone error');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setMicState('processing');
    if (spokenTranscript) {
      handleProcessAnswer(spokenTranscript);
    } else {
      setMicState('ready');
    }
  };

  // Automatically process speech once user stops talking and transcript is present
  useEffect(() => {
    if (micState === 'processing' && spokenTranscript && !voiceReviewPending) {
      handleProcessAnswer(spokenTranscript);
    }
  }, [micState, spokenTranscript]);

  const handleProcessAnswer = async (textToProcess: string) => {
    if (!textToProcess.trim()) return;
    setMicState('processing');
    try {
      const q = voiceQuestions[voiceStepIndex];
      const fieldId = q ? q.id : 'description';
      const res = await api.processVoiceAnswer({
        field: fieldId,
        spoken_text: textToProcess,
        language: voiceLang,
        current_product: {
          title,
          category,
          materials
        }
      });

      if (res.success && res.is_valid) {
        setVoiceReviewPending({
          original_text: res.original_text || textToProcess,
          english_value: String(res.english_value || ''),
          display_text: res.display_text || String(res.english_value || ''),
          field: fieldId,
          category: res.associated_category,
          materials: res.associated_materials,
          price: res.numeric_value && fieldId.includes('price') ? res.numeric_value : undefined,
          stock: res.numeric_value && fieldId.includes('stock') ? res.numeric_value : undefined,
          price_suggestion: res.price_suggestion,
          confidence: res.confidence || 'high'
        });
        setMicState('ready');
      } else {
        setMicState('error');
        setMicErrorMessage(
          res.error_message ||
          (voiceLang === 'ta' ? 'பதிலை புரிந்து கொள்ள முடியவில்லை. மீண்டும் பேசவும்.' : 'Could not parse answer. Please try again.')
        );
      }
    } catch (err: any) {
      setMicState('error');
      setMicErrorMessage(err.message || 'Failed to process voice response');
    }
  };

  const confirmVoiceStep = () => {
    if (!voiceReviewPending) return;
    const { field, english_value, category: cCat, materials: cMat, price: cPrice, stock: cStock } = voiceReviewPending;

    if (field === 'title') {
      setTitle(english_value);
      if (cCat) setCategory(cCat);
      if (cMat) setMaterials(cMat);
      if (voiceReviewPending.price_suggestion?.suggested_price && !pricePerUnit) {
        setPricePerUnit(voiceReviewPending.price_suggestion.suggested_price);
      }
    } else if (field === 'category') {
      setCategory(english_value);
    } else if (field === 'materials') {
      setMaterials(english_value);
    } else if (field === 'price_per_unit' || field === 'price') {
      const p = Number(english_value) || cPrice;
      if (p) setPricePerUnit(p);
    } else if (field === 'stock_quantity' || field === 'stock') {
      const s = Number(english_value) || cStock;
      if (s) setStockQuantity(s);
    } else if (field === 'description' || field === 'features') {
      setDescription(english_value);
    } else if (field === 'moq') {
      const m = Number(english_value);
      if (m) setMoq(m);
    } else if (field === 'lead_time_days') {
      const lt = Number(english_value);
      if (lt) setLeadTimeDays(lt);
    }

    setVoiceReviewPending(null);
    setSpokenTranscript('');
    setManualVoiceAnswer('');
    setShowManualVoiceInput(false);

    // Advance to next unfulfilled question or review
    setVoiceStepIndex((prev) => prev + 1);
  };

  const tryAgainVoiceStep = () => {
    setVoiceReviewPending(null);
    setSpokenTranscript('');
    setManualVoiceAnswer('');
    setMicState('ready');
    setMicErrorMessage('');
    startListening();
  };

  const handleSubmitProduct = async (e: React.FormEvent, isPublished: boolean = true) => {
    e.preventDefault();
    setErrorMessage('');

    if (!previewUrl && !uploadedImageUrl) {
      setErrorMessage(t('photoRequired') || 'Product photograph is required.');
      return;
    }

    if (!title.trim()) {
      setErrorMessage(voiceLang === 'ta' ? 'தயாரிப்பின் பெயர் தேவை.' : 'Product title is required.');
      return;
    }

    if (!category.trim()) {
      setErrorMessage(voiceLang === 'ta' ? 'கைவினைப் பிரிவு தேர்ந்தெடுக்கப்பட வேண்டும்.' : 'Craft category is required.');
      return;
    }

    if (!pricePerUnit || Number(pricePerUnit) <= 0) {
      setErrorMessage(voiceLang === 'ta' ? 'செல்லுபடியாகும் விலையை உள்ளிடவும்.' : 'Please provide a valid price per unit.');
      return;
    }

    setSaving(true);
    try {
      const finalImage = selectedImageChoice === 'enhanced' && enhancedImageUrl
        ? enhancedImageUrl
        : (uploadedImageUrl || previewUrl);

      const payload = {
        title: title.trim(),
        category: category.trim(),
        price_per_unit: Number(pricePerUnit),
        unit: unit.trim() || 'piece',
        stock_quantity: Number(stockQuantity) || 0,
        moq: Number(moq) || 1,
        lead_time_days: Number(leadTimeDays) || 7,
        monthly_capacity: Number(monthlyCapacity) || 50,
        materials: materials.trim(),
        dimensions: dimensions.trim(),
        production_method: productionMethod.trim() || 'Handcrafted',
        description: description.trim(),
        images: [finalImage],
        primary_image_hash: imageHash,
        is_published: isPublished,
        ai_generated: Boolean(aiAnalyzed && isAiPowered),
      };

      const res = await api.createProduct(payload);
      setSuccessProduct({ ...payload, id: res.product_id });
      onSuccess({ ...payload, id: res.product_id });
    } catch (err: any) {
      console.error('Failed to publish product:', err);
      setErrorMessage(err.message || 'Could not save product listing.');
    } finally {
      setSaving(false);
    }
  };

  // Check which question to ask next or if all core fields are covered
  const currentVoiceQ = voiceQuestions[voiceStepIndex];
  const allVoiceQuestionsCompleted = voiceQuestions.length > 0 && voiceStepIndex >= voiceQuestions.length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-4 sm:p-6 shadow-2xl border border-stone-200 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-stone-200 pb-3 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-serif text-lg sm:text-xl font-bold text-charcoal-900">
                {language === 'ta' ? 'புதிய கைவினைப் பொருள் சேர்த்தல்' : 'Create Artisan Product Listing'}
              </h3>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <Sparkles className="w-3 h-3 text-emerald-600" /> Rural Artisan Direct
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              {language === 'ta'
                ? 'புகைப்படம் பதிவேற்றவும் • கைமுறை படிவம் அல்லது குரல் வழி தேர்வு செய்யவும்'
                : 'Upload photo • Choose manual input or voice assistant to publish effortlessly'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCameraStream();
              stopSpeaking();
              onClose();
            }}
            className="text-stone-400 hover:text-stone-600 p-2 rounded-xl hover:bg-stone-100 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pr-1 pt-4 space-y-6">
          
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-800 text-xs sm:text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {/* SECTION 1: EXACTLY ONE SHARED PHOTO UPLOAD & STUDIO ENHANCEMENT */}
          <div className="bg-[#FAF8F5] p-4 sm:p-5 rounded-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-bold text-charcoal-900 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-forest-700" />
                  {t('sharedPhotoHeader')} <span className="text-rose-500">*</span>
                </label>
                <p className="text-xs text-stone-500">
                  {t('sharedPhotoDesc')}
                </p>
              </div>

              {previewUrl && (
                <button
                  type="button"
                  onClick={handleClearPhoto}
                  className="text-xs text-stone-500 hover:text-rose-600 flex items-center gap-1 font-medium bg-white px-2.5 py-1 rounded-lg border border-stone-200"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> {t('retakePhoto')}
                </button>
              )}
            </div>

            {/* PROCESSING SPINNER */}
            {(aiLoading || enhancementLoading) && (
              <div className="bg-white p-6 rounded-2xl border border-forest-200 text-center space-y-3 shadow-xs animate-pulse">
                <div className="w-12 h-12 rounded-full bg-forest-50 text-forest-700 flex items-center justify-center mx-auto">
                  <RefreshCw className="w-6 h-6 animate-spin text-forest-700" />
                </div>
                <div>
                  <h4 className="font-bold text-charcoal-900 text-sm">
                    {enhancementLoading ? 'Creating High-Fidelity Studio Backdrop…' : 'Analyzing Visual Craft Attributes…'}
                  </h4>
                  <p className="text-xs text-stone-500 max-w-md mx-auto">
                    Preserving the authentic texture, edges, and colors of your handcrafted creation.
                  </p>
                </div>
              </div>
            )}

            {/* PREVIEWS & STUDIO SELECTION */}
            {previewUrl && !aiLoading && !enhancementLoading && (
              <div className="space-y-4">
                {enhancedImageUrl ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* ORIGINAL PHOTOGRAPH CARD */}
                    <div
                      onClick={() => setSelectedImageChoice('original')}
                      className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer bg-white relative ${
                        selectedImageChoice === 'original'
                          ? 'border-forest-700 ring-2 ring-forest-600/20 shadow-md'
                          : 'border-stone-200 hover:border-stone-300 opacity-80'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-charcoal-800 flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5 text-forest-700" /> Original Craft Photo
                        </span>
                        {selectedImageChoice === 'original' && (
                          <span className="bg-forest-800 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Check className="w-3 h-3" /> Selected
                          </span>
                        )}
                      </div>
                      <div className="w-full h-48 rounded-xl overflow-hidden bg-stone-50 border border-stone-200 flex items-center justify-center p-2">
                        <img
                          src={previewUrl}
                          alt="Original upload"
                          className="w-full h-full object-contain rounded-lg"
                        />
                      </div>
                      <p className="text-[11px] text-stone-500 mt-2">
                        Your untouched authentic workshop photograph.
                      </p>
                    </div>

                    {/* STUDIO ENHANCED CARD */}
                    <div
                      onClick={() => setSelectedImageChoice('enhanced')}
                      className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer bg-white relative ${
                        selectedImageChoice === 'enhanced'
                          ? 'border-forest-700 ring-2 ring-forest-600/20 shadow-md'
                          : 'border-stone-200 hover:border-stone-300 opacity-80'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-forest-900 flex items-center gap-1">
                          <Wand2 className="w-3.5 h-3.5 text-forest-700" /> Studio Enhanced Backdrop
                        </span>
                        {selectedImageChoice === 'enhanced' && (
                          <span className="bg-forest-800 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Check className="w-3 h-3" /> Selected
                          </span>
                        )}
                      </div>
                      <div className="w-full h-48 rounded-xl overflow-hidden bg-stone-50 border border-stone-200 flex items-center justify-center p-2">
                        <img
                          src={enhancedImageUrl}
                          alt="Enhanced studio background"
                          className="w-full h-full object-contain rounded-lg"
                        />
                      </div>
                      <p className="text-[11px] text-stone-500 mt-2">
                        Neutral warm studio lighting with zero artificial blur on craft edges.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white p-3.5 rounded-2xl border border-stone-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-charcoal-800 flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5 text-forest-700" /> Uploaded Craft Photograph
                      </span>
                      <button
                        type="button"
                        onClick={handleClearPhoto}
                        className="text-xs text-stone-500 hover:text-rose-600 flex items-center gap-1"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Replace Photo
                      </button>
                    </div>
                    <div className="w-full max-h-72 rounded-xl overflow-hidden bg-stone-50 border border-stone-200 flex items-center justify-center p-2">
                      <img
                        src={previewUrl}
                        alt="Original craft upload"
                        className="w-full h-full max-h-64 object-contain rounded-lg"
                      />
                    </div>
                    <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-stone-500">
                      <span className="flex items-center gap-1.5 text-stone-600">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        Authentic photograph preserved at full quality.
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRetryEnhancement(backdropStyle)}
                        disabled={enhancementLoading}
                        className="px-3 py-1 bg-stone-100 hover:bg-stone-200 text-charcoal-800 rounded-lg font-medium flex items-center gap-1 text-xs shrink-0"
                      >
                        <Wand2 className="w-3 h-3 text-terracotta-600" />
                        {enhancementLoading ? 'Processing…' : 'Enhance Background'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* INITIAL ACQUISITION: TAKE PHOTO OR UPLOAD */}
            {!previewUrl && (
              <div>
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      stopCameraStream();
                      setImageSourceTab('upload');
                    }}
                    className={`flex-1 py-2.5 px-3 text-xs sm:text-sm font-medium rounded-xl border transition-all flex items-center justify-center gap-2 ${
                      imageSourceTab === 'upload'
                        ? 'bg-white border-forest-600 text-forest-800 shadow-xs'
                        : 'bg-stone-100 border-stone-200 text-stone-600 hover:bg-stone-200/60'
                    }`}
                  >
                    <Upload className="w-4 h-4" /> Upload from Gallery
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImageSourceTab('camera');
                      startCamera();
                    }}
                    className={`flex-1 py-2.5 px-3 text-xs sm:text-sm font-medium rounded-xl border transition-all flex items-center justify-center gap-2 ${
                      imageSourceTab === 'camera'
                        ? 'bg-white border-forest-600 text-forest-800 shadow-xs'
                        : 'bg-stone-100 border-stone-200 text-stone-600 hover:bg-stone-200/60'
                    }`}
                  >
                    <Camera className="w-4 h-4" /> Take Photo (Device Camera)
                  </button>
                </div>

                {imageSourceTab === 'upload' && (
                  <label className="border-2 border-dashed border-stone-300 hover:border-forest-600 bg-white rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center cursor-pointer transition-colors block">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handlePhotoSelected(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                    />
                    <div className="w-12 h-12 rounded-full bg-forest-50 text-forest-800 flex items-center justify-center mb-2">
                      <Upload className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-semibold text-charcoal-900">
                      Tap to select craft photo from device
                    </span>
                    <span className="text-xs text-stone-400 mt-1">
                      JPG, PNG, or WEBP up to 10MB
                    </span>
                  </label>
                )}

                {imageSourceTab === 'camera' && (
                  <div className="bg-stone-900 rounded-2xl p-4 text-center">
                    {cameraError ? (
                      <div className="p-4 text-rose-300 text-xs">
                        <AlertCircle className="w-6 h-6 mx-auto mb-2 text-rose-400" />
                        {cameraError}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="relative rounded-xl overflow-hidden bg-black aspect-video max-h-72 mx-auto flex items-center justify-center">
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={toggleCameraFacing}
                            className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs rounded-lg border border-stone-700 flex items-center gap-1.5"
                          >
                            <RefreshCw className="w-3.5 h-3.5" /> Flip Camera
                          </button>
                          <button
                            type="button"
                            onClick={capturePhoto}
                            disabled={!cameraActive}
                            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs sm:text-sm font-bold rounded-xl flex items-center gap-2 shadow-lg"
                          >
                            <Camera className="w-4 h-4" /> Capture Photo
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              stopCameraStream();
                              setImageSourceTab('upload');
                            }}
                            className="text-xs text-stone-400 hover:text-white"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* INPUT METHOD SELECTOR (SHARED PHOTO & STATE) */}
          <div className="bg-white p-3 sm:p-4 rounded-2xl border border-stone-200 shadow-2xs space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-charcoal-900 block">
                  {t('chooseInputMethod')}
                </span>
                <span className="text-[11px] text-stone-500">
                  {t('inputModeNote')}
                </span>
              </div>

              {/* Language pill in voice mode */}
              {inputMode === 'voice' && (
                <div className="flex items-center gap-1 bg-amber-50 border border-amber-300 p-1 rounded-xl shrink-0">
                  <span className="text-[10px] font-bold text-amber-900 px-2">Language:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setVoiceLang('ta');
                      stopSpeaking();
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      voiceLang === 'ta'
                        ? 'bg-amber-700 text-white shadow-xs'
                        : 'text-stone-700 hover:bg-amber-100'
                    }`}
                  >
                    தமிழ்
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVoiceLang('en');
                      stopSpeaking();
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      voiceLang === 'en'
                        ? 'bg-amber-700 text-white shadow-xs'
                        : 'text-stone-700 hover:bg-amber-100'
                    }`}
                  >
                    English
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  stopSpeaking();
                  setInputMode('manual');
                }}
                className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 border transition-all ${
                  inputMode === 'manual'
                    ? 'bg-forest-800 text-white border-forest-900 shadow-xs'
                    : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                {t('manualInputTab')}
              </button>

              <button
                type="button"
                onClick={() => {
                  setInputMode('voice');
                }}
                className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 border transition-all ${
                  inputMode === 'voice'
                    ? 'bg-amber-700 text-white border-amber-800 shadow-xs'
                    : 'bg-amber-50/70 text-amber-900 border-amber-300 hover:bg-amber-100'
                }`}
              >
                <Mic className="w-4 h-4" />
                {t('preferSpeakingTab')}
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* OPTION A: PREFER SPEAKING (INTEGRATED INTERACTIVE VOICE ASSISTANT) */}
          {/* ========================================================================= */}
          {inputMode === 'voice' && (
            <div className="bg-gradient-to-br from-amber-50/70 via-orange-50/40 to-stone-50 rounded-2xl border-2 border-amber-300 p-4 sm:p-6 space-y-6">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-amber-200 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Mic className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="font-serif font-bold text-charcoal-900 text-base">
                      {t('voiceAssistantTitle')}
                    </h4>
                    <p className="text-xs text-stone-600">
                      {t('voiceAssistantSubtitle')}
                    </p>
                  </div>
                </div>

                {isSpeaking && (
                  <button
                    type="button"
                    onClick={stopSpeaking}
                    className="px-2.5 py-1 bg-amber-100 text-amber-900 text-xs font-semibold rounded-lg flex items-center gap-1 border border-amber-300"
                  >
                    <VolumeX className="w-3.5 h-3.5" /> Mute TTS
                  </button>
                )}
              </div>

              {/* Step indicator */}
              {!allVoiceQuestionsCompleted && currentVoiceQ && (
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-amber-900 mb-1.5">
                    <span>
                      {t('questionProgress')} {voiceStepIndex + 1} of {voiceQuestions.length}
                    </span>
                    <span className="text-[11px] bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300 font-bold">
                      {currentVoiceQ.id}
                    </span>
                  </div>
                  <div className="w-full bg-amber-200/60 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-amber-700 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${((voiceStepIndex + 1) / voiceQuestions.length) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* ACTIVE QUESTION CARD */}
              {!allVoiceQuestionsCompleted && currentVoiceQ ? (
                <div className="bg-white rounded-2xl p-5 border border-amber-300 shadow-sm space-y-5">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-amber-800 block mb-1">
                          {voiceLang === 'ta' ? 'கேள்வி' : 'Question'}
                        </span>
                        <h3 className="font-serif text-lg sm:text-xl font-extrabold text-charcoal-900 leading-snug">
                          {voiceLang === 'ta' ? currentVoiceQ.question_ta : currentVoiceQ.question_en}
                        </h3>
                        <p className="text-xs text-stone-500 mt-1">
                          {voiceLang === 'ta' ? currentVoiceQ.hint_ta : currentVoiceQ.hint_en}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const txt = voiceLang === 'ta' ? (currentVoiceQ.tts_text_ta || currentVoiceQ.question_ta) : (currentVoiceQ.tts_text_en || currentVoiceQ.question_en);
                          speakQuestion(txt, voiceLang);
                        }}
                        className="p-2 text-amber-800 hover:bg-amber-50 rounded-xl border border-amber-200 shrink-0 transition-colors"
                        title={t('repeatQuestion')}
                      >
                        <Volume2 className="w-5 h-5 text-amber-700" />
                      </button>
                    </div>
                  </div>

                  {/* MICROPHONE CONTROLS & STATE */}
                  <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-amber-50/50 border border-amber-200/80 space-y-4">
                    
                    {/* Big Pulse Mic Button */}
                    <div className="relative">
                      {micState === 'listening' && (
                        <div className="absolute inset-0 rounded-full bg-amber-400 animate-ping opacity-60" />
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (micState === 'listening') {
                            stopListening();
                          } else {
                            startListening();
                          }
                        }}
                        className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center text-white shadow-lg transition-transform active:scale-95 ${
                          micState === 'listening'
                            ? 'bg-rose-600 hover:bg-rose-700'
                            : micState === 'processing'
                            ? 'bg-amber-600'
                            : 'bg-amber-700 hover:bg-amber-800'
                        }`}
                      >
                        {micState === 'listening' ? (
                          <MicOff className="w-8 h-8 animate-pulse" />
                        ) : micState === 'processing' ? (
                          <RefreshCw className="w-8 h-8 animate-spin" />
                        ) : (
                          <Mic className="w-8 h-8" />
                        )}
                      </button>
                    </div>

                    {/* State Text */}
                    <div className="text-center">
                      <span className={`text-xs font-bold uppercase tracking-wider block ${
                        micState === 'listening'
                          ? 'text-rose-700 animate-pulse'
                          : micState === 'processing'
                          ? 'text-amber-800'
                          : micState === 'error'
                          ? 'text-rose-600'
                          : 'text-stone-600'
                      }`}>
                        {micState === 'listening'
                          ? t('micListening')
                          : micState === 'processing'
                          ? t('micProcessing')
                          : micState === 'error'
                          ? t('micError')
                          : t('micReady')}
                      </span>

                      {spokenTranscript && (
                        <p className="text-sm font-semibold text-charcoal-900 mt-2 italic max-w-lg bg-white px-3 py-1.5 rounded-xl border border-amber-200 inline-block shadow-2xs">
                          &ldquo;{spokenTranscript}&rdquo;
                        </p>
                      )}

                      {micErrorMessage && (
                        <p className="text-xs text-rose-600 font-medium mt-1">
                          {micErrorMessage}
                        </p>
                      )}
                    </div>

                    {/* Secondary Action Controls */}
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                      {micState === 'listening' ? (
                        <button
                          type="button"
                          onClick={stopListening}
                          className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-colors shadow-xs"
                        >
                          {t('stopListening')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={startListening}
                          className="px-4 py-2 bg-amber-700 text-white rounded-xl text-xs font-bold hover:bg-amber-800 transition-colors shadow-xs"
                        >
                          {t('startListening')}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={tryAgainVoiceStep}
                        className="px-3 py-2 bg-white text-stone-700 border border-stone-300 rounded-xl text-xs font-medium hover:bg-stone-50 transition-colors"
                      >
                        {t('tryAgain')}
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowManualVoiceInput(!showManualVoiceInput)}
                        className="px-3 py-2 bg-white text-stone-700 border border-stone-300 rounded-xl text-xs font-medium hover:bg-stone-50 transition-colors flex items-center gap-1"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        {t('editAnswer')}
                      </button>
                    </div>
                  </div>

                  {/* MANUAL TEXT BOX FALLBACK */}
                  {showManualVoiceInput && (
                    <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                      <label className="text-xs font-bold text-charcoal-800 block">
                        {t('manualFallbackHint')}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={manualVoiceAnswer}
                          onChange={(e) => setManualVoiceAnswer(e.target.value)}
                          placeholder={voiceLang === 'ta' ? 'பதிலை தட்டச்சு செய்யவும்…' : 'Type your answer here…'}
                          className="flex-1 px-3 py-2 rounded-lg border border-stone-300 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleProcessAnswer(manualVoiceAnswer)}
                          disabled={!manualVoiceAnswer.trim()}
                          className="px-4 py-2 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold"
                        >
                          Process
                        </button>
                      </div>
                    </div>
                  )}

                  {/* REVIEW & CONFIRM CARD (NATURAL TAMIL UNDERSTANDING REVIEW) */}
                  {voiceReviewPending && (
                    <div className="p-4 bg-emerald-50/80 border-2 border-emerald-300 rounded-2xl space-y-3 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          {t('transcriptReview')}
                        </span>
                        {voiceReviewPending.confidence === 'uncertain' && (
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                            Clarification Suggested
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="bg-white p-3 rounded-xl border border-emerald-200">
                          <span className="text-[10px] text-stone-500 block uppercase font-bold tracking-wider">
                            {t('recognizedSpoken')}
                          </span>
                          <strong className="text-charcoal-900 text-sm block mt-0.5">
                            {voiceReviewPending.original_text}
                          </strong>
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-emerald-200">
                          <span className="text-[10px] text-emerald-800 block uppercase font-bold tracking-wider">
                            {t('englishTranslation')}
                          </span>
                          <strong className="text-forest-950 text-sm block mt-0.5">
                            {voiceReviewPending.english_value}
                          </strong>
                        </div>
                      </div>

                      {voiceReviewPending.category && (
                        <div className="text-xs text-stone-600 bg-white px-3 py-1.5 rounded-xl border border-emerald-200">
                          Mapped Category: <strong className="text-forest-900">{voiceReviewPending.category}</strong>
                        </div>
                      )}

                      {voiceReviewPending.price_suggestion && (
                        <div className="text-xs text-stone-600 bg-amber-50 px-3 py-2 rounded-xl border border-amber-200 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-amber-900 block">Indicative Fair Price Benchmark:</span>
                            <span>₹{voiceReviewPending.price_suggestion.suggested_price} (Range: ₹{voiceReviewPending.price_suggestion.price_range_min} - ₹{voiceReviewPending.price_suggestion.price_range_max})</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPricePerUnit(voiceReviewPending.price_suggestion.suggested_price)}
                            className="px-2.5 py-1 bg-amber-700 text-white text-xs font-bold rounded-lg"
                          >
                            Accept
                          </button>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={tryAgainVoiceStep}
                          className="px-3 py-2 text-stone-600 hover:text-stone-800 text-xs font-medium"
                        >
                          {t('tryAgain')}
                        </button>
                        <button
                          type="button"
                          onClick={confirmVoiceStep}
                          className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5"
                        >
                          <Check className="w-4 h-4" /> {t('confirmAndNext')}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Navigation controls */}
                  <div className="flex items-center justify-between pt-2 border-t border-stone-200 text-xs">
                    <button
                      type="button"
                      disabled={voiceStepIndex === 0}
                      onClick={() => setVoiceStepIndex((prev) => Math.max(0, prev - 1))}
                      className="text-stone-500 hover:text-stone-800 disabled:opacity-30 flex items-center gap-1 font-medium"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Previous Question
                    </button>

                    <button
                      type="button"
                      onClick={() => setVoiceStepIndex((prev) => prev + 1)}
                      className="text-forest-800 font-bold hover:underline flex items-center gap-1"
                    >
                      Skip Question <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                /* ALL QUESTIONS ANSWERED: COMPREHENSIVE REVIEW & PUBLISH CARD */
                <div className="bg-white rounded-2xl p-6 border-2 border-emerald-400 shadow-md space-y-6">
                  <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                    <div className="flex items-center gap-2 text-emerald-800">
                      <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                      <div>
                        <h4 className="font-serif font-bold text-lg text-charcoal-900">
                          {t('reviewListing')}
                        </h4>
                        <p className="text-xs text-stone-500">
                          All voice questions completed. Review before publishing to the marketplace.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setInputMode('manual')}
                      className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold flex items-center gap-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Switch to Manual Form
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                      <span className="text-[10px] text-stone-400 uppercase font-bold block">Product Title (English)</span>
                      <strong className="text-charcoal-900 text-sm block mt-0.5">{title || '—'}</strong>
                    </div>

                    <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                      <span className="text-[10px] text-stone-400 uppercase font-bold block">Craft Category</span>
                      <strong className="text-charcoal-900 text-sm block mt-0.5">{category || '—'}</strong>
                    </div>

                    <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                      <span className="text-[10px] text-stone-400 uppercase font-bold block">Unit Price & Stock</span>
                      <strong className="text-forest-900 text-sm block mt-0.5">
                        ₹{pricePerUnit || 0} / {unit} • {stockQuantity} in stock (MOQ: {moq})
                      </strong>
                    </div>

                    <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                      <span className="text-[10px] text-stone-400 uppercase font-bold block">Primary Materials</span>
                      <strong className="text-charcoal-900 text-sm block mt-0.5">{materials || 'Natural materials'}</strong>
                    </div>

                    <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 md:col-span-2">
                      <span className="text-[10px] text-stone-400 uppercase font-bold block">Artisan Description & Story</span>
                      <p className="text-stone-700 text-xs mt-1 leading-relaxed">{description || '—'}</p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-3 border-t border-stone-200">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={(e) => handleSubmitProduct(e, false)}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-50 font-bold text-xs"
                    >
                      {saving ? 'Saving Draft…' : t('saveDraft')}
                    </button>

                    <button
                      type="button"
                      disabled={saving}
                      onClick={(e) => handleSubmitProduct(e, true)}
                      className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-forest-800 hover:bg-forest-900 text-white font-bold text-xs shadow-md flex items-center justify-center gap-2"
                    >
                      {saving ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" /> Saving & Publishing…
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 text-gold-300" /> {t('publishListing')}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* OPTION B: MANUAL INPUT (STANDARD COMPLETE FORM WITH PRESERVED STATE) */}
          {/* ========================================================================= */}
          {inputMode === 'manual' && (
            <div className="space-y-6">
              
              {/* SECTION 2: AI CATALOG STATUS & ARTISAN HINTS */}
              {aiAnalyzed && (
                <div className="p-4 rounded-2xl border border-stone-200 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-charcoal-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-terracotta-600" />
                      Product Recognition Status
                    </span>
                    <span className="text-[11px] text-stone-500">
                      {isAiPowered ? 'Review suggested fields below' : 'Manual entry mode active'}
                    </span>
                  </div>

                  {isAiPowered ? (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Vision AI Recognition:</span> Suggested fields prefilled based on visual analysis. Please review and confirm material, price, and category before publishing.
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                      <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Manual Entry Mode:</span> Could not confidently identify this product (Vision AI is not configured or recognition is uncertain). Please select your craft category and enter product details manually below.
                      </div>
                    </div>
                  )}

                  {duplicateWarning && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                      {duplicateWarning}
                    </div>
                  )}
                </div>
              )}

              {/* SECTION 3: BASIC PRODUCT INFORMATION */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 space-y-4">
                <h4 className="text-xs uppercase font-bold tracking-wider text-charcoal-800">
                  Basic Product Information
                </h4>

                {/* Product Title */}
                <div>
                  <label className="block text-xs font-bold text-charcoal-800 mb-1">
                    Product Title (English Canonical) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Traditional Terracotta Water Jug with Handle"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
                  />
                </div>

                {/* Category & Production Method */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-charcoal-800 mb-1">
                      Craft Category <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 bg-white focus:ring-2 focus:ring-forest-600 focus:outline-none"
                    >
                      <option value="">Select an authentic craft category…</option>
                      {CRAFT_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-charcoal-800 mb-1">
                      Production Technique
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Wheel-thrown & Kiln Baked / Handloom"
                      value={productionMethod}
                      onChange={(e) => setProductionMethod(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Materials & Confirmation */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-charcoal-800">
                      Primary Materials <span className="text-rose-500">*</span>
                    </label>
                    {materialUnconfirmed && (
                      <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        Please confirm authentic composition
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Natural Terracotta Clay / 100% Mulberry Silk"
                    value={materials}
                    onChange={(e) => {
                      setMaterials(e.target.value);
                      setMaterialUnconfirmed(false);
                    }}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* SECTION 4: PRICING & INVENTORY */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs uppercase font-bold tracking-wider text-charcoal-800">
                    Pricing, MOQ & Inventory
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowCalculator(!showCalculator)}
                    className="text-xs text-forest-800 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    {showCalculator ? 'Hide Cost Calculator' : 'Fair Price Calculator'}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-charcoal-800 mb-1">
                      Unit Price (₹) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="any"
                      placeholder="e.g. 380"
                      value={pricePerUnit}
                      onChange={(e) => setPricePerUnit(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-charcoal-800 mb-1">
                      Unit of Measure
                    </label>
                    <select
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 bg-white focus:ring-2 focus:ring-forest-600 focus:outline-none"
                    >
                      {COMMON_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-charcoal-800 mb-1">
                      Ready Stock
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g. 10"
                      value={stockQuantity}
                      onChange={(e) => setStockQuantity(e.target.value ? Number(e.target.value) : 0)}
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-charcoal-800 mb-1">
                      Minimum Order (MOQ)
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 1"
                      value={moq}
                      onChange={(e) => setMoq(e.target.value ? Number(e.target.value) : 1)}
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-charcoal-800 mb-1">
                      Dimensions / Size
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Height 11 in, Volume 3L"
                      value={dimensions}
                      onChange={(e) => setDimensions(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-charcoal-800 mb-1">
                      Lead Time (Days)
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 7"
                      value={leadTimeDays}
                      onChange={(e) => setLeadTimeDays(e.target.value ? Number(e.target.value) : 7)}
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-charcoal-800 mb-1">
                      Monthly Capacity
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 50"
                      value={monthlyCapacity}
                      onChange={(e) => setMonthlyCapacity(e.target.value ? Number(e.target.value) : 50)}
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-charcoal-800 mb-1">
                    Artisan Story & Craft Description
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe the craft tradition, cooling benefits, weaving style, or natural materials…"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Form Actions */}
              <div className="pt-4 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    stopCameraStream();
                    onClose();
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 border border-stone-300 rounded-xl text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={saving || aiLoading || enhancementLoading}
                  onClick={(e) => handleSubmitProduct(e, false)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-forest-800 text-forest-800 hover:bg-forest-50 font-bold text-sm"
                >
                  {saving ? 'Saving Draft…' : t('saveDraft')}
                </button>

                <button
                  type="button"
                  disabled={saving || aiLoading || enhancementLoading}
                  onClick={(e) => handleSubmitProduct(e, true)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-forest-800 hover:bg-forest-900 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-md transition-colors"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Saving & Publishing…
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 text-gold-300" /> {t('publishListing')}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddProductModal;
