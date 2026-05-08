import { useState, useRef } from 'react';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { auth, db, storage } from '../firebase';
import { PIPELINE_STEPS } from '../data/pipelineSteps';
import {
  Upload, Trash2, Eye, CheckCircle2, FileText, RotateCcw, Loader2,
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

export default function AgentDocuments({ agentDocuments, onUpdate }: AgentDocumentsProps) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const uid = auth.currentUser?.uid;

  const handleUpload = async (stepId: string, file: File) => {
    if (!uid) return;
    if (file.type !== 'application/pdf') {
      setError(`${file.name} is not a PDF. Only PDF files are accepted.`);
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError(`${file.name} exceeds 20 MB.`);
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
        const storageRef = ref(storage, `agents/${uid}/documents/${stepId}.pdf`);
        await deleteObject(storageRef);
      } catch {
        // File may not exist in Storage — ignore
      }

      // Remove from Firestore using a field mask update
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
        <p className="text-sm text-charcoal/50 mt-1">
          Upload custom PDF versions of the standard documents. The platform will use your version for all leads.
          If no custom document is uploaded, the default LeadCrest document is used. Fields matching lead data will be pre-filled automatically.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 font-medium">
          {error}
        </div>
      )}

      <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-2xl overflow-hidden">
        {PIPELINE_STEPS.map((step) => {
          const custom = agentDocuments[step.id];
          const isUploading = uploading === step.id;
          const isRemoving = removing === step.id;
          const busy = isUploading || isRemoving;

          return (
            <div key={step.id} className="flex items-center gap-4 p-4 bg-white hover:bg-zinc-50/50 transition-colors">
              {/* Status icon */}
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                custom ? 'bg-sage/10 text-sage' : 'bg-zinc-100 text-charcoal/30'
              }`}>
                {custom ? <CheckCircle2 className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
              </div>

              {/* Step info */}
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className="font-bold text-sm text-midnight truncate">{step.title}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-charcoal/40 border border-zinc-200 px-1.5 py-0.5 rounded">
                    {step.docLabel}
                  </span>
                  {custom ? (
                    <span className="text-[10px] text-sage font-bold truncate max-w-[180px]">
                      {custom.name}
                    </span>
                  ) : (
                    <span className="text-[10px] text-charcoal/30 italic">Using default document</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {custom && (
                  <a
                    href={custom.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-zinc-200 bg-zinc-50 text-charcoal/50 hover:bg-zinc-100 transition-all"
                    title="Preview document"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </a>
                )}

                {custom && (
                  <button
                    onClick={() => handleRemove(step.id)}
                    disabled={busy}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-red-100 bg-red-50 text-red-500 hover:bg-red-100 transition-all disabled:opacity-40"
                    title="Reset to default"
                  >
                    {isRemoving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  </button>
                )}

                {/* Hidden file input */}
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all disabled:opacity-40 ${
                    custom
                      ? 'border border-honey/20 bg-honey/5 text-honey hover:bg-honey/10'
                      : 'bg-honey text-white hover:bg-honey/90 shadow-sm'
                  }`}
                  title={custom ? 'Replace document' : 'Upload custom document'}
                >
                  {isUploading
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...</>
                    : <><Upload className="w-3.5 h-3.5" /> {custom ? 'Replace' : 'Upload'}</>
                  }
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-charcoal/40 leading-relaxed">
        Documents are stored securely in your agent profile. When a lead signs a document, any matching AcroForm fields
        will be pre-filled with lead data automatically. Fields that cannot be matched are left blank.
      </p>
    </div>
  );
}
