import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Shield, Download, FileText, Clock, AlertTriangle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

const SUPABASE_URL = "https://zmjikithlaxeldvsmklz.supabase.co";

interface ShareData {
  claim: { id: string; status: string; est_payout: number; filed_at: string | null } | null;
  settlement: {
    name: string; company: string; breach_year: number | null;
    payout_min: number | null; payout_max: number | null;
    deadline: string | null; claim_deadline: string | null; administrator_name: string | null;
  } | null;
  packet: { id: string; file_name: string; generated_at: string; signed_url: string | null } | null;
  evidence: { file_name: string; doc_type: string; file_size: number | null; created_at: string; signed_url: string | null }[];
  scope: string;
  expires_at: string;
}

function maskName(name?: string | null): string {
  if (!name) return "Claimant";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "Claimant";
  return parts.map(p => p.charAt(0).toUpperCase() + ".").join(" ");
}

function normalizeDocName(fileName: string, docType: string): string {
  const typeMap: Record<string, string> = {
    id_document: "Identity Document",
    proof_of_address: "Proof of Address",
    breach_notice: "Breach Notice",
    receipt: "Receipt / Financial Record",
    other: "Supporting Document",
  };
  const label = typeMap[docType] || docType.replace(/_/g, " ");
  const ext = fileName.includes(".") ? fileName.split(".").pop() : "";
  return `${label}${ext ? `.${ext}` : ""}`;
}

function formatCurrency(n: number | null | undefined): string {
  if (n == null) return "—";
  return `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
}

const ShareClaim = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError("No share token provided.");
      setLoading(false);
      return;
    }

    const resolve = async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/share-claim-packet?token=${encodeURIComponent(token)}`
        );
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || "Invalid or expired link");
          return;
        }
        setData(json);
      } catch {
        setError("Failed to load shared claim.");
      } finally {
        setLoading(false);
      }
    };

    resolve();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            {error.includes("expired") ? (
              <Clock className="h-8 w-8 text-destructive" />
            ) : (
              <AlertTriangle className="h-8 w-8 text-destructive" />
            )}
          </div>
          <h1 className="text-xl font-bold text-foreground">
            {error.includes("expired") ? "Link Expired" : "Invalid Link"}
          </h1>
          <p className="text-muted-foreground text-sm">{error}</p>
          <p className="text-xs text-muted-foreground">
            Contact the person who shared this link to request a new one.
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const claimantInitials = maskName(null); // We don't expose claimant name on share page

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg gradient-emerald flex items-center justify-center">
            <Shield className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground">BreachPay</h1>
            <p className="text-[10px] text-muted-foreground">Shared Claim Packet</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            <span>Secure share link</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        {/* Settlement Info */}
        {data.settlement && (
          <div className="rounded-2xl border bg-card p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground">{data.settlement.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {data.settlement.company}
                  {data.settlement.breach_year ? ` · ${data.settlement.breach_year} Breach` : ""}
                </p>
              </div>
              {data.claim && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary uppercase">
                  {data.claim.status.replace(/_/g, " ")}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Claimant</p>
                <p className="text-sm font-semibold">{claimantInitials}</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Payout Range</p>
                <p className="text-sm font-semibold text-primary">
                  {formatCurrency(data.settlement.payout_min)} – {formatCurrency(data.settlement.payout_max)}
                </p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Filed</p>
                <p className="text-sm font-semibold">
                  {data.claim?.filed_at ? new Date(data.claim.filed_at).toLocaleDateString() : "—"}
                </p>
              </div>
              {data.settlement.administrator_name && (
                <div className="rounded-xl bg-muted/50 p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Administrator</p>
                  <p className="text-sm font-semibold">{data.settlement.administrator_name}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Claim Packet Download */}
        {data.packet && (
          <div className="rounded-2xl border bg-card p-6 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> Claim Packet
            </h3>
            <div className="flex items-center justify-between rounded-xl bg-muted/50 p-4">
              <div>
                <p className="text-sm font-medium">{data.packet.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  Generated {new Date(data.packet.generated_at).toLocaleDateString()}
                </p>
              </div>
              {data.packet.signed_url ? (
                <Button size="sm" className="rounded-xl gap-2" asChild>
                  <a href={data.packet.signed_url} target="_blank" rel="noreferrer">
                    <Download className="h-4 w-4" /> Download
                  </a>
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">Unavailable</span>
              )}
            </div>
          </div>
        )}

        {/* Evidence Documents */}
        {data.scope === "packet_and_evidence" && data.evidence.length > 0 && (
          <div className="rounded-2xl border bg-card p-6 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" /> Evidence Documents ({data.evidence.length})
            </h3>
            <div className="space-y-2">
              {data.evidence.map((doc, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl bg-muted/50 p-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {normalizeDocName(doc.file_name, doc.doc_type)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : ""}
                        {doc.created_at ? ` · ${new Date(doc.created_at).toLocaleDateString()}` : ""}
                      </p>
                    </div>
                  </div>
                  {doc.signed_url ? (
                    <Button size="sm" variant="outline" className="rounded-xl shrink-0" asChild>
                      <a href={doc.signed_url} target="_blank" rel="noreferrer">
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">—</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center space-y-2 pt-4">
          <p className="text-xs text-muted-foreground">
            This link expires {new Date(data.expires_at).toLocaleDateString()} at{" "}
            {new Date(data.expires_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Powered by BreachPay · Not a law firm · No legal advice provided
          </p>
        </div>
      </main>
    </div>
  );
};

export default ShareClaim;
