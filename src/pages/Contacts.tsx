import React, { useEffect, useState } from 'react';
import { collection, addDoc, doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Agent, Lead } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  User,
  Mail,
  Phone,
  ExternalLink,
  RefreshCw,
  Filter,
  UserPlus,
  CheckCircle2,
  XCircle,
  Settings,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

import Integrations from '../components/Integrations';
import { handleFirestoreError, OperationType } from '../utils/firestore-errors';

export default function Contacts() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [addingLead, setAddingLead] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showIntegrations, setShowIntegrations] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubscribe = onSnapshot(doc(db, 'agents', auth.currentUser.uid), (doc) => {
      if (doc.exists()) {
        setAgent({ uid: doc.id, ...doc.data() } as Agent);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `agents/${auth.currentUser?.uid}`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSyncNow = async () => {
    if (!agent) return;
    setSyncing(true);
    setSyncError(null);
    try {
      const response = await fetch('/api/auth/google/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: agent.uid })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sync contacts');
      }

      setSuccessMessage('Contacts synced successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      console.error('Manual Sync Error:', error);
      setSyncError(error.message || 'An unexpected error occurred during sync.');
    } finally {
      setSyncing(false);
    }
  };

  const handleAddToLeads = async (contact: any) => {
    if (!auth.currentUser) return;

    setAddingLead(contact.resourceName);
    try {
      const name = contact.names?.[0]?.displayName || 'Unnamed Contact';
      const email = contact.emailAddresses?.[0]?.value || '';
      const phone = contact.phoneNumbers?.[0]?.value || '';

      const newLead: Omit<Lead, 'id'> = {
        agentId: auth.currentUser.uid,
        name,
        email,
        phone,
        currentAddress: '',
        type: 'rent',
        timeline: '',
        budget: '',
        preApproved: '',
        downPaymentReady: '',
        locationPreference: '',
        motivation: '',
        score: 50,
        status: 'cold',
        source: 'contacts',
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'leads'), newLead);
      setSuccessMessage(`Added ${name} to Leads`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error adding lead:', error);
    } finally {
      setAddingLead(null);
    }
  };

  const contacts = agent?.googleContacts || [];
  const filteredContacts = contacts.filter((contact: any) => {
    if (!contact) return false;
    const name = contact.names?.[0]?.displayName?.toLowerCase() || '';
    const email = contact.emailAddresses?.[0]?.value?.toLowerCase() || '';
    const phone = contact.phoneNumbers?.[0]?.value?.toLowerCase() || '';
    const search = searchTerm.toLowerCase();
    return name.includes(search) || email.includes(search) || phone.includes(search);
  });

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-honey"></div>
      </div>
    );
  }

  if (!agent?.googleContactsConnected) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 py-12">
        <div className="text-center space-y-4 mb-12">
          <h1 className="text-4xl font-black text-midnight tracking-tight">Contact Sync</h1>
          <p className="text-charcoal/60 max-w-xl mx-auto">Connect your Google account to sync your contacts and manage them directly from LeadCrest.</p>
        </div>

        {agent && (
          <Integrations
            agent={agent}
            onUpdate={(updatedAgent) => setAgent(updatedAgent)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black text-midnight tracking-tight">Google Contacts</h1>
            <span className="px-3 py-1 bg-sage/10 text-sage rounded-full text-[10px] font-black uppercase tracking-widest">
              {contacts.length} Total
            </span>
          </div>
          <p className="text-charcoal/60">View and manage your synced contacts from {agent.googleEmail}.</p>
        </div>

        <div className="flex items-center gap-3">
          {syncError && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="px-4 py-2 bg-red-50 text-red-600 text-xs font-bold rounded-lg border border-red-100 flex items-center gap-2"
            >
              <XCircle className="w-4 h-4" />
              {syncError}
            </motion.div>
          )}
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="px-4 py-2 bg-sage/10 text-sage text-xs font-bold rounded-lg border border-sage/20 flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              {successMessage}
            </motion.div>
          )}
          <button
            onClick={() => setShowIntegrations(!showIntegrations)}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl font-black transition-all shadow-sm border-2 ${
              showIntegrations
                ? 'bg-midnight text-white border-midnight'
                : 'bg-white text-midnight border-zinc-100 hover:bg-zinc-50'
            }`}
          >
            <Settings className="w-4 h-4" />
            {showIntegrations ? 'Hide Settings' : 'Manage Connection'}
          </button>
          <button
            onClick={handleSyncNow}
            disabled={syncing}
            className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-zinc-100 text-midnight font-black rounded-xl hover:bg-zinc-50 transition-all disabled:opacity-50 shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showIntegrations && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white rounded-[32px] border-2 border-zinc-100 shadow-sm mb-8">
              <Integrations
                agent={agent}
                onUpdate={(updatedAgent) => setAgent(updatedAgent)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-charcoal/30" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border-2 border-zinc-100 rounded-2xl focus:border-honey outline-none transition-all font-bold text-midnight shadow-sm"
          />
        </div>
        <div className="flex items-center gap-2 px-4 py-4 bg-white border-2 border-zinc-100 rounded-2xl shadow-sm">
          <Filter className="w-5 h-5 text-charcoal/30" />
          <span className="text-sm font-bold text-charcoal/60 uppercase tracking-widest">Filter by:</span>
          <select className="bg-transparent font-black text-midnight outline-none cursor-pointer">
            <option>All Contacts</option>
            <option>Recent Synced</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredContacts.length > 0 ? (
          filteredContacts.map((contact: any, idx: number) => (
            <motion.div
              key={contact.resourceName || idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="group bg-white p-6 rounded-3xl border-2 border-zinc-100 hover:border-honey/50 transition-all shadow-sm hover:shadow-xl hover:shadow-honey/5"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-midnight/5 rounded-2xl flex items-center justify-center group-hover:bg-honey/10 transition-colors overflow-hidden">
                  {contact.photos?.[0]?.url ? (
                    <img
                      src={contact.photos[0].url}
                      alt={contact.names?.[0]?.displayName || 'Contact'}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <User className="w-6 h-6 text-midnight/40 group-hover:text-honey transition-colors" />
                  )}
                </div>
                <button className="p-2 hover:bg-zinc-50 rounded-xl transition-colors">
                  <ExternalLink className="w-4 h-4 text-charcoal/30" />
                </button>
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-black text-midnight truncate">
                  {contact.names?.[0]?.displayName || 'Unnamed Contact'}
                </h3>
                <div className="flex items-center gap-2 text-charcoal/60">
                  <Mail className="w-3 h-3" />
                  <p className="text-xs font-medium truncate">
                    {contact.emailAddresses?.[0]?.value || 'No email provided'}
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-zinc-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-sage rounded-full" />
                  <span className="text-[10px] font-black text-sage uppercase tracking-widest">Synced</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleAddToLeads(contact)}
                    disabled={addingLead === contact.resourceName}
                    className="flex items-center gap-1.5 text-[10px] font-black text-honey uppercase tracking-widest hover:underline disabled:opacity-50"
                  >
                    <UserPlus className="w-3 h-3" />
                    {addingLead === contact.resourceName ? 'Adding...' : 'Add to Leads'}
                  </button>
                  <button className="text-[10px] font-black text-midnight/40 uppercase tracking-widest hover:underline">
                    Invite
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="col-span-full py-20 text-center bg-zinc-50 rounded-[32px] border-2 border-dashed border-zinc-200">
            <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <RefreshCw className="w-8 h-8 text-zinc-300" />
            </div>
            <h3 className="text-lg font-bold text-midnight">No contacts found</h3>
            <p className="text-sm text-charcoal/60 max-w-xs mx-auto mt-1">
              {searchTerm
                ? `No contacts matching "${searchTerm}"`
                : "Your Google Contacts sync is active but no contacts were found. Try adding some contacts to your Google account and sync again."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
