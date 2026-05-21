import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { AlertTriangle, Download, Printer, ShieldCheck } from 'lucide-react';

interface FintracData {
  idType: string;
  fullName: string;
  dateOfBirth: string;
  address: string;
  idNumber: string;
  expiryDate: string;
  jurisdiction: string;
  country: string;
  submittedAt: string;
  submittedBy: string;
}

const ID_TYPE_LABELS: Record<string, string> = {
  drivers_licence:  "Driver's Licence",
  passport:         'Passport',
  pr_card:          'Permanent Resident (PR) Card',
  foreign_passport: 'Foreign Passport',
};

export default function FintracRecord() {
  const { leadId } = useParams<{ leadId: string }>();
  const [loading, setLoading]         = useState(true);
  const [authorized, setAuthorized]   = useState(false);
  const [leadName, setLeadName]       = useState('');
  const [leadEmail, setLeadEmail]     = useState('');
  const [agentName, setAgentName]     = useState('');
  const [fintracData, setFintracData] = useState<FintracData | null>(null);

  useEffect(() => {
    if (!leadId) return;
    const load = async () => {
      const user = auth.currentUser;
      if (!user) { setLoading(false); return; }

      const leadDoc = await getDoc(doc(db, 'leads', leadId));
      if (!leadDoc.exists()) { setLoading(false); return; }

      const data = leadDoc.data();
      // Only the lead's agent may view this record
      if (data.agentId !== user.uid) { setLoading(false); return; }

      setAuthorized(true);
      setLeadName(data.name || '');
      setLeadEmail(data.email || '');
      setFintracData(data.fintracData || null);

      const agentDoc = await getDoc(doc(db, 'agents', user.uid));
      if (agentDoc.exists()) setAgentName(agentDoc.data().name || user.displayName || '');

      setLoading(false);
    };
    load();
  }, [leadId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linen">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-honey" />
      </div>
    );
  }

  if (!auth.currentUser) return <Navigate to="/login" replace />;

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linen p-6">
        <div className="bg-white rounded-3xl shadow-xl p-10 max-w-sm text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="text-xl font-black text-midnight">Access Denied</h2>
          <p className="text-charcoal/60 text-sm">You are not authorized to view this FINTRAC record.</p>
        </div>
      </div>
    );
  }

  if (!fintracData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linen p-6">
        <div className="bg-white rounded-3xl shadow-xl p-10 max-w-sm text-center space-y-4">
          <ShieldCheck className="w-12 h-12 text-zinc-300 mx-auto" />
          <h2 className="text-xl font-black text-midnight">ID Not Yet Submitted</h2>
          <p className="text-charcoal/60 text-sm">{leadName} has not yet uploaded their ID. Send them a FINTRAC verification email from the lead's pipeline.</p>
        </div>
      </div>
    );
  }

  const verificationDate = new Date(fintracData.submittedAt).toLocaleDateString('en-CA', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  const idLabel = ID_TYPE_LABELS[fintracData.idType] || fintracData.idType || 'Government-Issued Photo ID';

  return (
    <div className="min-h-screen bg-zinc-100 py-8 px-4">
      {/* Action bar — hidden on print */}
      <div className="max-w-3xl mx-auto mb-6 flex items-center justify-between print:hidden">
        <h1 className="text-lg font-black text-midnight">FINTRAC Identity Verification Record</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-bold text-midnight hover:bg-zinc-50 transition-colors"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-honey text-white text-sm font-bold hover:bg-honey/90 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" /> Save as PDF
          </button>
        </div>
      </div>

      {/* FINTRAC Form — printable */}
      <div className="max-w-3xl mx-auto bg-white shadow-lg print:shadow-none" id="fintrac-form">
        {/* Header */}
        <div className="border-b-4 border-midnight px-8 py-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-charcoal/50">Canada · Anti-Money Laundering</p>
              <h2 className="text-2xl font-black text-midnight mt-1">Individual Identification Information Record</h2>
              <p className="text-sm text-charcoal/60 mt-1">
                Proceeds of Crime (Money Laundering) and Terrorist Financing Act — Section 9.1(1)
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-charcoal/40">FINTRAC</p>
              <p className="text-xs text-charcoal/50 mt-1">Record Date: {verificationDate}</p>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-8">
          {/* Part A — Individual's Information */}
          <section>
            <SectionHeader label="Part A" title="Individual's Information" />
            <div className="grid grid-cols-2 gap-6 mt-4">
              <Field label="Full Legal Name" value={fintracData.fullName} wide />
              <Field label="Date of Birth" value={fintracData.dateOfBirth} />
              <Field label="Current Address" value={fintracData.address} wide />
              <Field label="Email Address" value={leadEmail} />
            </div>
          </section>

          {/* Part B — Identification */}
          <section>
            <SectionHeader label="Part B" title="Identification Document" />
            <div className="grid grid-cols-2 gap-6 mt-4">
              <Field label="Type of ID Document" value={idLabel} />
              <Field label="Document / Licence Number" value={fintracData.idNumber} />
              <Field label="Jurisdiction of Issue" value={fintracData.jurisdiction} />
              <Field label="Country" value={fintracData.country} />
              <Field label="Expiry Date" value={fintracData.expiryDate} />
              <Field label="Verification Method" value="Government-issued photo ID — copy received by email" />
            </div>
          </section>

          {/* Part C — Completion */}
          <section>
            <SectionHeader label="Part C" title="Record of Verification" />
            <div className="grid grid-cols-2 gap-6 mt-4">
              <Field label="Date of Verification" value={verificationDate} />
              <Field label="Completed by (Agent)" value={agentName} />
              <Field label="Brokerage / Organization" value="" />
              <Field label="Position / Title" value="Registered Real Estate Salesperson" />
            </div>
          </section>

          {/* AI extraction notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 print:border-zinc-200 print:bg-zinc-50 print:text-zinc-700">
            <p className="font-bold mb-1">⚠️ Verification Note</p>
            <p>The information above was extracted from the ID image submitted by {leadName} using AI-assisted document recognition. You must verify all fields against the original ID document (received via email) before signing this record. The original ID image was not stored in LeadCrest and is available only in the notification email you received.</p>
          </div>

          {/* Signature block */}
          <div className="border-t border-zinc-200 pt-6 grid grid-cols-2 gap-8">
            <div>
              <div className="h-16 border-b border-zinc-400 mb-2" />
              <p className="text-xs text-charcoal/50">Signature of Reporting Person</p>
              <p className="text-xs font-bold text-midnight mt-1">{agentName}</p>
            </div>
            <div>
              <div className="h-16 border-b border-zinc-400 mb-2" />
              <p className="text-xs text-charcoal/50">Date Signed</p>
            </div>
          </div>

          <p className="text-[10px] text-charcoal/30 text-center pb-2">
            Generated by LeadCrest · {verificationDate} · For FINTRAC compliance use only.
          </p>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; }
          #fintrac-form { box-shadow: none !important; max-width: 100% !important; }
        }
      `}</style>
    </div>
  );
}

function SectionHeader({ label, title }: { label: string; title: string }) {
  return (
    <div className="flex items-center gap-3 pb-2 border-b border-zinc-200">
      <span className="text-[10px] font-black bg-midnight text-white px-2 py-0.5 rounded uppercase tracking-widest">{label}</span>
      <h3 className="text-sm font-black text-midnight uppercase tracking-wide">{title}</h3>
    </div>
  );
}

function Field({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-charcoal/40 mb-1">{label}</p>
      <div className="border-b border-zinc-300 pb-1.5 min-h-[28px]">
        <p className="text-sm font-semibold text-midnight">{value || ' '}</p>
      </div>
    </div>
  );
}
