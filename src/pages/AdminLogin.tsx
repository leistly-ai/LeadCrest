import { useState } from 'react';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ShieldCheck, AlertCircle, ArrowRight, Mail, Lock } from 'lucide-react';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (email !== 'admin@leistly.com') {
      setError('Unauthorized access. This portal is for administrators only.');
      setLoading(false);
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/admin');
    } catch (err: any) {
      console.error('Admin login error:', err);
      setError('Invalid credentials or unauthorized access.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      if (result.user.email === 'admin@leistly.com') {
        navigate('/admin');
      } else {
        await auth.signOut();
        setError('Unauthorized access. This portal is for administrators only.');
      }
    } catch (err: any) {
      console.error('Admin Google login error:', err);
      setError(err.message || 'An error occurred during Google login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[2.5rem] p-12 space-y-10 shadow-2xl border border-zinc-100"
      >
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-midnight rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-midnight/20">
            <ShieldCheck className="w-10 h-10 text-honey" />
          </div>
          <h2 className="text-3xl font-black tracking-tighter text-midnight">Control Center</h2>
          <p className="text-charcoal/60 font-medium">Restricted Administrative Access</p>
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

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-3">
            <label className="text-[11px] font-black text-midnight/40 uppercase tracking-[0.2em] ml-1">
              Admin Email
            </label>
            <div className="relative group">
              <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-midnight/20 group-focus-within:text-honey transition-colors" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-14 pr-6 py-5 rounded-2xl bg-zinc-50 border border-zinc-100 focus:border-honey focus:bg-white outline-none transition-all text-base font-bold text-midnight placeholder:text-midnight/20"
                placeholder="admin@leistly.com"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[11px] font-black text-midnight/40 uppercase tracking-[0.2em] ml-1">
              Secret Key
            </label>
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
            {loading ? 'Verifying...' : 'Authorize Access'}
            {!loading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
          </button>
        </form>

        <div className="relative py-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-100"></div>
          </div>
          <div className="relative flex justify-center text-[10px] font-black uppercase tracking-[0.3em] text-midnight/20">
            <span className="bg-white px-6">Secure SSO</span>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full py-5 px-6 border-2 border-zinc-100 rounded-2xl flex items-center justify-center gap-4 hover:bg-zinc-50 hover:border-zinc-200 transition-all disabled:opacity-50 font-black text-base text-midnight"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="Google" />
          Admin Google Auth
        </button>
      </motion.div>
    </div>
  );
}
