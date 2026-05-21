import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import { Agent } from '../types';
import { motion } from 'motion/react';
import { QrCode, Clock, Copy, CheckCircle2, MessageSquare, Share2, AlertTriangle, CreditCard, History, Terminal, AlertCircle, ExternalLink, ArrowRight } from 'lucide-react';
import QRCode from 'qrcode';
import { handleFirestoreError, OperationType } from '../utils/firestore-errors';

import { GLOBAL_WHATSAPP_NUMBER, WHATSAPP_LINK_BASE } from '../constants';

interface Payment {
  id: string;
  amount: number;
  status: string;
  planId: string;
  createdAt: string;
}

export default function Dashboard() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        
        const fetchAgentData = async () => {
          try {
            const agentDoc = await getDoc(doc(db, 'agents', user.uid));
            if (agentDoc.exists()) {
              setAgent(agentDoc.data() as Agent);
            }
          } catch (err) {
            handleFirestoreError(err, OperationType.GET, `agents/${user.uid}`);
          } finally {
            setLoading(false);
          }
        };
        fetchAgentData();

        // Fetch payments
        const paymentsQuery = query(
          collection(db, 'payments'),
          where('agentId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );

        const unsubPayments = onSnapshot(paymentsQuery, (snapshot) => {
          setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)));
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, 'payments');
        });

        return () => unsubPayments();
      } else {
        setLoading(false);
        setUserId(null);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const isLicenseInvalid = agent?.licenseStatus === 'invalid';

  // Separate effect for QR generation
  useEffect(() => {
    if (!userId || isLicenseInvalid) {
      setQrCode(null);
      return;
    }

    const generateQR = async () => {
      const agentRef = agent?.name || userId;
      const message = `Hi, I'm interested in a property! [Ref:${agentRef}]`;
      const chatUrl = `${WHATSAPP_LINK_BASE}?text=${encodeURIComponent(message)}`;

      try {
        const url = await QRCode.toDataURL(chatUrl, {
          width: 600,
          margin: 2,
          color: {
            dark: '#1E3A5F',
            light: '#FFFFFF'
          }
        });
        setQrCode(url);
      } catch (err) {
        console.error('QR generation error:', err);
      }
    };

    generateQR();
  }, [userId]);

  const handleCopy = () => {
    if (!userId) return;
    const agentRef = agent?.name || userId;
    const message = `Hi, I'm interested in a property! [Ref:${agentRef}]`;
    const chatUrl = `${WHATSAPP_LINK_BASE}?text=${encodeURIComponent(message)}`;
    
    navigator.clipboard.writeText(chatUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-honey"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      {isLicenseInvalid && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-3xl bg-red-50 border border-red-200 flex items-start gap-4 shadow-sm"
        >
          <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-red-900">License Verification Failed</h3>
            <p className="text-sm text-red-700 leading-relaxed">
              Your real estate license could not be validated. Your QR code has been disabled. 
              Please contact <a href="mailto:admin@leistly.com" className="font-bold underline">admin@leistly.com</a> immediately. 
              Access will be revoked in {agent?.licenseInvalidDate ? Math.max(0, 10 - Math.floor((new Date().getTime() - new Date(agent.licenseInvalidDate).getTime()) / (1000 * 60 * 60 * 24))) : 10} business days.
            </p>
          </div>
        </motion.div>
      )}

      {/* Hero Section with QR Code */}
      <section className="relative overflow-hidden rounded-[2.5rem] bg-midnight p-8 md:p-12 text-white shadow-2xl">
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-64 h-64 bg-honey/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-64 h-64 bg-sage/20 rounded-full blur-3xl" />
        
        <div className="relative grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-honey text-xs font-bold uppercase tracking-wider">
                <QrCode className="w-3.5 h-3.5" />
                Agent Toolkit
              </div>
              <h1 className="text-4xl md:text-5xl font-bold leading-tight">
                Your Personal <span className="text-honey">WhatsApp Magnet</span>
              </h1>
              <p className="text-lg text-white/70 leading-relaxed">
                Scan, share, and qualify. Your unique QR code connects leads directly to our AI-powered WhatsApp assistant.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#25D366]/20 flex items-center justify-center">
                    <Share2 className="w-5 h-5 text-[#25D366]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">WhatsApp Direct Link</p>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest">Global Number: {GLOBAL_WHATSAPP_NUMBER}</p>
                  </div>
                </div>
                <button 
                  onClick={handleCopy}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all text-sm font-bold ${
                    copied ? 'bg-sage text-white' : 'bg-honey text-midnight hover:bg-honey/90'
                  }`}
                >
                  {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3">
                <p className="text-[10px] font-black text-honey uppercase tracking-widest">How it works</p>
                <ul className="space-y-2">
                  <li className="text-xs text-white/60 flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-honey mt-1 shrink-0" />
                    Lead scans QR code and sends the pre-filled message.
                  </li>
                  <li className="text-xs text-white/60 flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-honey mt-1 shrink-0" />
                    Twilio forwards the message to our AI assistant.
                  </li>
                  <li className="text-xs text-white/60 flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-honey mt-1 shrink-0" />
                    AI identifies you via the [Ref] tag and starts qualification.
                  </li>
                  <li className="text-xs text-white/60 flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-honey mt-1 shrink-0" />
                    Qualified leads appear instantly in your dashboard.
                  </li>
                </ul>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-midnight/20 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Web Chat Simulator</p>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest">Test your flow in browser</p>
                  </div>
                </div>
                <a 
                  href={`/chat/${userId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-sm font-bold text-white border border-white/10"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open Simulator
                </a>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative p-8 bg-white rounded-[2rem] shadow-2xl shadow-black/50 group"
            >
              <div className="absolute inset-0 bg-honey/5 rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity" />
              {qrCode ? (
                <img src={qrCode} alt="Agent QR Code" className="w-full max-w-[280px] relative z-10" />
              ) : (
                <div className="w-[280px] h-[280px] bg-zinc-100 animate-pulse rounded-xl" />
              )}
              
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-midnight border border-white/10 rounded-full shadow-xl flex items-center gap-2 whitespace-nowrap">
                <div className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-widest">WhatsApp Ready</span>
              </div>
            </motion.div>

            <div className="text-center space-y-1">
              <p className="text-sm font-bold text-white">Download QR Code</p>
              <p className="text-xs text-white/40">High-resolution for print ads</p>
            </div>
          </div>
        </div>
      </section>

      {/* Instructions & History Section */}
      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-12">
          {/* Instructions */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-midnight">How to use your QR Code</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {[
                { 
                  step: '01', 
                  title: 'Print on Signage', 
                  desc: 'Place this QR code on your "For Sale" signs, flyers, and business cards.' 
                },
                { 
                  step: '02', 
                  title: 'Digital Ads', 
                  desc: 'Use the link in your Instagram, Facebook, or Google property ads.' 
                },
                { 
                  step: '03', 
                  title: 'Auto-Capture', 
                  desc: `Leads scan and message our global AI number (${GLOBAL_WHATSAPP_NUMBER}).` 
                },
                { 
                  step: '04', 
                  title: 'Get Qualified', 
                  desc: 'Leads are automatically qualified and sent to your Customer Dashboard.' 
                },
              ].map((item) => (
                <div key={item.step} className="p-6 rounded-3xl border border-zinc-100 bg-white hover:border-honey/30 transition-all shadow-sm group">
                  <span className="text-3xl font-black text-honey/20 group-hover:text-honey/40 transition-colors">{item.step}</span>
                  <h3 className="text-sm font-bold text-midnight uppercase tracking-wider mt-2">{item.title}</h3>
                  <p className="text-xs text-charcoal/60 mt-2 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Transaction History */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-midnight flex items-center gap-3">
                <History className="w-6 h-6 text-honey" />
                Transaction History
              </h2>
            </div>
            
            <div className="bg-white rounded-[2rem] border border-zinc-100 shadow-sm overflow-hidden">
              {payments.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50/50 border-b border-zinc-100">
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-charcoal/40">Date</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-charcoal/40">Plan</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-charcoal/40">Amount</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-charcoal/40">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {payments.map((payment) => (
                        <tr key={payment.id} className="hover:bg-zinc-50/30 transition-colors">
                          <td className="px-6 py-4 text-xs font-medium text-charcoal/60">
                            {new Date(payment.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-xs font-bold text-midnight uppercase tracking-widest">
                            {payment.planId}
                          </td>
                          <td className="px-6 py-4 text-sm font-black text-midnight">
                            ${payment.amount}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5 text-sage font-bold text-[10px] uppercase tracking-widest">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Succeeded
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-50 flex items-center justify-center mx-auto">
                    <CreditCard className="w-6 h-6 text-charcoal/20" />
                  </div>
                  <p className="text-sm text-charcoal/40 font-medium">No transactions found yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="p-8 rounded-[2rem] bg-sage/10 border border-sage/20 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-sage/20 flex items-center justify-center">
              <Clock className="w-6 h-6 text-sage" />
            </div>
            <h3 className="text-xl font-bold text-midnight">Trial Status</h3>
            <p className="text-sm text-charcoal/70 leading-relaxed">
              You are currently on the Professional Trial. You have full access to all AI qualification features.
            </p>
            {agent?.trialEndDate && (
              <div className="pt-4 border-t border-sage/20">
                <p className="text-[10px] font-bold text-sage uppercase tracking-widest">Expires On</p>
                <p className="text-lg font-bold text-midnight">{new Date(agent.trialEndDate).toLocaleDateString()}</p>
              </div>
            )}
          </div>

          <div className="p-8 rounded-[2rem] bg-honey/5 border border-honey/10 space-y-4">
            <h3 className="font-bold text-midnight">Need Help?</h3>
            <p className="text-xs text-charcoal/60 leading-relaxed">
              Our team is here to help you set up your QR codes and optimize your lead flow.
            </p>
            <button className="w-full py-3 rounded-xl bg-midnight text-white text-xs font-bold hover:bg-midnight/90 transition-all">
              Contact Support
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
