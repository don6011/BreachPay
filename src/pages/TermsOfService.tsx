import { LegalPage, LegalSection } from "@/components/public/LegalPage";
import type { PageMeta } from "@/lib/settlements/content";
import { SITE_NAME, SITE_URL } from "@/lib/settlements/format";

export const TERMS_META: PageMeta = {
  title: `Terms of Service | ${SITE_NAME}`,
  description: "The terms for using BreachPay, a free and independent directory of data breach settlements.",
  canonical: `${SITE_URL}/terms`,
  jsonLd: [],
};

const TermsOfService = () => (
  <LegalPage meta={TERMS_META} title="Terms of Service" updated="November 17, 2026">
    <LegalSection heading="1. What BreachPay is">
      <p>
        BreachPay is an independent directory of data breach class action settlements. It lists settlements, shows the
        claim deadline and the payout stated in the settlement notice, and links to the site where claims are filed.
        With a free account you can also check your email address against known breaches and keep track of claims you
        have filed.
      </p>
      <p>
        BreachPay is <strong>not a law firm</strong>, is <strong>not a settlement administrator</strong>, and is not
        affiliated with the companies or settlements listed. Nothing on BreachPay is legal advice.
      </p>
    </LegalSection>

    <LegalSection heading="2. No fees">
      <p>
        BreachPay is free. We do not charge to list settlements, to link you to a claim form, or for an account, and we
        do not take any part of a settlement payment.
      </p>
    </LegalSection>

    <LegalSection heading="3. You file your own claims">
      <ul>
        <li>You file claims yourself, directly with the settlement administrator, on the administrator's site.</li>
        <li>BreachPay does not file claims for you and does not receive, hold or send settlement money.</li>
        <li>
          The settlement administrator and the court decide who is eligible, whether a claim is approved, and how much
          is paid. BreachPay has no say in those decisions.
        </li>
        <li>
          A "match" in your account means a listed settlement involves a company from your breach check results. It is
          not a statement that you are eligible.
        </li>
      </ul>
    </LegalSection>

    <LegalSection heading="4. Settlement information">
      <p>
        Listings are compiled from public sources and reviewed before they are published, but they can be incomplete or
        out of date. Deadlines can change by court order. Always confirm deadlines, eligibility and payment terms on the
        official settlement site before you file. If a listing differs from the official notice, the official notice
        governs.
      </p>
      <p>
        Payout amounts shown are the amounts stated in settlement notices. The amount actually paid depends on the
        settlement terms and the number of valid claims, and can be lower.
      </p>
    </LegalSection>

    <LegalSection heading="5. The breach check">
      <p>
        The breach check looks up your account email address in the Have I Been Pwned database. Results depend on that
        service. No database covers every breach, so a result showing no breaches is not a guarantee that your data has
        never been exposed.
      </p>
    </LegalSection>

    <LegalSection heading="6. Your account">
      <ul>
        <li>Use an email address that belongs to you.</li>
        <li>Keep your password private. You are responsible for activity on your account.</li>
        <li>Do not use BreachPay to file false claims, or to collect information about other people.</li>
        <li>You can delete your account at any time from Settings.</li>
      </ul>
    </LegalSection>

    <LegalSection heading="7. Links to other sites">
      <p>
        BreachPay links to settlement sites and other sources that we do not control. We show the web address of each
        link so you can check where it leads. We are not responsible for the content or practices of those sites.
      </p>
    </LegalSection>

    <LegalSection heading="8. No warranty">
      <p>
        BreachPay is provided as is, without warranties of any kind. We do not guarantee that any listing is accurate
        or current, or that you will receive any payment from any settlement.
      </p>
    </LegalSection>

    <LegalSection heading="9. Limitation of liability">
      <p>
        To the maximum extent permitted by law, BreachPay is not liable for any indirect, incidental, special,
        consequential or punitive damages arising from use of the site, including missed deadlines, denied claims,
        delayed payments or inaccurate settlement or breach information.
      </p>
    </LegalSection>

    <LegalSection heading="10. Changes">
      <p>
        We may update these terms. The date at the top shows when they last changed. Continuing to use BreachPay after
        a change means you accept the updated terms.
      </p>
    </LegalSection>
  </LegalPage>
);

export default TermsOfService;
