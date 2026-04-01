import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Clock, ShieldCheck, AlertTriangle, ArrowRight, ExternalLink } from 'lucide-react';

export default function LicenseValidationSplash() {
  const navigate = useNavigate();

  return (
    <div className="max-w-2xl mx-auto py-24 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card-container p-12 text-center space-y-10"
      >
        <div className="w-24 h-24 rounded-[2rem] bg-honey/10 flex items-center justify-center mx-auto">
          <ShieldCheck className="w-12 h-12 text-honey animate-pulse" />
        </div>

        <div className="space-y-6">
          <h1 className="text-4xl font-bold tracking-tight text-midnight">Profile Submitted Successfully</h1>
          <p className="text-lg text-charcoal/60 leading-relaxed max-w-md mx-auto">
            Your real estate license number is being validated by our compliance team.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6 pt-6 border-t border-zinc-100">
          <div className="p-6 rounded-3xl bg-zinc-50 border border-zinc-100 space-y-3 text-left">
            <div className="flex items-center gap-2 text-honey font-bold text-sm uppercase tracking-widest">
              <Clock className="w-4 h-4" />
              Timeline
            </div>
            <p className="text-xs text-charcoal/70 leading-relaxed">
              Validation typically takes <span className="font-bold text-midnight">2 business days</span>. You can still access your dashboard during this time.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-red-50 border border-red-100 space-y-3 text-left">
            <div className="flex items-center gap-2 text-red-500 font-bold text-sm uppercase tracking-widest">
              <AlertTriangle className="w-4 h-4" />
              Compliance
            </div>
            <p className="text-xs text-charcoal/70 leading-relaxed">
              If your license is found invalid, your <span className="font-bold text-midnight">QR code will be disabled</span> immediately and access revoked within 10 days.
            </p>
          </div>
        </div>

        <div className="space-y-4 pt-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="btn-primary w-full py-5 flex items-center justify-center gap-3 text-lg"
          >
            Go to Dashboard
            <ArrowRight className="w-6 h-6" />
          </button>
          
          <div className="flex items-center justify-center gap-2 text-xs text-charcoal/40">
            Questions? Contact{' '}
            <a href="mailto:admin@leistly.com" className="text-honey font-bold hover:underline flex items-center gap-1">
              Support <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
