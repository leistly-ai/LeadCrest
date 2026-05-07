import { useState } from 'react';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { auth } from '../firebase';
import { Lead } from '../types';
import { PIPELINE_STEPS, STEP_MAP } from '../data/pipelineSteps';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText, UserCheck, Shield, FolderOpen,
  ClipboardList, Handshake, Receipt, CheckSquare, Package,
  CheckCircle2, ChevronDown, ChevronUp, PenLine, Send, Copy, Check
} from 'lucide-react';

const STEP_ICONS: Record<string, React.ReactNode> = {
  'reco-guide':        <FileText className="w-4 h-4" />,
  'bra':               <UserCheck className="w-4 h-4" />,
  'fintrac':           <Shield className="w-4 h-4" />,
  'consent-referral':  <Handshake className="w-4 h-4" />,
  'mortgage-docs':     <FolderOpen className="w-4 h-4" />,
  'aps':               <ClipboardList className="w-4 h-4" />,
  'form-320':          <Handshake className="w-4 h-4" />,
  'deposit':           <Receipt className="w-4 h-4" />,
  'waivers':           <CheckSquare className="w-4 h-4" />,
  'lawyer-package':    <Package className="w-4 h-4" />,
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

interface TransactionPipelineProps {
  lead: Lead;
  onUpdate: (updated: Lead) => void;
}

export default function TransactionPipeline({ lead, onUpdate }: TransactionPipelineProps) {
  const [expandedPhase, setExpandedPhase] = useState<string | null>(PHASE_ORDER[0]);
  const [sending, setSending] = useState<string | null>(null);
  const [sentSteps, setSentSteps] = useState<Set<string>>(new Set());
  const [copiedStep, setCopiedStep] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const completedSteps: string[] = (lead as any).completedSteps || [];
  const signatures: Record<string, any> = (lead as any).signatures || {};

  const handleSendEmail = async (stepId: string) => {
    const step = STEP_MAP[stepId];
    setSending(stepId);
    setSendError(null);

    try {
      const currentUser = auth.currentUser;
      const res = await fetch('/api/send-document-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          stepId,
          leadEmail: lead.email,
          leadName: lead.name,
          agentEmail: currentUser?.email || '',
          agentName: currentUser?.displayName || 'Your Agent',
          stepTitle: step.title,
          docLabel: step.docLabel,
          stepPhase: step.phase,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to send email');
      }

      // Update Firestore client-side (no Admin SDK needed)
      await updateDoc(doc(db, 'leads', lead.id), {
        completedSteps: arrayUnion(stepId),
      });

      setSentSteps(prev => new Set(prev).add(stepId));
      onUpdate({ ...lead, ...({ completedSteps: [...completedSteps, stepId] } as any) });
    } catch (err: any) {
      setSendError(err.message || 'Failed to send email');
    } finally {
      setSending(null);
    }
  };

  const handleCopyLink = (stepId: string) => {
    const link = `${window.location.origin}/sign/${lead.id}/${stepId}`;
    navigator.clipboard.writeText(link);
    setCopiedStep(stepId);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  const stepsByPhase = PHASE_ORDER.reduce<Record<string, typeof PIPELINE_STEPS>>((acc, phase) => {
    acc[phase] = PIPELINE_STEPS.filter(s => s.phase === phase);
    return acc;
  }, {});

  const phaseCompletion = (phase: string) => {
    const steps = stepsByPhase[phase];
    const done = steps.filter(s => completedSteps.includes(s.id)).length;
    return { done, total: steps.length };
  };

  const overallDone = completedSteps.length;
  const overallTotal = PIPELINE_STEPS.length;
  const progressPct = Math.round((overallDone / overallTotal) * 100);

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="p-5 rounded-custom border border-zinc-200 bg-white shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-midnight text-sm">Transaction Progress</h3>
          <span className="text-xs font-bold text-charcoal/50">{overallDone}/{overallTotal} steps</span>
        </div>
        <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-honey rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
        <p className="text-[10px] text-charcoal/40 font-bold uppercase tracking-widest text-right">{progressPct}% complete</p>
      </div>

      {/* Send error toast */}
      <AnimatePresence>
        {sendError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-medium"
          >
            {sendError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phases */}
      {PHASE_ORDER.map((phase) => {
        const colors = PHASE_COLORS[phase];
        const { done, total } = phaseCompletion(phase);
        const isExpanded = expandedPhase === phase;
        const allDone = done === total;

        return (
          <div key={phase} className={`rounded-custom border ${colors.border} overflow-hidden shadow-sm`}>
            <button
              onClick={() => setExpandedPhase(isExpanded ? null : phase)}
              className={`w-full flex items-center justify-between p-4 ${colors.bg} hover:opacity-90 transition-opacity`}
            >
              <div className="flex items-center gap-3">
                {allDone
                  ? <CheckCircle2 className={`w-5 h-5 ${colors.text}`} />
                  : <div className={`w-5 h-5 rounded-full border-2 ${colors.border} flex items-center justify-center`}>
                      <span className={`text-[9px] font-black ${colors.text}`}>{done}/{total}</span>
                    </div>
                }
                <span className={`font-bold text-sm ${colors.text}`}>{phase}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${colors.badge}`}>{done}/{total} done</span>
                {isExpanded ? <ChevronUp className={`w-4 h-4 ${colors.text}`} /> : <ChevronDown className={`w-4 h-4 ${colors.text}`} />}
              </div>
            </button>

            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden bg-white"
                >
                  <div className="divide-y divide-zinc-100">
                    {stepsByPhase[phase].map((step) => {
                      const emailSent = completedSteps.includes(step.id) || sentSteps.has(step.id);
                      const signed = !!signatures[step.id];
                      const isSending = sending === step.id;
                      const isCopied = copiedStep === step.id;

                      return (
                        <div key={step.id} className="p-4 flex items-start gap-4">
                          {/* Step icon */}
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                            signed ? 'bg-sage/10 text-sage' : emailSent ? 'bg-honey/10 text-honey' : `${colors.bg} ${colors.text}`
                          }`}>
                            {signed ? <CheckCircle2 className="w-4 h-4" /> : STEP_ICONS[step.id]}
                          </div>

                          {/* Step info */}
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-bold text-sm text-midnight">{step.title}</h4>
                              <span className="text-[9px] font-bold text-charcoal/40 uppercase tracking-widest border border-zinc-200 px-1.5 py-0.5 rounded">
                                {step.docLabel}
                              </span>
                              {signed && (
                                <span className="text-[9px] font-bold text-sage bg-sage/10 px-1.5 py-0.5 rounded uppercase tracking-widest flex items-center gap-1">
                                  <PenLine className="w-2.5 h-2.5" /> Signed {new Date(signatures[step.id].signedAt).toLocaleDateString()}
                                </span>
                              )}
                              {emailSent && !signed && (
                                <span className="text-[9px] font-bold text-honey bg-honey/10 px-1.5 py-0.5 rounded uppercase tracking-widest">
                                  Email Sent
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-charcoal/50 leading-relaxed">{step.description}</p>
                            {emailSent && !signed && (
                              <p className="text-[10px] text-charcoal/40 flex items-center gap-1">
                                <PenLine className="w-3 h-3" />
                                Awaiting signature from {lead.name}
                              </p>
                            )}
                          </div>

                          {/* Action buttons */}
                          <div className="flex flex-col gap-1.5 shrink-0">
                            <button
                              onClick={() => handleSendEmail(step.id)}
                              disabled={isSending || signed}
                              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold transition-all ${
                                signed
                                  ? 'bg-sage/10 text-sage cursor-default'
                                  : emailSent
                                  ? 'bg-zinc-100 text-charcoal/50 hover:bg-zinc-200'
                                  : 'bg-honey text-white hover:bg-honey/90 shadow-sm'
                              } disabled:opacity-50`}
                            >
                              {isSending ? (
                                <>
                                  <div className="w-3 h-3 border-2 border-current/40 border-t-current rounded-full animate-spin" />
                                  Sending...
                                </>
                              ) : signed ? (
                                <><CheckCircle2 className="w-3.5 h-3.5" /> Signed</>
                              ) : emailSent ? (
                                <><Send className="w-3.5 h-3.5" /> Resend</>
                              ) : (
                                <><Send className="w-3.5 h-3.5" /> Send Email</>
                              )}
                            </button>
                            <button
                              onClick={() => handleCopyLink(step.id)}
                              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold transition-all border ${
                                isCopied
                                  ? 'bg-sage/10 text-sage border-sage/20'
                                  : 'bg-zinc-50 text-charcoal/50 hover:bg-zinc-100 border-zinc-200'
                              }`}
                              title="Copy signing link"
                            >
                              {isCopied ? <><Check className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy Link</>}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
