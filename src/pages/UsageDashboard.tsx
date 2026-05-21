import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import { Lead, Agent } from '../types';
import { CreditCard, DollarSign, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

export default function UsageDashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const leadsQuery = query(collection(db, 'leads'), where('agentId', '==', user.uid));
        const unsubLeads = onSnapshot(leadsQuery, (snapshot) => {
          const leadsData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Lead));
          setLeads(leadsData);
          setLoading(false);
        });

        const agentQuery = query(collection(db, 'agents'), where('uid', '==', user.uid));
        const unsubAgent = onSnapshot(agentQuery, (snapshot) => {
          if (!snapshot.empty) {
            setAgent(snapshot.docs[0].data() as Agent);
          }
        });

        return () => {
          unsubLeads();
          unsubAgent();
        };
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const calculateUsage = () => {
    const totalCreditChecks = leads.filter(l => l.creditCheck).length;
    const totalEmploymentChecks = leads.filter(l => l.employmentInfo?.validated).length;

    const creditCheckCost = totalCreditChecks * 4; // $4 avg per check
    const employmentCheckCost = totalEmploymentChecks * 1.5; // $1.50 avg per check
    const totalCost = creditCheckCost + employmentCheckCost;

    const tier = agent?.subscriptionTier || 'professional';
    const includedChecks = tier === 'professional' ? 10 : 999999; // Enterprise gets unlimited
    const additionalChecks = Math.max(0, totalCreditChecks - includedChecks);
    const additionalCost = additionalChecks * 2; // $2 per additional check

    return {
      totalCreditChecks,
      totalEmploymentChecks,
      creditCheckCost,
      employmentCheckCost,
      totalCost,
      includedChecks,
      additionalChecks,
      additionalCost,
      remainingChecks: Math.max(0, includedChecks - totalCreditChecks)
    };
  };

  const usage = calculateUsage();
  const isNearLimit = usage.remainingChecks <= 2 && agent?.subscriptionTier === 'professional';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-honey"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-midnight">Usage & Billing</h1>
        <p className="text-charcoal/60">Track your verification costs and usage limits.</p>
      </div>

      {isNearLimit && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-custom bg-honey/10 border border-honey/20 flex items-center gap-3"
        >
          <AlertCircle className="w-5 h-5 text-honey shrink-0" />
          <div>
            <p className="font-bold text-midnight">Running low on credit checks</p>
            <p className="text-sm text-charcoal/60">
              You have {usage.remainingChecks} checks remaining this month. Additional checks are $2 each.
            </p>
          </div>
        </motion.div>
      )}

      <div className="grid md:grid-cols-4 gap-6">
        <StatCard
          icon={<CreditCard className="w-6 h-6" />}
          label="Credit Checks Used"
          value={`${usage.totalCreditChecks} / ${agent?.subscriptionTier === 'enterprise' ? '∞' : usage.includedChecks}`}
          color="midnight"
        />
        <StatCard
          icon={<CheckCircle2 className="w-6 h-6" />}
          label="Employment Verifications"
          value={usage.totalEmploymentChecks}
          color="sage"
        />
        <StatCard
          icon={<DollarSign className="w-6 h-6" />}
          label="Total API Costs"
          value={`$${usage.totalCost.toFixed(2)}`}
          color="honey"
        />
        <StatCard
          icon={<TrendingUp className="w-6 h-6" />}
          label="Cost Per Lead"
          value={leads.length > 0 ? `$${(usage.totalCost / leads.length).toFixed(2)}` : '$0.00'}
          color="sage"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="p-8 rounded-custom border border-zinc-200 bg-white space-y-6 shadow-sm">
          <h3 className="font-bold text-midnight">Current Plan</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-charcoal/60">Subscription Tier</span>
              <span className="text-sm font-bold text-midnight uppercase tracking-widest">
                {agent?.subscriptionTier || 'Professional'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-charcoal/60">Included Credit Checks</span>
              <span className="text-sm font-bold text-midnight">
                {agent?.subscriptionTier === 'enterprise' ? 'Unlimited' : '10 / month'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-charcoal/60">Additional Check Cost</span>
              <span className="text-sm font-bold text-midnight">
                {agent?.subscriptionTier === 'enterprise' ? 'Included' : '$2 / check'}
              </span>
            </div>
          </div>
        </div>

        <div className="p-8 rounded-custom border border-zinc-200 bg-white space-y-6 shadow-sm">
          <h3 className="font-bold text-midnight">This Month</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-charcoal/60">Credit Check Costs</span>
              <span className="text-sm font-bold text-midnight">${usage.creditCheckCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-charcoal/60">Employment Check Costs</span>
              <span className="text-sm font-bold text-midnight">${usage.employmentCheckCost.toFixed(2)}</span>
            </div>
            {usage.additionalChecks > 0 && (
              <div className="flex justify-between items-center pt-4 border-t border-zinc-200">
                <span className="text-sm text-charcoal/60">Additional Checks ({usage.additionalChecks})</span>
                <span className="text-sm font-bold text-honey">${usage.additionalCost.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-4 border-t border-zinc-200">
              <span className="text-sm font-bold text-midnight">Total Usage Costs</span>
              <span className="text-lg font-bold text-midnight">${usage.totalCost.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-8 rounded-custom border border-zinc-200 bg-white space-y-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-midnight">Recent Verifications</h3>
          <span className="text-xs text-charcoal/40 font-bold uppercase tracking-widest">
            Last 30 Days
          </span>
        </div>

        <div className="space-y-3">
          {leads
            .filter(l => l.creditCheck || l.employmentInfo?.validated)
            .slice(0, 10)
            .map((lead) => (
              <div
                key={lead.id}
                className="flex items-center justify-between p-4 rounded-lg bg-zinc-50/50 border border-zinc-100"
              >
                <div>
                  <p className="font-bold text-midnight text-sm">{lead.name}</p>
                  <p className="text-xs text-charcoal/60">
                    {lead.creditCheck && 'Credit Check'}
                    {lead.creditCheck && lead.employmentInfo?.validated && ' + '}
                    {lead.employmentInfo?.validated && 'Employment Verification'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-midnight">
                    ${((lead.creditCheck ? 4 : 0) + (lead.employmentInfo?.validated ? 1.5 : 0)).toFixed(2)}
                  </p>
                  <p className="text-xs text-charcoal/40">
                    {lead.creditCheck?.checkedAt && new Date(lead.creditCheck.checkedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}

          {leads.filter(l => l.creditCheck || l.employmentInfo?.validated).length === 0 && (
            <div className="p-8 text-center text-charcoal/40 text-sm">
              No verifications yet. Start verifying leads to see usage data here.
            </div>
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
        <p className="text-xs text-charcoal/60 font-medium">{label}</p>
        <p className="text-xl font-bold text-midnight">{value}</p>
      </div>
    </div>
  );
}
