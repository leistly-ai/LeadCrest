import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { motion } from 'motion/react';
import { Users, ShieldCheck, ShieldAlert, CreditCard, Search, Filter, CheckCircle2, XCircle, Power, PowerOff, BadgeCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Agent } from '../types';
import { handleFirestoreError, OperationType } from '../utils/firestore-errors';

interface Payment {
  id: string;
  agentId: string;
  agentName: string;
  amount: number;
  status: string;
  planId: string;
  createdAt: string;
}

export default function AdminDashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'agents' | 'payments'>('agents');
  const navigate = useNavigate();

  useEffect(() => {
    const user = auth.currentUser;
    if (!user || user.email !== 'admin@leistly.com') {
      navigate('/');
      return;
    }

    const agentsQuery = query(collection(db, 'agents'), orderBy('createdAt', 'desc'));
    const paymentsQuery = query(collection(db, 'payments'), orderBy('createdAt', 'desc'));

    const unsubAgents = onSnapshot(agentsQuery, (snapshot) => {
      setAgents(snapshot.docs.map(doc => ({ ...doc.data() } as Agent)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'agents');
    });

    const unsubPayments = onSnapshot(paymentsQuery, (snapshot) => {
      setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'payments');
    });

    return () => {
      unsubAgents();
      unsubPayments();
    };
  }, [navigate]);

  const toggleLicense = async (agentId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'agents', agentId), {
        licenseVerified: !currentStatus,
        licenseStatus: !currentStatus ? 'valid' : 'pending'
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `agents/${agentId}`);
    }
  };

  const toggleAccess = async (agentId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'agents', agentId), {
        isAccessEnabled: !currentStatus
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `agents/${agentId}`);
    }
  };

  const filteredAgents = agents.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-honey"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-midnight tracking-tight">Admin Control Center</h1>
          <p className="text-charcoal/60">Manage agents, verify licenses, and monitor transactions.</p>
        </div>

        <div className="flex items-center gap-2 bg-zinc-100 p-1 rounded-2xl">
          <button
            onClick={() => setActiveTab('agents')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'agents' ? 'bg-white text-midnight shadow-sm' : 'text-charcoal/40 hover:text-charcoal'
            }`}
          >
            Agents
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'payments' ? 'bg-white text-midnight shadow-sm' : 'text-charcoal/40 hover:text-charcoal'
            }`}
          >
            Transactions
          </button>
        </div>
      </div>

      {activeTab === 'agents' ? (
        <div className="space-y-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-charcoal/40" />
            <input
              type="text"
              placeholder="Search agents by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border border-zinc-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-honey/20 focus:border-honey outline-none transition-all"
            />
          </div>

          <div className="bg-white rounded-[2.5rem] border border-zinc-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50/50 border-b border-zinc-100">
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">Agent</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">Plan</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">License</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">Access</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {filteredAgents.map((agent) => (
                    <tr 
                      key={agent.uid} 
                      onClick={() => navigate(`/admin/agent/${agent.uid}`)}
                      className="hover:bg-zinc-50/30 transition-colors cursor-pointer group"
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-midnight/5 flex items-center justify-center text-midnight font-bold group-hover:bg-honey/10 group-hover:text-honey transition-colors">
                            {agent.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-midnight">{agent.name}</p>
                            <p className="text-xs text-charcoal/40">{agent.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          agent.subscriptionTier === 'enterprise' ? 'bg-midnight text-white' :
                          agent.subscriptionTier === 'pro' ? 'bg-sage/10 text-sage' :
                          'bg-honey/10 text-honey'
                        }`}>
                          {agent.subscriptionTier}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleLicense(agent.uid, agent.licenseVerified);
                          }}
                          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            agent.licenseVerified 
                              ? 'bg-sage/10 text-sage hover:bg-sage/20' 
                              : 'bg-zinc-100 text-charcoal/40 hover:bg-zinc-200'
                          }`}
                        >
                          {agent.licenseVerified ? <BadgeCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                          {agent.licenseVerified ? 'Verified' : 'Verify'}
                        </button>
                      </td>
                      <td className="px-8 py-6">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleAccess(agent.uid, agent.isAccessEnabled);
                          }}
                          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            agent.isAccessEnabled 
                              ? 'bg-midnight text-white hover:bg-midnight/90' 
                              : 'bg-red-50 text-red-600 hover:bg-red-100'
                          }`}
                        >
                          {agent.isAccessEnabled ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                          {agent.isAccessEnabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </td>
                      <td className="px-8 py-6 text-sm text-charcoal/40">
                        {new Date(agent.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[2.5rem] border border-zinc-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50/50 border-b border-zinc-100">
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">Transaction ID</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">Agent</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">Plan</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">Amount</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">Date</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-zinc-50/30 transition-colors">
                    <td className="px-8 py-6 font-mono text-xs text-charcoal/40">
                      {payment.id.substring(0, 12)}...
                    </td>
                    <td className="px-8 py-6 font-bold text-midnight">
                      {payment.agentName}
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-xs font-bold uppercase tracking-widest text-charcoal/60">
                        {payment.planId}
                      </span>
                    </td>
                    <td className="px-8 py-6 font-black text-midnight">
                      ${payment.amount}
                    </td>
                    <td className="px-8 py-6 text-sm text-charcoal/40">
                      {new Date(payment.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-sage font-bold text-xs">
                        <CheckCircle2 className="w-4 h-4" />
                        Succeeded
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
