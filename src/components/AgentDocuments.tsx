import { useState, useRef } from 'react';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { auth, db, storage } from '../firebase';
import { PIPELINE_STEPS, STEP_MAP } from '../data/pipelineSteps';
import {
  FileText, UserCheck, Shield, FolderOpen,
  ClipboardList, Handshake, Receipt, CheckSquare, Package,
  CheckCircle2, ChevronDown, ChevronUp, Download, Upload,
  Loader2, RotateCcw, Eye,
} from 'lucide-react';

interface DocMeta {
  url: string;
  name: string;
  uploadedAt: string;
}

interface AgentDocumentsProps {
  agentDocuments: Record<string, DocMeta>;
  onUpdate: (docs: Record<string, DocMeta>) => void;
}

const STEP_ICONS: Record<string, React.ReactNode> = {
  'reco-guide':       <FileText className="w-4 h-4" />,
  'bra':              <UserCheck className="w-4 h-4" />,
  'fintrac':          <Shield className="w-4 h-4" />,
  'consent-referral': <Handshake className="w-4 h-4" />,
  'mortgage-docs':    <FolderOpen className="w-4 h-4" />,
  'aps':              <ClipboardList className="w-4 h-4" />,
  'form-320':         <Handshake className="w-4 h-4" />,
  'deposit':          <Receipt className="w-4 h-4" />,
  'waivers':          <CheckSquare className="w-4 h-4" />,
  'lawyer-package':   <Package className="w-4 h-4" />,
};

const PHASE_ORDER = [
  'Phase 1 · Lead to Client',
  'Phase 2 · Mortgage Referral',
  'Phase 3 · Transaction',
  'Phase 4 · Lawyer Package',
];

const PHASE_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  'Phase 1 · Lead to Client':    { bg: 'bg-honey/5',    border: 'border-honey/20',    text: 'text-honey',    badge: 'bg-honey/10 text-honey' },
  'Phase 2 · Mortgage Referral': { bg: 'bg-sage/5',     border: 'border-sage/20',     text: 'text-sage',     badge: 'bg-sage/10 text-sage' },
  'Phase 3 · Transaction':       { bg: 'bg-midnight/5', border: 'border-midnight/20', text: 'text-midnight', badge: 'bg-midnight/10 text-midnight' },
  'Phase 4 · Lawyer Package':    { bg: 'bg-zinc-50',    border: 'border-zinc-200',    text: 'text-zinc-700', badge: 'bg-zinc-100 text-zinc-700' },
};

