import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldCheck, Upload, Video, FileText, CheckCircle2, AlertCircle,
  Clock, ArrowRight, ArrowLeft, Trash2, Camera, Eye, RefreshCw,
  Award, HelpCircle, X, Play, Square, AlertTriangle, Save, Edit3,
  Layers, Hammer
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import api from '../../services/api';

const CRAFT_CATEGORIES = [
  'Handloom & Textiles',
  'Pottery & Ceramics',
  'Household Goods, Water Jugs & Pitchers',
  'Pottery & Terracotta',
  'Woodcraft & Carving',
  'Metalwork & Bell Metal',
  'Leather Goods & Mojaris',
  'Bamboo & Cane Craft',
  'Jewellery & Filigree',
  'Painting & Folk Art (Madhubani/Pattachitra/Tanjore)',
  'Stone Craft & Sculpting',
  'Natural Fibre & Jute',
  'Embroidery & Needlework (Zardozi/Chikankari/Kantha)',
  'Other Traditional Handicrafts'
];

const INDIAN_STATES = [
  'Tamil Nadu', 'Karnataka', 'Kerala', 'Andhra Pradesh', 'Telangana',
  'Maharashtra', 'Gujarat', 'Rajasthan', 'Delhi', 'West Bengal',
  'Uttar Pradesh', 'Madhya Pradesh', 'Bihar', 'Odisha', 'Punjab',
  'Haryana', 'Assam', 'Goa', 'Uttarakhand', 'Himachal Pradesh'
];

