import { Link } from "react-router-dom";
import { Shield, ArrowLeft, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

const PrivacyPolicy = () => (
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
      <h1 className="text-2xl font-bold mb-1">Privacy Policy</h1>
      <p className="text-muted-foreground text-sm mb-8">Last updated: February 26, 2026</p>

      <section className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        <h2 className="text-lg font-semibold text-foreground">1. Information We Collect</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Account Information:</strong> Email address, name (when provided for claims).</li>
          <li><strong className="text-foreground">Claim Data:</strong> Personal details submitted during claim filing (name, address, phone, breach experience).</li>
          <li><strong className="text-foreground">Documents:</strong> Files uploaded as supporting evidence for claims.</li>
          <li><strong className="text-foreground">Scan Data:</strong> Email and phone hashes used to check breach databases.</li>
          <li><strong className="text-foreground">Usage Data:</strong> Platform interactions for product improvement.</li>
        </ul>

        <h2 className="text-lg font-semibold text-foreground">2. How We Protect Your Data</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Encryption at rest:</strong> All data is encrypted using industry-standard methods.</li>
          <li><strong className="text-foreground">Secure document storage:</strong> Documents are stored in private, encrypted storage with time-limited signed URLs.</li>
          <li><strong className="text-foreground">Hashed identifiers:</strong> Monitored emails and phone numbers are stored as cryptographic hashes, not plaintext.</li>
          <li><strong className="text-foreground">No public document links:</strong> All document access requires authentication or time-limited tokens.</li>
          <li><strong className="text-foreground">PII masking:</strong> Personal information is masked in partner-facing interfaces.</li>
        </ul>

        <h2 className="text-lg font-semibold text-foreground">3. How We Use Your Data</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>To match you with eligible settlements and file claims on your behalf.</li>
          <li>To communicate claim status updates and deadline alerts.</li>
          <li>To improve platform accuracy and user experience.</li>
          <li>We do <strong className="text-foreground">not</strong> sell your personal data to third parties.</li>
        </ul>

        <h2 className="text-lg font-semibold text-foreground">4. Partner Access</h2>
        <p>Authorized law firm partners and claims administrators may access limited claim data only for claims specifically assigned to them. Partners agree to data handling obligations through indemnification agreements.</p>

        <h2 className="text-lg font-semibold text-foreground">5. Data Retention</h2>
        <p>We retain claim data for as long as necessary to process claims and comply with legal obligations. Users may request deletion of their data at any time.</p>

        <h2 className="text-lg font-semibold text-foreground">6. Your Rights</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Access:</strong> Request a copy of your data.</li>
          <li><strong className="text-foreground">Correction:</strong> Update inaccurate information.</li>
          <li><strong className="text-foreground">Deletion:</strong> Request deletion of your account and associated data.</li>
          <li><strong className="text-foreground">Export:</strong> Download your data in a portable format.</li>
        </ul>
        <p>To exercise these rights, visit your <Link to="/settings" className="text-primary hover:underline">Settings</Link> page or contact us.</p>

        <h2 className="text-lg font-semibold text-foreground">7. Cookies & Analytics</h2>
        <p>We use essential cookies for authentication and session management. Analytics data is collected in aggregate form without personally identifiable information.</p>

        <h2 className="text-lg font-semibold text-foreground">8. Changes to This Policy</h2>
        <p>We may update this policy periodically. Significant changes will be communicated via email or in-app notification.</p>
      </section>

      <div className="mt-10 rounded-xl border bg-muted/30 p-4 flex items-start gap-3">
        <Lock className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          Your privacy is fundamental to our platform. BreachPay never stores plaintext sensitive identifiers and all documents are accessed through time-limited signed URLs only.
        </p>
      </div>
    </main>
  </div>
);

export default PrivacyPolicy;
