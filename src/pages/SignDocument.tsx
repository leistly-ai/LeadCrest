import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { STEP_MAP } from '../data/pipelineSteps';
import {
  CheckCircle2, PenLine, RotateCcw, ChevronUp, Network,
  AlertTriangle, ArrowRight, ArrowLeft, Upload, X, FileImage, ShieldCheck, Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Flow adapts based on step type:
//   requiresIdUpload  → summary → upload → sign → preview → done
//   requiresSignature → summary → sign   → preview → done
//   acknowledge-only  → summary → preview → done
type FlowStep = 'summary' | 'upload' | 'sign' | 'preview' | 'done';

interface IdFile {
  name: string;
  dataUrl: string;
  mimeType: string;
  sizeKb: number;
}

const MAX_ID_FILES = 3;
const MAX_FILE_MB = 8;

export default function SignDocument() {
  const { leadId, stepId } = useParams<{ leadId: string; stepId: string }>();

  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [agentEmail, setAgentEmail] = useState('');
  const [agentName, setAgentName] = useState('');
  const [agentBrokerage, setAgentBrokerage] = useState('');
  const [loadingLead, setLoadingLead] = useState(true);
  const [alreadySigned, setAlreadySigned] = useState(false);

  const [flowStep, setFlowStep] = useState<FlowStep>('summary');
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureEmpty, setSignatureEmpty] = useState(true);
  const [signatureDataUrl, setSignatureDataUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [prefilling, setPrefilling] = useState(false);
  const [prefillPdfBase64, setPrefillPdfBase64] = useState<string | null>(null);

  // ID upload state (FINTRAC step only — never persisted to DB)
  const [idFiles, setIdFiles] = useState<IdFile[]>([]);
  const [idUploadError, setIdUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const step = stepId ? STEP_MAP[stepId] : null;

  useEffect(() => {
    if (!leadId || !stepId) return;
    const load = async () => {
      const leadDoc = await getDoc(doc(db, 'leads', leadId));
      if (!leadDoc.exists()) { setLoadingLead(false); return; }
      const data = leadDoc.data();
      const name = data.name || '';
      const email = data.email || '';
      setLeadName(name);
      setLeadEmail(email);
      const aid = data.agentId || '';
      if ((data.signatures || {})[stepId]) setAlreadySigned(true);

      let resolvedPdfUrl: string | null = null;
      let resolvedAgentInfo = { name: '', email: '', brokerage: '' };
      if (aid) {
        const agentDoc = await getDoc(doc(db, 'agents', aid));
        if (agentDoc.exists()) {
          const agentDocData = agentDoc.data();
          setAgentEmail(agentDocData.email || '');
          setAgentName(agentDocData.name || '');
          setAgentBrokerage(agentDocData.brokerage || agentDocData.brokerageName || '');
          resolvedAgentInfo = {
            name: agentDocData.name || '',
            email: agentDocData.email || '',
            brokerage: agentDocData.brokerage || agentDocData.brokerageName || '',
          };
          const customDoc = agentDocData.documents?.[stepId];
          resolvedPdfUrl = customDoc?.url || null;
        }
      }

      // Fall back to default local PDF if no custom doc
      if (!resolvedPdfUrl) {
        const defaultUrl = `/documents/${stepId}.pdf`;
        try {
          const r = await fetch(defaultUrl, { method: 'HEAD' });
          if (r.ok) resolvedPdfUrl = defaultUrl;
        } catch { /* no default PDF */ }
      }

      // Pre-fill the PDF with lead data
      if (resolvedPdfUrl) {
        setPrefilling(true);
        try {
          const prefillRes = await fetch('/api/prefill-document', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pdfUrl: resolvedPdfUrl.startsWith('http') ? resolvedPdfUrl : null,
              stepId: resolvedPdfUrl.startsWith('http') ? null : stepId,
              leadData: {
                name, email,
                phone: data.phone,
                address: data.currentAddress,
                budget: data.budget,
                timeline: data.timeline,
                type: data.type,
                employer: data.employmentInfo?.company,
                salary: data.employmentInfo?.salary,
              },
              agentData: {
                ...resolvedAgentInfo,
                date: new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }),
              },
            }),
          });
          if (prefillRes.ok) {
            const { pdf } = await prefillRes.json();
            setPrefillPdfBase64(pdf);
            const blob = new Blob([Uint8Array.from(atob(pdf), c => c.charCodeAt(0))], { type: 'application/pdf' });
            setPdfUrl(URL.createObjectURL(blob));
          } else {
            // Prefill failed — show original PDF
            setPdfUrl(resolvedPdfUrl);
          }
        } catch {
          setPdfUrl(resolvedPdfUrl);
        } finally {
          setPrefilling(false);
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

  // ── Drawing helpers ───────────────────────────────────────────────────────
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

  // ── ID upload helpers ─────────────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIdUploadError('');
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const remaining = MAX_ID_FILES - idFiles.length;
    const toProcess = files.slice(0, remaining);

    toProcess.forEach(file => {
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        setIdUploadError(`"${file.name}" exceeds ${MAX_FILE_MB} MB. Please use a smaller file.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = ev => {
        const dataUrl = ev.target?.result as string;
        setIdFiles(prev => [...prev, {
          name: file.name,
          dataUrl,
          mimeType: file.type,
          sizeKb: Math.round(file.size / 1024),
        }]);
      };
      reader.readAsDataURL(file);
    });
    // Reset so the same file can be re-selected if removed
    e.target.value = '';
  };

  const removeIdFile = (idx: number) => {
    setIdFiles(prev => prev.filter((_, i) => i !== idx));
  };

  // ── Navigation helpers ────────────────────────────────────────────────────
  const nextAfterSummary = () => {
    if (step?.requiresIdUpload) return setFlowStep('upload');
    if (step?.requiresSignature) return setFlowStep('sign');
    setFlowStep('preview');
  };

  const nextAfterUpload = () => {
    setFlowStep('sign');
  };

  const handleGoToPreview = () => {
    if (step?.requiresSignature && signatureEmpty) return;
    if (step?.requiresSignature) {
      setSignatureDataUrl(canvasRef.current!.toDataURL('image/png'));
    }
    setFlowStep('preview');
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!leadId || !stepId) return;
    setSubmitting(true);
    setError('');
    try {
      const signedAt = new Date().toISOString();

      // Firestore write — signature image and ID files are NOT stored here
      await updateDoc(doc(db, 'leads', leadId), {
        [`signatures.${stepId}`]: { signerName: leadName, signedAt, docLabel: step?.docLabel },
        completedSteps: arrayUnion(stepId),
      });

      // Send notification — server handles email only, nothing is stored server-side
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
          signature: signatureDataUrl || null,
          stepTitle: step?.title,
          docLabel: step?.docLabel,
          signedAt,
          // ID files sent inline — server attaches to email, never writes to disk/DB
          idAttachments: idFiles.map(f => ({
            filename: f.name,
            content: f.dataUrl.split(',')[1], // base64 only
            mimeType: f.mimeType,
          })),
          // Pre-filled PDF (base64) — replaces static file attachment
          prefillPdf: prefillPdfBase64 || null,
        }),
      });

      setFlowStep('done');
      setTimeout(() => window.close(), 4000);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading / error states ────────────────────────────────────────────────
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

  if (alreadySigned && flowStep !== 'done') {
    return (
      <SignLayout flowStep={null} step={step}>
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
      <SignLayout flowStep={null} step={step}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-5 py-8"
        >
          <div className="w-20 h-20 bg-sage/10 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-sage" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-midnight">
              {step.requiresIdUpload ? 'Verification Complete!' : 'Document Signed!'}
            </h2>
            <p className="text-charcoal/60 text-sm">
              {step.requiresIdUpload
                ? `Your ID and consent have been securely forwarded to your agent. A confirmation will be sent to `
                : `A signed copy has been sent to your agent. You will also receive a confirmation at `}
              <strong>{leadEmail}</strong>.
            </p>
          </div>
          <div className="bg-zinc-50 rounded-2xl p-4 text-left space-y-2 text-sm">
            <Row label="Name" value={leadName} />
            <Row label="Document" value={step.docLabel} />
            <Row label="Completed" value={new Date().toLocaleString()} />
          </div>
          {signatureDataUrl && (
            <div className="border border-zinc-200 rounded-2xl p-4 bg-white">
              <p className="text-[10px] text-charcoal/40 font-bold uppercase tracking-widest mb-2 text-center">Your Signature</p>
              <img src={signatureDataUrl} alt="Your signature" className="max-h-20 mx-auto" />
            </div>
          )}
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
      <SignLayout flowStep={flowStep} step={step}>
        <motion.div key="summary" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-honey uppercase tracking-widest">{step.phase}</span>
            <h1 className="text-2xl font-black text-midnight">{step.title}</h1>
            <span className="text-[10px] border border-zinc-200 rounded px-2 py-0.5 text-charcoal/50 font-bold uppercase tracking-widest">{step.docLabel}</span>
          </div>

          {/* PDF viewer if available, otherwise text summary */}
          {prefilling ? (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 flex items-center justify-center" style={{ height: '360px' }}>
              <div className="flex flex-col items-center gap-3 text-charcoal/40">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="text-xs font-bold uppercase tracking-widest">Preparing document…</p>
              </div>
            </div>
          ) : pdfUrl ? (
            <div className="rounded-2xl overflow-hidden border border-zinc-200">
              <iframe src={pdfUrl} title={step.title} className="w-full" style={{ height: '360px', border: 'none' }} />
            </div>
          ) : (
            <div className="bg-zinc-50 rounded-2xl p-5 space-y-2 text-sm text-charcoal/70 leading-relaxed">
              {summaryLines.map((line, i) => (
                <p key={i} className={line === '' ? 'mt-1' : ''}>{line}</p>
              ))}
            </div>
          )}

          <div className="border-l-4 border-honey pl-4 py-1">
            <p className="text-xs font-bold text-charcoal/50 uppercase tracking-widest mb-1">
              {step.requiresSignature ? 'By signing, you confirm:' : step.requiresIdUpload ? 'By submitting, you confirm:' : 'By acknowledging, you confirm:'}
            </p>
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

          {step.requiresIdUpload && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-800">ID Required for This Step</p>
                <p className="text-xs text-amber-700 mt-1">You will be asked to upload a photo of your government-issued ID on the next screen. Your ID is forwarded directly to your agent via encrypted email and is <strong>not stored</strong> in this application.</p>
              </div>
            </div>
          )}

          <button
            onClick={nextAfterSummary}
            className="w-full py-4 bg-honey text-white font-black rounded-2xl hover:bg-honey/90 transition-all flex items-center justify-center gap-2 shadow-lg text-sm"
          >
            {step.requiresIdUpload ? 'Continue to ID Upload' : step.requiresSignature ? 'Continue to Sign' : 'Continue to Review'}
            <ArrowRight className="w-4 h-4" />
          </button>
          <p className="text-[10px] text-charcoal/30 text-center">
            {step.requiresSignature
              ? 'Your electronic signature is legally binding under the Electronic Commerce Act (Ontario).'
              : 'Your acknowledgement is recorded and forwarded to your agent.'}
          </p>
        </motion.div>
      </SignLayout>
    );
  }

  // ── Step 2a: ID Upload (FINTRAC only) ────────────────────────────────────
  if (flowStep === 'upload') {
    return (
      <SignLayout flowStep={flowStep} step={step}>
        <motion.div key="upload" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
          <div>
            <button onClick={() => setFlowStep('summary')} className="flex items-center gap-1 text-xs text-charcoal/40 hover:text-midnight transition-colors font-bold mb-4">
              <ArrowLeft className="w-3 h-3" /> Back
            </button>
            <h2 className="text-xl font-black text-midnight">Upload Your ID</h2>
            <p className="text-sm text-charcoal/50 mt-1">Please upload a clear photo or scan of your government-issued ID (front, and back if applicable).</p>
          </div>

          {/* Privacy notice */}
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-800 space-y-1">
              <p className="font-bold">Your privacy is protected</p>
              <p>Your ID is sent directly to your agent via encrypted email. It is <strong>not stored</strong> in LeadCrest's database or servers at any point.</p>
            </div>
          </div>

          {/* Upload area */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/heic,application/pdf"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={idFiles.length >= MAX_ID_FILES}
              className="w-full border-2 border-dashed border-zinc-300 hover:border-honey rounded-2xl p-8 flex flex-col items-center gap-3 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Upload className="w-8 h-8 text-charcoal/30" />
              <div className="text-center">
                <p className="font-bold text-midnight text-sm">Click to upload ID</p>
                <p className="text-xs text-charcoal/40 mt-1">JPEG, PNG, HEIC or PDF · max {MAX_FILE_MB} MB per file · up to {MAX_ID_FILES} files</p>
              </div>
            </button>
          </div>

          {/* Error */}
          <AnimatePresence>
            {idUploadError && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm text-red-500 bg-red-50 rounded-xl p-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {idUploadError}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Uploaded files */}
          {idFiles.length > 0 && (
            <div className="space-y-2">
              {idFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                  <FileImage className="w-5 h-5 text-honey shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-midnight truncate">{f.name}</p>
                    <p className="text-[10px] text-charcoal/40">{f.sizeKb} KB</p>
                  </div>
                  <button onClick={() => removeIdFile(i)} className="text-charcoal/30 hover:text-red-500 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={nextAfterUpload}
            disabled={idFiles.length === 0}
            className="w-full py-4 bg-honey text-white font-black rounded-2xl hover:bg-honey/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg text-sm"
          >
            Continue to Consent <ArrowRight className="w-4 h-4" />
          </button>
          <p className="text-[10px] text-charcoal/30 text-center">At least one ID document is required to proceed.</p>
        </motion.div>
      </SignLayout>
    );
  }

  // ── Step 2b: Signature ────────────────────────────────────────────────────
  if (flowStep === 'sign') {
    const backTarget: FlowStep = step.requiresIdUpload ? 'upload' : 'summary';
    return (
      <SignLayout flowStep={flowStep} step={step}>
        <motion.div key="sign" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
          <div>
            <button onClick={() => setFlowStep(backTarget)} className="flex items-center gap-1 text-xs text-charcoal/40 hover:text-midnight transition-colors font-bold mb-4">
              <ArrowLeft className="w-3 h-3" /> Back
            </button>
            <h2 className="text-xl font-black text-midnight">Draw Your Signature</h2>
            <p className="text-sm text-charcoal/50 mt-1">Sign below to confirm your agreement to <strong className="text-midnight">{step.title}</strong></p>
          </div>

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

          {/* Legal warning for Waivers / APS */}
          {(stepId === 'waivers' || stepId === 'aps') && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 font-medium leading-relaxed">
                {stepId === 'waivers'
                  ? 'Once submitted, this waiver makes the deal FIRM and legally binding. You may forfeit your deposit if you fail to close.'
                  : 'This is a legally binding purchase contract. Ensure you have reviewed all terms with your lawyer before signing.'}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-midnight flex items-center gap-2">
                <PenLine className="w-4 h-4 text-honey" /> Sign in the box below
              </p>
              <button onClick={clearSignature} className="flex items-center gap-1 text-xs text-charcoal/40 hover:text-red-500 transition-colors font-bold">
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

  // ── Step 3: Preview / Confirm ─────────────────────────────────────────────
  const backToSign: FlowStep = step.requiresSignature ? 'sign' : step.requiresIdUpload ? 'upload' : 'summary';

  return (
    <SignLayout flowStep={flowStep} step={step}>
      <motion.div key="preview" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
        <div>
          <button onClick={() => setFlowStep(backToSign)} className="flex items-center gap-1 text-xs text-charcoal/40 hover:text-midnight transition-colors font-bold mb-4">
            <ArrowLeft className="w-3 h-3" /> Back
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

          {/* PDF or text summary */}
          {prefilling ? (
            <div className="bg-zinc-50 border-b border-zinc-100 flex items-center justify-center" style={{ height: '380px' }}>
              <div className="flex flex-col items-center gap-3 text-charcoal/40">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="text-xs font-bold uppercase tracking-widest">Preparing document…</p>
              </div>
            </div>
          ) : pdfUrl ? (
            <div className="bg-zinc-50 border-b border-zinc-100">
              <iframe src={pdfUrl} title={step.title} className="w-full" style={{ height: '380px', border: 'none' }} />
            </div>
          ) : (
            <div className="bg-white p-5 text-charcoal/60 leading-relaxed text-xs space-y-1.5 border-b border-zinc-100">
              {summaryLines.slice(0, 6).map((line, i) => (
                <p key={i} className={line === '' ? 'mt-1' : ''}>{line}</p>
              ))}
              {summaryLines.length > 6 && (
                <p className="text-charcoal/30 italic">… and more as detailed in the full document.</p>
              )}
            </div>
          )}

          <div className="bg-white p-5 space-y-4">
            <div>
              <p className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest mb-2">Acknowledgement</p>
              <p className="text-xs text-midnight leading-relaxed">{step.acknowledgement}</p>
            </div>

            {/* Signer details */}
            <div className="border border-zinc-200 rounded-xl p-4 space-y-2 bg-zinc-50/50">
              <Row label="Name" value={leadName} />
              <Row label="Email" value={leadEmail || '—'} />
              <Row label="Document" value={`${step.title} (${step.docLabel})`} />
              <Row label="Date" value={today} />
            </div>

            {/* ID files summary (FINTRAC) */}
            {idFiles.length > 0 && (
              <div className="border border-zinc-200 rounded-xl p-4 bg-white space-y-2">
                <p className="text-[10px] text-charcoal/40 font-bold uppercase tracking-widest">ID Documents Attached</p>
                {idFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-charcoal/60">
                    <FileImage className="w-3.5 h-3.5 text-honey shrink-0" />
                    <span className="truncate">{f.name}</span>
                    <span className="text-charcoal/30 shrink-0">({f.sizeKb} KB)</span>
                  </div>
                ))}
                <p className="text-[10px] text-blue-600 mt-1">These files will be emailed to your agent and are not stored in LeadCrest.</p>
              </div>
            )}

            {/* Signature display */}
            {signatureDataUrl && (
              <div className="border border-zinc-200 rounded-xl p-4 bg-white">
                <p className="text-[10px] text-charcoal/40 font-bold uppercase tracking-widest mb-3">Electronic Signature</p>
                <div className="bg-zinc-50 rounded-lg p-3 flex items-center justify-center min-h-[80px]">
                  <img src={signatureDataUrl} alt="Your signature" className="max-h-20 max-w-full" />
                </div>
                <div className="mt-2 border-t border-zinc-200 pt-2">
                  <p className="text-[10px] text-charcoal/30 text-center">× {leadName} — {today}</p>
                </div>
              </div>
            )}

            <p className="text-[10px] text-charcoal/30 leading-relaxed">
              By confirming, you agree this is legally binding under the Electronic Commerce Act (Ontario). A copy will be emailed to your agent, with a confirmation to you at {leadEmail || 'your email'}.
            </p>
          </div>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-red-500 text-sm bg-red-50 rounded-xl p-3">
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
            <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Submitting...</>
          ) : (
            <><CheckCircle2 className="w-5 h-5" /> {step.requiresSignature ? 'Confirm & Submit Signature' : step.requiresIdUpload ? 'Submit ID & Consent' : 'Confirm & Acknowledge'}</>
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

// Step indicator adapts to the flow type for this step
function StepIndicator({ flowStep, step }: { flowStep: FlowStep | null; step: StepDefinition | null }) {
  if (!flowStep || !step) return null;

  type StepDef = { key: FlowStep; label: string };
  let steps: StepDef[];
  if (step.requiresIdUpload) {
    steps = [
      { key: 'summary', label: 'Review' },
      { key: 'upload', label: 'Upload ID' },
      { key: 'sign', label: 'Consent' },
      { key: 'preview', label: 'Confirm' },
    ];
  } else if (step.requiresSignature) {
    steps = [
      { key: 'summary', label: 'Review' },
      { key: 'sign', label: 'Sign' },
      { key: 'preview', label: 'Confirm' },
    ];
  } else {
    steps = [
      { key: 'summary', label: 'Review' },
      { key: 'preview', label: 'Confirm' },
    ];
  }

  const currentIdx = steps.findIndex(s => s.key === flowStep);

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
              <span className={`text-[9px] font-bold mt-1 whitespace-nowrap ${active ? 'text-honey' : done ? 'text-sage' : 'text-charcoal/30'}`}>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-8 h-0.5 mb-4 mx-1 ${done ? 'bg-sage' : 'bg-zinc-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

import { StepDefinition } from '../data/pipelineSteps';

function SignLayout({ children, flowStep, step }: { children: React.ReactNode; flowStep: FlowStep | null; step: StepDefinition | null }) {
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
        <StepIndicator flowStep={flowStep} step={step} />
      </div>

      <div className="max-w-xl mx-auto px-4 py-8">
        <div className="bg-white rounded-3xl shadow-xl p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
