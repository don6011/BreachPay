import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { VerificationBadge } from "@/components/VerificationBadge";
import { DeadlineBadge, isDeadlinePassed } from "@/components/DeadlineBadge";
import { PayoutRange } from "@/components/PayoutRange";
import { BackToTopButton } from "@/components/BackToTopButton";
import { SubmissionModeActions } from "@/components/SubmissionModeActions";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useTrackEvent } from "@/hooks/useTrackEvent";
import {
  ArrowLeft, ArrowRight, Clock, AlertTriangle, ExternalLink, Shield,
  Scale, FileCheck, Building2, MapPin, Hash,
} from "lucide-react";

const SettlementDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const track = useTrackEvent();

  const [settlement, setSettlement] = useState<any>(null);
  const [claim, setClaim] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filing, setFiling] = useState(false);

  useEffect(() => {
    if (!id || !user) return;

    const fetch = async () => {
      try {
        const { data: s } = await supabase
          .from("settlements")
          .select("*")
          .eq("id", id)
          .eq("is_demo", false)
          .eq("is_test", false)
          .single();

        setSettlement(s);

        // Track match_viewed when user opens a settlement detail
        if (s) {
          track("match_viewed", { settlement_id: s.id, settlement_name: s.name });
        }

        const { data: c } = await supabase
          .from("claims")
          .select("id, status, est_payout, filed_at, submitted_to_admin_at, external_submission_ref")
          .eq("user_id", user.id)
          .eq("settlement_id", id)
          .maybeSingle();

        setClaim(c);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [id, user]);

  const handleFileClaim = async () => {
    if (!user || !settlement || filing) return;
    setFiling(true);
    try {
      // Check eligibility via server-side RPC first
      const { data: check, error: checkErr } = await supabase.rpc("rpc_can_start_claim", {
        p_settlement_id: settlement.id,
      });
      if (checkErr) throw checkErr;
      const result = check as any;
      if (!result.allowed) {
        toast({ title: "Not Eligible", description: result.reason, variant: "destructive" });
        return;
      }
      // Navigate to the full claim wizard
      navigate(`/claims/file?settlement=${settlement.id}`);
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error", description: err?.message || "Failed to start claim.", variant: "destructive" });
    } finally {
      setFiling(false);
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Settlement Details" subtitle="Loading..." />
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!settlement) {
    return (
      <div>
        <PageHeader title="Settlement Not Found" subtitle="This settlement doesn't exist or you don't have access." />
        <Button variant="outline" asChild className="mt-4 rounded-xl">
          <Link to="/settlements"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Settlements</Link>
        </Button>
      </div>
    );
  }

  const effectiveDeadline = settlement.claim_deadline || settlement.deadline;
  const daysLeft = effectiveDeadline
    ? Math.max(0, Math.ceil((new Date(effectiveDeadline).getTime() - Date.now()) / 86400000))
    : null;
  const isUrgent = daysLeft !== null && daysLeft <= 30;
  const isClosed = settlement.status === "closed" || settlement.lifecycle_status === "closed" || settlement.lifecycle_status === "archived" || isDeadlinePassed(effectiveDeadline);

  return (
    <div>
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/dashboard">Dashboard</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/settlements">Settlements</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{settlement?.name ?? "Detail"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-2xl font-bold">{settlement.name}</h1>
            <StatusPill variant={settlement.status} />
            <VerificationBadge level={settlement.verification_level} verified={settlement.verified} compact />
            <DeadlineBadge deadline={effectiveDeadline} />
          </div>
          <p className="text-sm text-muted-foreground">{settlement.company} · {settlement.breach_year} Breach</p>
        </div>

        {!isClosed && !claim && (
          <Button
            className="rounded-xl shadow-[0_0_16px_hsl(172_89%_52%/0.2)] hover:shadow-[0_0_24px_hsl(172_89%_52%/0.35)] transition-all duration-300"
            disabled={filing}
            onClick={handleFileClaim}
          >
            {filing ? "Filing..." : <>File Claim <ArrowRight className="ml-1 h-4 w-4" /></>}
          </Button>
        )}
        {claim && (
          <Button variant="outline" asChild className="rounded-xl">
            <Link to={`/claims/${claim.id}`}><FileCheck className="mr-2 h-4 w-4" /> Track Claim</Link>
          </Button>
        )}
      </div>

      {/* Submission Mode Actions */}
      {claim && (
        <SubmissionModeActions
          settlementId={settlement.id}
          settlementName={settlement.name}
          submissionMode={settlement.submission_mode || "packet_only"}
          claimUrl={settlement.claim_url || settlement.claims_filing_url}
          claimId={claim.id}
          claimStatus={claim.status}
          submittedToAdminAt={claim.submitted_to_admin_at || null}
          externalSubmissionRef={claim.external_submission_ref || null}
          onClaimUpdate={() => {
            // Re-fetch claim
            supabase.from("claims").select("id, status, est_payout, filed_at, submitted_to_admin_at, external_submission_ref")
              .eq("user_id", user!.id).eq("settlement_id", id!).maybeSingle()
              .then(({ data }) => setClaim(data));
          }}
        />
      )}

      {settlement.description && (
        <p className="text-muted-foreground mb-6">{settlement.description}</p>
      )}

      {/* Key Info Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Estimated Payout</p>
          <PayoutRange min={settlement.payout_min || 0} max={settlement.payout_max || 0} size="sm" className="text-xl" />
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Filing Deadline</p>
          <div className={`flex items-center gap-1.5 text-sm font-bold ${isUrgent ? "text-critical" : ""}`}>
            {isUrgent ? <AlertTriangle className="h-4 w-4" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
            {effectiveDeadline || "—"}
          </div>
          {daysLeft !== null && <p className="text-xs text-muted-foreground mt-1">{daysLeft} days remaining</p>}
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Status</p>
          <StatusPill variant={settlement.status} />
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Your Claim</p>
          {claim ? (
            <StatusPill variant={claim.status} />
          ) : (
            <span className="text-sm text-muted-foreground">Not filed</span>
          )}
        </div>
      </div>

      {/* Details Panel */}
      <div className="glass-card p-6 mb-6 space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" /> Settlement Details
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          {settlement.jurisdiction && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Jurisdiction:</span>
              <span>{settlement.jurisdiction}</span>
            </div>
          )}
          {settlement.case_number && (
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Case:</span>
              <span>{settlement.case_number}</span>
            </div>
          )}
          {settlement.administrator_name && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Administrator:</span>
              <span>{settlement.administrator_name}</span>
            </div>
          )}
          {settlement.breach_year && (
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Breach Year:</span>
              <span>{settlement.breach_year}</span>
            </div>
          )}
        </div>

        {/* Source Links */}
        <div className="flex flex-wrap gap-3 pt-2">
          <VerificationBadge
            level={settlement.verification_level}
            verified={settlement.verified}
            sourceUrl={settlement.official_source_url || settlement.source_url}
          />
          {settlement.claims_filing_url && (
            <a
              href={settlement.claims_filing_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline rounded-lg bg-primary/5 px-2.5 py-1.5"
            >
              <ExternalLink className="h-3 w-3" /> Official claims filing site
            </a>
          )}
          {(settlement.official_source_url || settlement.source_url) && (
            <a
              href={settlement.official_source_url || settlement.source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> View source
            </a>
          )}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        BreachPay is not a law firm. Eligibility depends on settlement administrator review. Estimated payouts are subject to settlement terms. All data comes from third-party sources.
      </p>

      <BackToTopButton />
    </div>
  );
};

export default SettlementDetail;
