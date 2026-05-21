import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Mail, Clock, CheckCircle2, XCircle, Calendar, Send } from 'lucide-react';
import { motion } from 'motion/react';

interface EmailRecord {
  id: string;
  emailType: 'welcome' | 'followup_day3' | 'followup_day7' | 'document_signed' | 'call_notes';
  scheduledFor: string;
  sent: boolean;
  sentAt?: string;
  error?: string;
  subject?: string;
  metadata?: Record<string, any>;
}

interface LeadEmailHistoryProps {
  leadId: string;
  leadEmail: string;
}

export default function LeadEmailHistory({ leadId, leadEmail }: LeadEmailHistoryProps) {
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'scheduled-emails'),
      where('leadId', '==', leadId)
    );

    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        const emailsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        } as EmailRecord));

        emailsData.sort((a, b) =>
          new Date(b.scheduledFor).getTime() - new Date(a.scheduledFor).getTime()
        );

        setEmails(emailsData);
        setLoading(false);
      },
      (error) => {
        console.error('[LeadEmailHistory] Error fetching emails:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [leadId]);

  const getEmailTypeLabel = (type: string) => {
    switch (type) {
      case 'welcome': return 'Welcome Email';
      case 'followup_day3': return 'Day 3 Follow-up';
      case 'followup_day7': return 'Day 7 Follow-up';
      case 'document_signed': return 'Document Signed';
      case 'call_notes': return 'Call Notes';
      default: return type;
    }
  };

  const getEmailIcon = (email: EmailRecord) => {
    if (email.error) {
      return <XCircle className="w-4 h-4 text-red-500" />;
    }
    if (email.sent) {
      return <CheckCircle2 className="w-4 h-4 text-sage" />;
    }
    return <Clock className="w-4 h-4 text-honey" />;
  };

  const getStatusColor = (email: EmailRecord) => {
    if (email.error) return 'text-red-500 bg-red-50';
    if (email.sent) return 'text-sage bg-sage/10';
    return 'text-honey bg-honey/10';
  };

  if (loading) {
    return (
      <div className="p-8 rounded-custom border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-honey"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 rounded-custom border border-zinc-200 bg-white shadow-sm space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mail className="w-5 h-5 text-honey" />
          <h3 className="font-bold text-midnight">Email History</h3>
        </div>
        <span className="text-xs font-bold text-charcoal/40 uppercase tracking-widest">
          {emails.length} Email{emails.length !== 1 ? 's' : ''}
        </span>
      </div>

      {emails.length === 0 ? (
        <div className="p-8 text-center text-charcoal/40 bg-zinc-50 rounded-xl border border-zinc-100">
          <Mail className="w-10 h-10 mx-auto mb-3 text-charcoal/20" />
          <p className="text-sm font-medium">No emails sent yet</p>
          <p className="text-xs mt-1">Automated emails will appear here once scheduled</p>
        </div>
      ) : (
        <div className="space-y-3">
          {emails.map((email, index) => (
            <motion.div
              key={email.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`p-4 rounded-xl border ${
                email.sent ? 'border-zinc-200 bg-zinc-50/50' : 'border-honey/20 bg-honey/5'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getStatusColor(email)}`}>
                    {getEmailIcon(email)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-midnight text-sm">
                        {getEmailTypeLabel(email.emailType)}
                      </h4>
                      <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${getStatusColor(email)}`}>
                        {email.error ? 'Failed' : email.sent ? 'Sent' : 'Pending'}
                      </span>
                    </div>

                    <p className="text-xs text-charcoal/60 mt-1">{leadEmail}</p>

                    <div className="flex items-center gap-4 mt-2 text-xs text-charcoal/60">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {email.sent && email.sentAt ? (
                          <span>Sent {new Date(email.sentAt).toLocaleDateString()}</span>
                        ) : (
                          <span>Scheduled {new Date(email.scheduledFor).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>

                    {email.error && (
                      <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
                        Error: {email.error}
                      </div>
                    )}

                    {email.subject && (
                      <p className="text-xs text-charcoal/40 mt-2 italic">"{email.subject}"</p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
