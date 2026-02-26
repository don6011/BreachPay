import { Link } from "react-router-dom";
import { Shield, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

const TermsOfService = () => (
  <div className="min-h-screen bg-background">
    <header className="border-b bg-card/80 backdrop-blur-sm">
      <div className="mx-auto max-w-3xl px-4 py-4 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="BreachPay" className="h-7 w-7" />
          <span className="text-sm font-bold">BreachPay</span>
        </Link>
        <div className="ml-auto">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/"><ArrowLeft className="h-3 w-3 mr-1" /> Back</Link>
          </Button>
        </div>
      </div>
    </header>

    <main className="mx-auto max-w-3xl px-4 py-10 prose prose-sm dark:prose-invert">
      <h1 className="text-2xl font-bold mb-1">Terms of Service</h1>
      <p className="text-muted-foreground text-sm mb-8">Last updated: February 26, 2026</p>

      <section className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        <h2 className="text-lg font-semibold text-foreground">1. Platform Description</h2>
        <p>BreachPay is a <strong className="text-foreground">claims assistance platform</strong> that helps users identify data breach settlements they may be eligible for and assists in preparing claim submissions. BreachPay is <strong className="text-foreground">not a law firm</strong>, does not provide legal advice, and does not guarantee any particular outcome or payout.</p>

        <h2 className="text-lg font-semibold text-foreground">2. Facilitation, Not Representation</h2>
        <p>BreachPay facilitates the claims filing process on behalf of users. We do not represent users in any legal proceeding. All claims are submitted to and reviewed by independent settlement administrators. We have no control over eligibility determinations or payout amounts.</p>

        <h2 className="text-lg font-semibold text-foreground">3. User Responsibilities</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Users submit claims voluntarily and on their own behalf.</li>
          <li>Users certify that all information provided is accurate and complete.</li>
          <li>Accuracy of claim outcomes depends on the information provided by users.</li>
          <li>Users acknowledge that estimated payouts are approximations and actual amounts may vary significantly.</li>
        </ul>

        <h2 className="text-lg font-semibold text-foreground">4. Settlement Administrator Authority</h2>
        <p>Final decisions regarding claim eligibility, approval, and payout amounts are made solely by settlement administrators appointed by the relevant courts. BreachPay has no authority to approve, deny, or modify claims once submitted.</p>

        <h2 className="text-lg font-semibold text-foreground">5. Fees</h2>
        <p>BreachPay charges a platform fee (typically 15%) only on successful payouts. Claim filing is always free. Optional convenience services (expedited review, document verification) are clearly priced and never required.</p>

        <h2 className="text-lg font-semibold text-foreground">6. Third-Party Data</h2>
        <p>BreachPay relies on publicly available breach data and third-party data sources. While we strive for accuracy, we cannot guarantee the completeness or accuracy of breach information, settlement details, or eligibility criteria.</p>

        <h2 className="text-lg font-semibold text-foreground">7. No Guaranteed Payouts</h2>
        <p>BreachPay does not guarantee that any user will receive a payout. Estimated payout ranges are provided for informational purposes only and are based on publicly available settlement data.</p>

        <h2 className="text-lg font-semibold text-foreground">8. Limitation of Liability</h2>
        <p>To the maximum extent permitted by law, BreachPay shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from use of the platform, including but not limited to denied claims, delayed payouts, or inaccurate breach data.</p>

        <h2 className="text-lg font-semibold text-foreground">9. Modifications</h2>
        <p>We reserve the right to modify these terms at any time. Continued use of the platform after modifications constitutes acceptance of the updated terms.</p>
      </section>

      <div className="mt-10 rounded-xl border bg-muted/30 p-4 flex items-start gap-3">
        <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          BreachPay is not a law firm and does not provide legal advice. All settlement data is sourced from third parties. Eligibility and payouts are determined by settlement administrators.
        </p>
      </div>
    </main>
  </div>
);

export default TermsOfService;
