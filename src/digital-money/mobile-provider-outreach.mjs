// Drafts for voluntary, manual business outreach from a phone.
// No email is sent automatically; no account, provider API, credentials or funds are used.
// This catalogue is research only and cannot activate a corridor.
const CANDIDATES=Object.freeze({
 'CANDIDATE-MONEYGRAM':Object.freeze({
  name:'MoneyGram',
  // Official MoneyGram enterprise enquiry page, not an authenticated API endpoint.
  contactUrl:'https://business.moneygram.com/',
  subject:'MoneyGram business partnership - exploratory US to Honduras remittance inquiry',
  message:`Hello MoneyGram Business Partnerships Team,

We are researching Moneda Mundial 2.0, a pre-incorporation mobile wallet and remittance prototype with fictitious credits only. No real transfers or partner credentials are in use.

Could you clarify whether an eligible future business may integrate MoneyGram as a Service or the Money Transfer API for consumer remittances originating in the United States and paying out in Honduras? We would like to assess bank deposits and in-person cash pickup separately, including whether a recipient can collect cash without our app or a smartphone.

Please explain the contracting entity, supported US state and Honduras scope, licensing or sponsorship model, funding responsibilities, customer-funds protection, recipient verification, KYC/AML and sanctions roles, FX and fee disclosures, cancellations, refunds, reconciliation and duplicate-payment prevention. We also wish to evaluate Nicaragua and other countries individually later.

Does MoneyGram accept preliminary enquiries before incorporation? What documentation is required for an authorized sandbox and, separately, live eligibility? We are not requesting real-money access, production keys or personal information at this stage.

Thank you,
Moneda Mundial 2.0 - Project team`,
 }),
 'CANDIDATE-NIUM':Object.freeze({
  name:'Nium',
  contactUrl:'https://www.nium.com/talk-to-us',
  subject:'US to Honduras remittances (bank/card/cash) - exploratory inquiry',
  message:`Hello Nium Partnerships Team,

We are developing Moneda Mundial 2.0, a test-only international wallet and remittance prototype. Our legal entity has not yet been incorporated.

Could you confirm whether an eligible future fintech client could support consumer remittances originating in the United States and paying out in Honduras? Please distinguish bank deposits, card payouts, and in-person cash pickup for a recipient without our app or smartphone. We need written clarification of US state scope, legal and licensing/sponsorship model, supported currencies, beneficiary verification, KYC/AML responsibilities, FX and fees, safeguarding, refunds and reconciliation.

Do you accept exploratory inquiries before incorporation? What is required for authorized sandbox access and, separately, for any live transactions? Nicaragua and other countries would be assessed individually in later phases.

We do not request production credentials or authorization to move customer funds.

Thank you,
Moneda Mundial 2.0 - Project team`,
 }),
 'CANDIDATE-TERRAPAY':Object.freeze({
  name:'TerraPay',
  contactUrl:'https://www.terrapay.com/connect/',
  subject:'US to Honduras consumer remittance and beneficiary verification inquiry',
  message:`Hello TerraPay Partnerships Team,

Moneda Mundial 2.0 is a pre-incorporation mobile wallet and remittance prototype using only fictitious test credits.

We are investigating whether consumer payments from the United States to Honduras could be supported through a regulated partner, especially bank-account payout. Please confirm the specific corridor and originating US state coverage, legal contracting entity, licensing/sponsorship terms, beneficiary and account validation, KYC/AML responsibilities, currency and FX disclosure, fees, refunds, and reconciliation.

Please distinguish any eligible card or in-person cash pickup method from general network marketing. We also wish to research Nicaragua and other countries separately, subject to local requirements. Can a project at this stage request an exploratory meeting, and what evidence is needed before official sandbox access?

No real transactions, production credentials, or identity uploads are requested.

Thank you,
Moneda Mundial 2.0 - Project team`,
 }),
 'CANDIDATE-THUNES':Object.freeze({
  name:'Thunes',
  contactUrl:'https://www.thunes.com/contact/',
  subject:'US to Honduras cash pickup without smartphone - eligibility inquiry',
  message:`Hello Thunes Partnerships Team,

We are developing Moneda Mundial 2.0, a test-only remittance prototype. Our business entity has not been incorporated yet.

We want to research a compliant United States to Honduras consumer remittance route, with an emphasis on in-person cash pickup for a beneficiary who does not own our app or a smartphone. Could an authorized payer support this exact corridor? Please clarify licensed agent coverage, identity checks at pickup, single-use reference protection, sanctions and fraud controls, payout proof, currency, FX and fees, refunds and reconciliation.

Please identify the responsible legal entities, originating US state/licensing or sponsorship scope, obligations for KYC/AML, and prerequisites for exploratory discussions and official sandbox access. If cash pickup is unavailable, please describe any other eligible payout options. Nicaragua and additional destinations remain future research only.

We will not attempt to transfer live funds without written scope confirmation, contracts and independent legal and security clearance.

Thank you,
Moneda Mundial 2.0 - Project team`,
 }),
});
export const MOBILE_PROVIDER_OUTREACH_REAL_PAYMENTS_ENABLED=false;
export const MOBILE_PROVIDER_OUTREACH_AUTOSEND_ENABLED=false;
export const MOBILE_PROVIDER_OUTREACH_DESTINATION='HN';
export function getMobileProviderOutreachDraft({providerId,destination}={}){
 // Fail closed for unexpected countries or providers, including prototype names.
 if(destination!==MOBILE_PROVIDER_OUTREACH_DESTINATION ||
  typeof providerId!=='string'||!Object.hasOwn(CANDIDATES,providerId))return null;
 const info=CANDIDATES[providerId];
 return Object.freeze({
  providerId,name:info.name,destination,origin:'US',
  contactUrl:info.contactUrl,subject:info.subject,
  message:'Subject: '+info.subject+'\n\n'+info.message,
  draftOnly:true,alreadySent:false,providerConfirmed:false,
  realPaymentsEnabled:false,requiresUserReviewAndSubmission:true,
 });
}
