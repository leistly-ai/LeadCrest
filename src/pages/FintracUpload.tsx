import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import {
  ShieldCheck, Upload, CheckCircle2, AlertTriangle,
  ChevronUp, Network, X, FileImage, ArrowRight, CreditCard,
  Plane, BadgeCheck, Globe,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type IdType = 'drivers_licence' | 'passport' | 'pr_card' | 'foreign_passport';
type Stage = 'select' | 'upload' | 'submitting' | 'done' | 'error';

const ID_OPTIONS: { value: IdType; label: string; sublabel: string; Icon: React.ElementType }[] = [
  { value: 'drivers_licence', label: "Driver's Licence",   sublabel: 'Provincial / Territorial', Icon: CreditCard },
  { value: 'passport',        label: 'Canadian Passport',  sublabel: 'Government of Canada',     Icon: Plane },
  { value: 'pr_card',         label: 'PR Card',            sublabel: 'Permanent Resident Card',  Icon: BadgeCheck },
  { value: 'foreign_passport',label: 'Foreign Passport',   sublabel: 'International document',   Icon: Globe },
];

const MAX_FILE_MB = 10;

export default function FintracUpload() {
  const { leadId } = useParams<{ leadId: string }>();

  const [leadName, setLeadName]     = useState('');
  const [leadEmail, setLeadEmail]   = useState('');
  const [agentEmail, setAgentEmail] = useState('');
  const [agentName, setAgentName]   = useState('');
  const [loading, setLoading]       = useState(true);
  const [alreadyDone, setAlreadyDone] = useState(false);

  const [stage, setStage]         = useState<Stage>('select');
  const [idType, setIdType]       = useState<IdType | null>(null);
  const [file, setFile]           = useState<{ name: string; dataUrl: string; mimeType: string } | null>(null);
  const [fileError, setFileError] = useState('');
  const [submitError, setSubmitError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!leadId) return;
    const load = async () => {
      const leadDoc = await getDoc(doc(db, 'leads', leadId));
      if (!leadDoc.exists()) { setLoading(false); return; }
      const data = leadDoc.data();
      setLeadName(data.name || '');
      setLeadEmail(data.email || '');
      if ((data.signatures || {})['fintrac'] || data.fintracData) setAlreadyDone(true);
      const aid = data.agentId || '';
      if (aid) {
        const agentDoc = await getDoc(doc(db, 'agents', aid));
        if (agentDoc.exists()) {
          setAgentEmail(agentDoc.data().email || '');
          setAgentName(agentDoc.data().name || '');
        }
      }
      setLoading(false);
    };
    load();
  }, [leadId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError('');
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      setFileError(`File exceeds ${MAX_FILE_MB} MB. Please use a smaller image.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      setFile({ name: f.name, dataUrl: ev.target?.result as string, mimeType: f.type });
    };
    reader.readAsDataURL(f);
    e.target.value = '';
  };

  const handleSubmit = async () => {
    if (!file || !idType || !leadId) return;
    setStage('submitting');
    setSubmitError('');

    try {
      // POST to server — Gemini extracts fields, emails agent; file is never stored server-side
      const res = await fetch('/api/fintrac-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          idType,
          idFile: file.dataUrl,
          mimeType: file.mimeType,
          leadEmail,
          leadName,
          agentEmail,
          agentName,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Submission failed');
      }

      const { extractedData, submittedAt } = await res.json();

      // Write extracted data + completion to Firestore client-side
      // Raw ID is NOT saved — only the structured text fields
      await updateDoc(doc(db, 'leads', leadId), {
        fintracData: {
          idType,
          fullName:    extractedData?.fullName    || '',
          dateOfBirth: extractedData?.dateOfBirth || '',
          address:     extractedData?.address     || '',
          idNumber:    extractedData?.idNumber    || '',
          expiryDate:  extractedData?.expiryDate  || '',
          jurisdiction: extractedData?.jurisdiction || '',
          country:     extractedData?.country     || '',
          submittedAt: submittedAt || new Date().toISOString(),
          submittedBy: leadName,
        },
        [`signatures.fintrac`]: { signerName: leadName, signedAt: submittedAt || new Date().toISOString(), docLabel: 'FINTRAC ID Record' },
        completedSteps: arrayUnion('fintrac'),
      });

      setStage('done');
    } catch (err: any) {
      setSubmitError(err.message || 'Something went wrong. Please try again.');
      setStage('upload');
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linen">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-honey" />
      </div>
    );
  }

  if (!leadName) {
    return (
      <FintracLayout>
        <div className="text-center space-y-4 py-8">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="text-xl font-black text-midnight">Link Not Found</h2>
          <p className="text-charcoal/60 text-sm">This link is invalid or has expired. Please contact your agent for a new link.</p>
        </div>
      </FintracLayout>
    );
  }

  // ── Already done ─────────────────────────────────────────────────────────
  if (alreadyDone && stage !== 'done') {
    return (
      <FintracLayout>
        <div className="text-center space-y-4 py-8">
          <div className="w-16 h-16 bg-sage/10 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-sage" />
          </div>
          <h2 className="text-2xl font-black text-midnight">Already Submitted</h2>
          <p className="text-charcoal/60 text-sm">You have already submitted your ID for verification. Your agent has been notified.</p>
        </div>
      </FintracLayout>
    );
  }

  // ── Done ─────────────────────────────────────────────────────────────────
  if (stage === 'done') {
    return (
      <FintracLayout>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-5 py-8">
          <div className="w-20 h-20 bg-sage/10 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-sage" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-midnight">Verification Submitted!</h2>
            <p className="text-charcoal/60 text-sm">
              Your ID has been securely forwarded to your agent. A confirmation has been sent to{' '}
              <strong>{leadEmail}</strong>.
            </p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-left space-y-1.5 text-sm">
            <p className="font-bold text-blue-800 flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Privacy Guarantee</p>
            <p className="text-blue-700 text-xs">Your ID image was sent directly to your agent and was <strong>not stored</strong> in LeadCrest at any point. Only the text fields extracted from your ID are retained to pre-fill the FINTRAC verification form.</p>
          </div>
          <p className="text-xs text-charcoal/40">You may close this window.</p>
        </motion.div>
      </FintracLayout>
    );
  }

  // ── Stage: select ID type ─────────────────────────────────────────────────
  if (stage === 'select') {
    return (
      <FintracLayout>
        <motion.div key="select" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-honey uppercase tracking-widest">Phase 1 · Lead to Client</span>
            <h1 className="text-2xl font-black text-midnight">FINTRAC Identity Verification</h1>
            <p className="text-sm text-charcoal/50 mt-1">Hi <strong className="text-midnight">{leadName}</strong> — federal law requires your agent to verify your identity before completing a real estate transaction.</p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-800">
              <p className="font-bold mb-1">Your ID is never stored in LeadCrest</p>
              <p>Your document is forwarded directly to your agent via encrypted email. Only the text fields (name, DOB, ID number) are retained to complete the verification form.</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-bold text-midnight mb-3">Select your ID type</p>
            <div className="grid grid-cols-2 gap-3">
              {ID_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setIdType(opt.value); setStage('upload'); }}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-zinc-200 hover:border-honey hover:bg-honey/5 transition-all text-center group"
                >
                  <div className="w-10 h-10 bg-zinc-100 group-hover:bg-honey/10 rounded-xl flex items-center justify-center transition-colors">
                    <opt.Icon className="w-5 h-5 text-midnight/50 group-hover:text-honey transition-colors" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-midnight">{opt.label}</p>
                    <p className="text-[10px] text-charcoal/40">{opt.sublabel}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <p className="text-[10px] text-charcoal/30 text-center leading-relaxed">
            Required under the Proceeds of Crime (Money Laundering) and Terrorist Financing Act (Canada).
          </p>
        </motion.div>
      </FintracLayout>
    );
  }

  // ── Stage: upload ─────────────────────────────────────────────────────────
  const selectedOpt = ID_OPTIONS.find(o => o.value === idType);
  return (
    <FintracLayout>
      <motion.div key="upload" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
        <div>
          <button onClick={() => { setStage('select'); setFile(null); }} className="flex items-center gap-1 text-xs text-charcoal/40 hover:text-midnight font-bold mb-4 transition-colors">
            ← Back
          </button>
          <h2 className="text-xl font-black text-midnight">Upload Your {selectedOpt?.label}</h2>
          <p className="text-sm text-charcoal/50 mt-1">Please upload a clear photo or scan. Both sides are recommended for a driver's licence.</p>
        </div>

        {/* Upload area */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/heic,image/webp,application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />

        {file ? (
          <div className="border-2 border-sage/30 bg-sage/5 rounded-2xl p-4 flex items-center gap-3">
            <FileImage className="w-8 h-8 text-sage shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-midnight text-sm truncate">{file.name}</p>
              <p className="text-xs text-charcoal/40">Ready to upload</p>
            </div>
            <button onClick={() => setFile(null)} className="text-charcoal/30 hover:text-red-500 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-zinc-300 hover:border-honey rounded-2xl p-10 flex flex-col items-center gap-3 transition-colors"
          >
            <Upload className="w-8 h-8 text-charcoal/30" />
            <div className="text-center">
              <p className="font-bold text-midnight text-sm">Click to upload ID</p>
              <p className="text-xs text-charcoal/40 mt-1">JPEG, PNG, HEIC, or PDF · max {MAX_FILE_MB} MB</p>
            </div>
          </button>
        )}

        <AnimatePresence>
          {fileError && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm text-red-500 bg-red-50 rounded-xl p-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {fileError}
            </motion.p>
          )}
          {submitError && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm text-red-500 bg-red-50 rounded-xl p-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {submitError}
            </motion.p>
          )}
        </AnimatePresence>

        <div className="space-y-3">
          <button
            onClick={handleSubmit}
            disabled={!file || stage === 'submitting'}
            className="w-full py-4 bg-honey text-white font-black rounded-2xl hover:bg-honey/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg text-sm"
          >
            {stage === 'submitting' ? (
              <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Submitting & Notifying Agent...</>
            ) : (
              <><ShieldCheck className="w-5 h-5" /> Submit ID Securely <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
          <p className="text-[10px] text-charcoal/30 text-center">
            By submitting you confirm this is your valid government-issued ID. Your agent will use this for FINTRAC compliance only.
          </p>
        </div>
      </motion.div>
    </FintracLayout>
  );
}

function FintracLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-linen">
      <div className="bg-white border-b border-zinc-100 px-6 py-4 flex items-center justify-center max-w-xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="relative w-7 h-7 flex items-center justify-center">
            <ChevronUp className="w-6 h-6 text-honey absolute -top-0.5" strokeWidth={3} />
            <Network className="w-4 h-4 text-honey/60 absolute bottom-0" strokeWidth={1.5} />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-black tracking-tighter text-midnight leading-none">LEADCREST</span>
            <span className="text-[8px] font-bold text-honey uppercase tracking-[0.2em]">FINTRAC Identity Verification</span>
          </div>
        </div>
      </div>
      <div className="max-w-xl mx-auto px-4 py-8">
        <div className="bg-white rounded-3xl shadow-xl p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
