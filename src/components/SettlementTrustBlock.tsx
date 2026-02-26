import { Shield, ExternalLink, Award, FileCheck, Users, Scale, Newspaper } from "lucide-react";
import { cn } from "@/lib/utils";

interface VerificationSource {
  label: string;
  url: string;
  type: string;
}

interface MediaReference {
  name: string;
  url?: string;
  type: string; // "regulator" | "media" | "court"
}

interface SettlementTrustBlockProps {
  credibilityScore: number | null;
  verificationLevel: string;
  verificationSources: VerificationSource[];
  mediaReferences: MediaReference[];
  verificationStatus: string;
  administratorName?: string | null;
  className?: string;
}

function getScoreColor(score: number) {
  if (score >= 80) return { bg: "bg-success/10", text: "text-success", border: "border-success/20", label: "High" };
  if (score >= 60) return { bg: "bg-warning/10", text: "text-warning", border: "border-warning/20", label: "Moderate" };
  return { bg: "bg-muted", text: "text-muted-foreground", border: "border-border", label: "Low" };
}

function getStatusConfig(status: string) {
  switch (status) {
    case "verified":
      return { label: "Verified Settlement", desc: "Court-approved with active claims window.", color: "text-success", bg: "bg-success/10 border-success/20" };
    case "monitored":
      return { label: "Monitored Settlement", desc: "Approved settlement — claims closed or under monitoring.", color: "text-info", bg: "bg-info/10 border-info/20" };
    case "pending":
      return { label: "Pending Verification", desc: "Ingested but not yet verified by our team.", color: "text-warning", bg: "bg-warning/10 border-warning/20" };
    default:
      return { label: "Verified Settlement", desc: "Court-approved with active claims window.", color: "text-success", bg: "bg-success/10 border-success/20" };
  }
}

const typeIcons: Record<string, React.ElementType> = {
  regulator: Scale,
  media: Newspaper,
  court: FileCheck,
};

export function SettlementTrustBlock({
  credibilityScore,
  verificationLevel,
  verificationSources,
  mediaReferences,
  verificationStatus,
  administratorName,
  className,
}: SettlementTrustBlockProps) {
  const score = credibilityScore ?? 85;
  const scoreStyle = getScoreColor(score);
  const statusConfig = getStatusConfig(verificationStatus);
  const sources = Array.isArray(verificationSources) ? verificationSources : [];
  const media = Array.isArray(mediaReferences) ? mediaReferences : [];

  return (
    <div className={cn("space-y-6", className)}>
      <h2 className="text-2xl font-semibold flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" /> Trust & Verification
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Verification Status Badge */}
        <div className={cn("glass-card p-5 border", statusConfig.bg)}>
          <div className="flex items-center gap-2 mb-2">
            <Award className={cn("h-5 w-5", statusConfig.color)} />
            <h3 className={cn("font-semibold text-sm", statusConfig.color)}>{statusConfig.label}</h3>
          </div>
          <p className="text-xs text-muted-foreground">{statusConfig.desc}</p>
        </div>

        {/* Credibility Score */}
        <div className="glass-card p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Credibility Score</p>
          <div className="flex items-center gap-3">
            <div className={cn("text-3xl font-bold", scoreStyle.text)}>{score}</div>
            <div className="flex-1">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", score >= 80 ? "bg-success" : score >= 60 ? "bg-warning" : "bg-muted-foreground")}
                  style={{ width: `${score}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{scoreStyle.label} credibility</p>
            </div>
          </div>
        </div>
      </div>

      {/* Verification Sources */}
      {sources.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-primary" /> Verification Sources
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Verified using official settlement documentation and administrator filings.
          </p>
          <div className="space-y-2">
            {sources.map((s, i) => (
              <a
                key={i}
                href={s.url}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                {s.label}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Media & Regulator References */}
      {media.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-primary" /> Reported By
          </h3>
          <div className="flex flex-wrap gap-3">
            {media.map((m, i) => {
              const Icon = typeIcons[m.type] || Newspaper;
              const content = (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  {m.name}
                </span>
              );
              return m.url ? (
                <a key={i} href={m.url} target="_blank" rel="noreferrer noopener" className="hover:border-primary/30 transition-colors">
                  {content}
                </a>
              ) : (
                <span key={i}>{content}</span>
              );
            })}
          </div>
        </div>
      )}

      {/* Claims Processing Disclosure */}
      <div className="glass-card p-5">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" /> How Claims Are Processed
        </h3>
        <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
          <li>Claims are reviewed and validated by the{administratorName ? ` ${administratorName}` : ""} settlement administrator.</li>
          <li>Supporting documentation is verified for authenticity and eligibility.</li>
          <li>Approved claims enter the payout queue after the claims period closes.</li>
          <li>Payouts are distributed directly by the settlement fund — not by BreachPay.</li>
        </ol>
        <p className="text-xs text-muted-foreground mt-3 border-t border-border pt-3">
          BreachPay assists with claim preparation and filing. All eligibility determinations and fund distributions are handled by third-party settlement administrators.
        </p>
      </div>
    </div>
  );
}
