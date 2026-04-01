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

export type LeadStatus = 'cold' | 'warm' | 'completion';
export type LeadType = 'buy' | 'rent';

export interface Lead {
  id: string;
  agentId: string;
  name: string;
  email: string;
  phone: string;
  currentAddress: string;
  type: LeadType;
  score: number;
  status: LeadStatus;
  softCreditCheck?: {
    rating: string;
    defaults: boolean;
    source: string;
  };
  employmentInfo?: {
    company: string;
    salary: string;
    validated: boolean;
  };
  documents?: string[];
  createdAt: string;
}
