import { motion } from 'motion/react';
import { Shield, Lock, Eye, Share2, AlertCircle } from 'lucide-react';

export default function PrivacyPolicy() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4 text-center"
      >
        <div className="w-16 h-16 bg-honey/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Shield className="w-8 h-8 text-honey" />
        </div>
        <h1 className="text-4xl font-black text-midnight tracking-tight">Privacy Policy</h1>
        <p className="text-charcoal/60 max-w-2xl mx-auto">
          Your privacy is our top priority. This policy outlines how we collect, use, and protect your data.
        </p>
      </motion.div>

      <div className="card-container p-8 md:p-12 space-y-12 bg-white">
        {/* Google API Disclosure Section */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 text-honey">
            <Lock className="w-6 h-6" />
            <h2 className="text-2xl font-bold text-midnight">Google API Disclosure</h2>
          </div>
          <div className="p-6 rounded-3xl bg-honey/5 border border-honey/10 space-y-6">
            <p className="text-charcoal/80 leading-relaxed font-medium">
              LeadCrest’s use and transfer to any other app of information received from Google APIs will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-honey hover:underline">Google API Services User Data Policy</a>, including the Limited Use requirements.
            </p>

            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="font-bold text-midnight flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-honey text-white flex items-center justify-center text-xs">1</span>
                  Information Access and Use
                </h3>
                <p className="text-sm text-charcoal/70 pl-8">
                  When you opt-in to sync your Google Contacts, our application accesses your contact list (names and email addresses) via Google OAuth Scopes. This information is used solely to provide and improve the user-facing features of LeadCrest.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-midnight flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-honey text-white flex items-center justify-center text-xs">2</span>
                  Data Sharing and Transfer
                </h3>
                <p className="text-sm text-charcoal/70 pl-8">
                  We do not share or transfer your Google user data to third parties, except:
                </p>
                <ul className="list-disc pl-14 text-sm text-charcoal/70 space-y-1">
                  <li>As necessary to provide or improve our user-facing features.</li>
                  <li>To comply with applicable law.</li>
                  <li>As part of a merger, acquisition, or sale of assets.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-midnight flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-honey text-white flex items-center justify-center text-xs">3</span>
                  Prohibitions
                </h3>
                <p className="text-sm text-charcoal/70 pl-8">
                  We strictly prohibit:
                </p>
                <ul className="list-disc pl-14 text-sm text-charcoal/70 space-y-1">
                  <li>Using Google contact data for serving advertisements.</li>
                  <li>Selling Google contact data to any third-party data brokers or ad networks.</li>
                  <li>Retaining Google contact data after you have disconnected your account or requested deletion.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <hr className="border-zinc-100" />

        <section className="space-y-6">
          <div className="flex items-center gap-3 text-honey">
            <Eye className="w-6 h-6" />
            <h2 className="text-2xl font-bold text-midnight">General Data Collection</h2>
          </div>
          <p className="text-charcoal/70 leading-relaxed">
            We collect information you provide directly to us when you create an account, update your profile, or use our lead qualification services. This may include your name, email address, phone number, and real estate license information.
          </p>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-3 text-honey">
            <Share2 className="w-6 h-6" />
            <h2 className="text-2xl font-bold text-midnight">How We Use Your Data</h2>
          </div>
          <p className="text-charcoal/70 leading-relaxed">
            Your data is used to provide, maintain, and improve our services, including automating lead qualification, generating QR codes, and facilitating communication between agents and potential leads.
          </p>
        </section>

        <div className="p-6 rounded-3xl bg-zinc-50 border border-zinc-100 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-charcoal/40 shrink-0 mt-1" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-midnight">Questions about your privacy?</p>
            <p className="text-sm text-charcoal/60">
              Contact our privacy team at <a href="mailto:privacy@leistly.com" className="text-honey hover:underline">privacy@leistly.com</a>
            </p>
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-charcoal/40 uppercase tracking-widest">
        Last Updated: March 24, 2026
      </div>
    </div>
  );
}
