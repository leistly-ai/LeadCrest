import { useNavigate } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { motion } from 'motion/react';
import { Check, ArrowRight, Shield, Zap, Crown } from 'lucide-react';

const PLANS = [
  {
    id: 'basic',
    name: 'Basic',
    price: '$79',
    period: 'per month',
    description: 'Perfect for individual agents starting out.',
    features: [
      'Up to 5 qualified leads per month',
      'QR Code generation',
      'WhatsApp flow simulation',
      'Basic lead scoring',
      '30-day free trial',
    ],
    icon: <Zap className="w-6 h-6 text-honey" />,
    popular: false
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$249',
    period: 'per month',
    description: 'Ideal for active agents with growing pipelines.',
    features: [
      'Up to 20 qualified leads per month',
      'Advanced lead scoring',
      'Soft credit check integration',
      'LinkedIn validation',
      'Priority support',
    ],
    icon: <Shield className="w-6 h-6 text-sage" />,
    popular: true
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '$449',
    period: 'per month',
    description: 'For high-volume agents and small teams.',
    features: [
      'Up to 50 qualified leads per month',
      'Hard credit check integration',
      'Automated document generation',
      'Ontario LTB contract builder',
      'Custom branding',
    ],
    icon: <Crown className="w-6 h-6 text-midnight" />,
    popular: false
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
                plan.id === 'free' ? 'bg-honey/10' : plan.id === 'basic' ? 'bg-sage/10' : 'bg-midnight/10'
              }`}>
                {plan.icon}
              </div>
              <div>
                <h3 className="text-xl font-bold text-midnight">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-midnight">{plan.price}</span>
                  <span className="text-sm text-charcoal/40 font-medium">{plan.period}</span>
                </div>
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
