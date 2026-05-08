import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import { Agent } from '../types';
import { motion } from 'motion/react';
import { User, Mail, Phone, FileText, MapPin, Home, Save, AlertCircle, ShieldCheck, Trash2, RefreshCw } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../utils/firestore-errors';
import AgentDocuments from '../components/AgentDocuments';

const ONTARIO_CITIES = [
  'Toronto', 'Ottawa', 'Mississauga', 'Brampton', 'Hamilton', 
  'London', 'Markham', 'Vaughan', 'Kitchener', 'Windsor',
  'Richmond Hill', 'Oakville', 'Burlington', 'Greater Sudbury', 'Oshawa'
];

const PROPERTY_TYPES = [
  'Condos', 'Townhouses', 'Detached', 'Semi-detached', 'Business real estate', 'Land/plots'
];

export default function Profile() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [selectedPropertyTypes, setSelectedPropertyTypes] = useState<string[]>([]);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [agentDocuments, setAgentDocuments] = useState<Record<string, { url: string; name: string; uploadedAt: string }>>({});
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const agentDoc = await getDoc(doc(db, 'agents', user.uid));
          if (agentDoc.exists()) {
            const data = agentDoc.data() as Agent;
            setAgent(data);
            setName(data.name);
            setPhone(data.phone);
            setSelectedCities(data.specializedCities || []);
            setSelectedPropertyTypes(data.propertyTypes || []);
            setAgentDocuments(data.documents || {});
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `agents/${user.uid}`);
        }
      } else {
        navigate('/login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agent) return;
    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      await updateDoc(doc(db, 'agents', agent.uid), {
        name,
        phone,
        specializedCities: selectedCities,
        propertyTypes: selectedPropertyTypes,
      });
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `agents/${agent.uid}`);
      setMessage({ type: 'error', text: 'Failed to update profile.' });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleCity = (city: string) => {
    setSelectedCities(prev => 
      prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city]
    );
  };

  const togglePropertyType = (type: string) => {
    setSelectedPropertyTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleClearCache = () => {
    if (window.confirm('This will clear your local application cache and reload the page. Continue?')) {
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-honey"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-midnight">Agent Profile</h1>
        {message.text && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`px-4 py-2 rounded-xl text-sm font-bold ${
              message.type === 'success' ? 'bg-sage/10 text-sage' : 'bg-red-50 text-red-500'
            }`}
          >
            {message.text}
          </motion.div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="card-container p-8 space-y-6">
            <h2 className="text-xl font-bold text-midnight flex items-center gap-2">
              <User className="w-5 h-5 text-honey" /> Basic Information
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-charcoal/60 uppercase tracking-widest">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-charcoal/60 uppercase tracking-widest">Email Address</label>
                <input
                  type="email"
                  disabled
                  value={agent?.email || ''}
                  className="input-field bg-zinc-50 cursor-not-allowed opacity-70"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-charcoal/60 uppercase tracking-widest">Phone Number</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input-field"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-charcoal/60 uppercase tracking-widest">License Number</label>
                <div className="relative">
                  <input
                    type="text"
                    disabled
                    value={agent?.licenseNumber || ''}
                    className="input-field bg-zinc-50 cursor-not-allowed opacity-70"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 group">
                    <AlertCircle className="w-4 h-4 text-charcoal/20 cursor-help" />
                    <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-midnight text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      License number is locked. Contact admin@leistly.com to update.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card-container p-8 space-y-8">
            <div className="space-y-4">
              <label className="text-sm font-bold text-midnight flex items-center gap-2 uppercase tracking-widest">
                <MapPin className="w-4 h-4 text-honey" /> Specialized Cities
              </label>
              <div className="flex flex-wrap gap-2">
                {ONTARIO_CITIES.map(city => (
                  <button
                    key={city}
                    type="button"
                    onClick={() => toggleCity(city)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                      selectedCities.includes(city)
                        ? 'bg-midnight text-white border-midnight'
                        : 'bg-white text-charcoal/60 border-zinc-200 hover:border-honey/50'
                    }`}
                  >
                    {city}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-sm font-bold text-midnight flex items-center gap-2 uppercase tracking-widest">
                <Home className="w-4 h-4 text-honey" /> Property Specialization
              </label>
              <div className="flex flex-wrap gap-2">
                {PROPERTY_TYPES.map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => togglePropertyType(type)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                      selectedPropertyTypes.includes(type)
                        ? 'bg-midnight text-white border-midnight'
                        : 'bg-white text-charcoal/60 border-zinc-200 hover:border-honey/50'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card-container p-6 space-y-6">
            <h3 className="font-bold text-midnight">Account Status</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-charcoal/60">Subscription</span>
                <span className="font-bold text-honey uppercase">{agent?.subscriptionTier}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-charcoal/60">License Status</span>
                <span className={`font-bold uppercase ${
                  agent?.licenseStatus === 'valid' ? 'text-sage' :
                  agent?.licenseStatus === 'pending' ? 'text-honey' : 'text-red-500'
                }`}>{agent?.licenseStatus}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-charcoal/60">Trial Ends</span>
                <span className="font-bold text-midnight">
                  {agent?.trialEndDate ? new Date(agent.trialEndDate).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full py-4 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          <div className="card-container p-6 space-y-4 border-red-100 bg-red-50/10">
            <h3 className="font-bold text-midnight flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-red-500" /> Troubleshooting
            </h3>
            <p className="text-xs text-charcoal/60 leading-relaxed">
              If you're experiencing issues with stale data or UI glitches, clearing the local application cache may help.
            </p>
            <button
              type="button"
              onClick={handleClearCache}
              className="w-full py-3 px-4 rounded-xl border border-red-200 text-red-600 text-xs font-black uppercase tracking-widest hover:bg-red-50 transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Clear Application Cache
            </button>
          </div>

          <div className="p-6 rounded-3xl bg-honey/5 border border-honey/10">
            <p className="text-xs text-charcoal/60 leading-relaxed">
              Need to update your license number or email? Please contact our support team at{' '}
              <a href="mailto:admin@leistly.com" className="text-honey font-bold hover:underline">
                admin@leistly.com
              </a>
            </p>
          </div>
        </div>
      </form>

      {/* Agent Documents section — below the main form */}
      <div className="card-container p-8">
        <AgentDocuments
          agentDocuments={agentDocuments}
          onUpdate={setAgentDocuments}
        />
      </div>
    </div>
  );
}
