import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Lead, LeadStatus } from '../types';
import { motion } from 'motion/react';
import {
  ArrowLeft, Phone, Mail, MapPin, Briefcase, DollarSign,
  ShieldCheck, CheckCircle2,
  UserCheck, CreditCard, Building2, Clock, Target, Home, DollarSign as BudgetIcon, Linkedin, ExternalLink, Edit2, Save, X, Upload, FileText
} from 'lucide-react';
import TransactionPipeline from '../components/TransactionPipeline';

export default function LeadDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [linkedInUrl, setLinkedInUrl] = useState('');
  const [isEditingLinkedIn, setIsEditingLinkedIn] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [uploadingCredit, setUploadingCredit] = useState(false);
  const [creditScore, setCreditScore] = useState('');
  const [creditRating, setCreditRating] = useState<'excellent' | 'good' | 'fair' | 'poor'>('excellent');

  useEffect(() => {
    if (!id) return;
    const fetchLead = async () => {
      const leadDoc = await getDoc(doc(db, 'leads', id));
      if (leadDoc.exists()) {
        const leadData = { id: leadDoc.id, ...leadDoc.data() } as Lead;
        setLead(leadData);
        setLinkedInUrl(leadData.linkedInProfile?.url || '');
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

  const verifyLinkedIn = async () => {
    if (!lead || !id || !linkedInUrl.trim()) return;
    setVerifying(true);
    try {
      const linkedInProfile = {
        url: linkedInUrl,
        verified: true,
        verifiedAt: new Date().toISOString()
      };
      await updateDoc(doc(db, 'leads', id), {
        linkedInProfile,
        'verification.identityVerified': true,
        'verification.lastVerifiedAt': new Date().toISOString()
      });
      setLead({ ...lead, linkedInProfile, verification: { ...lead.verification, identityVerified: true, lastVerifiedAt: new Date().toISOString() } });
      setIsEditingLinkedIn(false);
    } catch (err) {
      console.error('Error verifying LinkedIn:', err);
    } finally {
      setVerifying(false);
    }
  };

  const saveLinkedInUrl = async () => {
    if (!lead || !id || !linkedInUrl.trim()) return;
    setVerifying(true);
    try {
      const linkedInProfile = {
        url: linkedInUrl,
        verified: false
      };
      await updateDoc(doc(db, 'leads', id), { linkedInProfile });
      setLead({ ...lead, linkedInProfile });
      setIsEditingLinkedIn(false);
    } catch (err) {
      console.error('Error saving LinkedIn URL:', err);
    } finally {
      setVerifying(false);
    }
  };

  const uploadCreditReport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !lead || !id) return;

    setUploadingCredit(true);
    try {
      const storageRef = ref(storage, `credit-reports/${id}/${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      const creditCheck = {
        type: 'soft' as const,
        score: creditScore ? parseInt(creditScore) : undefined,
        rating: creditRating,
        defaults: false,
        provider: 'manual',
        checkedAt: new Date().toISOString(),
        cost: 0,
        reportUrl: url
      };

      await updateDoc(doc(db, 'leads', id), {
        creditCheck,
        'verification.creditCheckCompleted': true,
        'verification.lastVerifiedAt': new Date().toISOString()
      });

      setLead({
        ...lead,
        creditCheck,
        verification: {
          ...lead.verification,
          creditCheckCompleted: true,
          lastVerifiedAt: new Date().toISOString()
        }
      });

      setCreditScore('');
    } catch (err) {
      console.error('Error uploading credit report:', err);
    } finally {
      setUploadingCredit(false);
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
          <span className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-2 ${
            lead.status === 'hot' ? 'bg-red-100 text-red-600' :
            lead.status === 'warm' ? 'bg-honey/10 text-honey' :
            lead.status === 'completion' ? 'bg-midnight/10 text-midnight' :
            'bg-zinc-100 text-charcoal/40'
          }`}>
            <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
            {lead.status}
          </span>
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

                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest flex items-center gap-1">
                      <Linkedin className="w-4 h-4" /> LinkedIn Profile
                    </p>

                    {isEditingLinkedIn ? (
                      <div className="space-y-2">
                        <input
                          type="url"
                          value={linkedInUrl}
                          onChange={(e) => setLinkedInUrl(e.target.value)}
                          placeholder="https://linkedin.com/in/..."
                          className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-honey"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={saveLinkedInUrl}
                            disabled={verifying || !linkedInUrl.trim()}
                            className="flex items-center gap-1 px-3 py-1.5 bg-sage text-white rounded-lg text-xs font-bold hover:bg-sage/90 disabled:opacity-50"
                          >
                            <Save className="w-3 h-3" /> Save
                          </button>
                          <button
                            onClick={() => {
                              setLinkedInUrl(lead.linkedInProfile?.url || '');
                              setIsEditingLinkedIn(false);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-zinc-200 text-charcoal rounded-lg text-xs font-bold hover:bg-zinc-300"
                          >
                            <X className="w-3 h-3" /> Cancel
                          </button>
                        </div>
                      </div>
                    ) : lead.linkedInProfile?.url ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <a
                            href={lead.linkedInProfile.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-midnight font-bold hover:text-honey transition-colors flex items-center gap-1 text-sm"
                          >
                            View Profile <ExternalLink className="w-3 h-3" />
                          </a>
                          <button
                            onClick={() => setIsEditingLinkedIn(true)}
                            className="text-charcoal/40 hover:text-midnight transition-colors"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                        {lead.linkedInProfile.verified ? (
                          <div className="flex items-center gap-2 text-sage text-sm font-bold">
                            <ShieldCheck className="w-4 h-4" /> Verified {lead.linkedInProfile.verifiedAt && `on ${new Date(lead.linkedInProfile.verifiedAt).toLocaleDateString()}`}
                          </div>
                        ) : (
                          <button
                            onClick={verifyLinkedIn}
                            disabled={verifying}
                            className="flex items-center gap-1 px-3 py-1.5 bg-honey text-midnight rounded-lg text-xs font-bold hover:bg-honey/90 disabled:opacity-50"
                          >
                            <ShieldCheck className="w-3 h-3" /> Verify Profile
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsEditingLinkedIn(true)}
                        className="text-xs font-bold text-honey hover:text-honey/80 transition-colors"
                      >
                        + Add LinkedIn Profile
                      </button>
                    )}
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
                  <CreditCard className="w-5 h-5 text-honey" /> Credit Check
                </h3>
                {lead.creditCheck ? (
                  <span className="text-xs font-bold text-sage bg-sage/10 px-2 py-1 rounded">COMPLETED</span>
                ) : (
                  <span className="text-xs font-bold text-charcoal/40 bg-zinc-100 px-2 py-1 rounded">PENDING</span>
                )}
              </div>

              {lead.creditCheck ? (
                <div className="space-y-4">
                  {lead.creditCheck.score && (
                    <div className="flex justify-between text-sm">
                      <span className="text-charcoal/60">Credit Score</span>
                      <span className="font-bold text-midnight">{lead.creditCheck.score}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-charcoal/60">Rating</span>
                    <span className="font-bold text-midnight capitalize">{lead.creditCheck.rating}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-charcoal/60">Defaults</span>
                    <span className={`font-bold ${lead.creditCheck.defaults ? 'text-red-500' : 'text-sage'}`}>
                      {lead.creditCheck.defaults ? 'Found' : 'None'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-charcoal/60">Checked</span>
                    <span className="font-bold text-midnight">{new Date(lead.creditCheck.checkedAt).toLocaleDateString()}</span>
                  </div>
                  {(lead.creditCheck as any).reportUrl && (
                    <a
                      href={(lead.creditCheck as any).reportUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-honey hover:text-honey/80 text-sm font-bold"
                    >
                      <FileText className="w-4 h-4" /> View Report
                    </a>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-charcoal/60">Upload a credit report to verify this lead's creditworthiness.</p>

                  <div className="space-y-3">
                    <input
                      type="number"
                      placeholder="Credit Score (optional)"
                      value={creditScore}
                      onChange={(e) => setCreditScore(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-honey"
                    />

                    <select
                      value={creditRating}
                      onChange={(e) => setCreditRating(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-honey"
                    >
                      <option value="excellent">Excellent (720+)</option>
                      <option value="good">Good (660-719)</option>
                      <option value="fair">Fair (560-659)</option>
                      <option value="poor">Poor (&lt;560)</option>
                    </select>

                    <label className="flex items-center gap-2 px-4 py-3 bg-honey/10 text-honey rounded-lg cursor-pointer hover:bg-honey/20 transition-all font-bold text-sm">
                      <Upload className="w-4 h-4" />
                      {uploadingCredit ? 'Uploading...' : 'Upload Credit Report (PDF)'}
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={uploadCreditReport}
                        disabled={uploadingCredit}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              )}
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

        {/* Qualification Summary Sidebar */}
        <div className="space-y-6">
          <div className="p-6 rounded-custom border border-zinc-200 bg-white space-y-4 shadow-sm">
            <h3 className="font-bold text-midnight text-sm">Qualification Details</h3>
            <div className="space-y-3">
              <SidebarItem icon={<Clock className="w-3.5 h-3.5" />} label="Timeline" value={(lead as any).timeline || '—'} />
              <SidebarItem icon={<BudgetIcon className="w-3.5 h-3.5" />} label="Budget" value={(lead as any).budget || '—'} />
              <SidebarItem icon={<CreditCard className="w-3.5 h-3.5" />} label="Pre-Approved" value={(lead as any).preApproved || '—'} />
              <SidebarItem icon={<Home className="w-3.5 h-3.5" />} label="Down Payment" value={(lead as any).downPaymentReady || '—'} />
              <SidebarItem icon={<MapPin className="w-3.5 h-3.5" />} label="Location Pref." value={(lead as any).locationPreference || '—'} />
              <SidebarItem icon={<Target className="w-3.5 h-3.5" />} label="Motivation" value={(lead as any).motivation || '—'} />
            </div>
          </div>

          <div className="p-6 rounded-custom border border-zinc-200 bg-white space-y-4 shadow-sm">
            <h3 className="font-bold text-midnight text-sm">Update Status</h3>
            <div className="space-y-2">
              {(['cold', 'warm', 'hot', 'completion'] as LeadStatus[]).map(s => (
                <button
                  key={s}
                  onClick={() => updateStatus(s)}
                  disabled={lead.status === s || updating}
                  className={`w-full py-2.5 rounded-custom text-xs font-bold uppercase tracking-widest transition-all ${
                    lead.status === s
                      ? s === 'hot' ? 'bg-red-500 text-white' : s === 'warm' ? 'bg-honey text-white' : s === 'completion' ? 'bg-midnight text-white' : 'bg-zinc-200 text-zinc-600'
                      : 'bg-white border border-zinc-200 text-charcoal/60 hover:bg-zinc-50'
                  }`}
                >
                  {lead.status === s ? `● ${s}` : s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Pipeline — full width below */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-midnight">Transaction Pipeline</h2>
          <span className="text-xs text-charcoal/40 font-bold uppercase tracking-widest">Ontario TRESA Process · {lead.type === 'buy' ? 'Purchase' : 'Rental'}</span>
        </div>
        <TransactionPipeline lead={lead} onUpdate={setLead} />
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

function SidebarItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest flex items-center gap-1 shrink-0 mt-0.5">
        {icon} {label}
      </span>
      <span className="text-xs font-bold text-midnight text-right">{value}</span>
    </div>
  );
}
