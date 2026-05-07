import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Lead } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText, UserCheck, Shield, Landmark, FolderOpen,
  ClipboardList, Handshake, Receipt, CheckSquare, Package,
  Mail, CheckCircle2, ChevronDown, ChevronUp, AlertCircle
} from 'lucide-react';

interface PipelineStep {
  id: string;
  phase: string;
  phaseColor: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  docLabel: string;
  emailSubject: (lead: Lead) => string;
  emailBody: (lead: Lead) => string;
}

const STEPS: PipelineStep[] = [
  // Phase 1 — Lead to Client
  {
    id: 'reco-guide',
    phase: 'Phase 1 · Lead to Client',
    phaseColor: 'honey',
    title: 'RECO Information Guide',
    description: 'Provide before any services — explains buyer rights under TRESA.',
    docLabel: 'RECO Guide',
    icon: <AlertCircle className="w-4 h-4" />,
    emailSubject: (l) => `Important: Your RECO Information Guide — ${l.name}`,
    emailBody: (l) => `Hi ${l.name},\n\nBefore we begin working together, Ontario law (TRESA) requires me to share the RECO Information Guide with you. This document explains your rights as a consumer and the difference between being a client and a self-represented party.\n\nPlease review the attached RECO Information Guide at your earliest convenience and confirm receipt by replying to this email.\n\nIf you have any questions, don't hesitate to reach out.\n\nBest regards`,
  },
  {
    id: 'bra',
    phase: 'Phase 1 · Lead to Client',
    phaseColor: 'honey',
    title: 'Buyer Representation Agreement (BRA)',
    description: 'OREA Form 300 — formalises our working relationship and my fiduciary duties.',
    docLabel: 'OREA Form 300',
    icon: <UserCheck className="w-4 h-4" />,
    emailSubject: (l) => `Action Required: Buyer Representation Agreement — ${l.name}`,
    emailBody: (l) => `Hi ${l.name},\n\nTo officially represent you in your property search, I need you to review and sign the Buyer Representation Agreement (OREA Form 300).\n\nThis agreement outlines:\n- The scope of my services\n- Commission structure\n- Duration of our search\n- My fiduciary duties to you\n\nPlease review the attached form and sign where indicated. You can reply with the signed copy or we can arrange to complete this in person.\n\nBest regards`,
  },
  {
    id: 'fintrac',
    phase: 'Phase 1 · Lead to Client',
    phaseColor: 'honey',
    title: 'FINTRAC Identity Verification',
    description: 'Federal law requires photo ID verification to prevent money laundering.',
    docLabel: 'FINTRAC ID Record',
    icon: <Shield className="w-4 h-4" />,
    emailSubject: (l) => `Identity Verification Required — ${l.name}`,
    emailBody: (l) => `Hi ${l.name},\n\nUnder Canadian federal law (FINTRAC regulations), I am required to verify the identity of all clients before proceeding with a real estate transaction.\n\nPlease provide a copy of ONE of the following valid government-issued photo IDs:\n- Passport\n- Driver's Licence\n- Provincial Photo ID Card\n\nYou can reply to this email with a clear photo or scan of your ID. This information is kept strictly confidential and is required by law.\n\nThank you for your cooperation.\n\nBest regards`,
  },

  // Phase 2 — Mortgage Referral
  {
    id: 'consent-referral',
    phase: 'Phase 2 · Mortgage Referral',
    phaseColor: 'sage',
    title: 'Consent to Mortgage Referral',
    description: 'Written consent required if referring to a mortgage broker and receiving a referral fee.',
    docLabel: 'Referral Consent Form',
    icon: <Handshake className="w-4 h-4" />,
    emailSubject: (l) => `Mortgage Referral Consent — ${l.name}`,
    emailBody: (l) => `Hi ${l.name},\n\nI would like to refer you to a trusted mortgage advisor who can help secure financing for your ${l.type === 'buy' ? 'purchase' : 'rental application'}.\n\nAs required by TRESA, I must disclose that I may receive a referral fee for this introduction, and I need your written consent to share your contact information (name, phone, email, and address) with the mortgage advisor.\n\nPlease reply confirming your consent to:\n1. The referral to a mortgage advisor\n2. Sharing your basic contact details\n\nBest regards`,
  },
  {
    id: 'mortgage-docs',
    phase: 'Phase 2 · Mortgage Referral',
    phaseColor: 'sage',
    title: 'Mortgage Document Collection',
    description: 'Employment Letter, Pay Stubs, NOA (2 yrs), Proof of Down Payment (90-day bank statements).',
    docLabel: 'Mortgage Package',
    icon: <FolderOpen className="w-4 h-4" />,
    emailSubject: (l) => `Documents Needed for Your Mortgage Application — ${l.name}`,
    emailBody: (l) => `Hi ${l.name},\n\nTo help your mortgage advisor process your application efficiently, please gather the following documents:\n\n📋 EMPLOYMENT & INCOME\n- Employment Letter (on company letterhead, confirming position and salary)\n- 2–3 most recent Pay Stubs\n\n📋 TAX DOCUMENTS\n- Notice of Assessment (NOA) from CRA — last 2 years\n  (Download from: My Account at canada.ca)\n\n📋 DOWN PAYMENT PROOF\n- 90 days of bank statements showing the source of your down payment funds\n  (All pages of all accounts contributing to the down payment)\n\nPlease send these to me as PDF attachments at your earliest convenience.\n\nBest regards`,
  },

  // Phase 3 — Transaction
  {
    id: 'aps',
    phase: 'Phase 3 · Transaction',
    phaseColor: 'midnight',
    title: 'Agreement of Purchase & Sale (APS)',
    description: 'OREA Form 100 — the core purchase contract to review and sign.',
    docLabel: 'OREA Form 100',
    icon: <ClipboardList className="w-4 h-4" />,
    emailSubject: (l) => `Agreement of Purchase and Sale — Review Required — ${l.name}`,
    emailBody: (l) => `Hi ${l.name},\n\nGreat news! I have prepared the Agreement of Purchase and Sale (OREA Form 100) for the property we discussed.\n\nThe attached agreement outlines:\n- Purchase price and deposit amount\n- Closing date\n- Conditions (financing, home inspection)\n- Inclusions and exclusions\n\nPlease review this carefully. I recommend you also have your lawyer review it before signing. Once you are ready, please sign where indicated and return the signed copy to me.\n\nTime is of the essence — please respond as soon as possible.\n\nBest regards`,
  },
  {
    id: 'form-320',
    phase: 'Phase 3 · Transaction',
    phaseColor: 'midnight',
    title: 'Confirmation of Co-operation (Form 320)',
    description: 'Confirms commission split between listing and buyer brokerages.',
    docLabel: 'OREA Form 320',
    icon: <Handshake className="w-4 h-4" />,
    emailSubject: (l) => `Confirmation of Co-operation & Representation — ${l.name}`,
    emailBody: (l) => `Hi ${l.name},\n\nAs part of the offer process, I am attaching the Confirmation of Co-operation and Representation (OREA Form 320) for your records.\n\nThis document confirms:\n- How both brokerages are being compensated\n- The nature of representation for both parties\n\nNo action is required from you on this document — it is for your records. However, please confirm receipt by replying to this email.\n\nBest regards`,
  },
  {
    id: 'deposit',
    phase: 'Phase 3 · Transaction',
    phaseColor: 'midnight',
    title: 'Deposit Receipt',
    description: 'Bank draft / certified cheque once offer is accepted — held in trust.',
    docLabel: 'Deposit Confirmation',
    icon: <Receipt className="w-4 h-4" />,
    emailSubject: (l) => `Deposit Instructions — ${l.name}`,
    emailBody: (l) => `Hi ${l.name},\n\nCongratulations — your offer has been accepted! 🎉\n\nThe next step is to provide your deposit. Here are the details:\n\n💰 DEPOSIT INSTRUCTIONS\n- Amount: As specified in your APS\n- Form: Bank Draft or Certified Cheque (payable to the listing brokerage "In Trust")\n- Deadline: As per the terms in your APS (typically within 24 hours of acceptance)\n\nOnce you have the bank draft, please send me:\n1. A photo/scan of the bank draft\n2. The bank confirmation of issuance\n\nI will then obtain the Confirmation of Receipt from the listing brokerage and forward it to you and your lawyer.\n\nBest regards`,
  },
  {
    id: 'waivers',
    phase: 'Phase 3 · Transaction',
    phaseColor: 'midnight',
    title: 'Waivers / Notices of Fulfillment',
    description: 'Removes financing or inspection conditions to firm up the deal.',
    docLabel: 'Condition Waivers',
    icon: <CheckSquare className="w-4 h-4" />,
    emailSubject: (l) => `Condition Waiver Required — ${l.name}`,
    emailBody: (l) => `Hi ${l.name},\n\nThe deadline to waive (or not waive) your conditions is approaching.\n\n📋 CONDITIONS TO FULFIL\n\nFinancing Condition:\n- Please confirm with your mortgage broker that your financing has been approved\n- Once confirmed, sign the attached Waiver of Financing Condition\n\nInspection Condition (if applicable):\n- Please confirm you are satisfied with the home inspection results\n- Sign the attached Notice of Fulfilment / Waiver\n\n⚠️ IMPORTANT: Once you sign and return these waivers, the deal becomes FIRM and legally binding. Please ensure you are fully satisfied before signing.\n\nReturn the signed waivers to me as soon as possible.\n\nBest regards`,
  },

  // Phase 4 — Lawyer Package
  {
    id: 'lawyer-package',
    phase: 'Phase 4 · Lawyer Package',
    phaseColor: 'charcoal',
    title: 'Lawyer Package',
    description: 'Full closing package: APS, Waivers, FINTRAC, Form 320, Deposit, MLS Sheet, Mortgage info.',
    docLabel: 'Closing Package',
    icon: <Package className="w-4 h-4" />,
    emailSubject: (l) => `Your Closing Package — Please Forward to Your Lawyer — ${l.name}`,
    emailBody: (l) => `Hi ${l.name},\n\nYour deal is now FIRM — congratulations! 🏡\n\nI am assembling your full closing package for your real estate lawyer. Please forward this email (and all attachments) to your lawyer immediately so they can begin the title transfer process.\n\n📦 LAWYER PACKAGE CONTENTS\n✅ Firm Agreement of Purchase and Sale (APS)\n✅ All Schedules and Condition Waivers\n✅ FINTRAC Identity Verification Record\n✅ Confirmation of Co-operation (Form 320)\n✅ Deposit Confirmation (held in trust)\n✅ MLS Listing Sheet (legal PIN and tax info)\n✅ Mortgage Broker Information (for lender coordination)\n\n📋 WHAT YOUR LAWYER NEEDS FROM YOU\n- Your lawyer's name, firm, and contact details\n- Confirmation of your mortgage lender\n- Any additional title insurance instructions\n\nPlease ensure your lawyer receives this package as soon as possible to meet the closing date.\n\nBest regards`,
  },
];

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

  const completedSteps: string[] = (lead as any).completedSteps || [];

  const markCompleted = async (stepId: string) => {
    if (completedSteps.includes(stepId)) return;
    const updated = [...completedSteps, stepId];
    await updateDoc(doc(db, 'leads', lead.id), { completedSteps: updated });
    onUpdate({ ...lead, ...(({ completedSteps: updated } as any)) });
  };

  const handleStepClick = async (step: PipelineStep) => {
    setSending(step.id);
    const subject = encodeURIComponent(step.emailSubject(lead));
    const body = encodeURIComponent(step.emailBody(lead));
    window.location.href = `mailto:${lead.email}?subject=${subject}&body=${body}`;
    setTimeout(async () => {
      await markCompleted(step.id);
      setSending(null);
    }, 1500);
  };

  const stepsByPhase = PHASE_ORDER.reduce<Record<string, PipelineStep[]>>((acc, phase) => {
    acc[phase] = STEPS.filter(s => s.phase === phase);
    return acc;
  }, {});

  const phaseCompletion = (phase: string) => {
    const steps = stepsByPhase[phase];
    const done = steps.filter(s => completedSteps.includes(s.id)).length;
    return { done, total: steps.length };
  };

  const overallDone = completedSteps.length;
  const overallTotal = STEPS.length;
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
            {/* Phase header */}
            <button
              onClick={() => setExpandedPhase(isExpanded ? null : phase)}
              className={`w-full flex items-center justify-between p-4 ${colors.bg} hover:opacity-90 transition-opacity`}
            >
              <div className="flex items-center gap-3">
                {allDone ? (
                  <CheckCircle2 className={`w-5 h-5 ${colors.text}`} />
                ) : (
                  <div className={`w-5 h-5 rounded-full border-2 ${colors.border} flex items-center justify-center`}>
                    <span className={`text-[9px] font-black ${colors.text}`}>{done}/{total}</span>
                  </div>
                )}
                <span className={`font-bold text-sm ${colors.text}`}>{phase}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${colors.badge}`}>
                  {done}/{total} done
                </span>
                {isExpanded ? <ChevronUp className={`w-4 h-4 ${colors.text}`} /> : <ChevronDown className={`w-4 h-4 ${colors.text}`} />}
              </div>
            </button>

            {/* Steps */}
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
                      const done = completedSteps.includes(step.id);
                      const isSending = sending === step.id;

                      return (
                        <div key={step.id} className={`p-4 flex items-start gap-4 ${done ? 'opacity-60' : ''}`}>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                            done ? 'bg-sage/10 text-sage' : `${colors.bg} ${colors.text}`
                          }`}>
                            {done ? <CheckCircle2 className="w-4 h-4" /> : step.icon}
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-sm text-midnight">{step.title}</h4>
                              <span className="text-[9px] font-bold text-charcoal/40 uppercase tracking-widest border border-zinc-200 px-1.5 py-0.5 rounded">
                                {step.docLabel}
                              </span>
                              {done && (
                                <span className="text-[9px] font-bold text-sage bg-sage/10 px-1.5 py-0.5 rounded uppercase tracking-widest">
                                  Sent
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-charcoal/50 leading-relaxed">{step.description}</p>
                          </div>
                          <button
                            onClick={() => handleStepClick(step)}
                            disabled={isSending}
                            className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold transition-all ${
                              done
                                ? 'bg-sage/10 text-sage hover:bg-sage/20'
                                : `bg-honey text-white hover:bg-honey/90 shadow-sm`
                            } disabled:opacity-50`}
                          >
                            <Mail className="w-3.5 h-3.5" />
                            {isSending ? 'Opening...' : done ? 'Resend' : 'Send Email'}
                          </button>
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
