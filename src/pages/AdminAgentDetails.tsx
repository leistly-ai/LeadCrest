import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Agent } from '../types';
import { motion } from 'motion/react';
import { User, Mail, Phone, MapPin, Home, Save, ArrowLeft, ShieldCheck, BadgeCheck, ShieldAlert, Power, PowerOff } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../utils/firestore-errors';

const ONTARIO_CITIES = [
  'Toronto', 'Ottawa', 'Mississauga', 'Brampton', 'Hamilton', 
  'London', 'Markham', 'Vaughan', 'Kitchener', 'Windsor',
  'Richmond Hill', 'Oakville', 'Burlington', 'Greater Sudbury', 'Oshawa'
];

const PROPERTY_TYPES = [
  'Condos', 'Townhouses', 'Detached', 'Semi-detached', 'Business real estate', 'Land/plots'
];

export default function AdminAgentDetails() {
  const { id } = useParams<{ id: string }>();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdmin = async () => {
      const user = auth.currentUser;
      if (!user || user.email !== 'admin@leistly.com') {
        navigate('/');
        return;
      }

      if (id) {
        try {
          const agentDoc = await getDoc(doc(db, 'agents', id));
          if (agentDoc.exists()) {
            setAgent(agentDoc.data() as Agent);
          } else {
            navigate('/admin');
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `agents/${id}`);
        }
      }
      setLoading(false);
    };

    checkAdmin();
  }, [id, navigate]);

  const toggleLicense = async () => {
    if (!agent || !id) return;
    try {
      const newStatus = !agent.licenseVerified;
      await updateDoc(doc(db, 'agents', id), {
        licenseVerified: newStatus,
        licenseStatus: newStatus ? 'valid' : 'pending'
      });
      setAgent({ ...agent, licenseVerified: newStatus, licenseStatus: newStatus ? 'valid' : 'pending' });
      setMessage({ type: 'success', text: `License ${newStatus ? 'verified' : 'unverified'} successfully.` });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `agents/${id}`);
    }
  };

  const toggleAccess = async () => {
    if (!agent || !id) return;
    try {
      const newStatus = !agent.isAccessEnabled;
      await updateDoc(doc(db, 'agents', id), {
        isAccessEnabled: newStatus
      });
      setAgent({ ...agent, isAccessEnabled: newStatus });
      setMessage({ type: 'success', text: `Access ${newStatus ? 'enabled' : 'disabled'} successfully.` });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `agents/${id}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-honey"></div>
      </div>
    );
  }

  if (!agent) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin')}
            className="p-3 rounded-2xl bg-white border border-zinc-100 hover:bg-zinc-50 transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5 text-midnight" />
          </button>
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-midnight tracking-tight">Agent Details</h1>
            <p className="text-charcoal/60">Reviewing profile for {agent.name}</p>
          </div>
        </div>

        {message.text && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`px-6 py-3 rounded-2xl text-sm font-bold shadow-sm border ${
              message.type === 'success' ? 'bg-sage/10 text-sage border-sage/20' : 'bg-red-50 text-red-500 border-red-100'
            }`}
          >
            {message.text}
          </motion.div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Basic Info Card */}
          <div className="bg-white rounded-[2.5rem] p-8 border border-zinc-100 shadow-sm space-y-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-honey/10 flex items-center justify-center">
                <User className="w-6 h-6 text-honey" />
              </div>
              <h2 className="text-xl font-black text-midnight tracking-tight">Profile Information</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-midnight/40 uppercase tracking-[0.2em] ml-1">Full Name</label>
                <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100 font-bold text-midnight">
                  {agent.name}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-midnight/40 uppercase tracking-[0.2em] ml-1">Email Address</label>
                <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100 font-bold text-midnight flex items-center gap-2">
                  <Mail className="w-4 h-4 text-midnight/20" />
                  {agent.email}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-midnight/40 uppercase tracking-[0.2em] ml-1">Phone Number</label>
                <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100 font-bold text-midnight flex items-center gap-2">
                  <Phone className="w-4 h-4 text-midnight/20" />
                  {agent.phone || 'Not provided'}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-midnight/40 uppercase tracking-[0.2em] ml-1">License Number</label>
                <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100 font-bold text-midnight">
                  {agent.licenseNumber}
                </div>
              </div>
            </div>
          </div>

          {/* Specialization Card */}
          <div className="bg-white rounded-[2.5rem] p-8 border border-zinc-100 shadow-sm space-y-8">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-midnight/5 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-midnight" />
                </div>
                <h3 className="text-lg font-black text-midnight tracking-tight">Service Areas</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {agent.specializedCities?.length ? agent.specializedCities.map(city => (
                  <span key={city} className="px-4 py-2 rounded-xl bg-zinc-50 border border-zinc-100 text-sm font-bold text-midnight">
                    {city}
                  </span>
                )) : <p className="text-sm text-charcoal/40 italic">No cities selected</p>}
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-midnight/5 flex items-center justify-center">
                  <Home className="w-5 h-5 text-midnight" />
                </div>
                <h3 className="text-lg font-black text-midnight tracking-tight">Property Types</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {agent.propertyTypes?.length ? agent.propertyTypes.map(type => (
                  <span key={type} className="px-4 py-2 rounded-xl bg-zinc-50 border border-zinc-100 text-sm font-bold text-midnight">
                    {type}
                  </span>
                )) : <p className="text-sm text-charcoal/40 italic">No property types selected</p>}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Admin Actions Card */}
          <div className="bg-white rounded-[2.5rem] p-8 border border-zinc-100 shadow-sm space-y-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-midnight/5 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-midnight" />
              </div>
              <h3 className="text-lg font-black text-midnight tracking-tight">Admin Actions</h3>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black uppercase tracking-widest text-midnight/40">License Status</span>
                  <span className={`text-xs font-black uppercase tracking-widest ${agent.licenseVerified ? 'text-sage' : 'text-honey'}`}>
                    {agent.licenseStatus}
                  </span>
                </div>
                <button
                  onClick={toggleLicense}
                  className={`w-full py-4 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 ${
                    agent.licenseVerified 
                      ? 'bg-sage/10 text-sage hover:bg-sage/20' 
                      : 'bg-honey text-white hover:bg-honey/90 shadow-lg shadow-honey/20'
                  }`}
                >
                  {agent.licenseVerified ? <BadgeCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                  {agent.licenseVerified ? 'Revoke Verification' : 'Verify License'}
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black uppercase tracking-widest text-midnight/40">Platform Access</span>
                  <span className={`text-xs font-black uppercase tracking-widest ${agent.isAccessEnabled ? 'text-midnight' : 'text-red-500'}`}>
                    {agent.isAccessEnabled ? 'Active' : 'Suspended'}
                  </span>
                </div>
                <button
                  onClick={toggleAccess}
                  className={`w-full py-4 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 ${
                    agent.isAccessEnabled 
                      ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                      : 'bg-midnight text-white hover:bg-midnight/90 shadow-lg shadow-midnight/20'
                  }`}
                >
                  {agent.isAccessEnabled ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                  {agent.isAccessEnabled ? 'Disable Access' : 'Enable Access'}
                </button>
              </div>
            </div>
          </div>

          {/* Subscription Info */}
          <div className="bg-midnight rounded-[2.5rem] p-8 text-white space-y-6 shadow-xl shadow-midnight/20">
            <h3 className="font-black tracking-tight">Subscription Info</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-white/40 text-xs font-black uppercase tracking-widest">Tier</span>
                <span className="font-black uppercase text-honey">{agent.subscriptionTier}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/40 text-xs font-black uppercase tracking-widest">Joined</span>
                <span className="font-bold">{new Date(agent.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/40 text-xs font-black uppercase tracking-widest">Trial End</span>
                <span className="font-bold">{agent.trialEndDate ? new Date(agent.trialEndDate).toLocaleDateString() : 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
