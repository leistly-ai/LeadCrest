import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, ArrowRight, Zap, Shield, BarChart3, MessageSquare, ChevronUp, Network, Globe, Database, Smartphone, FileText, Scale, Lock, UserCheck, CheckCircle2, Hash, Users, Target, Workflow, Layout, QrCode, Share2, Copy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { useModal } from '../contexts/ModalContext';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestore-errors';
import QRCode from 'qrcode';
// Constants removed - using web-only approach

interface Payment {
  id: string;
  agentName: string;
  amount: number;
  planId: string;
  createdAt: string;
}

const chartData = [
  { name: 'Jan', leads: 400, qualified: 240 },
  { name: 'Feb', leads: 300, qualified: 139 },
  { name: 'Mar', leads: 200, qualified: 980 },
  { name: 'Apr', leads: 278, qualified: 390 },
  { name: 'May', leads: 189, qualified: 480 },
  { name: 'Jun', leads: 239, qualified: 380 },
  { name: 'Jul', leads: 349, qualified: 430 },
];

const conversionData = [
  { name: 'Cold', value: 400, color: '#1E3A5F' },
  { name: 'Warm', value: 300, color: '#D4A373' },
  { name: 'Hot', value: 200, color: '#A4B494' },
];

const tiers = [
  {
    name: 'Professional',
    price: '$149',
    description: 'Pre-qualified, verified leads ready to close.',
    features: [
      '7-day free trial',
      'Up to 50 leads/month',
      'Advanced AI scoring',
      '10 credit checks included',
      'Employment verification',
      'Document automation',
    ],
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: '$349',
    description: 'Full-service lead-to-close automation.',
    features: [
      '7-day free trial',
      'Unlimited leads',
      'Unlimited credit checks',
      'Multi-agent teams',
      'White-label branding',
      'API access',
    ],
    highlight: false,
  },
];