export const ArtisanVerificationPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { language, t } = useLanguage();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingStep, setSavingStep] = useState(false);
  const [reopeningDraft, setReopeningDraft] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Application state
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [status, setStatus] = useState<string>('not_started');
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');

  // Step 1: Artisan Profile
  const [profile, setProfile] = useState({
    full_name: '',
    phone: '',
    email: '',
    address: '',
    district: '',
    state: 'Tamil Nadu',
    pincode: '',
    craft_category: 'Handloom & Textiles',
    production_method: 'Handcrafted Traditional Method',
    materials_used: 'Natural Clay, Terracotta, Silk, Cotton',
    years_of_experience: 5,
    workshop_details: '',
    seller_type: 'individual_producer',
    annual_production_capacity: 500
  });

  // Step 2: Documents
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDocType, setSelectedDocType] = useState('artisan_id_card');
  const [docDescription, setDocDescription] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 3: Craft Video
  const [craftVideo, setCraftVideo] = useState<any | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const videoFileInputRef = useRef<HTMLInputElement>(null);

  // Camera Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [showCameraRecorder, setShowCameraRecorder] = useState(false);
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<any>(null);

  // Step 4: Submission
  const [declarationAgreed, setDeclarationAgreed] = useState(false);
  const [submissionNotes, setSubmissionNotes] = useState('');

  // Load application on mount
  const loadApplication = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getVerificationApplication();
      const app = res.application;
      if (app) {
        setStatus(app.verification_status || 'not_started');
        setCurrentStep(app.current_step || 1);
        setSubmittedAt(app.submitted_at || null);
        setRejectionReason(app.rejection_reason || '');
        setSubmissionNotes(app.submission_notes || '');

        if (app.artisan_profile) {
          setProfile((prev) => ({
            ...prev,
            ...app.artisan_profile,
            full_name: app.artisan_profile.full_name || user?.full_name || '',
            phone: app.artisan_profile.phone || user?.phone || '',
            email: app.artisan_profile.email || user?.email || '',
            production_method: app.artisan_profile.production_method || prev.production_method,
            materials_used: app.artisan_profile.materials_used || prev.materials_used
          }));
        } else if (user) {
          setProfile((prev) => ({
            ...prev,
            full_name: user.full_name || '',
            phone: user.phone || '',
            email: user.email || '',
          }));
        }

        setDocuments(app.documents || []);
        setCraftVideo(app.craft_video || null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load verification status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplication();
    return () => {
      stopCamera();
    };
  }, []);

  // Save current step progress to backend
  const handleSaveStep = async (stepNum: number, silent: boolean = false) => {
    setSavingStep(true);
    setError('');
    try {
      const payload: any = {
        step: stepNum,
        artisan_profile: profile,
        submission_notes: submissionNotes
      };
      await api.saveVerificationStep(stepNum, payload);
      if (!silent) {
        setSuccessMsg(language === 'ta' ? 'முன்னேற்றம் வெற்றிகரமாக வரைவில் சேமிக்கப்பட்டது.' : 'Progress saved to draft successfully.');
        setTimeout(() => setSuccessMsg(''), 3500);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save progress.');
    } finally {
      setSavingStep(false);
    }
  };

  // Reopen draft if in pending status
  const handleReopenDraft = async () => {
    setReopeningDraft(true);
    setError('');
    try {
      await api.reopenVerificationDraft();
      setStatus('draft');
      setSuccessMsg(language === 'ta' ? 'விண்ணப்பம் திருத்துவதற்காக வரைவாக மாற்றப்பட்டது.' : 'Application unlocked as draft. You can now edit and resubmit.');
      setTimeout(() => setSuccessMsg(''), 4000);
      await refreshUser();
    } catch (err: any) {
      setError(err.message || 'Failed to reopen application draft.');
    } finally {
      setReopeningDraft(false);
    }
  };

  // Step 1 Validation & Advance
  const handleNextFromStep1 = async () => {
    setError('');
    if (!profile.full_name.trim()) { setError('Artisan full name is required.'); return; }
    if (!profile.phone.trim() || !/^\d{10}$/.test(profile.phone.replace(/\D/g, ''))) {
      setError('Please provide a valid 10-digit phone number.');
      return;
    }
    if (!profile.district.trim()) { setError('District location is required.'); return; }
    if (!profile.workshop_details.trim() || profile.workshop_details.trim().length < 15) {
      setError('Please provide a descriptive summary of your workshop and craft production methods (at least 15 characters).');
      return;
    }

    await handleSaveStep(1, true);
    setCurrentStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Step 2 Document Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setError('File is too large. Maximum size for documents is 15MB.');
      return;
    }

    setUploadingDoc(true);
    setError('');
    try {
      const res = await api.uploadEvidence(file, selectedDocType, docDescription);
      setDocuments((prev) => [
        {
          id: res.evidence_id,
          original_filename: res.original_filename,
          file_url: res.file_url,
          evidence_type: res.evidence_type,
          file_size: res.file_size,
          created_at: new Date().toISOString()
        },
        ...prev
      ]);
      setDocDescription('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSuccessMsg('Document uploaded successfully.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Document upload failed.');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this document?')) return;
    try {
      await api.deleteEvidence(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      setSuccessMsg('Document removed.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to remove document.');
    }
  };

  const handleNextFromStep2 = async () => {
    setError('');
    if (documents.length === 0) {
      setError('Please upload at least one supporting document (e.g. Artisan ID, trade certificate, or workshop photo) to proceed.');
      return;
    }
    await handleSaveStep(2, true);
    setCurrentStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Step 3 Video Handling
  const handleVideoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      setError('Video file is too large. Maximum allowed video size is 50MB.');
      return;
    }

    setUploadingVideo(true);
    setError('');
    try {
      const res = await api.uploadEvidence(file, 'craft_video', 'Craft demonstration process video');
      setCraftVideo({
        id: res.evidence_id,
        original_filename: res.original_filename,
        file_url: res.file_url,
        is_video: true,
        created_at: new Date().toISOString()
      });
      setSuccessMsg('Craft demonstration video uploaded successfully.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Video upload failed.');
    } finally {
      setUploadingVideo(false);
      if (videoFileInputRef.current) videoFileInputRef.current.value = '';
    }
  };

  // Camera Recording Handlers
  const startCamera = async () => {
    setCameraError('');
    setShowCameraRecorder(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true
      });
      setCameraStream(stream);
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      setCameraError('Camera access denied or not supported on this browser. Please use the "Upload Pre-recorded Video" option below.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    setShowCameraRecorder(false);
    setRecordingSeconds(0);
  };

  const startRecording = () => {
    if (!cameraStream) return;
    const recordedBlobs: Blob[] = [];
    const mediaRecorder = new MediaRecorder(cameraStream, { mimeType: 'video/webm;codecs=vp8,opus' });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedBlobs.push(event.data);
      }
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(1000); // 1-second chunks
    setIsRecording(true);
    setRecordingSeconds(0);

    timerRef.current = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
  };

  const stopRecordingAndUpload = async () => {
    if (!mediaRecorderRef.current) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    mediaRecorderRef.current.onstop = async () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      stopCamera();

      if (blob.size === 0) {
        setError('Recorded video was empty. Please try recording again.');
        return;
      }

      setUploadingVideo(true);
      setError('');
      try {
        const file = new File([blob], `craft_recording_${Date.now()}.webm`, { type: 'video/webm' });
        const res = await api.uploadEvidence(file, 'craft_video', 'Live camera recorded craft proof');
        setCraftVideo({
          id: res.evidence_id,
          original_filename: res.original_filename,
          file_url: res.file_url,
          is_video: true,
          created_at: new Date().toISOString()
        });
        setSuccessMsg('Recorded video uploaded successfully.');
        setTimeout(() => setSuccessMsg(''), 3000);
      } catch (err: any) {
        setError(err.message || 'Failed to upload recorded video.');
      } finally {
        setUploadingVideo(false);
      }
    };

    mediaRecorderRef.current.stop();
  };

  const recordedChunksRef = useRef<Blob[]>([]);

  const handleDeleteVideo = async () => {
    if (!craftVideo) return;
    if (!window.confirm('Are you sure you want to remove the craft demonstration video?')) return;
    try {
      await api.deleteEvidence(craftVideo.id);
      setCraftVideo(null);
      setSuccessMsg('Craft demonstration video removed.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to remove video.');
    }
  };

  const handleNextFromStep3 = async () => {
    setError('');
    if (!craftVideo) {
      setError('A craft process demonstration video is required. Please record or upload a video showing your crafting technique.');
      return;
    }
    await handleSaveStep(3, true);
    setCurrentStep(4);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Step 4 Final Submit / Resubmit
  const handleFinalSubmit = async () => {
    setError('');
    if (!declarationAgreed) {
      setError('Please check the declaration box confirming the authenticity of your artisanal craftwork.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.submitVerificationApplication({
        artisan_profile: profile,
        notes: submissionNotes
      });
      setStatus('pending');
      setSubmittedAt(res.submitted_at || new Date().toISOString());
      setSuccessMsg('Verification application submitted! Our curation team will review your application.');
      await refreshUser();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err.message || 'Submission failed. Please check required fields.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-12 h-12 border-4 border-forest-800 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-stone-600 font-medium">Loading your artisan verification dossier…</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-stone-500">
        <Link to="/" className="hover:text-forest-900">Home</Link>
        <span>&rsaquo;</span>
        <Link to="/seller" className="hover:text-forest-900">Seller Dashboard</Link>
        <span>&rsaquo;</span>
        <span className="text-charcoal-900 font-semibold">Artisan Verification</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-forest-50 border border-forest-200 text-forest-900 text-xs font-semibold mb-2">
            <ShieldCheck className="w-4 h-4 text-gold-500" />
            Rural Artisan Direct Curation
          </div>
          <h1 className="font-serif text-3xl font-extrabold text-forest-950">
            Artisan Producer Verification
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 mt-1 max-w-2xl">
            Complete the 4-step artisan verification application. Verified genuine producers unlock public marketplace publishing, verified trust badges, and priority matching with bulk wholesale buyers.
          </p>
        </div>

        <Link
          to="/seller"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-stone-300 text-stone-700 text-xs font-semibold hover:bg-stone-50 transition-all self-start sm:self-auto shadow-2xs"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Dashboard
        </Link>
      </div>

      {/* Status Banners */}
      {status === 'approved' && (
        <div className="p-6 rounded-2xl bg-emerald-50 border-2 border-emerald-300 flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Award className="w-8 h-8 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-serif text-lg font-bold text-emerald-950">
                Verified Artisan Producer
              </h3>
              <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                Congratulations! Your artisan workshop and craft evidence have been reviewed and approved by platform administrators. Your listings proudly display the verified badge and are publicly visible across the marketplace.
              </p>
              <p className="text-[11px] text-emerald-700 mt-1 font-medium">
                You can update your workshop profile, crafting methods, and capacity anytime below and click Save Changes.
              </p>
            </div>
          </div>
        </div>
      )}

      {status === 'pending' && (
        <div className="p-6 rounded-2xl bg-amber-50 border-2 border-amber-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <Clock className="w-8 h-8 text-amber-700 shrink-0 mt-0.5 animate-pulse" />
            <div>
              <h3 className="font-serif text-lg font-bold text-amber-950">
                Awaiting Administrative Review
              </h3>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                Your application was submitted on <strong>{submittedAt ? new Date(submittedAt).toLocaleDateString() : 'recently'}</strong>. Our administration team is inspecting your craft process video and identity documents.
              </p>
              <p className="text-[11px] text-amber-700 mt-1 font-medium">
                Need to correct your information or add more evidence? You can edit below and save changes, or click Reopen Draft.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleReopenDraft}
            disabled={reopeningDraft}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-stone-300 text-white text-xs font-bold shrink-0 transition-all shadow-xs flex items-center gap-1.5"
          >
            <Edit3 className="w-3.5 h-3.5" />
            {reopeningDraft ? 'Unlocking...' : 'Reopen as Draft'}
          </button>
        </div>
      )}

      {status === 'rejected' && (
        <div className="p-6 rounded-2xl bg-rose-50 border-2 border-rose-300 flex items-start gap-4">
          <AlertCircle className="w-8 h-8 text-rose-700 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-serif text-lg font-bold text-rose-950">
              Application Requires Revision
            </h3>
            <p className="text-xs text-rose-800 mt-1 leading-relaxed">
              <strong>Reviewer Note:</strong> {rejectionReason || 'Evidence was insufficient to prove genuine artisan craft origin.'}
            </p>
            <p className="text-xs text-rose-700 mt-2 font-medium">
              You can update your profile details, upload clearer documents or a new craft video below, and resubmit your application for re-review.
            </p>
          </div>
        </div>
      )}

      {/* Global Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Step Progress Stepper - ALWAYS ACTIVE & CLICKABLE */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { num: 1, title: 'Artisan Profile', desc: 'Craft & Workshop' },
          { num: 2, title: 'Supporting Docs', desc: 'ID & Certifications' },
          { num: 3, title: 'Craft Video', desc: 'Process Proof' },
          { num: 4, title: 'Review & Submit', desc: 'Declaration' },
        ].map((s) => {
          const isActive = currentStep === s.num;
          const isDone = currentStep > s.num || status === 'approved' || status === 'pending';
          return (
            <button
              key={s.num}
              type="button"
              onClick={() => {
                handleSaveStep(currentStep, true);
                setCurrentStep(s.num);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                isActive
                  ? 'border-forest-800 bg-white ring-2 ring-forest-800/20 shadow-md'
                  : isDone
                  ? 'border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50'
                  : 'border-stone-200 bg-stone-50 hover:bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold ${
                    isActive
                      ? 'bg-forest-800 text-white'
                      : isDone
                      ? 'bg-emerald-600 text-white'
                      : 'bg-stone-200 text-stone-600'
                  }`}
                >
                  {isDone && !isActive ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                </span>
                <span className="text-[10px] font-mono text-stone-400">Step {s.num}/4</span>
              </div>
              <h4 className="font-semibold text-xs sm:text-sm text-charcoal-900">{s.title}</h4>
              <p className="text-[11px] text-stone-500 mt-0.5">{s.desc}</p>
            </button>
          );
        })}
      </div>

      {/* ================= STEP 1: ARTISAN PROFILE ================= */}
      {currentStep === 1 && (
        <div className="bg-white rounded-3xl border border-stone-200 shadow-xs p-6 sm:p-8 space-y-6">
          <div className="border-b border-stone-100 pb-4 flex items-center justify-between">
            <div>
              <h3 className="font-serif text-xl font-bold text-forest-950">
                Step 1: Artisan & Workshop Profile
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                Provide authentic details regarding your craft discipline, physical workshop location, and crafting background.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleSaveStep(1)}
              disabled={savingStep}
              className="px-4 py-2 rounded-xl border border-forest-700 bg-forest-50 hover:bg-forest-100 text-forest-900 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
            >
              <Save className={`w-3.5 h-3.5 ${savingStep ? 'animate-spin' : ''}`} />
              {savingStep ? 'Saving...' : 'Save Draft'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-charcoal-800 mb-1">
                Artisan / Master Craftsman Full Name *
              </label>
              <input
                type="text"
                value={profile.full_name}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                placeholder="e.g. Ramanathan Natarajan"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs sm:text-sm focus:outline-hidden focus:border-forest-800 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-charcoal-800 mb-1">
                Contact Phone Number *
              </label>
              <input
                type="tel"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                placeholder="10-digit mobile number"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs sm:text-sm focus:outline-hidden focus:border-forest-800 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-charcoal-800 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                placeholder="artisan@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs sm:text-sm focus:outline-hidden focus:border-forest-800 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-charcoal-800 mb-1">
                Craft Discipline / Category *
              </label>
              <select
                value={profile.craft_category}
                onChange={(e) => setProfile({ ...profile, craft_category: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs sm:text-sm focus:outline-hidden focus:border-forest-800 bg-white"
              >
                {CRAFT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-charcoal-800 mb-1">
                Production Method / Technique *
              </label>
              <input
                type="text"
                value={profile.production_method}
                onChange={(e) => setProfile({ ...profile, production_method: e.target.value })}
                placeholder="e.g. Traditional Handloom, Wheel-thrown, Hand Carved"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs sm:text-sm focus:outline-hidden focus:border-forest-800 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-charcoal-800 mb-1">
                Primary Materials Used *
              </label>
              <input
                type="text"
                value={profile.materials_used}
                onChange={(e) => setProfile({ ...profile, materials_used: e.target.value })}
                placeholder="e.g. Pure Mulberry Silk, Natural Terracotta Clay, Solid Brass"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs sm:text-sm focus:outline-hidden focus:border-forest-800 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-charcoal-800 mb-1">
                Artisan Producer Structure *
              </label>
              <select
                value={profile.seller_type}
                onChange={(e) => setProfile({ ...profile, seller_type: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs sm:text-sm focus:outline-hidden focus:border-forest-800 bg-white"
              >
                <option value="individual_producer">Individual Master Craftsman</option>
                <option value="producer_group">Artisan Family / Producer Group</option>
                <option value="self_help_group">Self-Help Group (SHG) Collective</option>
                <option value="cooperative">Registered Artisan Cooperative</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-charcoal-800 mb-1">
                Years of Crafting Experience *
              </label>
              <input
                type="number"
                min="1"
                max="70"
                value={profile.years_of_experience}
                onChange={(e) => setProfile({ ...profile, years_of_experience: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs sm:text-sm focus:outline-hidden focus:border-forest-800 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-charcoal-800 mb-1">
                Estimated Monthly Craft Capacity (units)
              </label>
              <input
                type="number"
                min="5"
                value={profile.annual_production_capacity}
                onChange={(e) => setProfile({ ...profile, annual_production_capacity: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs sm:text-sm focus:outline-hidden focus:border-forest-800 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-charcoal-800 mb-1">
                District / Region *
              </label>
              <input
                type="text"
                value={profile.district}
                onChange={(e) => setProfile({ ...profile, district: e.target.value })}
                placeholder="e.g. Thanjavur or Madurai"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs sm:text-sm focus:outline-hidden focus:border-forest-800 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-charcoal-800 mb-1">
                State *
              </label>
              <select
                value={profile.state}
                onChange={(e) => setProfile({ ...profile, state: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs sm:text-sm focus:outline-hidden focus:border-forest-800 bg-white"
              >
                {INDIAN_STATES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-charcoal-800 mb-1">
                PIN Code
              </label>
              <input
                type="text"
                value={profile.pincode}
                onChange={(e) => setProfile({ ...profile, pincode: e.target.value })}
                placeholder="e.g. 613001"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs sm:text-sm focus:outline-hidden focus:border-forest-800 bg-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-charcoal-800 mb-1">
                Physical Workshop Address
              </label>
              <input
                type="text"
                value={profile.address}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                placeholder="Village/Street, Taluk, Pincode"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs sm:text-sm focus:outline-hidden focus:border-forest-800 bg-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-charcoal-800 mb-1">
                Workshop Setup & Hand Tooling Description *
              </label>
              <textarea
                rows={4}
                value={profile.workshop_details}
                onChange={(e) => setProfile({ ...profile, workshop_details: e.target.value })}
                placeholder="Describe your workspace, traditional tools (e.g. handloom pit, wood lathe, pottery wheel), raw materials used, and crafting techniques..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs sm:text-sm focus:outline-hidden focus:border-forest-800 bg-white"
              />
              <span className="text-[11px] text-stone-400 mt-1 block">
                Minimum 15 characters. Genuine workshop descriptions build buyer confidence.
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-stone-100">
            <button
              type="button"
              onClick={() => handleSaveStep(1)}
              disabled={savingStep}
              className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 text-xs font-semibold hover:bg-stone-50 transition-all flex items-center gap-1.5"
            >
              <Save className={`w-3.5 h-3.5 ${savingStep ? 'animate-spin' : ''}`} />
              Save Progress
            </button>

            <button
              type="button"
              onClick={handleNextFromStep1}
              className="px-6 py-2.5 rounded-xl bg-forest-800 hover:bg-forest-900 text-white text-xs font-semibold shadow-xs transition-all flex items-center gap-2"
            >
              Next: Supporting Documents <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 2: SUPPORTING DOCUMENTS ================= */}
      {currentStep === 2 && (
        <div className="bg-white rounded-3xl border border-stone-200 shadow-xs p-6 sm:p-8 space-y-6">
          <div className="border-b border-stone-100 pb-4 flex items-center justify-between">
            <div>
              <h3 className="font-serif text-xl font-bold text-forest-950">
                Step 2: Supporting Documents & Proof
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                Upload at least one official document or workshop photograph verifying your artisan status.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleSaveStep(2)}
              disabled={savingStep}
              className="px-4 py-2 rounded-xl border border-forest-700 bg-forest-50 hover:bg-forest-100 text-forest-900 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
            >
              <Save className={`w-3.5 h-3.5 ${savingStep ? 'animate-spin' : ''}`} />
              Save Draft
            </button>
          </div>

          {/* Upload Area */}
          <div className="p-5 rounded-2xl bg-[#FCFAF6] border-2 border-dashed border-[#EDE5D6] space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-charcoal-800 mb-1">
                  Document Classification
                </label>
                <select
                  value={selectedDocType}
                  onChange={(e) => setSelectedDocType(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs bg-white focus:outline-hidden"
                >
                  <option value="artisan_id_card">Ministry of Textiles Artisan Card (Pehchan)</option>
                  <option value="shg_certificate">SHG / Cooperative Society Registration</option>
                  <option value="gi_certificate">GI (Geographical Indication) User Certificate</option>
                  <option value="workshop_photo">Workshop Facility / Hand Tools Photo</option>
                  <option value="identity_proof">Identity & Address Proof (Aadhaar / Voter ID)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-charcoal-800 mb-1">
                  Document Description (Optional)
                </label>
                <input
                  type="text"
                  value={docDescription}
                  onChange={(e) => setDocDescription(e.target.value)}
                  placeholder="e.g. Master Weaver Card issued 2022"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs focus:outline-hidden bg-white"
                />
              </div>
            </div>

            <div>
              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={handleFileUpload}
                className="hidden"
                id="doc-upload-input"
              />
              <label
                htmlFor="doc-upload-input"
                className={`w-full py-6 rounded-xl border-2 border-stone-300 bg-white hover:bg-stone-50 cursor-pointer flex flex-col items-center justify-center transition-all ${
                  uploadingDoc ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                <Upload className="w-8 h-8 text-forest-700 mb-2" />
                <span className="text-xs font-bold text-forest-900">
                  {uploadingDoc ? 'Uploading Evidence...' : 'Click to Upload Document / Photo'}
                </span>
                <span className="text-[11px] text-stone-400 mt-1">
                  Accepted: PDF, PNG, JPG, JPEG, WEBP (Max 15MB)
                </span>
              </label>
            </div>
          </div>

          {/* List of uploaded documents */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-charcoal-800 mb-3">
              Uploaded Supporting Evidence ({documents.length})
            </h4>

            {documents.length === 0 ? (
              <div className="p-8 text-center bg-stone-50 rounded-2xl border border-stone-200">
                <FileText className="w-10 h-10 text-stone-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-stone-600">No documents uploaded yet</p>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  Upload your artisan card, workshop photo, or collective registration above.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3.5 rounded-xl border border-stone-200 bg-white flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-forest-50 text-forest-800 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-charcoal-900 truncate">
                          {doc.original_filename}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-stone-400 mt-0.5">
                          <span className="capitalize">{doc.evidence_type.replace(/_/g, ' ')}</span>
                          {doc.file_size > 0 && (
                            <span>&bull; {(doc.file_size / (1024 * 1024)).toFixed(2)} MB</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors"
                        title="View Document"
                      >
                        <Eye className="w-4 h-4" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors cursor-pointer"
                        title="Delete Evidence"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-stone-100">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 text-xs font-semibold hover:bg-stone-50 transition-all flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Profile
            </button>

            <button
              type="button"
              onClick={handleNextFromStep2}
              className="px-6 py-2.5 rounded-xl bg-forest-800 hover:bg-forest-900 text-white text-xs font-semibold shadow-xs transition-all flex items-center gap-2"
            >
              Next: Craft-Proof Video <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 3: CRAFT-PROOF VIDEO ================= */}
      {currentStep === 3 && (
        <div className="bg-white rounded-3xl border border-stone-200 shadow-xs p-6 sm:p-8 space-y-6">
          <div className="border-b border-stone-100 pb-4 flex items-center justify-between">
            <div>
              <h3 className="font-serif text-xl font-bold text-forest-950">
                Step 3: Craft-Proof Demonstration Video
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                Provide a 1–2 minute video demonstrating your physical workshop, hand tools, and live crafting process. This eliminates synthetic middlemen and guarantees authentic handmade origin.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleSaveStep(3)}
              disabled={savingStep}
              className="px-4 py-2 rounded-xl border border-forest-700 bg-forest-50 hover:bg-forest-100 text-forest-900 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
            >
              <Save className={`w-3.5 h-3.5 ${savingStep ? 'animate-spin' : ''}`} />
              Save Draft
            </button>
          </div>

          {/* Active Craft Video Display */}
          {craftVideo ? (
            <div className="p-6 rounded-2xl bg-[#FCFAF6] border border-[#EDE5D6] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-forest-950 block">
                    Craft Process Video Uploaded
                  </span>
                  <span className="text-[11px] text-stone-500">
                    File: {craftVideo.original_filename}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleDeleteVideo}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove / Replace Video
                </button>
              </div>

              <div className="rounded-xl overflow-hidden bg-black max-w-xl mx-auto shadow-sm">
                <video
                  src={craftVideo.file_url}
                  controls
                  className="w-full max-h-80 object-contain"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {cameraError && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Camera Access Note:</p>
                    <p className="mt-0.5">{cameraError}</p>
                  </div>
                </div>
              )}

              {/* Live Camera Viewfinder */}
              {showCameraRecorder ? (
                <div className="p-6 rounded-2xl bg-charcoal-900 text-white space-y-4 max-w-xl mx-auto">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-bold">
                      <span className={`w-2.5 h-2.5 rounded-full ${isRecording ? 'bg-rose-500 animate-ping' : 'bg-emerald-400'}`} />
                      {isRecording ? `Recording... (${recordingSeconds}s)` : 'Camera Ready'}
                    </span>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="text-stone-400 hover:text-white"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center">
                    <video
                      ref={liveVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex items-center justify-center gap-4 pt-2">
                    {!isRecording ? (
                      <button
                        type="button"
                        onClick={startRecording}
                        className="px-6 py-2.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer"
                      >
                        <Square className="w-4 h-4 fill-white" /> Start Recording
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={stopRecordingAndUpload}
                        disabled={uploadingVideo}
                        className="px-6 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-md transition-all animate-pulse cursor-pointer"
                      >
                        <Square className="w-4 h-4 fill-white" />
                        {uploadingVideo ? 'Uploading Recorded Video...' : 'Stop & Save Video'}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Option 1: Camera */}
                  <div className="p-6 rounded-2xl border-2 border-stone-200 bg-stone-50 flex flex-col items-center text-center justify-between space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-forest-100 text-forest-800 flex items-center justify-center">
                      <Camera className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-charcoal-900">Record using Device Camera</h4>
                      <p className="text-xs text-stone-500 mt-1 max-w-xs">
                        Record a direct live video from your phone or webcam demonstrating your crafting.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="w-full py-2.5 px-4 rounded-xl bg-forest-800 hover:bg-forest-900 text-white text-xs font-semibold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Camera className="w-4 h-4" /> Open Camera Recorder
                    </button>
                  </div>

                  {/* Option 2: Upload File */}
                  <div className="p-6 rounded-2xl border-2 border-stone-200 bg-stone-50 flex flex-col items-center text-center justify-between space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-terracotta-100 text-terracotta-800 flex items-center justify-center">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-charcoal-900">Upload Pre-recorded Video</h4>
                      <p className="text-xs text-stone-500 mt-1 max-w-xs">
                        Choose an MP4, WebM, or MOV video file from your computer or phone gallery.
                      </p>
                    </div>

                    <input
                      type="file"
                      ref={videoFileInputRef}
                      accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
                      onChange={handleVideoFileUpload}
                      className="hidden"
                      id="video-upload-input"
                    />
                    <label
                      htmlFor="video-upload-input"
                      className={`w-full py-2.5 px-4 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 text-stone-800 text-xs font-semibold shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        uploadingVideo ? 'opacity-50 pointer-events-none' : ''
                      }`}
                    >
                      <Upload className="w-4 h-4" />
                      {uploadingVideo ? 'Uploading Video (Max 50MB)...' : 'Select Video File'}
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-stone-100">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 text-xs font-semibold hover:bg-stone-50 transition-all flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Documents
            </button>

            <button
              type="button"
              onClick={handleNextFromStep3}
              className="px-6 py-2.5 rounded-xl bg-forest-800 hover:bg-forest-900 text-white text-xs font-semibold shadow-xs transition-all flex items-center gap-2"
            >
              Next: Review & Submit <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 4: REVIEW & SUBMIT ================= */}
      {currentStep === 4 && (
        <div className="bg-white rounded-3xl border border-stone-200 shadow-xs p-6 sm:p-8 space-y-6">
          <div className="border-b border-stone-100 pb-4 flex items-center justify-between">
            <div>
              <h3 className="font-serif text-xl font-bold text-forest-950">
                Step 4: Review Application & Declaration
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                Verify your craft dossier details before submitting for administrative curation.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleSaveStep(4)}
              disabled={savingStep}
              className="px-4 py-2 rounded-xl border border-forest-700 bg-forest-50 hover:bg-forest-100 text-forest-900 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
            >
              <Save className={`w-3.5 h-3.5 ${savingStep ? 'animate-spin' : ''}`} />
              Save Draft
            </button>
          </div>

          <div className="space-y-4">
            {/* Profile Review Card */}
            <div className="p-5 rounded-2xl bg-[#FCFAF6] border border-[#EDE5D6] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-forest-900">
                  1. Artisan Profile
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="text-xs font-semibold text-terracotta-700 hover:underline flex items-center gap-1"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit Step 1
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-stone-400 block text-[11px]">Artisan Name</span>
                  <strong className="text-charcoal-900">{profile.full_name}</strong>
                </div>
                <div>
                  <span className="text-stone-400 block text-[11px]">Craft Category</span>
                  <strong className="text-charcoal-900">{profile.craft_category}</strong>
                </div>
                <div>
                  <span className="text-stone-400 block text-[11px]">Technique</span>
                  <strong className="text-charcoal-900">{profile.production_method}</strong>
                </div>
                <div>
                  <span className="text-stone-400 block text-[11px]">Materials</span>
                  <strong className="text-charcoal-900">{profile.materials_used}</strong>
                </div>
                <div>
                  <span className="text-stone-400 block text-[11px]">Experience</span>
                  <strong className="text-charcoal-900">{profile.years_of_experience} years</strong>
                </div>
                <div>
                  <span className="text-stone-400 block text-[11px]">Monthly Capacity</span>
                  <strong className="text-charcoal-900">{profile.annual_production_capacity} units</strong>
                </div>
                <div>
                  <span className="text-stone-400 block text-[11px]">Location</span>
                  <strong className="text-charcoal-900">{profile.district}, {profile.state}</strong>
                </div>
                <div>
                  <span className="text-stone-400 block text-[11px]">Contact Phone</span>
                  <strong className="text-charcoal-900">{profile.phone}</strong>
                </div>
              </div>

              {profile.workshop_details && (
                <div className="text-xs bg-white p-3 rounded-xl border border-stone-200 text-stone-700">
                  <span className="text-[11px] text-stone-400 block font-semibold mb-1">Workshop & Tooling:</span>
                  &ldquo;{profile.workshop_details}&rdquo;
                </div>
              )}
            </div>

            {/* Documents Review Card */}
            <div className="p-5 rounded-2xl bg-[#FCFAF6] border border-[#EDE5D6] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-forest-900">
                  2. Supporting Documents ({documents.length})
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="text-xs font-semibold text-terracotta-700 hover:underline flex items-center gap-1"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit Step 2
                </button>
              </div>

              {documents.length === 0 ? (
                <p className="text-xs text-rose-600 font-semibold">No documents uploaded! Please upload at least one in Step 2.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {documents.map((d) => (
                    <div key={d.id} className="p-2.5 rounded-xl bg-white border border-stone-200 text-xs flex items-center justify-between">
                      <span className="truncate max-w-[200px] font-medium text-charcoal-900">{d.original_filename}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-stone-100 text-stone-600 capitalize">
                        {d.evidence_type.replace(/_/g, ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Video Review Card */}
            <div className="p-5 rounded-2xl bg-[#FCFAF6] border border-[#EDE5D6] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-forest-900">
                  3. Craft Demonstration Video
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="text-xs font-semibold text-terracotta-700 hover:underline flex items-center gap-1"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit Step 3
                </button>
              </div>

              {!craftVideo ? (
                <p className="text-xs text-rose-600 font-semibold">No craft video uploaded! Please record or upload a video in Step 3.</p>
              ) : (
                <div className="flex items-center justify-between text-xs bg-white p-3 rounded-xl border border-stone-200">
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-emerald-600" />
                    <span className="font-semibold text-charcoal-900">{craftVideo.original_filename}</span>
                  </div>
                  <a
                    href={craftVideo.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-forest-800 font-bold hover:underline"
                  >
                    Preview Video &rsaquo;
                  </a>
                </div>
              )}
            </div>

            {/* Additional Submission Notes */}
            <div>
              <label className="block text-xs font-bold text-charcoal-800 mb-1">
                Additional Notes for Administrative Reviewers (Optional)
              </label>
              <textarea
                rows={2}
                value={submissionNotes}
                onChange={(e) => setSubmissionNotes(e.target.value)}
                placeholder="Mention any traditional craft lineage, awards, state artisan recognition, or bulk fulfillment capabilities..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs focus:outline-hidden bg-white"
              />
            </div>

            {/* Declaration Checkbox */}
            <label className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50/70 border border-amber-200 cursor-pointer">
              <input
                type="checkbox"
                checked={declarationAgreed}
                onChange={(e) => setDeclarationAgreed(e.target.checked)}
                className="w-4 h-4 rounded text-forest-800 focus:ring-forest-800 mt-0.5"
              />
              <span className="text-xs text-amber-950 leading-relaxed font-medium">
                I hereby solemnly affirm that the crafting evidence, workshop description, and demonstration video represent authentic, handmade craftwork produced by me or my registered artisan collective. I understand that misrepresentation will result in immediate suspension.
              </span>
            </label>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-stone-100">
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 text-xs font-semibold hover:bg-stone-50 transition-all flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Video
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleSaveStep(4)}
                disabled={savingStep}
                className="px-4 py-2.5 rounded-xl border border-stone-300 text-stone-700 text-xs font-semibold hover:bg-stone-50 transition-all flex items-center gap-1.5"
              >
                <Save className={`w-3.5 h-3.5 ${savingStep ? 'animate-spin' : ''}`} />
                Save Draft
              </button>

              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={submitting}
                className="px-8 py-3 rounded-xl bg-forest-800 hover:bg-forest-900 disabled:bg-stone-300 text-white text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-gold-300" />
                {submitting
                  ? 'Submitting Dossier...'
                  : status === 'pending'
                  ? 'Update & Resubmit Dossier'
                  : status === 'rejected'
                  ? 'Resubmit Verification Dossier'
                  : 'Submit Verification Dossier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArtisanVerificationPage;
