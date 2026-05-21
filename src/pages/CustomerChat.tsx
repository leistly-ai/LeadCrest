import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Agent } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Send, User, MessageSquare, CheckCircle2, Phone, Mail, MapPin, Briefcase, DollarSign, Clock, Home, Target, CreditCard } from 'lucide-react';
import { scheduleWelcomeEmail } from '../utils/emailScheduler';

interface Message {
  id: string;
  text: string;
  sender: 'bot' | 'user';
  type?: 'input' | 'choice' | 'text';
}

const QUESTIONS = [
  { id: 'name',             text: "Hi! I'm your real estate assistant. What's your full name?", icon: <User className="w-5 h-5" /> },
  { id: 'email',            text: "Great to meet you! What's your email address?", icon: <Mail className="w-5 h-5" /> },
  { id: 'phone',            text: "And your best phone number?", icon: <Phone className="w-5 h-5" /> },
  { id: 'currentAddress',   text: "What's your current home address?", icon: <MapPin className="w-5 h-5" /> },
  { id: 'type',             text: "Are you looking to buy or rent a property?", icon: <Home className="w-5 h-5" />, choices: ['Buy', 'Rent'] },
  { id: 'timeline',         text: "What's your timeline for moving?", icon: <Clock className="w-5 h-5" />, choices: ['ASAP', '1–3 months', '3–6 months', 'Just exploring'] },
  { id: 'budget',           text: "What's your budget or price range? (e.g. $400k–$600k)", icon: <DollarSign className="w-5 h-5" /> },
  { id: 'preApproved',      text: "Have you been pre-approved for a mortgage?", icon: <CreditCard className="w-5 h-5" />, choices: ['Yes, pre-approved', 'In process', 'Not yet'] },
  { id: 'downPaymentReady', text: "Do you have a down payment ready?", icon: <CreditCard className="w-5 h-5" />, choices: ['Yes, 20%+', 'Yes, less than 20%', 'Financing entirely', 'Not yet'] },
  { id: 'locationPreference', text: "Which neighbourhood or area are you interested in?", icon: <MapPin className="w-5 h-5" /> },
  { id: 'motivation',       text: "What's your main reason for moving?", icon: <Target className="w-5 h-5" />, choices: ['Relocating / job change', 'Upgrading / downsizing', 'Investment', 'Just exploring'] },
  { id: 'company',          text: "Who is your current employer?", icon: <Briefcase className="w-5 h-5" /> },
  { id: 'salary',           text: "What's your approximate annual household income?", icon: <DollarSign className="w-5 h-5" /> },
];

