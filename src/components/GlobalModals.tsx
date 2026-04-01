import React from 'react';
import { useModal } from '../contexts/ModalContext';
import Modal from './Modal';
import { Shield, Scale, Lock, UserCheck, CheckCircle2, Hash, MessageSquare, FileText, Users, Database, Target, Zap, Workflow, Phone } from 'lucide-react';

export default function GlobalModals() {
  const { activeModal, closeModal } = useModal();

  return (
    <>
      <Modal 
        isOpen={activeModal === 'about'} 
        onClose={closeModal} 
        title="Our Vision"
      >
        <div className="space-y-6">
          <p className="text-[#64748B] leading-[1.6] tracking-[0.02em]">
            Leadcrest’s mission is to bridge the gap between businesses and their ideal audience through AI-driven precision. We believe that identifying the right alignment shouldn't be a manual struggle, but a seamless, intelligent process.
          </p>
          <div className="h-px bg-zinc-100 w-full" />
          <p className="text-[#64748B] leading-[1.6] tracking-[0.02em]">
            Leadcrest is powered by the foundational technology of <strong>Leistly AI</strong>, a company dedicated to building the future of intelligent business operations. Together, we are redefining how professionals interact with data.
          </p>
        </div>
      </Modal>

      <Modal 
        isOpen={activeModal === 'integrations'} 
        onClose={closeModal} 
        title="Seamless Connectivity"
      >
        <div className="space-y-8">
          <p className="text-[#64748B] leading-[1.6] tracking-[0.02em]">
            Leadcrest fits effortlessly into your workflow, syncing critical alignment data where you need it most.
          </p>
          
          <div className="space-y-8">
            <section className="space-y-4">
              <div className="inline-flex px-3 py-1 bg-[#F97316] text-white text-[10px] font-bold uppercase tracking-widest rounded-full">
                Workspace Tools
              </div>
              <div className="flex gap-6">
                <IntegrationIcon icon={<Hash className="w-6 h-6" />} name="Slack" />
                <IntegrationIcon icon={<MessageSquare className="w-6 h-6" />} name="Microsoft Teams" />
                <IntegrationIcon icon={<FileText className="w-6 h-6" />} name="Notion" />
              </div>
              <p className="text-sm text-[#64748B]">Ensure team-wide alignment with instant notifications and shared workspaces.</p>
            </section>

            <section className="space-y-4">
              <div className="inline-flex px-3 py-1 bg-[#F97316] text-white text-[10px] font-bold uppercase tracking-widest rounded-full">
                Contact Platforms
              </div>
              <div className="flex gap-6">
                <IntegrationIcon icon={<Users className="w-6 h-6" />} name="HubSpot" />
                <IntegrationIcon icon={<Database className="w-6 h-6" />} name="Salesforce" />
                <IntegrationIcon icon={<Target className="w-6 h-6" />} name="Pipedrive" />
                <IntegrationIcon icon={<Phone className="w-6 h-6" />} name="Twilio" />
              </div>
              <p className="text-sm text-[#64748B]">Populate your CRM with verified high-intent customer profiles for immediate action.</p>
            </section>

            <section className="space-y-4">
              <div className="inline-flex px-3 py-1 bg-[#F97316] text-white text-[10px] font-bold uppercase tracking-widest rounded-full">
                Automation
              </div>
              <div className="flex gap-6">
                <IntegrationIcon icon={<Zap className="w-6 h-6" />} name="Zapier" />
                <IntegrationIcon icon={<Workflow className="w-6 h-6" />} name="Make.com" />
              </div>
              <p className="text-sm text-[#64748B]">Trigger multi-channel outreach workflows based on real-time alignment scores.</p>
            </section>
          </div>

          <div className="pt-4 text-center">
            <p className="text-xs text-[#64748B]">
              Don't see your stack? <button className="text-[#F97316] font-bold hover:underline">Request an integration</button>
            </p>
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={activeModal === 'privacy'} 
        onClose={closeModal} 
        title="Your Data, Protected"
      >
        <div className="space-y-8">
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-xl bg-zinc-50 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-[#71717A]" />
            </div>
            <div className="space-y-1">
              <h4 className="text-[16px] font-bold text-[#1E293B]">Professional Data Ethics</h4>
              <p className="text-sm text-[#64748B]">We only process public and professional information to ensure the highest standards of privacy and relevance.</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-xl bg-zinc-50 flex items-center justify-center shrink-0">
              <Scale className="w-5 h-5 text-[#71717A]" />
            </div>
            <div className="space-y-1">
              <h4 className="text-[16px] font-bold text-[#1E293B]">Compliance</h4>
              <p className="text-sm text-[#64748B]">Our operations are fully compliant with GDPR and CCPA standards, protecting users across global jurisdictions.</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-xl bg-zinc-50 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5 text-[#71717A]" />
            </div>
            <div className="space-y-1">
              <h4 className="text-[16px] font-bold text-[#1E293B]">Data Security</h4>
              <p className="text-sm text-[#64748B]">We utilize industry-standard encryption protocols (AES-256) for all data at rest and in transit.</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-xl bg-zinc-50 flex items-center justify-center shrink-0">
              <UserCheck className="w-5 h-5 text-[#71717A]" />
            </div>
            <div className="space-y-1">
              <h4 className="text-[16px] font-bold text-[#1E293B]">User Rights</h4>
              <p className="text-sm text-[#64748B]">You maintain full control over your data. Request data deletion or export at any time through our support portal.</p>
            </div>
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={activeModal === 'terms'} 
        onClose={closeModal} 
        title="Terms of Engagement"
      >
        <div className="space-y-6">
          <ul className="space-y-4">
            {[
              'Acceptable use of AI insights for professional and ethical business purposes only.',
              'Subscription billing clarity: transparent monthly or annual cycles with no hidden fees.',
              'Service delivery is provided on an "As-Is" basis with high availability targets.',
              'All intellectual property remains the exclusive property of Leadcrest and Leistly AI.',
              'Prohibited use: strictly no spamming, data scraping, or unauthorized redistribution.',
              'Compliance with all applicable local and international data protection laws.',
            ].map((point, i) => (
              <li key={i} className="flex gap-4 text-sm text-[#64748B] leading-[1.6]">
                <CheckCircle2 className="w-5 h-5 text-[#F97316] shrink-0" />
                {point}
              </li>
            ))}
          </ul>
        </div>
      </Modal>
    </>
  );
}

function IntegrationIcon({ icon, name }: { icon: React.ReactNode; name: string }) {
  return (
    <div className="group flex flex-col items-center gap-2">
      <div className="w-12 h-12 rounded-xl bg-zinc-50 flex items-center justify-center text-[#71717A] group-hover:text-[#F97316] group-hover:bg-[#F97316]/5 transition-all duration-300">
        {icon}
      </div>
      <span className="text-[10px] font-bold text-[#1E293B] uppercase tracking-wider group-hover:text-[#F97316] transition-colors">{name}</span>
    </div>
  );
}
