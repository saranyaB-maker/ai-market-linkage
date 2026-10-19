import React, { useState } from 'react';
import { Mic, MicOff, Check, X, Volume2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface VoiceInputProps {
  onTranscriptConfirmed: (text: string) => void;
  targetFieldLabel?: string;
}

export const VoiceInputButton: React.FC<VoiceInputProps> = ({ onTranscriptConfirmed, targetFieldLabel = "Description" }) => {
  const { language } = useLanguage();
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge, or type manually.");
      return;
    }

    try {
      const recog = new SpeechRecognition();
      recog.continuous = false;
      recog.interimResults = true;
      recog.lang = language === 'ta' ? 'ta-IN' : 'en-IN';

      recog.onstart = () => {
        setIsRecording(true);
        setTranscript('');
      };

      recog.onresult = (event: any) => {
        let currentText = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          currentText += event.results[i][0].transcript;
        }
        setTranscript(currentText);
      };

      recog.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsRecording(false);
      };

      recog.onend = () => {
        setIsRecording(false);
        if (transcript.trim().length > 0) {
          setShowConfirmModal(true);
        }
      };

      recog.start();
      setRecognition(recog);
    } catch (err) {
      console.error("Speech init error:", err);
      setIsRecording(false);
    }
  };

  const stopListening = () => {
    if (recognition) {
      recognition.stop();
    }
    setIsRecording(false);
    if (transcript.trim().length > 0) {
      setShowConfirmModal(true);
    }
  };

  const handleConfirm = () => {
    onTranscriptConfirmed(transcript.trim());
    setShowConfirmModal(false);
    setTranscript('');
  };

  return (
    <>
      <button
        type="button"
        onClick={isRecording ? stopListening : startListening}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
          isRecording
            ? 'bg-rose-500 text-white animate-pulse shadow-md'
            : 'bg-[#F4EFE6] text-forest-800 hover:bg-[#EAE2D5] border border-[#DDD5C5]'
        }`}
        title="Voice Input (English / தமிழ்)"
      >
        {isRecording ? (
          <>
            <MicOff className="w-3.5 h-3.5" />
            <span>Listening ({language === 'ta' ? 'தமிழ்' : 'English'})... Stop</span>
          </>
        ) : (
          <>
            <Mic className="w-3.5 h-3.5 text-terracotta-600" />
            <span>Voice Input ({language === 'ta' ? 'தமிழ்' : 'English'})</span>
          </>
        )}
      </button>

      {/* Confirmation screen before voice-transcribed information is saved */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <Volume2 className="w-5 h-5 text-forest-700" />
                <h3 className="font-semibold text-charcoal-900">Review Transcribed Statement</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="text-stone-400 hover:text-stone-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-stone-500 mt-3">
              Target Field: <strong className="text-charcoal-800">{targetFieldLabel}</strong>. Please review and make any manual corrections before accepting:
            </p>

            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={4}
              className="w-full mt-3 p-3 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
            />

            <div className="flex items-center justify-end gap-3 mt-4 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-lg"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-forest-800 text-white rounded-lg hover:bg-forest-900 shadow-sm"
              >
                <Check className="w-4 h-4" />
                Accept & Insert Text
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
