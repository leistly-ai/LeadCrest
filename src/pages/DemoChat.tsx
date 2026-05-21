import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Send, User, MessageSquare, CheckCircle2, Phone, Mail, MapPin, Briefcase, DollarSign, Clock, Home, Target, CreditCard, Star, ThumbsUp, ThumbsDown } from 'lucide-react';

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

const FEEDBACK_QUESTIONS = [
  { id: 'rating', text: "How was your experience going through these questions?", choices: ['⭐ Excellent', '⭐ Good', '⭐ Average', '⭐ Poor'] },
  { id: 'wouldUse', text: "If you were looking for a home, would you be willing to go through a similar set of questions to get matched with a well-suited and personalized agent who meets your needs?", choices: ['Yes, definitely', 'Yes, probably', 'Not sure', 'No, probably not'] },
  { id: 'mostValuable', text: "What would be most valuable to you about getting matched with an agent this way?", choices: ['Save time', 'Better personalization', 'Agent knows my needs upfront', 'Skip repeated questions'] },
];

export default function DemoChat() {
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([
    { id: 'welcome', text: "Hi! Welcome to the LeadCrest demo experience. I'll ask you a few questions just like a real estate agent would. This is completely anonymous – we won't save any of your information.", sender: 'bot' },
    { id: 'q1', text: QUESTIONS[0].text, sender: 'bot' }
  ]);
  const [currentStep, setCurrentStep] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isFinished, setIsFinished] = useState(false);
  const [feedbackPhase, setFeedbackPhase] = useState(false);
  const [feedbackStep, setFeedbackStep] = useState(0);
  const [feedbackAnswers, setFeedbackAnswers] = useState<Record<string, string>>({});
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    if (feedbackPhase) {
      // Handle feedback questions
      const currentFeedbackQ = FEEDBACK_QUESTIONS[feedbackStep];
      const newFeedback = { ...feedbackAnswers, [currentFeedbackQ.id]: text };
      setFeedbackAnswers(newFeedback);

      setMessages(prev => [...prev, { id: Date.now().toString(), text, sender: 'user' }]);
      setInputValue('');

      if (feedbackStep < FEEDBACK_QUESTIONS.length - 1) {
        setIsTyping(true);
        setTimeout(() => {
          setIsTyping(false);
          setFeedbackStep(prev => prev + 1);
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            text: FEEDBACK_QUESTIONS[feedbackStep + 1].text,
            sender: 'bot'
          }]);
        }, 1000);
      } else {
        // All feedback collected
        setIsTyping(true);
        setTimeout(() => {
          setIsTyping(false);
          setMessages(prev => [...prev, {
            id: 'final-thanks',
            text: "Thank you for your feedback! 🎉\n\nThis demo shows how LeadCrest helps real estate agents qualify leads automatically. Want to see it in action for your business?\n\nSign up for a free trial to start capturing and qualifying your own leads!",
            sender: 'bot'
          }]);
          setIsFinished(true);
        }, 1500);
      }
      return;
    }

    // Handle main qualification questions
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
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          text: QUESTIONS[currentStep + 1].text,
          sender: 'bot'
        }]);
      }, 1000);
    } else {
      // Main questions done, move to feedback
      setIsTyping(true);
      setTimeout(async () => {
        setIsTyping(false);
        setMessages(prev => [...prev, {
          id: 'transition',
          text: "Perfect! You've completed the qualification flow. ✅\n\nNow I'd love to get your quick feedback on this experience.",
          sender: 'bot'
        }]);

        setTimeout(() => {
          setFeedbackPhase(true);
          setMessages(prev => [...prev, {
            id: 'feedback-1',
            text: FEEDBACK_QUESTIONS[0].text,
            sender: 'bot'
          }]);
        }, 2000);
      }, 1500);
    }
  };

  const currentQuestion = feedbackPhase
    ? FEEDBACK_QUESTIONS[feedbackStep]
    : QUESTIONS[currentStep];

  return (
    <div className="min-h-screen bg-linen py-8 px-4">
      <div className="max-w-2xl mx-auto h-[85vh] flex flex-col bg-[#E5DDD5] rounded-3xl border border-zinc-200 overflow-hidden shadow-2xl">
        {/* Chat Header */}
        <div className="p-4 bg-[#075E54] flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-zinc-200 flex items-center justify-center font-bold text-[#075E54] border-2 border-white/20">
              LC
            </div>
            <div>
              <h2 className="font-bold text-white text-sm">LeadCrest Demo</h2>
              <p className="text-[10px] text-white/70 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] animate-pulse" />
                Demo Assistant
              </p>
            </div>
          </div>
          <div className="px-3 py-1 bg-white/10 rounded-full text-[9px] text-white font-bold uppercase tracking-wider border border-white/20">
            Demo Mode
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
                <div className={`relative max-w-[85%] p-3 rounded-xl text-[13px] leading-relaxed shadow-sm whitespace-pre-line ${
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
            {currentQuestion?.choices ? (
              <div className="flex flex-wrap gap-2 w-full">
                {currentQuestion.choices.map(choice => (
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
          <div className="p-6 text-center space-y-4 bg-white border-t border-zinc-100">
            <div className="w-12 h-12 rounded-full bg-[#25D366]/20 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6 text-[#25D366]" />
            </div>
            <h3 className="font-bold text-zinc-800 text-base">Demo Complete!</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">This is how LeadCrest qualifies leads for real estate agents automatically.</p>
            <div className="flex gap-3 pt-2">
              <a
                href="/signup"
                className="flex-1 py-3 px-6 bg-[#D4A373] hover:bg-[#c29262] text-white font-bold rounded-xl transition-all text-sm"
              >
                Start Free Trial
              </a>
              <a
                href="/"
                className="flex-1 py-3 px-6 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold rounded-xl transition-all text-sm"
              >
                Back to Home
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
