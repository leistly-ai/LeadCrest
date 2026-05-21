import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, sendPasswordResetEmail } from 'firebase/auth';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, ArrowRight, ShieldCheck, AlertCircle, Smartphone } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../utils/firestore-errors';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // No-op: recent payments listener removed
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password. If you signed up with Google, please use the Google login button below.');
      } else {
        setError(err.message || 'An error occurred during login.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address first.');
      return;
    }
    setError('');
    setMessage('');
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('Password reset email sent! Check your inbox.');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email.');
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Google login error:', err);
      setError(err.message || 'An error occurred during Google login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-24">
      <div className="grid lg:grid-cols-2 gap-20 items-center">
        {/* Login Form */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-[2.5rem] p-12 space-y-10 shadow-2xl shadow-midnight/5 border border-zinc-100"
        >
          <div className="space-y-4">
            <div className="w-16 h-16 bg-honey/10 rounded-2xl flex items-center justify-center mb-6">
              <ShieldCheck className="w-8 h-8 text-honey" />
            </div>
            <h2 className="text-4xl font-black tracking-tighter text-midnight">Agent Portal</h2>
            <p className="text-charcoal/60 font-medium">Secure access to your LeadCrest intelligence.</p>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-5 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-sm font-bold flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              {error}
            </motion.div>
          )}

          {message && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-5 rounded-2xl bg-sage/10 border border-sage/20 text-sage text-sm font-bold"
            >
              {message}
            </motion.div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-3">
              <label className="text-[11px] font-black text-midnight/40 uppercase tracking-[0.2em] ml-1">
                Email Address
              </label>
              <div className="relative group">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-midnight/20 group-focus-within:text-honey transition-colors" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-14 pr-6 py-5 rounded-2xl bg-zinc-50 border border-zinc-100 focus:border-honey focus:bg-white outline-none transition-all text-base font-bold text-midnight placeholder:text-midnight/20"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center ml-1">
                <label className="text-[11px] font-black text-midnight/40 uppercase tracking-[0.2em]">
                  Password
                </label>
                <button 
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-[10px] font-black text-honey hover:text-midnight transition-colors uppercase tracking-widest"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative group">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-midnight/20 group-focus-within:text-honey transition-colors" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-14 pr-6 py-5 rounded-2xl bg-zinc-50 border border-zinc-100 focus:border-honey focus:bg-white outline-none transition-all text-base font-bold text-midnight placeholder:text-midnight/20"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 rounded-2xl bg-midnight hover:bg-[#2a4a75] text-white font-black transition-all flex items-center justify-center gap-3 shadow-xl shadow-midnight/20 disabled:opacity-50 group text-lg"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
              {!loading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
            </button>
          </form>

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-100"></div>
            </div>
            <div className="relative flex justify-center text-[10px] font-black uppercase tracking-[0.3em] text-midnight/20">
              <span className="bg-white px-6">Enterprise SSO</span>
            </div>
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-5 px-6 border-2 border-zinc-100 rounded-2xl flex items-center justify-center gap-4 hover:bg-zinc-50 hover:border-zinc-200 transition-all disabled:opacity-50 font-black text-base text-midnight"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="Google" />
            Continue with Google
          </button>

          <div className="text-center pt-4">
            <p className="text-sm font-medium text-charcoal/40">
              New to LeadCrest?{' '}
              <Link to="/signup" className="text-honey font-black hover:text-midnight transition-colors">
                Create an account
              </Link>
            </p>
          </div>
        </motion.div>

        {/* Benefits & Activity Section */}
        <div className="space-y-12">
          <div className="space-y-4">
            <h3 className="text-3xl font-black tracking-tighter text-midnight">Why Agents Choose LeadCrest</h3>
            <p className="text-lg text-charcoal/60 leading-relaxed">
              Join thousands of licensed professionals who have automated their lead qualification pipeline.
            </p>
            <div className="grid gap-8">
            <BenefitItem 
              icon={<ShieldCheck className="w-6 h-6 text-honey" />}
              title="Verified Intelligence"
              description="Every lead is cross-referenced with LinkedIn and soft credit data."
            />
            <BenefitItem 
              icon={<Smartphone className="w-6 h-6 text-honey" />}
              title="Instant Deployment"
              description="Generate your unique QR code and start capturing leads in seconds."
            />
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}

function BenefitItem({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex gap-6 p-6 rounded-3xl hover:bg-white hover:shadow-xl hover:shadow-midnight/5 transition-all group">
      <div className="w-14 h-14 rounded-2xl bg-honey/5 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <div className="space-y-1">
        <h4 className="text-xl font-bold text-midnight">{title}</h4>
        <p className="text-sm text-charcoal/60 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
