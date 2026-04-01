import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Lead, LeadStatus } from '../types';
import { motion } from 'motion/react';
import { 
  ArrowLeft, Phone, Mail, MapPin, Briefcase, DollarSign, 
  ShieldCheck, FileText, CheckCircle2, AlertCircle, 
  Download, ExternalLink, MessageSquare, UserCheck, 
  CreditCard, Building2, Scale
} from 'lucide-react';

export default function LeadDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchLead = async () => {
      const leadDoc = await getDoc(doc(db, 'leads', id));
      if (leadDoc.exists()) {
        setLead({ id: leadDoc.id, ...leadDoc.data() } as Lead);
      }
      setLoading(false);
    };
    fetchLead();
  }, [id]);

  const updateStatus = async (newStatus: LeadStatus) => {
    if (!lead || !id) return;
    setUpdating(true);
    try {
      await updateDoc(doc(db, 'leads', id), { status: newStatus });
      setLead({ ...lead, status: newStatus });
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <div className="p-12 text-center text-charcoal opacity-40">Loading lead details...</div>;
  if (!lead) return <div className="p-12 text-center text-charcoal opacity-40">Lead not found.</div>;

  const scoreColor = lead.score >= 70 ? 'text-sage' : lead.score >= 40 ? 'text-honey' : 'text-red-500';
  const scoreBg = lead.score >= 70 ? 'bg-sage/10' : lead.score >= 40 ? 'bg-honey/10' : 'bg-red-500/10';

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-charcoal/40 hover:text-midnight transition-colors font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
        <div className="flex gap-3">
          <button
            onClick={() => updateStatus('warm')}
            disabled={lead.status === 'warm' || updating}
            className={`px-4 py-2 rounded-custom text-sm font-bold transition-all flex items-center gap-2 shadow-sm ${
              lead.status === 'warm' 
                ? 'bg-honey/10 text-honey border border-honey/20' 
                : 'bg-white border border-zinc-200 text-charcoal/80 hover:bg-zinc-50'
            }`}
          >
            <UserCheck className="w-4 h-4" /> Mark as Warm
          </button>
          <button
            onClick={() => updateStatus('completion')}
            disabled={lead.status === 'completion' || updating}
            className={`px-4 py-2 rounded-custom text-sm font-bold transition-all flex items-center gap-2 shadow-sm ${
              lead.status === 'completion' 
                ? 'bg-midnight/10 text-midnight border border-midnight/20' 
                : 'bg-honey hover:bg-[#c29262] text-white'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" /> Move to Completion
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="lg:col-span-2 space-y-8">
          <div className="p-8 rounded-custom border border-zinc-200 bg-white space-y-8 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-6">
                <div className={`w-20 h-20 rounded-custom flex items-center justify-center text-3xl font-bold shadow-inner ${scoreBg} ${scoreColor}`}>
                  {lead.score}
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-midnight">{lead.name}</h1>
                  <p className="text-charcoal/60 flex items-center gap-2">
                    <span className="capitalize">{lead.type}ing</span> · Lead since {new Date(lead.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest ${
                lead.status === 'completion' ? 'bg-midnight/10 text-midnight' :
                lead.status === 'warm' ? 'bg-honey/10 text-honey' :
                'bg-zinc-100 text-charcoal/40'
              }`}>
                {lead.status}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <h3 className="text-xs font-bold text-charcoal/40 uppercase tracking-widest">Contact Information</h3>
                <div className="space-y-4">
                  <ContactItem icon={<Mail className="w-4 h-4" />} label="Email" value={lead.email} />
                  <ContactItem icon={<Phone className="w-4 h-4" />} label="Phone" value={lead.phone} />
                  <ContactItem icon={<MapPin className="w-4 h-4" />} label="Current Address" value={lead.currentAddress} />
                </div>
              </div>
              <div className="space-y-6">
                <h3 className="text-xs font-bold text-charcoal/40 uppercase tracking-widest">Employment & Income</h3>
                <div className="space-y-4">
                  <ContactItem icon={<Briefcase className="w-4 h-4" />} label="Company" value={lead.employmentInfo?.company || 'Not provided'} />
                  <ContactItem icon={<DollarSign className="w-4 h-4" />} label="Annual Salary" value={lead.employmentInfo?.salary || 'Not provided'} />
                  <div className="flex items-center gap-2 text-sage text-sm font-bold">
                    <ShieldCheck className="w-4 h-4" /> LinkedIn Profile Validated
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Verification Section */}
          <div className="grid md:grid-cols-2 gap-8">
            <div className="p-8 rounded-custom border border-zinc-200 bg-white space-y-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2 text-midnight">
                  <CreditCard className="w-5 h-5 text-honey" /> Soft Credit Check
                </h3>
                <span className="text-xs font-bold text-sage bg-sage/10 px-2 py-1 rounded">PASSED</span>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-charcoal/60">Estimated Rating</span>
                  <span className="font-bold text-midnight">720 - 750 (Excellent)</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-charcoal/60">Previous Defaults</span>
                  <span className="font-bold text-sage">None detected (Open Room)</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-charcoal/60">Public Records</span>
                  <span className="font-bold text-sage">Clear</span>
                </div>
              </div>
            </div>

            <div className="p-8 rounded-custom border border-zinc-200 bg-white space-y-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2 text-midnight">
                  <Building2 className="w-5 h-5 text-honey" /> LTB / Rental History
                </h3>
                <span className="text-xs font-bold text-sage bg-sage/10 px-2 py-1 rounded">VERIFIED</span>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-charcoal/60">Previous Evictions</span>
                  <span className="font-bold text-sage">0</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-charcoal/60">Rental Arrears</span>
                  <span className="font-bold text-sage">None</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-charcoal/60">Landlord References</span>
                  <span className="font-bold text-midnight">2 Pending</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Sidebar */}
        <div className="space-y-6">
          <div className="p-8 rounded-custom border border-zinc-200 bg-white space-y-6 shadow-sm">
            <h3 className="font-bold text-midnight">Next Steps</h3>
            <div className="space-y-4">
              <ActionItem 
                icon={<Phone className="w-4 h-4" />} 
                title="Call Lead" 
                description="Validate identity and intent." 
                active={lead.status === 'cold'}
              />
              <ActionItem 
                icon={<FileText className="w-4 h-4" />} 
                title="Gather Documents" 
                description="ID, Paystubs, Bank Statements." 
                active={lead.status === 'warm'}
              />
              <ActionItem 
                icon={<Scale className="w-4 h-4" />} 
                title="Legal Package" 
                description="Send to lawyers or LTB." 
                active={lead.status === 'completion'}
              />
            </div>
          </div>

          <div className="p-8 rounded-custom border border-honey/20 bg-honey/5 space-y-6 shadow-sm">
            <h3 className="font-bold text-honey">Generate Documents</h3>
            <p className="text-sm text-charcoal/70 leading-relaxed">
              {lead.type === 'buy' 
                ? 'Generate a comprehensive mortgage and legal package for the bank and lawyers.' 
                : 'Generate the standard Ontario LTB Tenancy Agreement (Form 2229E).'}
            </p>
            <button
              disabled={lead.status !== 'completion'}
              className="w-full py-4 bg-honey hover:bg-[#c29262] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-custom transition-all flex items-center justify-center gap-2 shadow-md"
            >
              <Download className="w-5 h-5" />
              {lead.type === 'buy' ? 'Download Legal Package' : 'Generate LTB Contract'}
            </button>
            {lead.status !== 'completion' && (
              <p className="text-[10px] text-charcoal/40 text-center uppercase tracking-widest font-bold">
                Available in Completion Phase
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ContactItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest flex items-center gap-1">
        {icon} {label}
      </p>
      <p className="text-midnight font-bold">{value}</p>
    </div>
  );
}

function ActionItem({ icon, title, description, active }: { icon: React.ReactNode; title: string; description: string; active: boolean }) {
  return (
    <div className={`p-4 rounded-custom border transition-all ${
      active ? 'border-honey/50 bg-honey/5' : 'border-zinc-100 bg-linen/30 opacity-50'
    }`}>
      <div className="flex items-center gap-3 mb-1">
        <div className={`w-8 h-8 rounded-custom flex items-center justify-center ${active ? 'bg-honey text-white shadow-sm' : 'bg-zinc-200 text-zinc-400'}`}>
          {icon}
        </div>
        <h4 className="font-bold text-sm text-midnight">{title}</h4>
      </div>
      <p className="text-xs text-charcoal/60 ml-11">{description}</p>
    </div>
  );
}