export default function LandingPage() {
  const { openModal } = useModal();
  const [demoQr, setDemoQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // No-op: recent payments listener removed
  }, []);

  useEffect(() => {
    const generateDemoQR = async () => {
      const demoUrl = `${window.location.origin}/demo-chat`;
      try {
        const url = await QRCode.toDataURL(demoUrl, {
          width: 400,
          margin: 2,
          color: {
            dark: '#1E3A5F',
            light: '#FFFFFF'
          }
        });
        setDemoQr(url);
      } catch (err) {
        console.error('Demo QR error:', err);
      }
    };
    generateDemoQR();
  }, []);

  const handleCopyDemo = () => {
    const demoUrl = `${window.location.origin}/demo-chat`;
    navigator.clipboard.writeText(demoUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-32 pb-32">
      {/* Hero Section */}
      <section className="relative pt-20 pb-12 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="space-y-8"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-honey/10 text-honey rounded-full text-sm font-semibold">
                <Zap className="w-4 h-4" />
                <span>Next-Gen Lead Intelligence</span>
              </div>
              <h1 className="text-6xl md:text-8xl font-bold tracking-tight text-midnight leading-[1.1]">
                Qualify Leads <br />
                <span className="text-honey italic font-serif">While You Sleep</span>
              </h1>
              <p className="text-xl text-charcoal/70 max-w-xl leading-relaxed">
                LeadCrest automates the entire real estate lead qualification process. From WhatsApp chat to credit checks and contract generation.
              </p>
              <div className="flex flex-wrap gap-4 pt-4">
                <Link
                  to="/signup"
                  className="px-10 py-5 bg-honey hover:bg-[#c29262] text-white font-bold rounded-large transition-all flex items-center gap-3 group shadow-xl shadow-honey/20"
                >
                  Start 7-Day Free Trial
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  to="/login"
                  className="px-10 py-5 bg-white hover:bg-zinc-50 text-midnight font-bold rounded-large border border-zinc-200 transition-all shadow-sm"
                >
                  Agent Login
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.8 }}
              className="relative"
            >
              <div className="absolute -inset-4 bg-honey/5 rounded-[40px] blur-3xl" />
              <div className="relative bg-white p-8 rounded-large border border-zinc-100 shadow-2xl">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-lg font-bold text-midnight">Lead Performance</h3>
                    <p className="text-sm text-charcoal/50">Real-time qualification metrics</p>
                  </div>
                  <BarChart3 className="w-6 h-6 text-honey" />
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1E3A5F" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#1E3A5F" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorQualified" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#D4A373" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#D4A373" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#999'}} />
                      <YAxis hide />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Area type="monotone" dataKey="leads" stroke="#1E3A5F" strokeWidth={3} fillOpacity={1} fill="url(#colorLeads)" />
                      <Area type="monotone" dataKey="qualified" stroke="#D4A373" strokeWidth={3} fillOpacity={1} fill="url(#colorQualified)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Demo QR Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[3rem] bg-midnight p-8 md:p-16 text-white shadow-3xl border border-white/5">
          <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-honey/10 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-96 h-96 bg-sage/10 rounded-full blur-[100px]" />
          
          <div className="relative grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-10">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-honey text-xs font-bold uppercase tracking-widest">
                  <QrCode className="w-4 h-4" />
                  Live Demo
                </div>
                <h2 className="text-5xl md:text-7xl font-black leading-[0.9] tracking-tighter">
                  Live Demo: <br />
                  <span className="text-honey">WhatsApp Flow</span>
                </h2>
                <p className="text-xl text-white/60 leading-relaxed max-w-lg">
                  Scan the QR code to experience our AI-powered lead qualification flow. See how we match buyers with the perfect agent through intelligent questions. No account required.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleCopyDemo}
                    className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-bold transition-all shadow-xl ${
                      copied ? 'bg-sage text-white' : 'bg-honey text-midnight hover:scale-105 active:scale-95'
                    }`}
                  >
                    {copied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    {copied ? 'Link Copied!' : 'Copy Demo Link'}
                  </button>
                  <a
                    href="/demo-chat"
                    className="flex items-center gap-3 px-8 py-4 rounded-2xl font-bold transition-all shadow-xl bg-white/10 text-white border border-white/20 hover:bg-white/20"
                  >
                    Try Demo Now →
                  </a>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="relative p-10 bg-white rounded-[2.5rem] shadow-2xl shadow-black/50"
              >
                {demoQr ? (
                  <img src={demoQr} alt="Demo QR" className="w-64 h-64 md:w-80 md:h-80 relative z-10" />
                ) : (
                  <div className="w-64 h-64 md:w-80 md:h-80 bg-zinc-100 animate-pulse rounded-2xl" />
                )}
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 bg-midnight border border-white/10 rounded-full shadow-2xl flex items-center gap-3 whitespace-nowrap">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#25D366] animate-pulse" />
                  <span className="text-xs font-black uppercase tracking-[0.2em]">Scan to Start</span>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}

      {/* Features Grid */}
      <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-midnight tracking-tight">
            Built for the <span className="text-honey">Modern Professional</span>
          </h2>
          <p className="text-lg text-charcoal/60 leading-relaxed">
            Our platform combines deep data intelligence with seamless automation to give you a competitive edge in the real estate market.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-10">
          <FeatureCard
            icon={<MessageSquare className="w-6 h-6 text-honey" />}
            title="WhatsApp Experience"
            description="Engage potential customers through a familiar chat interface that qualifies them automatically using AI-driven conversational flows."
            delay={0.1}
          />
          <FeatureCard
            icon={<Shield className="w-6 h-6 text-honey" />}
            title="Instant Qualification"
            description="Soft credit checks and LinkedIn validation ensure you only spend time on high-quality leads that meet your specific criteria."
            delay={0.2}
          />
          <FeatureCard
            icon={<BarChart3 className="w-6 h-6 text-honey" />}
            title="Lead Scoring"
            description="Every lead gets a score from 0-100 based on their profile, income, and history, allowing you to prioritize your most promising prospects."
            delay={0.3}
          />
          <FeatureCard
            icon={<Network className="w-6 h-6 text-honey" />}
            title="Data Apex Network"
            description="Connect with a vast network of verified data sources to enrich your lead profiles with deep insights and historical data."
            delay={0.4}
          />
          <FeatureCard
            icon={<Globe className="w-6 h-6 text-honey" />}
            title="Global Reach"
            description="Scale your lead generation efforts across multiple regions and markets with our globally distributed infrastructure."
            delay={0.5}
          />
          <FeatureCard
            icon={<Database className="w-6 h-6 text-honey" />}
            title="Intelligence Engine"
            description="Our proprietary algorithms analyze thousands of data points to predict lead conversion probability with high accuracy."
            delay={0.6}
          />
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">
        <div className="text-center space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-midnight">Simple, Transparent Pricing</h2>
          <p className="text-xl text-charcoal/60">Choose the plan that fits your pipeline.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-10 max-w-6xl mx-auto">
          {tiers.map((tier, index) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className={`p-10 rounded-large border ${
                tier.highlight
                  ? 'border-honey bg-white ring-1 ring-honey/20 shadow-2xl scale-105 z-10'
                  : 'border-zinc-200 bg-white shadow-sm'
              } space-y-8 flex flex-col relative overflow-hidden`}
            >
              {tier.highlight && (
                <div className="absolute top-0 right-0 bg-honey text-white text-[10px] font-bold uppercase tracking-widest px-4 py-1 rounded-bl-xl">
                  Most Popular
                </div>
              )}
              <div className="space-y-3">
                <h3 className="text-2xl font-bold text-midnight">{tier.name}</h3>
                <p className="text-charcoal/60 text-sm leading-relaxed">{tier.description}</p>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-midnight">$</span>
                <span className="text-3xl font-bold text-midnight">{tier.price.substring(1)}</span>
                <span className="text-charcoal/40 font-medium text-[10px]">/month</span>
              </div>
              <div className="h-px bg-zinc-100" />
              <ul className="space-y-5 flex-grow">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-4 text-sm text-charcoal/80">
                    <div className="w-5 h-5 rounded-full bg-sage/10 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-sage" />
                    </div>
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                to="/signup"
                className={`w-full py-4 rounded-large font-bold text-center transition-all shadow-md ${
                  tier.highlight
                    ? 'bg-honey hover:bg-[#c29262] text-white'
                    : 'bg-midnight hover:bg-[#2a4a75] text-white'
                }`}
              >
                Get Started
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Webhook Debugger Section Removed */}
 
       {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 border-t border-zinc-100">
        <div className="grid md:grid-cols-4 gap-12 pb-20">
          <div className="col-span-2 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-midnight rounded-xl flex items-center justify-center">
                <Network className="w-6 h-6 text-honey" />
              </div>
              <span className="text-2xl font-bold text-midnight tracking-tighter">LEADCREST</span>
            </div>
            <p className="text-charcoal/60 max-w-sm leading-relaxed">
              Engaged Intelligence for Licensed Professionals. Automating the future of real estate lead generation and data technology.
            </p>
          </div>
          <div className="space-y-6">
            <h4 className="font-bold text-midnight">Product</h4>
            <ul className="space-y-4 text-sm text-charcoal/60">
              <li><button onClick={() => scrollToSection('features')} className="hover:text-honey transition-colors">Features</button></li>
              <li><button onClick={() => scrollToSection('pricing')} className="hover:text-honey transition-colors">Pricing</button></li>
              <li><button onClick={() => openModal('integrations')} className="hover:text-honey transition-colors">Integrations</button></li>
            </ul>
          </div>
          <div className="space-y-6">
            <h4 className="font-bold text-midnight">Company</h4>
            <ul className="space-y-4 text-sm text-charcoal/60">
              <li><button onClick={() => openModal('about')} className="hover:text-honey transition-colors">About Us</button></li>
              <li><button onClick={() => openModal('privacy')} className="hover:text-honey transition-colors">Privacy Policy</button></li>
              <li><button onClick={() => openModal('terms')} className="hover:text-honey transition-colors">Terms of Service</button></li>
            </ul>
          </div>
        </div>
        <div className="py-8 border-t border-zinc-100 text-center text-sm text-charcoal/40">
          © {new Date().getFullYear()} LeadCrest. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description, delay }: { icon: React.ReactNode; title: string; description: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
      className="p-10 rounded-large border border-zinc-100 bg-white space-y-6 hover:border-honey/30 transition-all shadow-sm hover:shadow-xl group"
    >
      <div className="w-14 h-14 rounded-2xl bg-honey/5 flex items-center justify-center group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <div className="space-y-3">
        <h3 className="text-2xl font-bold text-midnight">{title}</h3>
        <p className="text-charcoal/70 leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center space-y-2">
      <div className="text-4xl md:text-5xl font-bold text-midnight">{value}</div>
      <div className="text-sm font-semibold text-charcoal/40 uppercase tracking-widest">{label}</div>
    </div>
  );
}
