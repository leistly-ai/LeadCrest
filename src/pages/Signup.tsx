import { useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { User, Mail, Lock, Phone, ArrowRight, ShieldCheck, KeyRound, CheckCircle2 } from 'lucide-react';

type SignupStep = 'details' | 'verification';

export default function Signup() {
  const [step, setStep] = useState<SignupStep>('details');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const createAgentDoc = async (user: any, agentName: string, agentEmail: string, agentPhone: string, tier: string) => {
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 30);

    await setDoc(doc(db, 'agents', user.uid), {
      uid: user.uid,
      name: agentName,
      email: agentEmail,
      phone: agentPhone,
      subscriptionTier: tier,
      trialEndDate: trialEndDate.toISOString(),
      isOnboarded: false,
      isAccessEnabled: true,
      licenseVerified: false,
      licenseStatus: 'pending',
      createdAt: new Date().toISOString(),
    });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (step === 'details') {
      setLoading(true);
      // Simulate sending OTPs
      setTimeout(() => {
        setStep('verification');
        setLoading(false);
      }, 1500);
      return;
    }

    if (emailOtp !== '123456' || phoneOtp !== '123456') {
      setError('Invalid verification codes. For demo purposes, use 123456 for both.');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: name });
      await createAgentDoc(user, name, email, phone, 'free');

      navigate('/pricing');
    } catch (err: any) {
      console.error('Signup error:', err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Email/Password signup is not enabled in the Firebase Console. Please enable it under Authentication > Sign-in method, or use the "Sign up with Google" button below.');
      } else {
        setError(err.message || 'An error occurred during signup.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if agent doc already exists
      const agentDoc = await getDoc(doc(db, 'agents', user.uid));
      if (!agentDoc.exists()) {
        await createAgentDoc(user, user.displayName || 'New Agent', user.email || '', '', 'free');
        navigate('/pricing');
      } else {
        const data = agentDoc.data();
        if (data?.isOnboarded) {
          navigate('/dashboard');
        } else {
          navigate('/onboarding');
        }
      }
    } catch (err: any) {
      console.error('Google signup error:', err);
      setError(err.message || 'An error occurred during Google signup.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto pt-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card-container p-8 space-y-8"
      >
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-midnight">
            {step === 'details' ? 'Create Agent Account' : 'Verify Identity'}
          </h1>
          <p className="text-charcoal opacity-80">
            {step === 'details' 
              ? 'Use any email address to start your 30-day free trial.'
              : `We've sent verification codes to ${email} and ${phone}.`}
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-custom bg-red-50 border border-red-200 text-red-600 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-6">
          {step === 'details' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-charcoal flex items-center gap-2">
                  <User className="w-4 h-4 text-midnight" /> Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field"
                  placeholder="John Doe"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-charcoal flex items-center gap-2">
                  <Mail className="w-4 h-4 text-midnight" /> Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  placeholder="john@example.com"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-charcoal flex items-center gap-2">
                  <Phone className="w-4 h-4 text-midnight" /> Phone Number
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input-field"
                  placeholder="+1 (555) 000-0000"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-charcoal flex items-center gap-2">
                  <Lock className="w-4 h-4 text-midnight" /> Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                  placeholder="••••••••"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-sm font-medium text-charcoal flex items-center gap-2">
                  <Mail className="w-4 h-4 text-midnight" /> Email OTP
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={emailOtp}
                    onChange={(e) => setEmailOtp(e.target.value)}
                    className="input-field pl-10 tracking-[0.5em] font-mono text-center"
                    placeholder="000000"
                  />
                  <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-charcoal/40" />
                </div>
                <p className="text-[10px] text-charcoal/40 uppercase tracking-widest">Check your inbox for the code</p>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-charcoal flex items-center gap-2">
                  <Phone className="w-4 h-4 text-midnight" /> Phone OTP
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={phoneOtp}
                    onChange={(e) => setPhoneOtp(e.target.value)}
                    className="input-field pl-10 tracking-[0.5em] font-mono text-center"
                    placeholder="000000"
                  />
                  <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-charcoal/40" />
                </div>
                <p className="text-[10px] text-charcoal/40 uppercase tracking-widest">Check your SMS messages</p>
              </div>

              <div className="flex items-center gap-2 p-3 bg-sage/5 border border-sage/10 rounded-xl text-sage text-xs">
                <ShieldCheck className="w-4 h-4" />
                Secure multi-factor authentication enabled
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-4 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              step === 'details' ? 'Sending Codes...' : 'Verifying...'
            ) : (
              step === 'details' ? 'Continue to Verification' : 'Verify & Create Account'
            )}
            {!loading && <ArrowRight className="w-5 h-5" />}
          </button>

          {step === 'verification' && (
            <button
              type="button"
              onClick={() => setStep('details')}
              className="w-full text-center text-sm text-charcoal/60 hover:text-midnight transition-colors"
            >
              Back to details
            </button>
          )}
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-200"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-zinc-500">Or use your Google account</span>
          </div>
        </div>

        <button
          onClick={handleGoogleSignup}
          disabled={loading}
          className="w-full py-3 px-4 border border-zinc-200 rounded-custom flex items-center justify-center gap-3 hover:bg-zinc-50 transition-colors disabled:opacity-50"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
          <span className="text-sm font-semibold text-midnight">Sign up with Google</span>
        </button>

        <div className="text-center text-sm text-charcoal opacity-70">
          Already have an account?{' '}
          <Link to="/login" className="text-honey font-semibold hover:underline">
            Login
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