export default function CustomerChat() {
  const { agentId } = useParams();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', text: "Connecting to agent...", sender: 'bot' }
  ]);
  const [currentStep, setCurrentStep] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isFinished, setIsFinished] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!agentId) return;
    const fetchAgent = async () => {
      const agentDoc = await getDoc(doc(db, 'agents', agentId));
      if (agentDoc.exists()) {
        setAgent(agentDoc.data() as Agent);
        setMessages([
          { id: 'welcome', text: `Hi! I'm the assistant for ${agentDoc.data().name}. Let's get you qualified for your next home!`, sender: 'bot' },
          { id: 'q1', text: QUESTIONS[0].text, sender: 'bot' }
        ]);
      }
    };
    fetchAgent();
  }, [agentId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      window.close();
      return;
    }
    const timer = setTimeout(() => setCountdown(c => (c ?? 1) - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    const currentQuestion = QUESTIONS[currentStep];
    const newAnswers = { ...answers, [currentQuestion.id]: text };
    setAnswers(newAnswers);

    setMessages(prev => [...prev, { id: Date.now().toString(), text, sender: 'user' }]);
    setInputValue('');

    if (currentStep < QUESTIONS.length - 1) {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        setCurrentStep(prev => prev + 1);
        setMessages(prev => [...prev, { id: Date.now().toString(), text: QUESTIONS[currentStep + 1].text, sender: 'bot' }]);
      }, 1000);
    } else {
      // Final step: Calculate score and save lead
      setIsTyping(true);
      setTimeout(async () => {
        setIsTyping(false);
        setMessages(prev => [...prev, { id: 'final', text: "Thank you! We're analyzing your profile and a real estate agent will be in touch shortly.", sender: 'bot' }]);
        setIsFinished(true);
        setCountdown(5);

        // Call scoring API with all new fields
        const response = await fetch('/api/score-lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newAnswers),
        });
        const { score } = await response.json();
        const status = score >= 70 ? 'hot' : score >= 45 ? 'warm' : 'cold';

        // Save to Firestore with all qualification fields
        const leadDoc = await addDoc(collection(db, 'leads'), {
          agentId,
          name: newAnswers.name || '',
          email: newAnswers.email || '',
          phone: newAnswers.phone || '',
          currentAddress: newAnswers.currentAddress || '',
          type: (newAnswers.type || 'buy').toLowerCase().includes('rent') ? 'rent' : 'buy',
          timeline: newAnswers.timeline || '',
          budget: newAnswers.budget || '',
          preApproved: newAnswers.preApproved || '',
          downPaymentReady: newAnswers.downPaymentReady || '',
          locationPreference: newAnswers.locationPreference || '',
          motivation: newAnswers.motivation || '',
          employmentInfo: {
            company: newAnswers.company || '',
            salary: newAnswers.salary || '',
            validated: false,
          },
          verification: {
            creditCheckCompleted: false,
            employmentVerified: false,
            identityVerified: false
          },
          score,
          status,
          source: 'qr-chat',
          createdAt: new Date().toISOString(),
        });

        // Schedule automated email drip campaign
        try {
          await scheduleWelcomeEmail(
            leadDoc.id,
            agentId,
            newAnswers.email || '',
            newAnswers.name || '',
            agent?.name || 'Your Agent'
          );
        } catch (emailErr) {
          console.error('Failed to schedule emails:', emailErr);
        }
      }, 1500);
    }
  };

  if (!agent) return <div className="p-12 text-center text-charcoal opacity-50">Loading chat...</div>;

  return (
    <div className="max-w-2xl mx-auto h-[85vh] flex flex-col bg-[#E5DDD5] rounded-3xl border border-zinc-200 overflow-hidden shadow-2xl">
      {/* Chat Header */}
      <div className="p-4 bg-[#075E54] flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-zinc-200 flex items-center justify-center font-bold text-[#075E54] border-2 border-white/20">
            {agent.name[0]}
          </div>
          <div>
            <h2 className="font-bold text-white text-sm">{agent.name}</h2>
            <p className="text-[10px] text-white/70 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] animate-pulse" />
              Online Assistant
            </p>
          </div>
        </div>
        <div className="flex gap-4 text-white/80">
          <Phone className="w-5 h-5 cursor-not-allowed opacity-50" />
          <Send className="w-5 h-5 rotate-45 cursor-not-allowed opacity-50" />
        </div>
      </div>

      {/* Messages Area */}
      <div
        className="flex-grow overflow-y-auto p-6 space-y-3 scrollbar-hide"
        style={{
          backgroundImage: `url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")`,
          backgroundBlendMode: 'overlay',
          backgroundColor: '#E5DDD5'
        }}
      >
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className={`flex ${msg.sender === 'bot' ? 'justify-start' : 'justify-end'}`}
            >
              <div className={`relative max-w-[85%] p-3 rounded-xl text-[13px] leading-relaxed shadow-sm ${
                msg.sender === 'bot'
                  ? 'bg-white text-zinc-800 rounded-tl-none'
                  : 'bg-[#DCF8C6] text-zinc-800 rounded-tr-none'
              }`}>
                {msg.text}
                <div className="text-[9px] text-zinc-400 text-right mt-1">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </motion.div>
          ))}
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="bg-white p-3 rounded-xl rounded-tl-none border border-zinc-100 flex gap-1 shadow-sm">
                <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce" />
                <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      {!isFinished && (
        <div className="p-3 bg-[#F0F0F0] flex items-center gap-2">
          {QUESTIONS[currentStep]?.choices ? (
            <div className="flex flex-wrap gap-2 w-full">
              {QUESTIONS[currentStep].choices.map(choice => (
                <button
                  key={choice}
                  onClick={() => handleSend(choice)}
                  className="flex-grow py-2.5 px-4 rounded-full bg-white border border-zinc-200 text-[#075E54] hover:bg-[#075E54] hover:text-white transition-all font-bold text-xs shadow-sm"
                >
                  {choice}
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="flex-grow relative">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend(inputValue)}
                  placeholder="Type a message"
                  className="w-full px-5 py-3 rounded-full bg-white border-none focus:ring-0 outline-none text-sm text-zinc-800 placeholder:text-zinc-400 shadow-sm"
                />
              </div>
              <button
                onClick={() => handleSend(inputValue)}
                className="w-12 h-12 rounded-full bg-[#075E54] hover:bg-[#128C7E] text-white flex items-center justify-center transition-all shadow-lg active:scale-95"
              >
                <Send className="w-5 h-5 ml-0.5" />
              </button>
            </>
          )}
        </div>
      )}

      {isFinished && (
        <div className="p-6 text-center space-y-3 bg-white border-t border-zinc-100">
          <div className="w-10 h-10 rounded-full bg-[#25D366]/20 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-5 h-5 text-[#25D366]" />
          </div>
          <h3 className="font-bold text-zinc-800 text-sm">Application Sent!</h3>
          <p className="text-[11px] text-zinc-500">Your profile has been shared with {agent.name}. They will contact you shortly.</p>
          {countdown !== null && countdown > 0 && (
            <p className="text-[10px] text-zinc-400">This window will close in {countdown}s...</p>
          )}
        </div>
      )}
    </div>
  );
}