export default function AgentDocuments({ agentDocuments, onUpdate }: AgentDocumentsProps) {
  const [expandedPhase, setExpandedPhase] = useState<string | null>(PHASE_ORDER[0]);
  const [uploading, setUploading]   = useState<string | null>(null);
  const [removing, setRemoving]     = useState<string | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const uid = auth.currentUser?.uid;

  const stepsByPhase = PHASE_ORDER.reduce<Record<string, typeof PIPELINE_STEPS>>((acc, phase) => {
    acc[phase] = PIPELINE_STEPS.filter(s => s.phase === phase);
    return acc;
  }, {});

  const phaseCustomCount = (phase: string) =>
    stepsByPhase[phase].filter(s => !!agentDocuments[s.id]).length;

  const handleUpload = async (stepId: string, file: File) => {
    if (!uid) return;
    if (file.type !== 'application/pdf') {
      setError(`"${file.name}" is not a PDF. Only PDF files are accepted.`);
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError(`"${file.name}" exceeds 20 MB.`);
      return;
    }
    setError(null);
    setUploading(stepId);
    try {
      const storageRef = ref(storage, `agents/${uid}/documents/${stepId}.pdf`);
      await uploadBytes(storageRef, file, { contentType: 'application/pdf' });
      const url = await getDownloadURL(storageRef);
      const meta: DocMeta = { url, name: file.name, uploadedAt: new Date().toISOString() };
      await updateDoc(doc(db, 'agents', uid), { [`documents.${stepId}`]: meta });
      onUpdate({ ...agentDocuments, [stepId]: meta });
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(null);
    }
  };

  const handleRemove = async (stepId: string) => {
    if (!uid) return;
    setRemoving(stepId);
    setError(null);
    try {
      try {
        await deleteObject(ref(storage, `agents/${uid}/documents/${stepId}.pdf`));
      } catch { /* may not exist */ }
      const agentRef = doc(db, 'agents', uid);
      const snap = await getDoc(agentRef);
      if (snap.exists()) {
        const docs = { ...(snap.data().documents || {}) };
        delete docs[stepId];
        await updateDoc(agentRef, { documents: docs });
      }
      const updated = { ...agentDocuments };
      delete updated[stepId];
      onUpdate(updated);
    } catch (err: any) {
      setError(err.message || 'Remove failed');
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-midnight flex items-center gap-2">
          <FileText className="w-5 h-5 text-honey" /> Transaction Documents
        </h2>
        <p className="text-sm text-charcoal/50 mt-1 leading-relaxed">
          Download the default LeadCrest templates, or upload your own custom versions.
          Your custom PDFs are used for all leads — AcroForm fields will be auto-filled with lead data.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 font-medium">
          {error}
        </div>
      )}

      {PHASE_ORDER.map((phase) => {
        const colors    = PHASE_COLORS[phase];
        const steps     = stepsByPhase[phase];
        const custom    = phaseCustomCount(phase);
        const isExpanded = expandedPhase === phase;

        return (
          <div key={phase} className={`rounded-custom border ${colors.border} overflow-hidden shadow-sm`}>
            {/* Phase header */}
            <button
              onClick={() => setExpandedPhase(isExpanded ? null : phase)}
              className={`w-full flex items-center justify-between p-4 ${colors.bg} hover:opacity-90 transition-opacity`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 ${colors.border} flex items-center justify-center`}>
                  <span className={`text-[9px] font-black ${colors.text}`}>{steps.length}</span>
                </div>
                <span className={`font-bold text-sm ${colors.text}`}>{phase}</span>
              </div>
              <div className="flex items-center gap-2">
                {custom > 0 && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${colors.badge}`}>
                    {custom} custom
                  </span>
                )}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500`}>
                  {steps.length} docs
                </span>
                {isExpanded
                  ? <ChevronUp className={`w-4 h-4 ${colors.text}`} />
                  : <ChevronDown className={`w-4 h-4 ${colors.text}`} />}
              </div>
            </button>

            {/* Steps */}
            {isExpanded && (
              <div className="divide-y divide-zinc-100 bg-white">
                {steps.map((step) => {
                  const custom     = agentDocuments[step.id];
                  const isUploading = uploading === step.id;
                  const isRemoving  = removing  === step.id;
                  const busy        = isUploading || isRemoving;

                  return (
                    <div key={step.id} className="p-4 flex items-start gap-4">
                      {/* Step icon */}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        custom ? 'bg-sage/10 text-sage' : `${colors.bg} ${colors.text}`
                      }`}>
                        {custom ? <CheckCircle2 className="w-4 h-4" /> : STEP_ICONS[step.id]}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold text-sm text-midnight">{step.title}</h4>
                          <span className="text-[9px] font-bold text-charcoal/40 uppercase tracking-widest border border-zinc-200 px-1.5 py-0.5 rounded">
                            {step.docLabel}
                          </span>
                          {custom ? (
                            <span className="text-[9px] font-bold text-sage bg-sage/10 px-1.5 py-0.5 rounded uppercase tracking-widest flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Custom · {new Date(custom.uploadedAt).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold text-charcoal/30 bg-zinc-100 px-1.5 py-0.5 rounded uppercase tracking-widest">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-charcoal/50 leading-relaxed">{step.description}</p>
                        {custom && (
                          <p className="text-[10px] text-charcoal/40 truncate max-w-xs">{custom.name}</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-1.5 shrink-0">
                        {/* Download — custom takes priority over default */}
                        {custom ? (
                          <a
                            href={custom.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold transition-all bg-sage/10 text-sage hover:bg-sage/20"
                          >
                            <Eye className="w-3.5 h-3.5" /> View Custom
                          </a>
                        ) : (
                          <a
                            href={`/documents/${step.id}.pdf`}
                            download={`${step.docLabel}.pdf`}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold transition-all border border-zinc-200 bg-zinc-50 text-charcoal/60 hover:bg-zinc-100"
                          >
                            <Download className="w-3.5 h-3.5" /> Download
                          </a>
                        )}

                        {/* Upload / Replace */}
                        <input
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          ref={el => { fileRefs.current[step.id] = el; }}
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) handleUpload(step.id, file);
                            e.target.value = '';
                          }}
                        />
                        <button
                          onClick={() => fileRefs.current[step.id]?.click()}
                          disabled={busy}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold transition-all disabled:opacity-40 ${
                            custom
                              ? 'bg-zinc-100 text-charcoal/50 hover:bg-zinc-200'
                              : 'bg-honey text-white hover:bg-honey/90 shadow-sm'
                          }`}
                        >
                          {isUploading
                            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</>
                            : <><Upload className="w-3.5 h-3.5" /> {custom ? 'Replace' : 'Upload'}</>}
                        </button>

                        {/* Reset to default */}
                        {custom && (
                          <button
                            onClick={() => handleRemove(step.id)}
                            disabled={busy}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold transition-all border border-red-100 bg-red-50 text-red-500 hover:bg-red-100 disabled:opacity-40"
                          >
                            {isRemoving
                              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Removing…</>
                              : <><RotateCcw className="w-3.5 h-3.5" /> Reset</>}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <p className="text-[11px] text-charcoal/40 leading-relaxed">
        Custom documents are stored securely in your agent profile. AcroForm fields in uploaded PDFs are automatically
        pre-filled with lead data when a signing link is opened. Fields that cannot be matched are left blank.
      </p>
    </div>
  );
}
