import { useNavigate } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { motion } from 'motion/react';
import { Check, ArrowRight, Shield, Zap, Crown } from 'lucide-react';

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 'Free',
    period: 'forever',
    description: 'Try LeadCrest with basic lead capture.',
    features: [
      'Up to 5 leads per month',
      'Basic lead scoring (0-100)',
      'Web-based chat qualification',
      'Lead dashboard',
      'Email notifications',
    ],
    icon: <Zap className="w-6 h-6 text-honey" />,
    popular: false,
    priceDetail: 'No credit card required'
  },
  {
    id: 'professional',
    name: 'Professional',
    price: '$149',
    period: 'per month',
    description: 'Pre-qualified, verified leads ready to close.',
    features: [
      'Up to 50 leads per month',
      'Advanced lead scoring + AI insights',
      '10 soft credit checks included',
      'Employment verification (Plaid)',
      'Automated document signing',
      'FINTRAC compliance tracking',
      'Priority email support',
    ],
    icon: <Shield className="w-6 h-6 text-sage" />,
    popular: true,
    priceDetail: '$2 per additional credit check'
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '$349',
    period: 'per month',
    description: 'Full-service lead-to-close automation.',
    features: [
      'Unlimited leads',
      'Unlimited credit checks included',
      'Hard credit checks (Equifax/TransUnion)',
      'Multi-agent team access',
      'Custom branding & white-label',
      'API access',
      'Dedicated account manager',
      'Transaction pipeline management',
    ],
    icon: <Crown className="w-6 h-6 text-midnight" />,
    popular: false,
    priceDetail: 'Custom enterprise features available'
  }
];

export default function Pricing() {
  const navigate = useNavigate();

  const handleSelectPlan = async (planId: string) => {
    const user = auth.currentUser;
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      await updateDoc(doc(db, 'agents', user.uid), {
        subscriptionTier: planId
      });

      if (planId === 'free') {
        navigate('/onboarding');
      } else {
        // Mock payment gateway
        window.location.href = `https://checkout.stripe.com/pay/mock_${planId}`;
      }
    } catch (err) {
      console.error('Error selecting plan:', err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-12 px-4 space-y-12">
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-midnight">Choose Your Plan</h1>
        <p className="text-lg text-charcoal/60 max-w-2xl mx-auto">
          Scale your real estate business with AI-powered lead qualification. Start with our 30-day free trial.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {PLANS.map((plan) => (
          <motion.div
            key={plan.id}
            whileHover={{ y: -10 }}
            className={`relative p-8 rounded-[2.5rem] border bg-white flex flex-col space-y-8 transition-all ${
              plan.popular ? 'border-honey shadow-xl shadow-honey/10' : 'border-zinc-100 shadow-sm'
            }`}
          >
            {plan.popular && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-1 bg-honey text-midnight text-[10px] font-bold uppercase tracking-widest rounded-full">
                Most Popular
              </div>
            )}

            <div className="space-y-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                plan.id === 'starter' ? 'bg-honey/10' : plan.id === 'professional' ? 'bg-sage/10' : 'bg-midnight/10'
              }`}>
                {plan.icon}
              </div>
              <div>
                <h3 className="text-xl font-bold text-midnight">{plan.name}</h3>
                <p className="text-xs text-charcoal/60 mt-1">{plan.description}</p>
                <div className="flex items-baseline gap-1 mt-3">
                  <span className="text-4xl font-black text-midnight">{plan.price}</span>
                  <span className="text-sm text-charcoal/40 font-medium">{plan.period}</span>
                </div>
                <p className="text-[10px] text-honey font-bold uppercase tracking-wider mt-1">{plan.priceDetail}</p>
              </div>
            </div>

            <ul className="space-y-4 flex-grow">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-3 text-sm text-charcoal/70">
                  <div className="w-5 h-5 rounded-full bg-sage/10 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-sage" />
                  </div>
                  {feature}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleSelectPlan(plan.id)}
              className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${
                plan.popular 
                  ? 'bg-honey text-midnight hover:bg-honey/90' 
                  : 'bg-midnight text-white hover:bg-midnight/90'
              }`}
            >
              {plan.id === 'free' ? 'Start Free Trial' : 'Get Started'}
              <ArrowRight className="w-5 h-5" />
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
