import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Lead } from '../types';
import { PIPELINE_STEPS, STEP_MAP } from '../data/pipelineSteps';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText, UserCheck, Shield, Landmark, FolderOpen,
  ClipboardList, Handshake, Receipt, CheckSquare, Package,
  Mail, CheckCircle2, ChevronDown, ChevronUp, PenLine
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

// Email bodies per step — plain text for mailto
const emailBody = (lead: Lead, stepId: string, signingLink: string): string => {
  const step = STEP_MAP[stepId];
  const firstName = lead.name.split(' ')[0];
  const summaryShort = step.documentSummary.split('\n').slice(0, 4).join('\n');

  return `Hi ${firstName},

${summaryShort}

──────────────────────────────
✍️  SIGN THIS DOCUMENT ONLINE
──────────────────────────────
Please click the secure link below to review the full document summary and add your electronic signature:

${signingLink}

This link is unique to you. Once you sign, a copy will be automatically sent to me for my records.

If you have any questions before signing, please don't hesitate to call or reply to this email.

Best regards`;
};

interface TransactionPipelineProps {
  lead: Lead;
  onUpdate: (updated: Lead) => void;
}

export default function TransactionPipeline({ lead, onUpdate }: TransactionPipelineProps) {
  const [expandedPhase, setExpandedPhase] = useState<string | null>(PHASE_ORDER[0]);
  const [sending, setSending] = useState<string | null>(null);

  const completedSteps: string[] = (lead as any).completedSteps || [];
  const signatures: Record<string, any> = (lead as any).signatures || {};

  const markEmailSent = async (stepId: string) => {
    if (completedSteps.includes(stepId)) return;
    const updated = [...completedSteps, stepId];
    await updateDoc(doc(db, 'leads', lead.id), { completedSteps: updated });
    onUpdate({ ...lead, ...({ completedSteps: updated } as any) });
  };

  const handleSendEmail = async (stepId: string) => {
    setSending(stepId);
    const step = STEP_MAP[stepId];
    const signingLink = `${window.location.origin}/sign/${lead.id}/${stepId}`;
    const subject = encodeURIComponent(`Action Required: ${step.title} — ${lead.name}`);
    const body = encodeURIComponent(emailBody(lead, stepId, signingLink));
    window.location.href = `mailto:${lead.email}?subject=${subject}&body=${body}`;
    setTimeout(async () => {
      await markEmailSent(stepId);
      setSending(null);
    }, 1500);
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
                      const emailSent = completedSteps.includes(step.id);
                      const signed = !!signatures[step.id];
                      const isSending = sending === step.id;

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
                              disabled={isSending}
                              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold transition-all ${
                                emailSent
                                  ? 'bg-zinc-100 text-charcoal/50 hover:bg-zinc-200'
                                  : 'bg-honey text-white hover:bg-honey/90 shadow-sm'
                              } disabled:opacity-50`}
                            >
                              <Mail className="w-3.5 h-3.5" />
                              {isSending ? 'Opening...' : emailSent ? 'Resend' : 'Send Email'}
                            </button>
                            {/* Copy signing link */}
                            <button
                              onClick={() => {
                                const link = `${window.location.origin}/sign/${lead.id}/${step.id}`;
                                navigator.clipboard.writeText(link);
                              }}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold bg-zinc-50 text-charcoal/50 hover:bg-zinc-100 transition-all border border-zinc-200"
                              title="Copy signing link"
                            >
                              <PenLine className="w-3.5 h-3.5" />
                              Copy Link
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
