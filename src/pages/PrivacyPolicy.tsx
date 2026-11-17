import { Link } from "react-router-dom";
import { LegalPage, LegalSection } from "@/components/public/LegalPage";
import type { PageMeta } from "@/lib/settlements/content";
import { SITE_NAME, SITE_URL } from "@/lib/settlements/format";

export const PRIVACY_META: PageMeta = {
  title: `Privacy Policy | ${SITE_NAME}`,
  description: "What BreachPay collects, why, who it is shared with, and how to export or delete your data.",
  canonical: `${SITE_URL}/privacy`,
  jsonLd: [],
};

const PrivacyPolicy = () => (
  <LegalPage meta={PRIVACY_META} title="Privacy Policy" updated="November 17, 2026">
    <LegalSection heading="1. Browsing without an account">
      <p>
        You can browse every settlement listing without an account. As with any website, the services that host
        BreachPay record technical details such as IP address when a page is requested. We do not use advertising or
        cross-site tracking scripts.
      </p>
    </LegalSection>

    <LegalSection heading="2. What we collect when you have an account">
      <ul>
        <li>
          <strong>Sign-in details:</strong> your email address and a password. The password is stored by our
          authentication provider in hashed form; we cannot read it.
        </li>
        <li>
          <strong>Breach check results:</strong> the names of known breaches that include your email address, the year
          and kind of data each exposed, and a rough exposure score calculated from them.
        </li>
        <li>
          <strong>Matches and claims:</strong> listed settlements that may relate to those breaches, and the claims you
          mark as filed.
        </li>
        <li>
          <strong>Preferences:</strong> for example whether you want email alerts.
        </li>
        <li>
          <strong>Activity:</strong> a record of actions in your account, such as running a breach check or opening a
          match, which we use to see what is working and to fix problems.
        </li>
      </ul>
      <p>
        We do not ask for your Social Security number, bank details or identity documents, and you never need to give
        them to BreachPay.
      </p>
    </LegalSection>

    <LegalSection heading="3. How we use it">
      <ul>
        <li>To run the breach check you ask for and show you the results.</li>
        <li>To show listed settlements that may relate to your results, and their deadlines.</li>
        <li>To send the email alerts you have turned on, and emails you request such as password resets.</li>
        <li>To keep the service working and improve it.</li>
      </ul>
      <p>
        We do <strong>not</strong> sell your personal data.
      </p>
    </LegalSection>

    <LegalSection heading="4. Who receives your data">
      <p>We share data only with the services needed to run BreachPay:</p>
      <ul>
        <li>
          <strong>Have I Been Pwned:</strong> when you run a breach check, your email address is sent to this service so
          it can report which known breaches include it.
        </li>
        <li>
          <strong>Supabase:</strong> stores account data and handles sign-in.
        </li>
        <li>
          <strong>Resend:</strong> delivers the emails we send you.
        </li>
      </ul>
      <p>
        We may also disclose information if the law requires it. When you follow a link to a settlement site, that site
        handles whatever you enter there under its own privacy policy.
      </p>
    </LegalSection>

    <LegalSection heading="5. Storage in your browser">
      <p>
        We use your browser's local storage to keep you signed in. Clearing your browser data, or logging out, removes
        it.
      </p>
    </LegalSection>

    <LegalSection heading="6. Keeping and deleting data">
      <p>
        We keep your account data until you delete your account. You can do that at any time from{" "}
        <Link to="/settings" className="text-primary hover:underline">Settings</Link>: it removes your profile, breach
        check results, matches, claim records and any files stored for your account.
      </p>
    </LegalSection>

    <LegalSection heading="7. Your choices">
      <ul>
        <li>
          <strong>Export:</strong> download a copy of your data from Settings.
        </li>
        <li>
          <strong>Email alerts:</strong> turn them on or off in Settings.
        </li>
        <li>
          <strong>Deletion:</strong> delete your account and its data from Settings.
        </li>
      </ul>
    </LegalSection>

    <LegalSection heading="8. Security">
      <p>
        Account records are protected by access rules so that each account can read only its own data, and connections
        to BreachPay are encrypted in transit. No service can promise perfect security, so use a password you do not use
        anywhere else.
      </p>
    </LegalSection>

    <LegalSection heading="9. Changes">
      <p>
        If we change this policy we will update the date at the top. If a change affects how we use data you have
        already given us, we will tell account holders by email.
      </p>
    </LegalSection>
  </LegalPage>
);

export default PrivacyPolicy;
