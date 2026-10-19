import React, { useState, useRef, useEffect } from 'react';
import {
  Mic, MicOff, Volume2, Camera, Upload, X, Check, ArrowRight,
  ArrowLeft, Sparkles, RefreshCw, AlertCircle, CheckCircle2,
  HelpCircle, Eye, ShieldCheck, Tag, DollarSign, Package,
  Layers, ShoppingBag, Edit2, Play, Pause
} from 'lucide-react';
import api from '../../services/api';
import { ProductImage } from '../common/ProductImage';

interface VoiceListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newProduct?: any) => void;
  initialLanguage?: 'ta' | 'en';
}

interface ProductListingState {
  title: string;
  category: string;
  materials: string;
  price_per_unit: number | '';
  stock_quantity: number | '';
  description: string;
  unit: string;
  moq: number;
  monthly_capacity: number;
  lead_time_days: number;
  production_method: string;
  dimensions: string;
  image_url: string;
  image_hash: string;
  confirmed_fields: Record<string, boolean>;
  ai_suggested_fields: Record<string, boolean>;
  tamil_labels: Record<string, string>;
}

const CRAFT_CATEGORIES = [
  'Household Goods, Water Jugs & Pitchers',
  'Pottery & Ceramics',
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

export const VoiceListingModal: React.FC<VoiceListingModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialLanguage = 'ta'
}) => {
  if (!isOpen) return null;

  // Language state: 'ta' (Tamil) or 'en' (English)
  const [lang, setLang] = useState<'ta' | 'en'>(initialLanguage);

  // Modal Step: 'photo' | 'qa' | 'price' | 'review' | 'success'
  const [step, setStep] = useState<'photo' | 'qa' | 'price' | 'review' | 'success'>('photo');

  // Photo & Camera state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [photoUploading, setPhotoUploading] = useState<boolean>(false);
  const [photoAiNote, setPhotoAiNote] = useState<string>('');

  // Voice Q&A Curriculum state
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(0);
  const [questions, setQuestions] = useState<any[]>([]);

  // Speech Recognition state: 'ready' | 'listening' | 'processing' | 'error'
  const [micState, setMicState] = useState<'ready' | 'listening' | 'processing' | 'error'>('ready');
  const [spokenTranscript, setSpokenTranscript] = useState<string>('');
  const [micErrorMessage, setMicErrorMessage] = useState<string>('');
  const [browserSpeechSupported, setBrowserSpeechSupported] = useState<boolean>(true);
  const recognitionRef = useRef<any>(null);

  // Manual fallback input
  const [manualText, setManualText] = useState<string>('');
  const [showManualInput, setShowManualInput] = useState<boolean>(false);

  // TTS audio playing state
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  // Collected Product Listing Data
  const [productData, setProductData] = useState<ProductListingState>({
    title: '',
    category: '',
    materials: '',
    price_per_unit: '',
    stock_quantity: 10,
    description: '',
    unit: 'piece',
    moq: 1,
    monthly_capacity: 50,
    lead_time_days: 7,
    production_method: 'Handcrafted',
    dimensions: '',
    image_url: '',
    image_hash: '',
    confirmed_fields: {},
    ai_suggested_fields: {},
    tamil_labels: {}
  });

  // Price recommendation state
  const [priceSuggestion, setPriceSuggestion] = useState<any>(null);
  const [priceLoading, setPriceLoading] = useState<boolean>(false);

  // Final submission state
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string>('');
  const [createdProduct, setCreatedProduct] = useState<any>(null);

  // Load questions on mount or language switch
  useEffect(() => {
    const loadQuestions = async () => {
      try {
        const res = await api.getVoiceQuestions(lang);
        setQuestions(res.questions || []);
      } catch (err) {
        console.error('Failed to load voice questions:', err);
      }
    };
    loadQuestions();
  }, [lang]);

  // Check speech recognition capability
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setBrowserSpeechSupported(false);
    }
  }, []);

  // Auto-read question aloud when question changes in 'qa' step
  useEffect(() => {
    if (step === 'qa' && questions.length > 0 && questions[currentQuestionIdx]) {
      const q = questions[currentQuestionIdx];
      const ttsPrompt = lang === 'ta' ? (q.tts_text_ta || q.question_ta) : (q.tts_text_en || q.question_en);
      speakText(ttsPrompt);
      // Preload manual text if field already has value
      const fieldId = q.id;
      const currentVal = productData[fieldId as keyof ProductListingState];
      setManualText(currentVal ? String(currentVal) : '');
      setSpokenTranscript('');
      setMicState('ready');
      setMicErrorMessage('');
    }
  }, [step, currentQuestionIdx, lang, questions]);

  // Text-To-Speech (TTS) handler
  const speakText = (text: string) => {
    if (!window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel(); // Stop any previous speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === 'ta' ? 'ta-IN' : 'en-IN';
      utterance.rate = 0.95; // Slightly slower, clear cadence for rural artisans

      // Try to find a matching Tamil or English voice
      const voices = window.speechSynthesis.getVoices();
      if (lang === 'ta') {
        const taVoice = voices.find(v => v.lang.includes('ta') || v.name.toLowerCase().includes('tamil'));
        if (taVoice) utterance.voice = taVoice;
      } else {
        const enVoice = voices.find(v => v.lang.includes('en-IN') || v.lang.includes('en'));
        if (enVoice) utterance.voice = enVoice;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
      setIsSpeaking(false);
    }
  };

  const stopSpeaking = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  // Camera Management
  const startCamera = async () => {
    setCameraError('');
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: any) {
      setCameraError(
        lang === 'ta'
          ? 'கேமரா அனுமதியை இயக்கவும் அல்லது புகைப்படத்தை பதிவேற்றவும்.'
          : 'Please enable camera permission or upload a photo from your files.'
      );
      setCameraActive(false);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `artisan_craft_${Date.now()}.jpg`, { type: 'image/jpeg' });
        handlePhotoSelected(file);
      }
    }, 'image/jpeg', 0.9);

    // Stop camera stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // Clean up streams on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // When photo is picked or captured
  const handlePhotoSelected = async (file: File) => {
    setSelectedFile(file);
    const preview = URL.createObjectURL(file);
    setPreviewUrl(preview);
    setPhotoUploading(true);
    setPhotoAiNote(lang === 'ta' ? 'புகைப்படம் பகுப்பாய்வு செய்யப்படுகிறது...' : 'Analyzing product photo...');

    try {
      const res = await api.aiCatalogGenerate({ image: file, auto_enhance: false });
      if (res?.image_url) {
        setProductData(prev => ({
          ...prev,
          image_url: res.image_url || '',
          image_hash: res.hashes?.phash || ''
        }));
      }

      const s = res?.suggestion;
      // Honest AI: Only prefill if genuinely recognized by vision model
      if (s?.recognized && s?.ai_powered && s?.category && s.category !== 'Other Traditional Crafts') {
        setProductData(prev => ({
          ...prev,
          title: s.title || prev.title,
          category: s.category || prev.category,
          materials: s.estimated_material || prev.materials,
          ai_suggested_fields: {
            title: true,
            category: true,
            materials: true
          }
        }));
        setPhotoAiNote(
          lang === 'ta'
            ? `புகைப்படத்தில் அடையாளம் காணப்பட்டது: "${s.title}" (${s.category})`
            : `Identified from photo: "${s.title}" (${s.category})`
        );
      } else {
        setPhotoAiNote(
          lang === 'ta'
            ? 'புகைப்படம் பதிவேற்றப்பட்டது. அடுத்த கேள்விகளுக்கு பதிலளித்து விவரங்களை நிரப்பலாம்.'
            : 'Photo saved. Please answer the guided questions to set title and details.'
        );
      }
    } catch (e) {
      setPhotoAiNote(
        lang === 'ta'
          ? 'புகைப்படம் சேமிக்கப்பட்டது. கேள்விகளுக்கு குரல் வழியே பதிலளிக்கவும்.'
          : 'Photo saved. Ready for guided voice questions.'
      );
    } finally {
      setPhotoUploading(false);
    }
  };

  // Start Speech Recognition
  const startListening = () => {
    setMicErrorMessage('');
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicState('error');
      setMicErrorMessage(
        lang === 'ta'
          ? 'உங்கள் உலாவியில் குரல் அறிதல் ஆதரிக்கப்படவில்லை. கீழே உள்ள தட்டச்சுப் பெட்டியைப் பயன்படுத்தவும்.'
          : 'Speech recognition is not supported in this browser. Please type below.'
      );
      setShowManualInput(true);
      return;
    }

    try {
      // Cancel TTS before listening so it doesn't hear itself
      stopSpeaking();

      const recog = new SpeechRecognition();
      recog.continuous = false;
      recog.interimResults = true;
      // Set language code based on user choice
      recog.lang = lang === 'ta' ? 'ta-IN' : 'en-IN';

      recog.onstart = () => {
        setMicState('listening');
        setSpokenTranscript('');
      };

      recog.onresult = (event: any) => {
        let text = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          text += event.results[i][0].transcript;
        }
        setSpokenTranscript(text);
      };

      recog.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setMicErrorMessage(
            lang === 'ta'
              ? 'மைக்ரோஃபோன் அனுமதி மறுக்கப்பட்டுள்ளது. உலாவி அமைப்பில் மைக் அனுமதியை இயக்கவும்.'
              : 'Microphone permission was denied. Please allow microphone access.'
          );
        } else if (event.error === 'no-speech') {
          setMicErrorMessage(
            lang === 'ta'
              ? 'குரல் எதுவும் கேட்கவில்லை. தயவுசெய்து மைக் பட்டனைத் தட்டி மீண்டும் பேசவும்.'
              : 'No speech was detected. Please tap and speak clearly.'
          );
        } else {
          setMicErrorMessage(`Speech error: ${event.error}. Please retry or type.`);
        }
        setMicState('error');
      };

      recog.onend = () => {
        if (micState === 'listening') {
          // If we captured words, auto-process them
          if (spokenTranscript.trim().length > 0) {
            handleProcessAnswer(spokenTranscript.trim());
          } else {
            setMicState('ready');
          }
        }
      };

      recognitionRef.current = recog;
      recog.start();
    } catch (err: any) {
      console.error('Failed to start speech recognition:', err);
      setMicState('error');
      setMicErrorMessage(err.message || 'Microphone activation failed');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (spokenTranscript.trim().length > 0) {
      handleProcessAnswer(spokenTranscript.trim());
    } else {
      setMicState('ready');
    }
  };

  // Process the spoken or typed response via backend NLP / translation
  const handleProcessAnswer = async (textToProcess: string) => {
    if (!textToProcess.trim()) return;

    setMicState('processing');
    const currentQ = questions[currentQuestionIdx];
    const fieldId = currentQ?.id || 'title';

    try {
      const res = await api.processVoiceAnswer({
        field: fieldId,
        spoken_text: textToProcess,
        language: lang,
        current_product: productData
      });

      if (res && res.is_valid) {
        setProductData(prev => {
          const updated = { ...prev };
          const val = res.numeric_value !== undefined ? res.numeric_value : (res.english_value || textToProcess);
          (updated as any)[fieldId] = val;
          updated.confirmed_fields[fieldId] = true;
          updated.tamil_labels[fieldId] = res.display_text || textToProcess;

          // If title answered, auto-populate associated category & materials if suggested
          if (fieldId === 'title') {
            if (res.associated_category && !prev.category) {
              updated.category = res.associated_category;
              updated.ai_suggested_fields.category = true;
            }
            if (res.associated_materials && !prev.materials) {
              updated.materials = res.associated_materials;
              updated.ai_suggested_fields.materials = true;
            }
            if (res.associated_description && !prev.description) {
              updated.description = res.associated_description;
            }
            if (res.price_suggestion) {
              setPriceSuggestion(res.price_suggestion);
            }
          }

          return updated;
        });

        // Spoken confirmation to seller
        const confirmSpeech = lang === 'ta'
          ? `${res.message || 'சரி, பதிவு செய்யப்பட்டது.'}`
          : `${res.message || 'Got it, saved.'}`;
        speakText(confirmSpeech);

        setSpokenTranscript(res.display_text || textToProcess);
        setManualText(String(res.numeric_value !== undefined ? res.numeric_value : (res.english_value || textToProcess)));
        setMicState('ready');
      } else {
        setMicState('error');
        setMicErrorMessage(res?.error_message || 'Could not understand response. Please retry.');
        speakText(res?.error_message || 'Please speak again.');
      }
    } catch (e: any) {
      console.error('Answer processing error:', e);
      setMicState('error');
      setMicErrorMessage(e.message || 'Server translation error');
    }
  };

  // Move to next question or review
  const handleNextQuestion = () => {
    if (currentQuestionIdx < questions.length - 1) {
      setCurrentQuestionIdx(prev => prev + 1);
      setShowManualInput(false);
    } else {
      // Transition to Price check or Review step
      if (!productData.price_per_unit) {
        fetchPriceRecommendation();
        setStep('price');
      } else {
        setStep('review');
      }
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIdx > 0) {
      setCurrentQuestionIdx(prev => prev - 1);
      setShowManualInput(false);
    } else {
      setStep('photo');
    }
  };

  // Fetch AI Price recommendation
  const fetchPriceRecommendation = async () => {
    setPriceLoading(true);
    try {
      const res = await api.suggestVoicePrice({
        category: productData.category || 'Household Goods, Water Jugs & Pitchers',
        materials: productData.materials || 'Clay',
        title: productData.title
      });
      setPriceSuggestion(res);
    } catch (e) {
      console.warn('Price calculation failed:', e);
    } finally {
      setPriceLoading(false);
    }
  };

  // Apply suggested price
  const handleApplyPriceSuggestion = () => {
    if (priceSuggestion?.suggested_price) {
      setProductData(prev => ({
        ...prev,
        price_per_unit: priceSuggestion.suggested_price,
        confirmed_fields: { ...prev.confirmed_fields, price_per_unit: true }
      }));
      setStep('review');
    }
  };

  // Save Product (Draft or Published)
  const handleSaveProduct = async (publish: boolean) => {
    if (!productData.title) {
      setSubmitError(lang === 'ta' ? 'தயாரிப்பு பெயர் அவசியம்.' : 'Product title is required.');
      return;
    }
    if (!productData.category) {
      setSubmitError(lang === 'ta' ? 'தயாரிப்பு பிரிவு அவசியம்.' : 'Product category is required.');
      return;
    }
    if (!productData.price_per_unit || Number(productData.price_per_unit) <= 0) {
      setSubmitError(lang === 'ta' ? 'செல்லுபடியாகும் விலையை உள்ளிடவும்.' : 'Please enter a valid price per unit.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const payload = {
        title: productData.title,
        category: productData.category,
        description: productData.description || `${productData.title}. Handcrafted with traditional artisan techniques.`,
        materials: productData.materials || 'Traditional Artisan Materials',
        price_per_unit: Number(productData.price_per_unit),
        stock_quantity: Number(productData.stock_quantity) || 10,
        unit: productData.unit || 'piece',
        moq: productData.moq || 1,
        monthly_capacity: productData.monthly_capacity || 50,
        lead_time_days: productData.lead_time_days || 7,
        production_method: productData.production_method || 'Handcrafted',
        dimensions: productData.dimensions || '',
        images: productData.image_url ? [productData.image_url] : [],
        primary_image_hash: productData.image_hash || '',
        is_published: publish
      };

      const res = await api.createProduct(payload);
      if (res && res.product) {
        setCreatedProduct(res.product);
        setStep('success');
        speakText(
          lang === 'ta'
            ? 'வாழ்த்துகள்! உங்கள் கைவினைப் பொருள் வெற்றிகரமாகச் சேமிக்கப்பட்டது.'
            : 'Congratulations! Your handmade product has been saved successfully.'
        );
        if (onSuccess) {
          onSuccess(res.product);
        }
      }
    } catch (e: any) {
      console.error('Failed to create product:', e);
      setSubmitError(e.message || (lang === 'ta' ? 'சேமிக்க முடியவில்லை. மீண்டும் முயலவும்.' : 'Failed to save product listing.'));
    } finally {
      setSubmitting(false);
    }
  };

  const currentQ = questions[currentQuestionIdx] || {};

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[#FAF8F5] w-full max-w-2xl rounded-3xl border border-[#E8E2D5] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="bg-white px-5 py-4 border-b border-stone-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-forest-800 text-gold-300 flex items-center justify-center shadow-xs shrink-0">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif text-lg sm:text-xl font-bold text-forest-950 flex items-center gap-2">
                {lang === 'ta' ? 'குரல் வழி பொருள் பதிவேற்றம்' : 'Voice Assistant Listing'}
                <span className="text-[10px] font-sans font-semibold px-2 py-0.5 rounded-full bg-forest-100 text-forest-800 border border-forest-200">
                  {lang === 'ta' ? 'தமிழ் / English' : 'English / தமிழ்'}
                </span>
              </h2>
              <p className="text-xs text-stone-500">
                {lang === 'ta' ? 'புகைப்படம் எடுத்து குரலில் பேசி உடனே பட்டியலிடுங்கள்' : 'Upload a photo and answer by voice to list your craft'}
              </p>
            </div>
          </div>

          {/* Right Header Controls: Language Switcher & Close */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-stone-100 rounded-xl p-1 border border-stone-200 text-xs">
              <button
                type="button"
                onClick={() => setLang('ta')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  lang === 'ta' ? 'bg-forest-800 text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                தமிழ்
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  lang === 'en' ? 'bg-forest-800 text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                EN
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                stopSpeaking();
                onClose();
              }}
              className="w-9 h-9 rounded-xl text-stone-400 hover:text-charcoal-900 hover:bg-stone-100 flex items-center justify-center transition-colors"
              aria-label="Close Voice Assistant"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body with Step Routing */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">

          {/* ================= STEP 1: PHOTO UPLOAD OR CAMERA ================= */}
          {step === 'photo' && (
            <div className="space-y-6">
              <div className="text-center max-w-md mx-auto">
                <span className="text-[11px] font-bold uppercase tracking-wider text-terracotta-700 bg-terracotta-50 px-3 py-1 rounded-full border border-terracotta-200">
                  {lang === 'ta' ? 'படி 1 / 3 : தயாரிப்பு புகைப்படம்' : 'Step 1 of 3: Product Photo'}
                </span>
                <h3 className="font-serif text-xl sm:text-2xl font-bold text-charcoal-900 mt-2">
                  {lang === 'ta' ? 'உங்கள் கைவினைப் பொருளின் புகைப்படத்தை எடுக்கவும்' : 'Take or upload a photo of your craft'}
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 mt-1">
                  {lang === 'ta'
                    ? 'தெளிவான படம் எடுத்தால் பொருள் வகை தானாகவே அடையாளம் காணப்படும்.'
                    : 'A clear photo allows automatic identification of product category and materials.'}
                </p>
              </div>

              {/* Photo Preview or Camera View */}
              {cameraActive ? (
                <div className="relative rounded-2xl overflow-hidden bg-black aspect-4/3 max-w-md mx-auto border-2 border-forest-600 shadow-md">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  <div className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-4">
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="h-14 px-6 rounded-full bg-forest-800 text-white font-bold text-sm shadow-xl hover:bg-forest-900 flex items-center gap-2 border-2 border-white"
                    >
                      <Camera className="w-5 h-5 text-gold-300" />
                      <span>{lang === 'ta' ? 'புகைப்படம் எடு' : 'Capture Photo'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
                        setCameraActive(false);
                      }}
                      className="h-10 px-4 rounded-xl bg-black/70 text-white text-xs hover:bg-black/90"
                    >
                      {lang === 'ta' ? 'ரத்து' : 'Cancel'}
                    </button>
                  </div>
                </div>
              ) : previewUrl ? (
                <div className="max-w-md mx-auto bg-white p-4 rounded-2xl border border-stone-200 shadow-sm space-y-3">
                  <div className="relative h-60 rounded-xl overflow-hidden bg-stone-100 border border-stone-200">
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewUrl('');
                        setSelectedFile(null);
                        setPhotoAiNote('');
                      }}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/70 text-white hover:bg-black flex items-center justify-center"
                      title="Remove photo"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {photoUploading && (
                    <div className="flex items-center gap-2 text-xs text-forest-800 bg-forest-50 p-2.5 rounded-xl border border-forest-200 animate-pulse">
                      <RefreshCw className="w-4 h-4 animate-spin text-forest-700" />
                      <span>{lang === 'ta' ? 'பகுப்பாய்வு செய்யப்படுகிறது...' : 'Analyzing craft features...'}</span>
                    </div>
                  )}

                  {photoAiNote && !photoUploading && (
                    <div className="flex items-start gap-2 text-xs text-stone-700 bg-stone-50 p-3 rounded-xl border border-stone-200">
                      <Sparkles className="w-4 h-4 text-terracotta-600 shrink-0 mt-0.5" />
                      <p>{photoAiNote}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="max-w-md mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Camera Button */}
                  <button
                    type="button"
                    onClick={startCamera}
                    className="p-6 rounded-2xl bg-white border-2 border-dashed border-forest-300 hover:border-forest-600 hover:bg-forest-50/50 transition-all flex flex-col items-center justify-center gap-3 text-center group shadow-xs"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-forest-100 text-forest-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Camera className="w-7 h-7 text-forest-800" />
                    </div>
                    <div>
                      <span className="font-bold text-sm text-charcoal-900 block">
                        {lang === 'ta' ? 'கேமரா மூலம் படம் எடு' : 'Use Device Camera'}
                      </span>
                      <span className="text-[11px] text-stone-500 mt-0.5 block">
                        {lang === 'ta' ? 'நேரடியாக படம் பிடிக்கவும்' : 'Take a photo directly'}
                      </span>
                    </div>
                  </button>

                  {/* File Upload Button */}
                  <label className="p-6 rounded-2xl bg-white border-2 border-dashed border-terracotta-300 hover:border-terracotta-600 hover:bg-terracotta-50/50 transition-all flex flex-col items-center justify-center gap-3 text-center cursor-pointer group shadow-xs">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePhotoSelected(file);
                      }}
                    />
                    <div className="w-14 h-14 rounded-2xl bg-terracotta-100 text-terracotta-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Upload className="w-7 h-7 text-terracotta-800" />
                    </div>
                    <div>
                      <span className="font-bold text-sm text-charcoal-900 block">
                        {lang === 'ta' ? 'கேலரியில் இருந்து தேர்ந்தெடு' : 'Upload Existing Image'}
                      </span>
                      <span className="text-[11px] text-stone-500 mt-0.5 block">
                        {lang === 'ta' ? 'JPG, PNG கோப்புகள்' : 'JPG, PNG file from device'}
                      </span>
                    </div>
                  </label>
                </div>
              )}

              {cameraError && (
                <div className="p-3 max-w-md mx-auto bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{cameraError}</span>
                </div>
              )}

              {/* Action: Proceed to Questions */}
              <div className="max-w-md mx-auto pt-2 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setStep('qa')}
                  className="w-full sm:w-auto h-12 px-6 rounded-xl bg-forest-800 hover:bg-forest-900 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all"
                >
                  <span>{lang === 'ta' ? 'அடுத்த படி: குரல் வழிகாட்டி →' : 'Continue to Voice Q&A →'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ================= STEP 2: GUIDED VOICE Q&A ================= */}
          {step === 'qa' && (
            <div className="space-y-6 max-w-xl mx-auto">
              {/* Progress Indicator */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-stone-600">
                  <span className="text-terracotta-700 font-bold uppercase tracking-wider">
                    {lang === 'ta'
                      ? `கேள்வி ${currentQuestionIdx + 1} / ${questions.length || 6}`
                      : `Question ${currentQuestionIdx + 1} of ${questions.length || 6}`}
                  </span>
                  <span>{Math.round(((currentQuestionIdx + 1) / (questions.length || 6)) * 100)}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-stone-200 overflow-hidden">
                  <div
                    className="h-full bg-forest-800 transition-all duration-300"
                    style={{ width: `${((currentQuestionIdx + 1) / (questions.length || 6)) * 100}%` }}
                  />
                </div>
              </div>

              {/* Question Card with Read Aloud */}
              <div className="bg-white p-6 rounded-3xl border border-stone-200/90 shadow-sm space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-forest-700 block">
                      {currentQ?.id?.replace('_', ' ').toUpperCase()}
                    </span>
                    <h3 className="font-serif text-xl sm:text-2xl font-bold text-forest-950 leading-snug">
                      {lang === 'ta' ? currentQ.question_ta : currentQ.question_en}
                    </h3>
                    <p className="text-xs text-stone-500 pt-0.5">
                      {lang === 'ta' ? currentQ.hint_ta : currentQ.hint_en}
                    </p>
                  </div>

                  {/* Audio Listen Again Button */}
                  <button
                    type="button"
                    onClick={() => {
                      const tts = lang === 'ta' ? (currentQ.tts_text_ta || currentQ.question_ta) : (currentQ.tts_text_en || currentQ.question_en);
                      speakText(tts);
                    }}
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border transition-all ${
                      isSpeaking
                        ? 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse'
                        : 'bg-[#F4EFE6] text-forest-900 border-[#DDD5C5] hover:bg-[#EAE2D5]'
                    }`}
                    title={lang === 'ta' ? 'கேள்வியை மீண்டும் கேள்' : 'Listen again'}
                  >
                    <Volume2 className="w-5 h-5 text-forest-800" />
                  </button>
                </div>

                {/* Big Animated Microphone Section */}
                <div className="py-6 flex flex-col items-center justify-center gap-4 bg-[#FCFAF6] rounded-2xl border border-stone-200/60 p-4">
                  <button
                    type="button"
                    onClick={micState === 'listening' ? stopListening : startListening}
                    className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${
                      micState === 'listening'
                        ? 'bg-rose-600 text-white ring-8 ring-rose-200 animate-pulse scale-105'
                        : micState === 'processing'
                        ? 'bg-amber-500 text-white ring-4 ring-amber-200 animate-spin'
                        : 'bg-forest-800 text-white hover:bg-forest-900 hover:scale-105 active:scale-95 ring-4 ring-forest-100'
                    }`}
                    aria-label="Toggle Microphone"
                  >
                    {micState === 'listening' ? (
                      <MicOff className="w-10 h-10 text-white" />
                    ) : micState === 'processing' ? (
                      <RefreshCw className="w-10 h-10 text-white animate-spin" />
                    ) : (
                      <Mic className="w-10 h-10 text-gold-300" />
                    )}
                  </button>

                  {/* Status Indicator Label */}
                  <div className="text-center">
                    <p className="font-bold text-sm text-charcoal-900">
                      {micState === 'listening'
                        ? (lang === 'ta' ? '👂 கேட்கிறது... பேசி முடித்ததும் தட்டவும்' : 'Listening... tap when finished speaking')
                        : micState === 'processing'
                        ? (lang === 'ta' ? '⏳ மொழிபெயர்த்து சரிபார்க்கிறது...' : 'Processing & translating...')
                        : micState === 'error'
                        ? (lang === 'ta' ? '⚠️ மீண்டும் முயற்சி செய்க' : 'Error detected. Tap to retry.')
                        : (lang === 'ta' ? '🎙️ பேச மைக்ரோஃபோனைத் தட்டவும்' : 'Tap microphone and speak')}
                    </p>
                    <span className="text-xs text-stone-500 block mt-0.5">
                      {lang === 'ta' ? 'தூய தமிழ் அல்லது ஆங்கிலத்தில் பேசலாம்' : 'Speak clearly in Tamil or English'}
                    </span>
                  </div>

                  {/* Live Spoken Transcript Box */}
                  {spokenTranscript && (
                    <div className="w-full bg-white p-3.5 rounded-xl border border-stone-200 text-xs text-charcoal-900 space-y-1">
                      <span className="text-[10px] font-bold text-forest-800 uppercase tracking-wider block">
                        {lang === 'ta' ? 'உங்கள் பதில்:' : 'Your Answer:'}
                      </span>
                      <p className="font-semibold text-sm text-forest-950">&ldquo;{spokenTranscript}&rdquo;</p>
                    </div>
                  )}

                  {micErrorMessage && (
                    <div className="p-3 w-full bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{micErrorMessage}</span>
                    </div>
                  )}
                </div>

                {/* Manual Text Editing / Fallback Option */}
                <div className="pt-2">
                  {!showManualInput ? (
                    <button
                      type="button"
                      onClick={() => setShowManualInput(true)}
                      className="text-xs text-forest-800 hover:underline font-semibold flex items-center gap-1.5"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>{lang === 'ta' ? 'அல்லது நேரடியாக தட்டச்சு செய்ய' : 'Or enter / edit manually with keyboard'}</span>
                    </button>
                  ) : (
                    <div className="space-y-2 p-3 bg-stone-50 rounded-2xl border border-stone-200">
                      <label className="text-xs font-semibold text-charcoal-700 block">
                        {lang === 'ta' ? 'கைமுறை திருத்தம் / தட்டச்சு:' : 'Manual Text Correction:'}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type={currentQ?.id === 'price_per_unit' || currentQ?.id === 'stock_quantity' ? 'number' : 'text'}
                          value={manualText}
                          onChange={(e) => setManualText(e.target.value)}
                          placeholder={currentQ?.hint_en}
                          className="flex-1 px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white focus:ring-2 focus:ring-forest-600 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleProcessAnswer(manualText)}
                          className="px-4 py-2 bg-forest-800 text-white rounded-xl text-xs font-semibold hover:bg-forest-900 shrink-0"
                        >
                          {lang === 'ta' ? 'சேமி' : 'Save'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Navigation Bar: Prev & Next Question */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handlePrevQuestion}
                  className="h-11 px-5 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-100 text-xs font-semibold transition-all flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>{lang === 'ta' ? 'முந்தையது' : 'Previous'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleNextQuestion}
                  className="h-11 px-6 rounded-xl bg-forest-800 hover:bg-forest-900 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-2"
                >
                  <span>
                    {currentQuestionIdx < questions.length - 1
                      ? (lang === 'ta' ? 'அடுத்த கேள்வி →' : 'Next Question →')
                      : (lang === 'ta' ? 'மதிப்பாய்வுக்குச் செல் →' : 'Proceed to Review →')}
                  </span>
                  <ArrowRight className="w-4 h-4 text-gold-300" />
                </button>
              </div>
            </div>
          )}

          {/* ================= STEP 3: PRICE RECOMMENDATION ================= */}
          {step === 'price' && (
            <div className="space-y-6 max-w-lg mx-auto">
              <div className="text-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-forest-700 bg-forest-50 px-3 py-1 rounded-full border border-forest-200">
                  {lang === 'ta' ? 'வழிகாட்டி நியாய விலை பரிந்துரை' : 'Indicative Fair Price Recommendation'}
                </span>
                <h3 className="font-serif text-xl sm:text-2xl font-bold text-charcoal-900 mt-2">
                  {lang === 'ta' ? 'பரிந்துரைக்கப்பட்ட மொத்த விற்பனை விலை' : 'Recommended Wholesale Unit Price'}
                </h3>
                <p className="text-xs text-stone-600 mt-1">
                  {lang === 'ta'
                    ? 'மூலப்பொருள் மற்றும் கைவினை உழைப்பு நேரத்தின் அடிப்படையில் கணக்கிடப்பட்ட மதிப்பீடு.'
                    : 'Transparent estimate based on raw materials, craft hours, and sustainable artisan margins.'}
                </p>
              </div>

              {priceSuggestion && (
                <div className="bg-white p-6 rounded-3xl border-2 border-forest-200 shadow-sm space-y-4 text-center">
                  <span className="text-xs text-stone-500 uppercase tracking-wider block font-semibold">
                    {lang === 'ta' ? 'பரிந்துரை விலை' : 'Estimated Fair Price'}
                  </span>
                  <div className="text-3xl sm:text-4xl font-extrabold font-mono text-forest-950">
                    ₹{priceSuggestion.suggested_price}
                    <span className="text-xs font-normal text-stone-500 ml-1.5 font-sans">
                      (வரம்பு: ₹{priceSuggestion.price_range_min} - ₹{priceSuggestion.price_range_max})
                    </span>
                  </div>

                  <p className="text-xs text-stone-600 bg-[#FCFAF6] p-3 rounded-2xl border border-stone-200">
                    {lang === 'ta' ? priceSuggestion.explanation_ta : priceSuggestion.explanation}
                  </p>
                  <p className="text-[11px] text-stone-400 italic">
                    * {lang === 'ta' ? 'இது உத்தரவாதப்படுத்தப்பட்ட சந்தை விலை அல்ல, ஒரு வழிகாட்டி மதிப்பீடு மட்டுமே.' : 'This is an estimate, not a guaranteed market price. You are free to choose your own price.'}
                  </p>

                  <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                    <button
                      type="button"
                      onClick={handleApplyPriceSuggestion}
                      className="w-full py-3 px-4 rounded-xl bg-forest-800 text-white font-bold text-xs sm:text-sm hover:bg-forest-900 transition-all flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4 text-gold-300" />
                      <span>{lang === 'ta' ? 'பரிந்துரை விலையை ஏற்றுக்கொள்' : 'Accept Suggested Price'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep('review')}
                      className="w-full py-3 px-4 rounded-xl border border-stone-300 text-stone-700 font-semibold text-xs sm:text-sm hover:bg-stone-50"
                    >
                      {lang === 'ta' ? 'எனது சொந்த விலையை உள்ளிட' : 'Enter My Own Price'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= STEP 4: REVIEW & PUBLISH ================= */}
          {step === 'review' && (
            <div className="space-y-6 max-w-xl mx-auto">
              <div className="text-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  {lang === 'ta' ? 'இறுதி சரிபார்ப்பு' : 'Final Review & Publish'}
                </span>
                <h3 className="font-serif text-xl sm:text-2xl font-bold text-charcoal-900 mt-2">
                  {lang === 'ta' ? 'உங்கள் பொருளின் விவரங்களை உறுதிப்படுத்தவும்' : 'Confirm your craft listing details'}
                </h3>
              </div>

              {/* Review Card */}
              <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-sm">
                <div className="flex flex-col sm:flex-row gap-4 p-5 border-b border-stone-100">
                  {productData.image_url ? (
                    <div className="w-full sm:w-32 h-32 rounded-2xl overflow-hidden bg-stone-100 shrink-0 border border-stone-200">
                      <ProductImage src={productData.image_url} alt={productData.title} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-32 h-32 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-400 shrink-0">
                      <Package className="w-10 h-10" />
                    </div>
                  )}

                  <div className="flex-1 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-terracotta-700 bg-terracotta-50 px-2 py-0.5 rounded border border-terracotta-200">
                      {productData.category || 'Household Goods, Water Jugs & Pitchers'}
                    </span>
                    <h4 className="font-serif text-lg font-bold text-charcoal-900 leading-tight">
                      {productData.title || (lang === 'ta' ? 'பெயர் குறிப்பிடப்படவில்லை' : 'Untitled Craft')}
                    </h4>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-extrabold font-mono text-forest-950">
                        ₹{productData.price_per_unit || 0}
                      </span>
                      <span className="text-xs text-stone-500">/ {productData.unit || 'piece'}</span>
                    </div>
                  </div>
                </div>

                {/* Structured Attributes Grid */}
                <div className="p-5 grid grid-cols-2 gap-3 text-xs bg-[#FAF8F5]">
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase font-semibold">{lang === 'ta' ? 'மூலப்பொருள்' : 'Primary Material'}</span>
                    <strong className="text-charcoal-800">{productData.materials || 'Clay / Terracotta'}</strong>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase font-semibold">{lang === 'ta' ? 'கையிருப்பு அளவு' : 'Available Stock'}</span>
                    <strong className="text-charcoal-800">{productData.stock_quantity || 10} units</strong>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase font-semibold">{lang === 'ta' ? 'உற்பத்தி முறை' : 'Technique'}</span>
                    <strong className="text-charcoal-800">{productData.production_method || 'Handcrafted'}</strong>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase font-semibold">{lang === 'ta' ? 'தயாரிப்பு காலம்' : 'Lead Time'}</span>
                    <strong className="text-charcoal-800">{productData.lead_time_days || 7} days</strong>
                  </div>
                </div>

                {productData.description && (
                  <div className="p-5 border-t border-stone-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
                      {lang === 'ta' ? 'விளக்கம்' : 'Description'}
                    </span>
                    <p className="text-xs text-stone-700 leading-relaxed">{productData.description}</p>
                  </div>
                )}
              </div>

              {submitError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Final Actions */}
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleSaveProduct(false)}
                    disabled={submitting}
                    className="w-full py-3.5 px-4 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-50 font-bold text-xs sm:text-sm transition-all"
                  >
                    {submitting ? (lang === 'ta' ? 'சேமிக்கிறது...' : 'Saving...') : (lang === 'ta' ? 'வரைவாகச் சேமி (Draft)' : 'Save as Draft')}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSaveProduct(true)}
                    disabled={submitting}
                    className="w-full py-3.5 px-4 rounded-xl bg-forest-800 hover:bg-forest-900 text-white font-bold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4 text-gold-300" />
                    <span>{submitting ? (lang === 'ta' ? 'வெளியிடுகிறது...' : 'Publishing...') : (lang === 'ta' ? 'சந்தையில் வெளியிடு' : 'Publish Product')}</span>
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs text-stone-500 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentQuestionIdx(0);
                      setStep('qa');
                    }}
                    className="hover:underline text-forest-800 font-semibold"
                  >
                    ← {lang === 'ta' ? 'குரல் வழியே மீண்டும் கேள்' : 'Re-ask questions by voice'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep('photo')}
                    className="hover:underline text-stone-600"
                  >
                    {lang === 'ta' ? 'புகைப்படத்தை மாற்று' : 'Change photo'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 5: SUCCESS MODAL ================= */}
          {step === 'success' && (
            <div className="py-8 text-center max-w-md mx-auto space-y-5">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div>
                <h3 className="font-serif text-2xl font-bold text-charcoal-900">
                  {lang === 'ta' ? 'பொருள் வெற்றிகரமாகச் சேர்க்கப்பட்டது!' : 'Product Listed Successfully!'}
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 mt-1 max-w-sm mx-auto">
                  {lang === 'ta'
                    ? `"${createdProduct?.title || productData.title}" சந்தையில் சேர்க்கப்பட்டு வாங்குபவர்களுக்குக் காண்பிக்கப்படுகிறது.`
                    : `"${createdProduct?.title || productData.title}" is now recorded and visible to wholesale buyers.`}
                </p>
              </div>

              <div className="pt-4 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    window.location.reload();
                  }}
                  className="w-full py-3.5 px-4 rounded-xl bg-forest-800 text-white font-bold text-sm hover:bg-forest-900 shadow-md"
                >
                  {lang === 'ta' ? 'கட்டுப்பாட்டகத்திற்குச் செல்ல' : 'Return to Seller Dashboard'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
