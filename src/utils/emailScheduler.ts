import { collection, query, where, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

export interface ScheduledEmail {
  leadId: string;
  agentId: string;
  leadEmail: string;
  leadName: string;
  agentName: string;
  emailType: 'welcome' | 'followup_day3' | 'followup_day7' | 'document_signed';
  scheduledFor: string;
  sent: boolean;
  sentAt?: string;
  metadata?: Record<string, any>;
}

export async function scheduleWelcomeEmail(
  leadId: string,
  agentId: string,
  leadEmail: string,
  leadName: string,
  agentName: string
): Promise<void> {
  const now = new Date();

  // Schedule welcome email immediately
  await addDoc(collection(db, 'scheduled-emails'), {
    leadId,
    agentId,
    leadEmail,
    leadName,
    agentName,
    emailType: 'welcome',
    scheduledFor: now.toISOString(),
    sent: false,
    createdAt: now.toISOString()
  });

  // Schedule day 3 follow-up
  const day3 = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  await addDoc(collection(db, 'scheduled-emails'), {
    leadId,
    agentId,
    leadEmail,
    leadName,
    agentName,
    emailType: 'followup_day3',
    scheduledFor: day3.toISOString(),
    sent: false,
    createdAt: now.toISOString()
  });

  // Schedule day 7 follow-up
  const day7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  await addDoc(collection(db, 'scheduled-emails'), {
    leadId,
    agentId,
    leadEmail,
    leadName,
    agentName,
    emailType: 'followup_day7',
    scheduledFor: day7.toISOString(),
    sent: false,
    createdAt: now.toISOString()
  });
}

export async function scheduleDocumentSignedEmail(
  leadId: string,
  agentId: string,
  leadEmail: string,
  leadName: string,
  agentName: string,
  documentType: string
): Promise<void> {
  const now = new Date();

  await addDoc(collection(db, 'scheduled-emails'), {
    leadId,
    agentId,
    leadEmail,
    leadName,
    agentName,
    emailType: 'document_signed',
    scheduledFor: now.toISOString(),
    sent: false,
    createdAt: now.toISOString(),
    metadata: { documentType }
  });
}

export async function getPendingEmails(): Promise<any[]> {
  const now = new Date().toISOString();
  const q = query(
    collection(db, 'scheduled-emails'),
    where('sent', '==', false),
    where('scheduledFor', '<=', now)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
