import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { STEP_MAP } from '../data/pipelineSteps';
import { CheckCircle2, PenLine, RotateCcw, ChevronUp, Network, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function SignDocument() {
  const { leadId, stepId } = useParams<{ leadId: string; stepId: string }>();
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [agentId, setAgentId] = useState('');
  const [loadingLead, setLoadingLead] = useState(true);
  const [alreadySigned, setAlreadySigned] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureEmpty, setSignatureEmpty] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const step = stepId ? STEP_MAP[stepId] : null;

  useEffect(() => {
    if (!leadId || !stepId) return;
    const load = async () => {
      const leadDoc = await getDoc(doc(db, 'leads', leadId));
      if (!leadDoc.exists()) { setLoadingLead(false); return; }
      const data = leadDoc.data();
      setLeadName(data.name || '');
      setLeadEmail(data.email || '');
      setAgentId(data.agentId || '');
      const sigs = data.signatures || {};
      if (sigs[stepId]) setAlreadySigned(true);
      setLoadingLead(false);
    };
    load();
  }, [leadId, stepId]);

  // Canvas setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1E3A5F';
  }, [loadingLead]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: ((e as React.MouseEvent).clientX - rect.left) * scaleX,
      y: ((e as React.MouseEvent).clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setSignatureEmpty(false);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDraw = () => setIsDrawing(false);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureEmpty(true);
  };

  const handleSubmit = async () => {
    if (signatureEmpty || !leadId || !stepId) return;
    setSubmitting(true);
    setError('');
    try {
      const canvas = canvasRef.current!;
      const signatureDataUrl = canvas.toDataURL('image/png');

      const res = await fetch('/api/sign-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          stepId,
          agentId,
          signerName: leadName,
          signerEmail: leadEmail,
          signature: signatureDataUrl,
          stepTitle: step?.title,
          docLabel: step?.docLabel,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Submission failed');
      }
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading / error states ──────────────────────────────────────────────
  if (loadingLead) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linen">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-honey" />
      </div>
    );
  }

  if (!step || !leadName) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linen p-6">
        <div className="bg-white rounded-3xl shadow-xl p-10 max-w-sm text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="text-xl font-black text-midnight">Link Not Found</h2>
          <p className="text-charcoal/60 text-sm">This signing link is invalid or has expired. Please contact your agent for a new link.</p>
        </div>
      </div>
    );
  }

  // ── Already signed ──────────────────────────────────────────────────────
  if (alreadySigned && !submitted) {
    return (
      <SignLayout>
        <div className="text-center space-y-4 py-8">
          <div className="w-16 h-16 bg-sage/10 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-sage" />
          </div>
          <h2 className="text-2xl font-black text-midnight">Already Signed</h2>
          <p className="text-charcoal/60">You have already signed <strong>{step.title}</strong>. A copy was sent to your agent.</p>
          <p className="text-xs text-charcoal/40">If you have questions, contact your real estate agent directly.</p>
        </div>
      </SignLayout>
    );
  }

  // ── Success state ───────────────────────────────────────────────────────
  if (submitted) {
    return (
      <SignLayout>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-5 py-8"
        >
          <div className="w-20 h-20 bg-sage/10 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-sage" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-midnight">Document Signed!</h2>
            <p className="text-charcoal/60 text-sm">
              Your signed copy of <strong>{step.title}</strong> has been sent to your agent.
            </p>
          </div>
          <div className="bg-zinc-50 rounded-2xl p-4 text-left space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-charcoal/50">Signer</span>
              <span className="font-bold text-midnight">{leadName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-charcoal/50">Document</span>
              <span className="font-bold text-midnight">{step.docLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-charcoal/50">Signed on</span>
              <span className="font-bold text-midnight">{new Date().toLocaleString()}</span>
            </div>
          </div>
          <p className="text-xs text-charcoal/40 pt-2">You may close this window.</p>
        </motion.div>
      </SignLayout>
    );
  }

  // ── Main signing page ───────────────────────────────────────────────────
  const summaryLines = step.documentSummary.split('\n');

  return (
    <SignLayout>
      <div className="space-y-6">
        {/* Document info */}
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-honey uppercase tracking-widest">{step.phase}</span>
          <h1 className="text-2xl font-black text-midnight">{step.title}</h1>
          <div className="flex items-center gap-2">
            <span className="text-[10px] border border-zinc-200 rounded px-2 py-0.5 text-charcoal/50 font-bold uppercase tracking-widest">{step.docLabel}</span>
          </div>
        </div>

        {/* Document summary */}
        <div className="bg-zinc-50 rounded-2xl p-5 space-y-2 text-sm text-charcoal/70 leading-relaxed">
          {summaryLines.map((line, i) => (
            <p key={i} className={line === '' ? 'mt-1' : ''}>
              {line}
            </p>
          ))}
        </div>

        {/* Acknowledgement */}
        <div className="border-l-4 border-honey pl-4 py-1">
          <p className="text-xs font-bold text-charcoal/50 uppercase tracking-widest mb-1">By signing, you confirm:</p>
          <p className="text-sm text-midnight leading-relaxed">{step.acknowledgement}</p>
        </div>

        {/* Signer info */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-zinc-50 rounded-xl p-3">
            <p className="text-[10px] text-charcoal/40 font-bold uppercase tracking-widest mb-1">Signer</p>
            <p className="font-bold text-midnight">{leadName}</p>
          </div>
          <div className="bg-zinc-50 rounded-xl p-3">
            <p className="text-[10px] text-charcoal/40 font-bold uppercase tracking-widest mb-1">Date</p>
            <p className="font-bold text-midnight">{new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>

        {/* Signature pad */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-midnight flex items-center gap-2">
              <PenLine className="w-4 h-4 text-honey" /> Draw your signature below
            </p>
            <button
              onClick={clearSignature}
              className="flex items-center gap-1 text-xs text-charcoal/40 hover:text-red-500 transition-colors font-bold"
            >
              <RotateCcw className="w-3 h-3" /> Clear
            </button>
          </div>
          <div className="relative border-2 border-dashed border-zinc-300 rounded-2xl overflow-hidden bg-white touch-none">
            <canvas
              ref={canvasRef}
              width={600}
              height={160}
              className="w-full cursor-crosshair"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
            {signatureEmpty && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-zinc-300 text-sm font-medium">Sign here</p>
              </div>
            )}
          </div>
          <div className="h-px bg-zinc-200 mx-4" />
          <p className="text-[10px] text-charcoal/30 text-center">× Signature of {leadName}</p>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-red-500 text-sm bg-red-50 rounded-xl p-3"
            >
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={signatureEmpty || submitting}
          className="w-full py-4 bg-honey text-white font-black rounded-2xl hover:bg-honey/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg text-sm"
        >
          {submitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              Sign & Submit Document
            </>
          )}
        </button>

        <p className="text-[10px] text-charcoal/30 text-center leading-relaxed">
          By submitting, you agree that this electronic signature is legally binding under the Electronic Commerce Act (Ontario). A signed copy will be emailed to your agent.
        </p>
      </div>
    </SignLayout>
  );
}

function SignLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-linen">
      {/* Minimal header */}
      <div className="bg-white border-b border-zinc-100 px-6 py-4 flex items-center justify-center gap-3">
        <div className="relative w-7 h-7 flex items-center justify-center">
          <ChevronUp className="w-6 h-6 text-honey absolute -top-0.5" strokeWidth={3} />
          <Network className="w-4 h-4 text-honey/60 absolute bottom-0" strokeWidth={1.5} />
        </div>
        <div className="flex flex-col items-center">
          <span className="text-lg font-black tracking-tighter text-midnight leading-none">LEADCREST</span>
          <span className="text-[8px] font-bold text-honey uppercase tracking-[0.2em]">Secure Document Signing</span>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-xl mx-auto px-4 py-8">
        <div className="bg-white rounded-3xl shadow-xl p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
