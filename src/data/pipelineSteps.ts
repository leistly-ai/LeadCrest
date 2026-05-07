export interface StepDefinition {
  id: string;
  phase: string;
  phaseColor: string;
  title: string;
  description: string;
  docLabel: string;
  // Plain-text summary shown to the lead on the signing page
  documentSummary: string;
  // Legal acknowledgement text the lead agrees to by signing
  acknowledgement: string;
}

export const PIPELINE_STEPS: StepDefinition[] = [
  // Phase 1 — Lead to Client
  {
    id: 'reco-guide',
    phase: 'Phase 1 · Lead to Client',
    phaseColor: 'honey',
    title: 'RECO Information Guide',
    description: 'Provide before any services — explains buyer rights under TRESA.',
    docLabel: 'RECO Guide',
    documentSummary: `The RECO Information Guide is a mandatory disclosure document required under Ontario's Trust in Real Estate Services Act (TRESA 2002, as amended 2023).\n\nIt explains:\n• Your rights as a real estate consumer in Ontario\n• The difference between being a "client" (full representation) and a "self-represented party"\n• What services you can expect from a registered salesperson\n• How to file a complaint with RECO if needed\n\nThis document must be provided to you before any real estate services are rendered.`,
    acknowledgement: 'I confirm that I have received and reviewed the RECO Information Guide and understand my rights as a real estate consumer under TRESA.',
  },
  {
    id: 'bra',
    phase: 'Phase 1 · Lead to Client',
    phaseColor: 'honey',
    title: 'Buyer Representation Agreement (BRA)',
    description: 'OREA Form 300 — formalises our working relationship and fiduciary duties.',
    docLabel: 'OREA Form 300',
    documentSummary: `The Buyer Representation Agreement (OREA Form 300) is the legal contract that establishes a formal client relationship between you and your real estate agent.\n\nKey terms covered:\n• Exclusivity — your agent will represent you exclusively for the agreed property type and geographic area\n• Duration — the period during which this agreement is active\n• Commission — the agreed remuneration payable to the brokerage\n• Fiduciary duties — your agent's obligations to act in your best interest, maintain confidentiality, and disclose conflicts\n• Holdover clause — applies to properties shown during the agreement term\n\nThis agreement is required before your agent can provide advice, negotiate on your behalf, or represent you in any offer.`,
    acknowledgement: 'I agree to enter into the Buyer Representation Agreement (OREA Form 300) with the brokerage, on the terms as communicated to me, and authorise the agent to represent me in my property search.',
  },
  {
    id: 'fintrac',
    phase: 'Phase 1 · Lead to Client',
    phaseColor: 'honey',
    title: 'FINTRAC Identity Verification',
    description: 'Federal law requires photo ID verification to prevent money laundering.',
    docLabel: 'FINTRAC ID Record',
    documentSummary: `FINTRAC (Financial Transactions and Reports Analysis Centre of Canada) identity verification is a mandatory requirement under the Proceeds of Crime (Money Laundering) and Terrorist Financing Act.\n\nAll registered real estate professionals in Canada are legally obligated to verify the identity of their clients before completing a real estate transaction.\n\nWhat is collected:\n• Full legal name\n• Date of birth\n• Current address\n• Type and number of government-issued photo ID (e.g., passport, driver's licence)\n• Document issuing jurisdiction and expiry date\n\nThis information is kept confidential and is not shared with third parties except as required by law.`,
    acknowledgement: 'I consent to identity verification as required by FINTRAC regulations and confirm that the identification document I have provided is valid, current, and belongs to me.',
  },

  // Phase 2 — Mortgage Referral
  {
    id: 'consent-referral',
    phase: 'Phase 2 · Mortgage Referral',
    phaseColor: 'sage',
    title: 'Consent to Mortgage Referral',
    description: 'Written consent required before referring to a mortgage broker.',
    docLabel: 'Referral Consent Form',
    documentSummary: `Before referring you to a mortgage broker or lender, your real estate agent is required by TRESA to obtain your written consent.\n\nThis consent covers:\n• Your agreement to be referred to a specific mortgage broker or advisor\n• Disclosure that your agent may receive a referral fee for this introduction\n• The specific contact information to be shared: name, phone number, email address, and home address\n\nYou are under no obligation to use the referred mortgage professional and may seek financing independently. This consent can be withdrawn at any time prior to the referral being made.`,
    acknowledgement: 'I consent to being referred to a mortgage broker/advisor by my real estate agent, and to the sharing of my basic contact information (name, phone, email, address) for this purpose. I understand my agent may receive a referral fee for this introduction.',
  },
  {
    id: 'mortgage-docs',
    phase: 'Phase 2 · Mortgage Referral',
    phaseColor: 'sage',
    title: 'Mortgage Document Collection',
    description: 'Employment Letter, Pay Stubs, NOA (2 yrs), Proof of Down Payment.',
    docLabel: 'Mortgage Package',
    documentSummary: `To support your mortgage application, your agent is requesting the following standard financial documents on behalf of your mortgage advisor.\n\nDocuments required:\n\n📋 Employment & Income\n• Employment confirmation letter (on company letterhead)\n• 2–3 most recent pay stubs\n\n📋 Tax Documents\n• Notice of Assessment (NOA) from CRA — last 2 years\n\n📋 Down Payment\n• 90 days of bank statements for all accounts contributing to your down payment (showing source of funds)\n\nAll documents are handled confidentially and will only be shared with your mortgage advisor and, where required, the lender.`,
    acknowledgement: 'I confirm that I have been informed of the mortgage documentation requirements and consent to my real estate agent collecting and forwarding these documents to my mortgage advisor for the purpose of securing financing.',
  },

  // Phase 3 — Transaction
  {
    id: 'aps',
    phase: 'Phase 3 · Transaction',
    phaseColor: 'midnight',
    title: 'Agreement of Purchase & Sale (APS)',
    description: 'OREA Form 100 — the core purchase contract.',
    docLabel: 'OREA Form 100',
    documentSummary: `The Agreement of Purchase and Sale (OREA Form 100) is the legally binding contract to purchase the property.\n\nThis document covers:\n• Property address and legal description\n• Purchase price and deposit amount\n• Closing / completion date\n• Conditions (e.g., financing approval, satisfactory home inspection)\n• Chattels included and fixtures excluded\n• Representations and warranties by both parties\n• Irrevocability period of the offer\n\n⚠️ IMPORTANT: This is a legally binding contract. Once signed and accepted by both parties, you are obligated to complete the purchase unless a condition is not fulfilled. You are advised to have your lawyer review this document before signing.`,
    acknowledgement: 'I have reviewed the Agreement of Purchase and Sale (OREA Form 100) as presented to me, understand its binding nature, and authorise my agent to submit this offer on my behalf.',
  },
  {
    id: 'form-320',
    phase: 'Phase 3 · Transaction',
    phaseColor: 'midnight',
    title: 'Confirmation of Co-operation (Form 320)',
    description: 'Confirms commission split between brokerages.',
    docLabel: 'OREA Form 320',
    documentSummary: `The Confirmation of Co-operation and Representation (OREA Form 320) is a disclosure document required under TRESA.\n\nIt confirms:\n• The nature of representation for the buyer (client relationship with buyer's brokerage)\n• The nature of representation for the seller (client relationship with listing brokerage)\n• How the listing brokerage will compensate the buyer's brokerage (commission split)\n• That both parties understand the representation arrangement\n\nThis document does not require action on your part — it is an acknowledgement that you understand how the brokerages involved in your transaction are being compensated.`,
    acknowledgement: 'I acknowledge receipt of the Confirmation of Co-operation and Representation (Form 320) and confirm my understanding of the representation arrangement and commission structure as disclosed.',
  },
  {
    id: 'deposit',
    phase: 'Phase 3 · Transaction',
    phaseColor: 'midnight',
    title: 'Deposit Receipt',
    description: 'Confirms deposit paid and held in trust after offer acceptance.',
    docLabel: 'Deposit Confirmation',
    documentSummary: `Upon acceptance of your offer, a deposit is required as a demonstration of your good faith and commitment to the purchase.\n\nDeposit details:\n• The deposit amount is as specified in your Agreement of Purchase and Sale\n• Payment must be made by Bank Draft or Certified Cheque only (payable to the listing brokerage "In Trust")\n• The deposit is due within the timeframe specified in your APS (typically 24 hours after acceptance)\n• The funds are held in the listing brokerage's trust account until closing\n• If the deal closes, the deposit is applied toward your purchase price\n• If the deal fails to close due to an unfulfilled condition, the deposit is returned\n\nA Confirmation of Receipt will be provided once the deposit is received by the listing brokerage.`,
    acknowledgement: 'I acknowledge the deposit instructions as stated in my Agreement of Purchase and Sale and confirm my commitment to provide the required deposit in the specified form and within the required timeframe.',
  },
  {
    id: 'waivers',
    phase: 'Phase 3 · Transaction',
    phaseColor: 'midnight',
    title: 'Waivers / Notices of Fulfillment',
    description: 'Removes conditions to firm up the deal.',
    docLabel: 'Condition Waivers',
    documentSummary: `A Waiver or Notice of Fulfillment removes a condition from your Agreement of Purchase and Sale, making the deal firm and legally binding.\n\nCommon conditions that may be waived:\n\n✅ Financing Condition\nYou are satisfied that you have received mortgage approval adequate to complete the purchase on the agreed terms.\n\n✅ Home Inspection Condition\nYou are satisfied with the results of a professional home inspection and accept the property in its current condition.\n\n⚠️ CRITICAL WARNING: Once you sign and your agent delivers a waiver, the deal becomes FIRM. You are legally obligated to complete the purchase. You may forfeit your deposit and face legal action for damages if you fail to close after waiving conditions.\n\nPlease ensure you are fully satisfied before signing any waiver.`,
    acknowledgement: 'I understand that by signing this document I am waiving one or more conditions in my Agreement of Purchase and Sale, making the deal FIRM and legally binding. I confirm I am fully satisfied and wish to proceed.',
  },

  // Phase 4 — Lawyer Package
  {
    id: 'lawyer-package',
    phase: 'Phase 4 · Lawyer Package',
    phaseColor: 'charcoal',
    title: 'Lawyer Package Acknowledgement',
    description: 'Confirms the closing package has been received and forwarded to your lawyer.',
    docLabel: 'Closing Package',
    documentSummary: `Your deal is now FIRM — congratulations! 🏡\n\nYour agent has assembled your complete closing package for your real estate lawyer. This package contains all documents required for title registration and financial settlement on closing day.\n\nPackage contents:\n✅ Firm Agreement of Purchase and Sale (with all schedules)\n✅ All Condition Waivers / Notices of Fulfillment\n✅ FINTRAC Identity Verification Record\n✅ Confirmation of Co-operation (Form 320)\n✅ Deposit Confirmation (funds held in trust)\n✅ MLS Listing Sheet (legal PIN, tax assessment, property details)\n✅ Mortgage Broker / Lender Information\n\nYour lawyer will use this package to:\n• Conduct a title search\n• Coordinate with your lender to register the mortgage (Charge)\n• Calculate closing cost adjustments\n• Register the transfer of title on closing day`,
    acknowledgement: 'I confirm that I have received the complete closing package and have forwarded (or will forward) all documents to my real estate lawyer to proceed with title registration and closing.',
  },
];

export const STEP_MAP = Object.fromEntries(PIPELINE_STEPS.map(s => [s.id, s]));
