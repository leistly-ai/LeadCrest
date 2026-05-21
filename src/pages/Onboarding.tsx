import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, setDoc, getDocFromServer } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { Agent } from '../types';
import { motion } from 'motion/react';
import { User, Mail, Phone, FileText, MapPin, Home, Info, ArrowRight, CheckCircle2, LogOut } from 'lucide-react';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const ONTARIO_CITIES = [
  'Toronto', 'Ottawa', 'Mississauga', 'Brampton', 'Hamilton', 
  'London', 'Markham', 'Vaughan', 'Kitchener', 'Windsor',
  'Richmond Hill', 'Oakville', 'Burlington', 'Greater Sudbury', 'Oshawa'
];

const PROPERTY_TYPES = [
  'Condos', 'Townhouses', 'Detached', 'Semi-detached', 'Business real estate', 'Land/plots'
];

export default function Onboarding() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [licenseNumber, setLicenseNumber] = useState('');
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [selectedPropertyTypes, setSelectedPropertyTypes] = useState<string[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const path = `agents/${user.uid}`;
          let agentDoc;
          try {
            agentDoc = await getDoc(doc(db, 'agents', user.uid));
          } catch (err) {
            handleFirestoreError(err, OperationType.GET, path);
          }
          
          if (agentDoc && agentDoc.exists()) {
            const data = agentDoc.data() as Agent;
            console.log('[Onboarding] Agent data loaded:', data);
            if (data.isOnboarded) {
              navigate('/dashboard');
              return;
            }
            setAgent(data);
            setLicenseNumber(data.licenseNumber || '');
            setSelectedCities(data.specializedCities || []);
            setSelectedPropertyTypes(data.propertyTypes || []);
          } else {
            console.log('[Onboarding] Agent document missing, creating default profile...');
            // Create default profile if missing
            const trialEndDate = new Date();
            trialEndDate.setDate(trialEndDate.getDate() + 30);
            
            const newAgent: Agent = {
              uid: user.uid,
              name: user.displayName || 'New Agent',
              email: user.email || '',
              phone: user.phoneNumber || '',
              subscriptionTier: 'free',
              trialEndDate: trialEndDate.toISOString(),
              isOnboarded: false,
              isAccessEnabled: true,
              licenseVerified: false,
              licenseStatus: 'pending',
              createdAt: new Date().toISOString(),
            };
            
            try {
              await setDoc(doc(db, 'agents', user.uid), newAgent);
            } catch (err) {
              handleFirestoreError(err, OperationType.WRITE, path);
            }
            setAgent(newAgent);
          }
        } catch (err: any) {
          console.error('[Onboarding] Error loading/creating agent profile:', err);
          setError('Failed to load your profile. Please check your connection.');
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
    setError(null);
    if (!agent) {
      setError('Agent profile not found. Please try logging out and back in.');
      return;
    }
    setSubmitting(true);

    try {
      console.log('Attempting to update agent profile:', agent.uid);
      await updateDoc(doc(db, 'agents', agent.uid), {
        licenseNumber,
        specializedCities: selectedCities,
        propertyTypes: selectedPropertyTypes,
        isOnboarded: true,
        licenseStatus: 'pending'
      });
      console.log('Profile updated successfully, navigating...');
      navigate('/license-splash');
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.message || 'Failed to update profile. Please check your connection and try again.');
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

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-honey"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-container p-8 md:p-12 space-y-10"
      >
        <div className="space-y-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-honey/10 text-honey text-xs font-bold uppercase tracking-wider">
            <User className="w-3 h-3" />
            Step 2: Complete Your Profile
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-midnight">Welcome to LeadCrest</h1>
          <p className="text-charcoal/60 max-w-md mx-auto">
            Tell us a bit more about your expertise. This information helps our AI qualify your leads with much higher precision.
          </p>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-3xl bg-red-50 border border-red-100 space-y-4"
          >
            <p className="text-red-600 text-sm font-medium">{error}</p>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 transition-all uppercase tracking-wider"
            >
              <LogOut className="w-3 h-3" />
              Sign Out & Try Again
            </button>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-10">
          {/* Basic Info (Read-only) */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-midnight flex items-center gap-2">
                <User className="w-4 h-4 text-honey" /> Full Name
              </label>
              <input
                type="text"
                disabled
                value={agent?.name || ''}
                className="input-field bg-zinc-50 cursor-not-allowed opacity-70"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-midnight flex items-center gap-2">
                <Mail className="w-4 h-4 text-honey" /> Email Address
              </label>
              <input
                type="email"
                disabled
                value={agent?.email || ''}
                className="input-field bg-zinc-50 cursor-not-allowed opacity-70"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-midnight flex items-center gap-2">
                <Phone className="w-4 h-4 text-honey" /> Phone Number
              </label>
              <input
                type="text"
                disabled
                value={agent?.phone || ''}
                className="input-field bg-zinc-50 cursor-not-allowed opacity-70"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-midnight flex items-center gap-2">
                <FileText className="w-4 h-4 text-honey" /> License Number *
              </label>
              <input
                type="text"
                required
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                className="input-field focus:ring-honey/20"
                placeholder="RE-12345678"
              />
              <p className="text-[10px] text-charcoal/40 italic">
                * Mandatory. Cannot be changed later without support.
              </p>
            </div>
          </div>

          {/* Specialization */}
          <div className="space-y-8 pt-6 border-t border-zinc-100">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-midnight flex items-center gap-2 uppercase tracking-widest">
                  <MapPin className="w-4 h-4 text-honey" /> Specialized Cities (Ontario)
                </label>
                <span className="text-[10px] font-bold text-charcoal/40 uppercase">Optional</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {ONTARIO_CITIES.map(city => (
                  <button
                    key={city}
                    type="button"
                    onClick={() => toggleCity(city)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
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
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-midnight flex items-center gap-2 uppercase tracking-widest">
                  <Home className="w-4 h-4 text-honey" /> Property Specialization
                </label>
                <span className="text-[10px] font-bold text-charcoal/40 uppercase">Optional</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {PROPERTY_TYPES.map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => togglePropertyType(type)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
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

          {/* AI Info Note */}
          <div className="p-6 rounded-3xl bg-sage/5 border border-sage/20 flex gap-4">
            <div className="w-10 h-10 rounded-2xl bg-sage/20 flex items-center justify-center shrink-0">
              <Info className="w-5 h-5 text-sage" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-midnight">AI Optimization</p>
              <p className="text-xs text-charcoal/70 leading-relaxed">
                Entering your specialization details allows our AI to better understand your market and qualify leads based on your specific expertise.
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full py-5 flex items-center justify-center gap-3 disabled:opacity-50 text-lg"
          >
            {submitting ? 'Saving Profile...' : 'Complete Registration'}
            {!submitting && <ArrowRight className="w-6 h-6" />}
          </button>
        </form>

        <div className="text-center">
          <p className="text-xs text-charcoal/40">
            Need to change your license number later? Contact{' '}
            <a href="mailto:admin@leistly.com" className="text-honey font-bold hover:underline">
              admin@leistly.com
            </a>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
