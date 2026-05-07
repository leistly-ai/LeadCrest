import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { STEP_MAP } from '../data/pipelineSteps';
import { CheckCircle2, PenLine, RotateCcw, ChevronUp, Network, AlertTriangle, ArrowRight, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type FlowStep = 'summary' | 'sign' | 'preview' | 'done';

export default function SignDocument() {
  const { leadId, stepId } = useParams<{ leadId: string; stepId: string }>();

  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [agentId, setAgentId] = useState('');
  const [agentEmail, setAgentEmail] = useState('');
  const [agentName, setAgentName] = useState('');
  const [loadingLead, setLoadingLead] = useState(true);
  const [alreadySigned, setAlreadySigned] = useState(false);

  const [flowStep, setFlowStep] = useState<FlowStep>('summary');
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureEmpty, setSignatureEmpty] = useState(true);
  const [signatureDataUrl, setSignatureDataUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const step = stepId ? STEP_MAP[stepId] : null;

  // Check if a PDF document exists for this step
  useEffect(() => {
    if (!stepId) return;
    const url = `/documents/${stepId}.pdf`;
    fetch(url, { method: 'HEAD' }).then(r => {
      if (r.ok) setPdfUrl(url);
    }).catch(() => {});
  }, [stepId]);

  useEffect(() => {
    if (!leadId || !stepId) return;
    const load = async () => {
      const leadDoc = await getDoc(doc(db, 'leads', leadId));
      if (!leadDoc.exists()) { setLoadingLead(false); return; }
      const data = leadDoc.data();
      setLeadName(data.name || '');
      setLeadEmail(data.email || '');
      const aid = data.agentId || '';
      setAgentId(aid);
      if ((data.signatures || {})[stepId]) setAlreadySigned(true);

      // Fetch agent profile for email notification
      if (aid) {
        const agentDoc = await getDoc(doc(db, 'agents', aid));
        if (agentDoc.exists()) {
          setAgentEmail(agentDoc.data().email || '');
          setAgentName(agentDoc.data().name || '');
        }
      }
      setLoadingLead(false);
    };
    load();
  }, [leadId, stepId]);

  // Canvas setup — re-run when flow reaches sign step
  useEffect(() => {
    if (flowStep !== 'sign') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1E3A5F';
  }, [flowStep]);

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

  const handleGoToPreview = () => {
    if (signatureEmpty) return;
    setSignatureDataUrl(canvasRef.current!.toDataURL('image/png'));
    setFlowStep('preview');
  };

  const handleSubmit = async () => {
    if (!signatureDataUrl || !leadId || !stepId) return;
    setSubmitting(true);
    setError('');
    try {
      const signedAt = new Date().toISOString();

      // 1. Save signature to Firestore client-side (no Admin SDK needed)
      await updateDoc(doc(db, 'leads', leadId), {
        [`signatures.${stepId}`]: { signerName: leadName, signedAt, docLabel: step?.docLabel },
        completedSteps: arrayUnion(stepId),
      });

      // 2. Send notification email via server (server only needs to call Resend)
      await fetch('/api/sign-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          stepId,
          signerName: leadName,
          signerEmail: leadEmail,
          agentEmail,
          agentName,
          signature: signatureDataUrl,
          stepTitle: step?.title,
          docLabel: step?.docLabel,
          signedAt,
        }),
      });

      setFlowStep('done');
      // Auto-close after 4 seconds
      setTimeout(() => window.close(), 4000);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────
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

  // ── Already signed ───────────────────────────────────────────────────────
  if (alreadySigned && flowStep !== 'done') {
    return (
      <SignLayout step={null}>
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

  // ── Done ─────────────────────────────────────────────────────────────────
  if (flowStep === 'done') {
    return (
      <SignLayout step={null}>
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
              A signed copy has been sent to your agent. You will also receive a confirmation at <strong>{leadEmail}</strong>.
            </p>
          </div>
          <div className="bg-zinc-50 rounded-2xl p-4 text-left space-y-2 text-sm">
            <Row label="Signer" value={leadName} />
            <Row label="Document" value={step.docLabel} />
            <Row label="Signed on" value={new Date().toLocaleString()} />
          </div>
          <div className="border border-zinc-200 rounded-2xl p-4 bg-white">
            <p className="text-[10px] text-charcoal/40 font-bold uppercase tracking-widest mb-2 text-center">Your Signature</p>
            {signatureDataUrl && (
              <img src={signatureDataUrl} alt="Your signature" className="max-h-20 mx-auto" />
            )}
          </div>
          <p className="text-xs text-charcoal/40 pt-2">This window will close automatically in a few seconds.</p>
        </motion.div>
      </SignLayout>
    );
  }

  const summaryLines = step.documentSummary.split('\n');
  const today = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });

  // ── Step 1: Summary ──────────────────────────────────────────────────────
  if (flowStep === 'summary') {
    return (
      <SignLayout step={flowStep}>
        <motion.div
          key="summary"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-honey uppercase tracking-widest">{step.phase}</span>
            <h1 className="text-2xl font-black text-midnight">{step.title}</h1>
            <span className="text-[10px] border border-zinc-200 rounded px-2 py-0.5 text-charcoal/50 font-bold uppercase tracking-widest">{step.docLabel}</span>
          </div>

          <div className="bg-zinc-50 rounded-2xl p-5 space-y-2 text-sm text-charcoal/70 leading-relaxed">
            {summaryLines.map((line, i) => (
              <p key={i} className={line === '' ? 'mt-1' : ''}>{line}</p>
            ))}
          </div>

          <div className="border-l-4 border-honey pl-4 py-1">
            <p className="text-xs font-bold text-charcoal/50 uppercase tracking-widest mb-1">By signing, you confirm:</p>
            <p className="text-sm text-midnight leading-relaxed">{step.acknowledgement}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-zinc-50 rounded-xl p-3">
              <p className="text-[10px] text-charcoal/40 font-bold uppercase tracking-widest mb-1">Prepared for</p>
              <p className="font-bold text-midnight">{leadName}</p>
            </div>
            <div className="bg-zinc-50 rounded-xl p-3">
              <p className="text-[10px] text-charcoal/40 font-bold uppercase tracking-widest mb-1">Date</p>
              <p className="font-bold text-midnight">{today}</p>
            </div>
          </div>

          <button
            onClick={() => setFlowStep('sign')}
            className="w-full py-4 bg-honey text-white font-black rounded-2xl hover:bg-honey/90 transition-all flex items-center justify-center gap-2 shadow-lg text-sm"
          >
            Continue to Sign <ArrowRight className="w-4 h-4" />
          </button>
          <p className="text-[10px] text-charcoal/30 text-center">Your electronic signature is legally binding under the Electronic Commerce Act (Ontario).</p>
        </motion.div>
      </SignLayout>
    );
  }

  // ── Step 2: Signature ────────────────────────────────────────────────────
  if (flowStep === 'sign') {
    return (
      <SignLayout step={flowStep}>
        <motion.div
          key="sign"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          <div>
            <button
              onClick={() => setFlowStep('summary')}
              className="flex items-center gap-1 text-xs text-charcoal/40 hover:text-midnight transition-colors font-bold mb-4"
            >
              <ArrowLeft className="w-3 h-3" /> Back to document
            </button>
            <h2 className="text-xl font-black text-midnight">Draw Your Signature</h2>
            <p className="text-sm text-charcoal/50 mt-1">Sign below to confirm your agreement to <strong className="text-midnight">{step.title}</strong></p>
          </div>

          {/* Signer info strip */}
          <div className="flex items-center gap-4 p-3 bg-zinc-50 rounded-xl text-sm">
            <div className="flex-1">
              <p className="text-[10px] text-charcoal/40 font-bold uppercase tracking-widest">Signing as</p>
              <p className="font-bold text-midnight">{leadName}</p>
            </div>
            <div className="flex-1">
              <p className="text-[10px] text-charcoal/40 font-bold uppercase tracking-widest">Date</p>
              <p className="font-bold text-midnight">{today}</p>
            </div>
          </div>

          {/* Signature pad */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-midnight flex items-center gap-2">
                <PenLine className="w-4 h-4 text-honey" /> Sign in the box below
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
                height={180}
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

          <button
            onClick={handleGoToPreview}
            disabled={signatureEmpty}
            className="w-full py-4 bg-honey text-white font-black rounded-2xl hover:bg-honey/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg text-sm"
          >
            Review Document <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      </SignLayout>
    );
  }

  // ── Step 3: Preview ──────────────────────────────────────────────────────
  return (
    <SignLayout step={flowStep}>
      <motion.div
        key="preview"
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        className="space-y-6"
      >
        <div>
          <button
            onClick={() => setFlowStep('sign')}
            className="flex items-center gap-1 text-xs text-charcoal/40 hover:text-midnight transition-colors font-bold mb-4"
          >
            <ArrowLeft className="w-3 h-3" /> Back to signature
          </button>
          <h2 className="text-xl font-black text-midnight">Review Your Document</h2>
          <p className="text-sm text-charcoal/50 mt-1">Please confirm the details below before submitting.</p>
        </div>

        {/* Document preview card */}
        <div className="border-2 border-zinc-200 rounded-2xl overflow-hidden">
          {/* Doc header */}
          <div className="bg-midnight px-5 py-4">
            <p className="text-[10px] text-honey font-bold uppercase tracking-widest">{step.phase}</p>
            <h3 className="text-white font-black text-lg mt-0.5">{step.title}</h3>
            <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest mt-1">{step.docLabel}</p>
          </div>

          {/* Doc body */}
          <div className="bg-white space-y-4 text-sm">
            {/* PDF viewer or text summary */}
            {pdfUrl ? (
              <div className="w-full bg-zinc-50 border-b border-zinc-100">
                <iframe
                  src={pdfUrl}
                  title={step.title}
                  className="w-full"
                  style={{ height: '420px', border: 'none' }}
                />
              </div>
            ) : (
              <div className="p-5 text-charcoal/60 leading-relaxed text-xs space-y-1.5">
                {summaryLines.slice(0, 6).map((line, i) => (
                  <p key={i} className={line === '' ? 'mt-1' : ''}>{line}</p>
                ))}
                {summaryLines.length > 6 && (
                  <p className="text-charcoal/30 italic">… and more as detailed in the full document.</p>
                )}
              </div>
            )}

            <div className="p-5 space-y-4">
              <div className="border-t border-zinc-100 pt-4">
                <p className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest mb-2">Acknowledgement</p>
                <p className="text-xs text-midnight leading-relaxed">{step.acknowledgement}</p>
              </div>

              {/* Signer details */}
              <div className="border border-zinc-200 rounded-xl p-4 space-y-2 bg-zinc-50/50">
                <Row label="Signed by" value={leadName} />
                <Row label="Email" value={leadEmail || '—'} />
                <Row label="Document" value={`${step.title} (${step.docLabel})`} />
                <Row label="Date" value={today} />
              </div>

              {/* Signature display */}
              <div className="border border-zinc-200 rounded-xl p-4 bg-white">
                <p className="text-[10px] text-charcoal/40 font-bold uppercase tracking-widest mb-3">Electronic Signature</p>
                <div className="bg-zinc-50 rounded-lg p-3 flex items-center justify-center min-h-[80px]">
                  {signatureDataUrl && (
                    <img src={signatureDataUrl} alt="Your signature" className="max-h-20 max-w-full" />
                  )}
                </div>
                <div className="mt-2 border-t border-zinc-200 pt-2">
                  <p className="text-[10px] text-charcoal/30 text-center">× {leadName} — {today}</p>
                </div>
              </div>

              <p className="text-[10px] text-charcoal/30 leading-relaxed">
                By confirming, you agree this electronic signature is legally binding under the Electronic Commerce Act (Ontario). A signed copy will be emailed to your agent, with a copy to you at {leadEmail || 'your email'}.
              </p>
            </div>
          </div>
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
          disabled={submitting}
          className="w-full py-4 bg-midnight text-white font-black rounded-2xl hover:bg-midnight/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg text-sm"
        >
          {submitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              Confirm &amp; Submit Signature
            </>
          )}
        </button>
      </motion.div>
    </SignLayout>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-charcoal/50">{label}</span>
      <span className="font-bold text-midnight text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}

function StepIndicator({ current }: { current: FlowStep | null }) {
  const steps: { key: FlowStep; label: string }[] = [
    { key: 'summary', label: 'Review' },
    { key: 'sign', label: 'Sign' },
    { key: 'preview', label: 'Confirm' },
  ];
  const currentIdx = steps.findIndex(s => s.key === current);

  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => {
        const done = currentIdx > i;
        const active = currentIdx === i;
        return (
          <div key={s.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${
                done ? 'bg-sage text-white' : active ? 'bg-honey text-white' : 'bg-zinc-200 text-charcoal/40'
              }`}>
                {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={`text-[9px] font-bold mt-1 ${active ? 'text-honey' : done ? 'text-sage' : 'text-charcoal/30'}`}>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-12 h-0.5 mb-4 mx-1 ${done ? 'bg-sage' : 'bg-zinc-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SignLayout({ children, step }: { children: React.ReactNode; step: FlowStep | null }) {
  return (
    <div className="min-h-screen bg-linen">
      <div className="bg-white border-b border-zinc-100 px-6 py-4 flex items-center justify-between max-w-xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="relative w-7 h-7 flex items-center justify-center">
            <ChevronUp className="w-6 h-6 text-honey absolute -top-0.5" strokeWidth={3} />
            <Network className="w-4 h-4 text-honey/60 absolute bottom-0" strokeWidth={1.5} />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-black tracking-tighter text-midnight leading-none">LEADCREST</span>
            <span className="text-[8px] font-bold text-honey uppercase tracking-[0.2em]">Secure Document Signing</span>
          </div>
        </div>
        {step && <StepIndicator current={step} />}
      </div>

      <div className="max-w-xl mx-auto px-4 py-8">
        <div className="bg-white rounded-3xl shadow-xl p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
