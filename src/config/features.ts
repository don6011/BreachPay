/**
 * Switches for parts of the product that are built but not ready to offer to
 * real users. Each one is off until the thing it promises actually exists;
 * turning a flag on brings its screens and navigation back unchanged.
 */
export const FEATURES = {
  /**
   * Wallet, payout tracking and bank details. Off: settlement administrators
   * pay claimants directly, so BreachPay never holds or sends money.
   */
  payouts: false,

  /**
   * Premium plan, paid claim help and the success fee. Off: no payment
   * provider is connected, so nothing can be bought.
   */
  paidPlans: false,

  /** Third-party identity-protection offers. Off: there are no partner agreements or links. */
  partnerOffers: false,

  /** Referral rewards. Off: there is no way to pay a reward. */
  referralRewards: false,

  /**
   * Automatic re-scans on a schedule. Off: the scheduled job does not query a
   * real breach source yet (see docs/TRUST_AND_LAUNCH.md). Manual checks use
   * Have I Been Pwned and are unaffected.
   */
  scheduledScans: false,

  /**
   * Uploading and storing supporting documents. Off: claim forms are filed on
   * the administrator's site, so holding copies of ID documents adds risk
   * without helping the claim.
   */
  documentUploads: false,

  /**
   * The multi-step claim wizard and PDF "claim packet". Off: administrators
   * take claims through their own forms, so the wizard collected personal
   * details and produced a document nobody could submit, while marking the
   * claim "submitted". People now file on the official site and tick it off.
   */
  claimPackets: false,

  /**
   * The AI support chat. Off: it sends account details to a language model and
   * tells people a question was "escalated to our team". Turn it on once
   * someone is answering escalations.
   */
  aiSupport: false,
} as const;

export type FeatureName = keyof typeof FEATURES;
