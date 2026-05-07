export type SubscriptionTier = 'free' | 'basic' | 'pro' | 'enterprise';

export interface Agent {
  uid: string;
  name: string;
  email: string;
  phone: string;
  subscriptionTier: SubscriptionTier;
  trialEndDate: string;
  qrCodeUrl?: string;
  licenseNumber?: string;
  specializedCities?: string[];
  propertyTypes?: string[];
  isOnboarded: boolean;
  licenseStatus: 'pending' | 'valid' | 'invalid';
  licenseVerified: boolean;
  isAccessEnabled: boolean;
  googleContactsConnected?: boolean;
  googleEmail?: string;
  googleRefreshToken?: string;
  googleContacts?: any;
  lastSyncAt?: string;
  licenseInvalidDate?: string;
  createdAt: string;
}

export type LeadStatus = 'cold' | 'warm' | 'hot' | 'completion';
export type LeadType = 'buy' | 'rent';

export interface Lead {
  id: string;
  agentId: string;
  name: string;
  email: string;
  phone: string;
  currentAddress: string;
  type: LeadType;
  // Scoring fields
  timeline: string;           // "asap" | "1-3 months" | "3-12 months" | "just looking"
  budget: string;             // e.g. "$400k-$600k"
  preApproved: string;        // "yes" | "pre-qualified" | "no" | "unknown"
  downPaymentReady: string;   // "yes 20%+" | "yes <20%" | "financing" | "no"
  locationPreference: string; // specific area or neighbourhood
  motivation: string;         // "relocating" | "upgrading" | "investment" | "exploring"
  score: number;
  status: LeadStatus;
  source?: string;
  employmentInfo?: {
    company: string;
    salary: string;
    validated: boolean;
  };
  softCreditCheck?: {
    rating: string;
    defaults: boolean;
    source: string;
  };
  documents?: string[];
  createdAt: string;
}
