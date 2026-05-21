import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import { Mail, Send, Clock, CheckCircle2, XCircle, Calendar } from 'lucide-react';
import { motion } from 'motion/react';
import {
  getWelcomeEmail,
  getFollowUpDay3Email,
  getFollowUpDay7Email,
  getDocumentSignedEmail
} from '../utils/emailTemplates';

interface ScheduledEmail {
  id: string;
  leadId: string;
  leadEmail: string;
  leadName: string;
  agentName: string;
  emailType: 'welcome' | 'followup_day3' | 'followup_day7' | 'document_signed';
  scheduledFor: string;
  sent: boolean;
  sentAt?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export default function EmailCampaigns() {
  const [emails, setEmails] = useState<ScheduledEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);

        const q = query(
          collection(db, 'scheduled-emails'),
          where('agentId', '==', user.uid)
        );

        const unsubEmails = onSnapshot(q,
          (snapshot) => {
            const emailsData = snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data()
            } as ScheduledEmail));

            emailsData.sort((a, b) =>
              new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()
            );

            setEmails(emailsData);
            setLoading(false);
          },
          (error) => {
            console.error('[EmailCampaigns] Error fetching emails:', error);
            setLoading(false);
          }
        );

        return () => unsubEmails();
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const sendEmailNow = async (email: ScheduledEmail) => {
    setSending(email.id);

    try {
      let template;
      const agentName = email.agentName;

      switch (email.emailType) {
        case 'welcome':
          template = getWelcomeEmail(email.leadName, agentName);
          break;
        case 'followup_day3':
          template = getFollowUpDay3Email(email.leadName, agentName);
          break;
        case 'followup_day7':
          template = getFollowUpDay7Email(email.leadName, agentName);
          break;
        case 'document_signed':
          template = getDocumentSignedEmail(
            email.leadName,
            agentName,
            email.metadata?.documentType || 'Document'
          );
          break;
        default:
          throw new Error('Unknown email type');
      }

      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email.leadEmail,
          subject: template.subject,
          html: template.html,
          text: template.text
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send email');
      }

      await updateDoc(doc(db, 'scheduled-emails', email.id), {
        sent: true,
        sentAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error sending email:', err);
      await updateDoc(doc(db, 'scheduled-emails', email.id), {
        error: err instanceof Error ? err.message : 'Failed to send'
      });
    } finally {
      setSending(null);
    }
  };

  const getEmailTypeLabel = (type: string) => {
    switch (type) {
      case 'welcome': return 'Welcome Email';
      case 'followup_day3': return 'Day 3 Follow-up';
      case 'followup_day7': return 'Day 7 Follow-up';
      case 'document_signed': return 'Document Signed';
      default: return type;
    }
  };

  const isPastDue = (scheduledFor: string) => {
    return new Date(scheduledFor) < new Date();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-honey"></div>
      </div>
    );
  }

  const pending = emails.filter(e => !e.sent);
  const sent = emails.filter(e => e.sent);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-midnight">Email Campaigns</h1>
        <p className="text-charcoal/60">Automated drip campaigns for your leads.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <StatCard
          icon={<Mail className="w-6 h-6" />}
          label="Total Scheduled"
          value={emails.length}
          color="midnight"
        />
        <StatCard
          icon={<Clock className="w-6 h-6" />}
          label="Pending"
          value={pending.length}
          color="honey"
        />
        <StatCard
          icon={<CheckCircle2 className="w-6 h-6" />}
          label="Sent"
          value={sent.length}
          color="sage"
        />
      </div>

      {pending.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-midnight">Pending Emails</h2>
          <div className="space-y-3">
            {pending.map((email) => (
              <motion.div
                key={email.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 rounded-custom border border-zinc-200 bg-white shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-12 h-12 rounded-custom flex items-center justify-center ${
                      isPastDue(email.scheduledFor) ? 'bg-honey/10' : 'bg-midnight/10'
                    }`}>
                      {isPastDue(email.scheduledFor) ? (
                        <Send className="w-6 h-6 text-honey" />
                      ) : (
                        <Clock className="w-6 h-6 text-midnight" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-midnight">{email.leadName}</h3>
                        <span className="text-xs font-bold text-charcoal/40 uppercase tracking-widest bg-zinc-100 px-2 py-1 rounded">
                          {getEmailTypeLabel(email.emailType)}
                        </span>
                      </div>
                      <p className="text-sm text-charcoal/60">{email.leadEmail}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Calendar className="w-3.5 h-3.5 text-charcoal/40" />
                        <span className="text-xs text-charcoal/60">
                          Scheduled for {new Date(email.scheduledFor).toLocaleString()}
                          {isPastDue(email.scheduledFor) && (
                            <span className="text-honey font-bold"> (Ready to send)</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => sendEmailNow(email)}
                    disabled={sending === email.id}
                    className="flex items-center gap-2 px-4 py-2 bg-honey text-midnight rounded-lg font-bold text-sm hover:bg-honey/90 transition-all disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    {sending === email.id ? 'Sending...' : 'Send Now'}
                  </button>
                </div>

                {email.error && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-600">
                    <XCircle className="w-4 h-4" />
                    {email.error}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {sent.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-midnight">Sent Emails</h2>
          <div className="space-y-3">
            {sent.slice(0, 10).map((email) => (
              <div
                key={email.id}
                className="p-6 rounded-custom border border-zinc-200 bg-white shadow-sm opacity-60"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 rounded-custom flex items-center justify-center bg-sage/10">
                      <CheckCircle2 className="w-6 h-6 text-sage" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-midnight">{email.leadName}</h3>
                        <span className="text-xs font-bold text-charcoal/40 uppercase tracking-widest bg-zinc-100 px-2 py-1 rounded">
                          {getEmailTypeLabel(email.emailType)}
                        </span>
                      </div>
                      <p className="text-sm text-charcoal/60">{email.leadEmail}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-sage" />
                        <span className="text-xs text-charcoal/60">
                          Sent on {email.sentAt && new Date(email.sentAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {emails.length === 0 && (
        <div className="p-12 text-center border border-dashed border-zinc-300 rounded-custom text-charcoal/40 bg-white shadow-sm">
          <Mail className="w-12 h-12 mx-auto mb-4 text-charcoal/20" />
          <p className="font-bold text-lg text-midnight mb-2">No email campaigns yet</p>
          <p className="text-sm">Email campaigns are automatically created when leads sign up.</p>
        </div>
      )}
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
