import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GoogleAuthProvider, signInWithPopup, getAdditionalUserInfo } from 'firebase/auth';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { RefreshCw, CheckCircle2, XCircle, ExternalLink, Mail, Shield, X } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../utils/firestore-errors';
import { Agent } from '../types';

interface IntegrationsProps {
  agent: Agent;
  onUpdate: (updatedAgent: Agent) => void;
}

export default function Integrations({ agent, onUpdate }: IntegrationsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const syncStatus = searchParams.get('sync');
    if (syncStatus === 'success') {
      searchParams.delete('sync');
      setSearchParams(searchParams);
    } else if (syncStatus === 'error') {
      searchParams.delete('sync');
      setSearchParams(searchParams);
      alert('Failed to connect Google Contacts. Please try again.');
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (agent.googleContactsConnected && showPrivacyModal) {
      setShowPrivacyModal(false);
    }
  }, [agent.googleContactsConnected, showPrivacyModal]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        onUpdate({
          ...agent,
          googleContactsConnected: true,
          lastSyncAt: new Date().toISOString()
        });
        setShowPrivacyModal(false);
        setLoading(false);
      } else if (event.data?.type === 'GOOGLE_AUTH_ERROR') {
        setError(event.data.error || 'Authentication failed');
        setLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [agent, onUpdate]);

  const fetchAndSaveContacts = async (accessToken: string) => {
    try {
      const response = await fetch('https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers,photos&pageSize=1000', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch contacts from Google');
      }

      const data = await response.json();
      const connections = data.connections || [];

      // Save to backend
      const saveResponse = await fetch('/api/contacts/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          uid: agent.uid,
          contacts: connections
        })
      });

      if (!saveResponse.ok) {
        throw new Error('Failed to save contacts to dashboard');
      }

      const saveData = await saveResponse.json();
      
      onUpdate({
        ...agent,
        googleContactsConnected: true,
        googleContacts: connections,
        lastSyncAt: saveData.lastSyncAt
      });

    } catch (err: any) {
      console.error('Sync error:', err);
      setError(err.message || 'Failed to sync contacts');
    }
  };

  const handleConnectGoogle = async () => {
    if (!agent?.uid) {
      setError('Missing User ID. Please refresh and try again.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const accessToken = credential?.accessToken;

      if (!accessToken) {
        throw new Error('Failed to obtain Google access token');
      }

      console.log('[Auth] Google Sign-In Successful, fetching contacts...');

      // Update local state email
      onUpdate({
        ...agent,
        googleEmail: result.user.email || '',
      });

      await fetchAndSaveContacts(accessToken);
      setShowPrivacyModal(false);

    } catch (error: any) {
      console.error('Google Auth Error:', error);
      setError(error.message || 'Failed to connect Google Contacts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!agent?.uid) {
      setError('Missing User ID. Please refresh and try again.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/google/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: agent.uid })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || data.error || `Failed to disconnect (Status: ${response.status})`);
      }

      onUpdate({
        ...agent,
        googleContactsConnected: false,
        googleEmail: '',
        googleContacts: undefined,
        lastSyncAt: undefined
      });
    } catch (error: any) {
      console.error('Disconnect Error:', error);
      setError(error.message || 'Failed to disconnect. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncNow = async () => {
    setLoading(true);
    setError(null);
    try {
      // Retrigger auth to get fresh token as requested
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const accessToken = credential?.accessToken;

      if (!accessToken) {
        throw new Error('Failed to obtain Google access token');
      }

      await fetchAndSaveContacts(accessToken);
    } catch (error: any) {
      console.error('Manual Sync Error:', error);
      setError(error.message || 'Failed to sync contacts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card-container p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center border border-zinc-100">
            <img 
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
              className="w-6 h-6" 
              alt="Google" 
            />
          </div>
          <div>
            <h3 className="text-lg font-bold text-midnight">Google Contacts Sync</h3>
            <p className="text-sm text-charcoal/60">Autofill invite lists and contact details automatically.</p>
            {agent.googleContactsConnected && (
              <div className="flex flex-col gap-2 mt-2">
                <div className="flex items-center gap-2 px-2 py-1 bg-sage/10 rounded-lg w-fit">
                  <div className="w-1.5 h-1.5 bg-sage rounded-full animate-pulse" />
                  <p className="text-[10px] text-sage font-bold uppercase tracking-widest">
                    Connected & Active
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-2 p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                  <div>
                    <p className="text-[10px] text-charcoal/40 font-bold uppercase tracking-widest mb-1">
                      Total Contacts
                    </p>
                    <p className="text-xl font-bold text-midnight">
                      {agent.googleContacts?.length || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-charcoal/40 font-bold uppercase tracking-widest mb-1">
                      Last Sync
                    </p>
                    <p className="text-xs font-medium text-midnight">
                      {agent.lastSyncAt ? new Date(agent.lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {agent.googleContactsConnected ? (
            <div className="flex items-center gap-4">
              <button
                onClick={handleSyncNow}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-1.5 bg-honey/10 text-honey rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-honey/20 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                Sync Now
              </button>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-sage/10 text-sage rounded-full text-[10px] font-black uppercase tracking-widest">
                <CheckCircle2 className="w-3 h-3" />
                Connected
              </div>
            </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 text-charcoal/40 rounded-full text-[10px] font-black uppercase tracking-widest">
            <XCircle className="w-3 h-3" />
            Not Connected
          </div>
        )}
      </div>

      <div className="p-6 rounded-3xl bg-zinc-50 border border-zinc-100 space-y-4">
        {agent.googleContactsConnected ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-midnight/5 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-midnight/40" />
                </div>
                <div>
                  <p className="text-xs font-black text-midnight/40 uppercase tracking-widest">Connected Account</p>
                  <p className="text-sm font-bold text-midnight">{agent.googleEmail}</p>
                </div>
              </div>
              <button
                onClick={handleDisconnect}
                disabled={loading}
                className="text-xs font-black text-red-500 hover:text-red-600 uppercase tracking-widest transition-colors flex items-center gap-2"
              >
                {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Disconnect'}
              </button>
            </div>
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 font-bold text-xs">
                <XCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col items-center text-center space-y-4 py-4">
              <div className="w-16 h-16 bg-honey/10 rounded-full flex items-center justify-center">
                <Shield className="w-8 h-8 text-honey" />
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-bold text-midnight">Connect Google Contacts</h4>
                <p className="text-sm text-charcoal/60">Sync your contacts to LeadCrest securely.</p>
              </div>
              <button
                onClick={() => setShowPrivacyModal(true)}
                disabled={loading}
                className="w-full py-4 rounded-2xl bg-white border-2 border-zinc-100 hover:border-honey/50 hover:bg-zinc-50 transition-all flex items-center justify-center gap-3 font-black text-midnight shadow-sm"
              >
                {loading ? (
                  <RefreshCw className="w-5 h-5 animate-spin text-honey" />
                ) : (
                  <>
                    <img 
                      src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
                      className="w-5 h-5" 
                      alt="Google" 
                    />
                    Connect Google Contacts
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showPrivacyModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPrivacyModal(false)}
              className="absolute inset-0 bg-midnight/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-honey/10 rounded-2xl flex items-center justify-center">
                      <Shield className="w-5 h-5 text-honey" />
                    </div>
                    <h3 className="text-xl font-black text-midnight uppercase tracking-tighter">Privacy & Permissions</h3>
                  </div>
                  <button 
                    onClick={() => setShowPrivacyModal(false)}
                    className="p-2 hover:bg-zinc-50 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5 text-charcoal/40" />
                  </button>
                </div>

                <div className="space-y-4 text-sm text-charcoal/70 leading-relaxed">
                  {error && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 font-bold text-xs">
                      <XCircle className="w-4 h-4 shrink-0" />
                      {error}
                    </div>
                  )}
                  <p>
                    To enable contact syncing, <strong>LeadCrest</strong> will request access to your Google Contacts via the Google People API.
                  </p>
                  <div className="space-y-3 p-5 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <p>
                      <strong className="text-midnight">What we collect:</strong> We access your contacts' names, email addresses, phone numbers, and profile photos.
                    </p>
                    <p>
                      <strong className="text-midnight">How we use it:</strong> This data is used exclusively to help you identify existing relationships in your lead pipeline and autofill contact details.
                    </p>
                    <p>
                      <strong className="text-midnight">Data Storage:</strong> We do not sell your contact data to third parties. Your data is stored securely and only used to provide the features you see on this screen.
                    </p>
                  </div>
                  <p className="text-xs pt-2">
                    By clicking "Connect," you agree to our <Link to="/privacy" className="text-honey font-bold hover:underline">Privacy Policy</Link> and specifically authorize access to your Google Contacts. Our use of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.
                  </p>
                </div>

                <button
                  onClick={handleConnectGoogle}
                  disabled={loading}
                  className="w-full py-4 rounded-2xl bg-midnight text-white hover:bg-midnight/90 transition-all flex items-center justify-center gap-3 font-black shadow-lg shadow-midnight/20"
                >
                  {loading ? (
                    <RefreshCw className="w-5 h-5 animate-spin text-honey" />
                  ) : (
                    <>
                      <img 
                        src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
                        className="w-5 h-5" 
                        alt="Google" 
                      />
                      Connect Google Contacts
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex items-start gap-3 p-4 rounded-2xl bg-honey/5 border border-honey/10">
        <ExternalLink className="w-4 h-4 text-honey shrink-0 mt-0.5" />
        <p className="text-[10px] text-charcoal/60 leading-relaxed">
          <strong>Privacy Note:</strong> LeadCrest only requests read-only access to your contacts. We do not store your contacts on our servers unless you explicitly save a lead. Your data is protected by industry-standard encryption.
        </p>
      </div>
    </div>
  );
}
