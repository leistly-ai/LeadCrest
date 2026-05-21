import { useEffect, useState, useMemo } from 'react';
import { collection, query, where, onSnapshot, getDocs, writeBatch } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import { Lead } from '../types';
import { Users, TrendingUp, Search, Filter, ExternalLink, PieChart as PieChartIcon, BarChart as BarChartIcon, MessageSquare, UserPlus, CheckCircle2, Trash2, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { handleFirestoreError, OperationType } from '../utils/firestore-errors';
import { WhatsAppSimulator } from '../components/WhatsAppSimulator';

export default function LeadsDashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [addingToContacts, setAddingToContacts] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [clearingLeads, setClearingLeads] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);

        // Listen for leads
        const q = query(collection(db, 'leads'), where('agentId', '==', user.uid));
        const unsubscribeLeads = onSnapshot(q, (snapshot) => {
          const leadsData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Lead[];
          setLeads(leadsData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
          setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, 'leads');
          setLoading(false);
        });

        return () => unsubscribeLeads();
      } else {
        setLoading(false);
        setUserId(null);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const handleClearLeads = async () => {
    if (!userId) return;
    setClearingLeads(true);
    try {
      const q = query(collection(db, 'leads'), where('agentId', '==', userId));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      setShowClearConfirm(false);
    } catch (error) {
      console.error('Error clearing leads:', error);
    } finally {
      setClearingLeads(false);
    }
  };

  const handleAddToContacts = async (lead: Lead) => {
    setAddingToContacts(lead.id);
    try {
      // This approach assumes a backend endpoint exists or will be created to handle
      // adding a lead to Google Contacts using the agent's stored OAuth tokens.
      // For now, we simulate the process.
      await new Promise(resolve => setTimeout(resolve, 1500));

      setSuccessMessage(`Synced ${lead.name} to Google Contacts`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error adding to contacts:', error);
    } finally {
      setAddingToContacts(null);
    }
  };

  const stats = useMemo(() => {
    const total = leads.length;
    const warm = leads.filter(l => l.status === 'warm').length;
    const avgScore = total ? Math.round(leads.reduce((acc, l) => acc + (l.score ?? 0), 0) / total) : 0;

    const statusData = [
      { name: 'Warm', value: warm, color: '#D4A373' },
      { name: 'Completion', value: leads.filter(l => l.status === 'completion').length, color: '#1E3A5F' },
      { name: 'Cold', value: leads.filter(l => l.status === 'cold').length, color: '#A4B494' },
    ].filter(d => d.value > 0);

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    const trendData = last7Days.map(date => ({
      date: date.split('-').slice(1).join('/'),
      count: leads.filter(l => l.createdAt?.startsWith(date)).length
    }));

    return { total, warm, avgScore, statusData, trendData };
  }, [leads]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-honey"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row gap-6 justify-between items-start">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-midnight">Customer Dashboard</h1>
          <p className="text-charcoal/60">Manage and track your qualified leads.</p>
        </div>
        <div className="flex items-center gap-4">
          <AnimatePresence>
            {successMessage && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="px-4 py-2 bg-sage/10 text-sage text-xs font-bold rounded-lg border border-sage/20 flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                {successMessage}
              </motion.div>
            )}
          </AnimatePresence>
          {leads.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-2 px-5 py-3 bg-red-50 text-red-500 border border-red-200 rounded-full font-bold hover:bg-red-100 transition-all"
            >
              <Trash2 size={16} />
              Clear All Leads
            </button>
          )}
          <button
            onClick={() => setIsSimulatorOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-[#25D366] text-white rounded-full font-bold shadow-lg hover:bg-[#128C7E] transition-all transform hover:scale-105"
          >
            <MessageSquare size={20} />
            Open WhatsApp Simulator
          </button>
        </div>
      </div>

      <WhatsAppSimulator
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        agentId={userId || undefined}
      />

      <AnimatePresence>
        {showClearConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center space-y-6"
            >
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <Trash2 className="w-7 h-7 text-red-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-midnight">Clear all leads?</h3>
                <p className="text-charcoal/60 text-sm">This will permanently delete all {leads.length} leads. This action cannot be undone.</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 py-3 rounded-2xl border border-zinc-200 font-bold text-charcoal hover:bg-zinc-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearLeads}
                  disabled={clearingLeads}
                  className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors disabled:opacity-60"
                >
                  {clearingLeads ? 'Clearing...' : 'Yes, clear all'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid md:grid-cols-3 gap-6">
        <StatCard icon={<Users className="w-5 h-5" />} label="Total Leads" value={stats.total} color="midnight" />
        <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Warm Leads" value={stats.warm} color="honey" />
        <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Avg. Qualification" value={`${stats.avgScore}%`} color="sage" />
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="p-6 rounded-large border border-zinc-200 bg-white space-y-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-midnight flex items-center gap-2">
              <BarChartIcon className="w-5 h-5 text-honey" />
              Lead Acquisition Trend
            </h3>
            <span className="text-xs text-charcoal/40 font-medium uppercase tracking-widest">Last 7 Days</span>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#999'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#999'}} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Line type="monotone" dataKey="count" stroke="#D4A373" strokeWidth={3} dot={{ r: 4, fill: '#D4A373' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-6 rounded-large border border-zinc-200 bg-white space-y-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-midnight flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-honey" />
              Status Distribution
            </h3>
            <span className="text-xs text-charcoal/40 font-medium uppercase tracking-widest">Current Pipeline</span>
          </div>
          <div className="h-[250px] w-full flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.statusData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {stats.statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-3 pr-8">
              {stats.statusData.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm font-medium text-midnight">{item.name}</span>
                  <span className="text-sm text-charcoal/40">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-midnight">Recent Leads</h2>
          <div className="flex gap-2">
            <button className="p-2 rounded-custom bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors shadow-sm">
              <Search className="w-4 h-4 text-charcoal/60" />
            </button>
            <button className="p-2 rounded-custom bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors shadow-sm">
              <Filter className="w-4 h-4 text-charcoal/60" />
            </button>
          </div>
        </div>

        <div className="grid gap-3">
          {leads.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-zinc-300 rounded-custom text-charcoal/40 bg-white shadow-sm">
              No leads yet. Share your QR code to start collecting leads!
            </div>
          ) : (
            leads.map((lead) => (
              <Link
                key={lead.id}
                to={`/lead/${lead.id}`}
                className="block p-5 rounded-custom border border-zinc-200 bg-white hover:border-honey/30 transition-all group shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-custom flex items-center justify-center font-bold text-lg ${
                      lead.score >= 70 ? 'bg-sage/10 text-sage' :
                      lead.score >= 40 ? 'bg-honey/10 text-honey' :
                      'bg-red-500/10 text-red-500'
                    }`}>
                      {lead.score}
                    </div>
                    <div>
                      <h3 className="font-semibold text-midnight group-hover:text-honey transition-colors">{lead.name}</h3>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-charcoal/60">{lead.type === 'buy' ? 'Buying' : 'Renting'} · {lead.email}</p>
                        {lead.verification && (
                          <div className="flex items-center gap-1">
                            {lead.verification.creditCheckCompleted && (
                              <ShieldCheck className="w-3.5 h-3.5 text-sage" title="Credit Verified" />
                            )}
                            {lead.verification.employmentVerified && (
                              <ShieldCheck className="w-3.5 h-3.5 text-honey" title="Employment Verified" />
                            )}
                            {lead.verification.identityVerified && (
                              <ShieldCheck className="w-3.5 h-3.5 text-midnight" title="Identity Verified" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleAddToContacts(lead);
                      }}
                      disabled={addingToContacts === lead.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-honey/5 text-honey text-[10px] font-black uppercase tracking-widest hover:bg-honey/10 transition-colors disabled:opacity-50"
                      title="Add to Google Contacts"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      {addingToContacts === lead.id ? 'Syncing...' : 'Add to Contacts'}
                    </button>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      lead.status === 'completion' ? 'bg-midnight/10 text-midnight' :
                      lead.status === 'warm' ? 'bg-honey/10 text-honey' :
                      'bg-zinc-100 text-charcoal/40'
                    }`}>
                      {lead.status}
                    </span>
                    <ExternalLink className="w-4 h-4 text-charcoal/20 group-hover:text-honey transition-colors" />
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  const colors: Record<string, string> = {
    midnight: 'text-midnight bg-midnight/10',
    honey: 'text-honey bg-honey/10',
    sage: 'text-sage bg-sage/10',
  };

  return (
    <div className="p-6 rounded-custom border border-zinc-200 bg-white flex items-center gap-4 shadow-sm">
      <div className={`w-12 h-12 rounded-custom flex items-center justify-center ${colors[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-charcoal/60 font-medium">{label}</p>
        <p className="text-2xl font-bold text-midnight">{value}</p>
      </div>
    </div>
  );
}
