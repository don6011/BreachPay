import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Shield, Download, FileText, Clock, AlertTriangle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

const SUPABASE_URL = "https://zmjikithlaxeldvsmklz.supabase.co";

interface ResolvedData {
  ok: boolean;
  settlement_name: string;
  company: string;
  claim_status: string;
  expires_at: string;
  download_url: string | null;
  error?: string;
}

const ShareClaim = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [data, setData] = useState<ResolvedData | null>(null);
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
          `${SUPABASE_URL}/functions/v1/resolve-claim-share-link?token=${encodeURIComponent(token)}`
        );
        const json = await res.json();
        if (!json.ok) {
          const errMsg = json.error === "expired"
            ? "This share link has expired."
            : json.error === "revoked"
            ? "This share link has been revoked."
            : "Invalid or expired link.";
          setError(errMsg);
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
            {error.includes("expired") ? "Link Expired" : error.includes("revoked") ? "Link Revoked" : "Invalid Link"}
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
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">{data.settlement_name}</h2>
              <p className="text-sm text-muted-foreground">{data.company}</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary uppercase">
              {data.claim_status.replace(/_/g, " ")}
            </span>
          </div>
        </div>

        {/* Claim Packet Download */}
        <div className="rounded-2xl border bg-card p-6 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Claim Packet
          </h3>
          {data.download_url ? (
            <div className="flex items-center justify-between rounded-xl bg-muted/50 p-4">
              <div>
                <p className="text-sm font-medium">Claim Packet</p>
                <p className="text-xs text-muted-foreground">
                  Download your claim packet document
                </p>
              </div>
              <Button size="sm" className="rounded-xl gap-2" asChild>
                <a href={data.download_url} target="_blank" rel="noreferrer">
                  <Download className="h-4 w-4" /> Download
                </a>
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No claim packet available yet.</p>
          )}
        </div>

        {/* Compliance Disclaimer */}
        <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Disclaimer:</strong> BreachPay assists in preparing and submitting claims but does not determine eligibility or payout amounts. Final decisions are made by settlement administrators. BreachPay is not a law firm and does not provide legal advice. All settlement data is sourced from third parties.
          </p>
        </div>

        {/* Footer */}
        <div className="text-center space-y-2 pt-4">
          <p className="text-xs text-muted-foreground">
            This link expires {new Date(data.expires_at).toLocaleDateString()} at{" "}
            {new Date(data.expires_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Powered by BreachPay · Not a law firm · No legal advice provided
          </p>
          <p className="text-[10px] text-muted-foreground">
            <a href="/terms" className="text-primary hover:underline">Terms of Service</a> · <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>
          </p>
        </div>
      </main>
    </div>
  );
};

export default ShareClaim;
