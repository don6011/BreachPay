import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useTrackEvent } from "@/hooks/useTrackEvent";
import {
  Download, ExternalLink, Loader2, CheckCircle, FileText,
} from "lucide-react";

interface SubmissionModeActionsProps {
  settlementId: string;
  settlementName: string;
  submissionMode: string;
  claimUrl: string | null;
  claimId: string | null;
  claimStatus: string | null;
  submittedToAdminAt: string | null;
  externalSubmissionRef: string | null;
  onClaimUpdate: () => void;
}

export const SubmissionModeActions = ({
  settlementId,
  settlementName,
  submissionMode: requestedMode,
  claimUrl,
  claimId,
  claimStatus,
  submittedToAdminAt,
  externalSubmissionRef,
  onClaimUpdate,
}: SubmissionModeActionsProps) => {
  const { user } = useAuth();
  const track = useTrackEvent();
  // There is no connection to any settlement administrator, so nothing can be
  // submitted for the user. "partner_api" settlements are handled like the
  // others: the person files on the official site and confirms it here.
  const submissionMode = requestedMode === "partner_api" ? (claimUrl ? "redirect_official" : "packet_only") : requestedMode;
  const [generatingPacket, setGeneratingPacket] = useState(false);
  const [markedSubmitted, setMarkedSubmitted] = useState(false);
  const [redirectConfirmed, setRedirectConfirmed] = useState(false);

  const handleGeneratePacket = async () => {
    if (!claimId) return;
    setGeneratingPacket(true);
    try {
      // Step 1: Generate the PDF on the server
      const { data, error } = await supabase.functions.invoke("generate-claim-packet", {
        body: { claim_id: claimId },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "We couldn't generate your claim packet right now. Please try again.");

      const storagePath = data.storage_path as string;
      const fileName = data.file_name as string || `BreachPay-Claim-Packet-${claimId.slice(0, 8)}.pdf`;

      // Step 2: Get a signed URL for the real PDF
      const { data: signedData, error: signedErr } = await supabase.storage
        .from("claim-packets")
        .createSignedUrl(storagePath, 300); // 5-minute expiry

      if (signedErr || !signedData?.signedUrl) {
        throw new Error("We couldn't generate your claim packet right now. Please try again.");
      }

      // Step 3: Fetch the PDF and trigger a real browser download
      const response = await fetch(signedData.signedUrl);
      if (!response.ok) throw new Error("We couldn't generate your claim packet right now. Please try again.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: "Claim Packet Downloaded", description: "Your PDF claim packet has been downloaded." });
      track("packet_generated", { claim_id: claimId });
      onClaimUpdate();
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "We couldn't generate your claim packet right now. Please try again.", variant: "destructive" });
    } finally {
      setGeneratingPacket(false);
    }
  };

  const handleRedirect = () => {
    if (!claimUrl) return;
    track("redirect_official", { settlement_id: settlementId, claim_url: claimUrl });
    window.open(claimUrl, "_blank");
  };

  const handleConfirmRedirectSubmission = async () => {
    if (!claimId || !user) return;
    try {
      await supabase.from("claims").update({
        status: "submitted",
        submission_channel: "redirect_official",
        updated_at: new Date().toISOString(),
      }).eq("id", claimId);

      await supabase.from("claim_status_history").insert({
        claim_id: claimId,
        status: "submitted",
        note: "User confirmed submission on official settlement website.",
        updated_by: "user",
      });

      toast({ title: "Claim Marked as Submitted", description: "Thank you for confirming your submission." });
      setRedirectConfirmed(true);
      onClaimUpdate();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleMarkSubmittedAfterFiling = async () => {
    if (!claimId || !user) return;
    try {
      await supabase.from("claims").update({
        status: "submitted",
        submission_channel: "packet_only",
        updated_at: new Date().toISOString(),
      }).eq("id", claimId);

      await supabase.from("claim_status_history").insert({
        claim_id: claimId,
        status: "submitted",
        note: "User marked claim as submitted after filing externally.",
        updated_by: "user",
      });

      toast({ title: "Claim Updated", description: "Your claim has been marked as submitted." });
      setMarkedSubmitted(true);
      onClaimUpdate();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  if (!claimId) return null;

  // Already submitted via partner_api
  if (submittedToAdminAt) {
    return (
      <div className="rounded-xl border border-success/30 bg-success/5 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-success" />
          <p className="text-sm font-semibold text-success">Submitted to Administrator</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Your claim was submitted on {new Date(submittedToAdminAt).toLocaleDateString()}.
          {externalSubmissionRef && <> Reference: <span className="font-mono">{externalSubmissionRef}</span></>}
        </p>
      </div>
    );
  }

  // Already submitted (non-partner)
  if (claimStatus === "submitted" || claimStatus === "under_review" || claimStatus === "approved" || claimStatus === "paid") {
    const modeLabel = submissionMode === "redirect_official" ? "You marked this claim as filed on the official site." :
      "You marked this claim as filed.";
    return (
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <p className="text-sm font-medium">{modeLabel}</p>
        </div>
      </div>
    );
  }

  // packet_only mode
  if (submissionMode === "packet_only") {
    return (
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <p className="text-sm text-muted-foreground">
          BreachPay prepares your claim packet. Submit it on the official settlement website.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="rounded-xl gap-2" onClick={handleGeneratePacket} disabled={generatingPacket}>
            {generatingPacket ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download Claim Packet
          </Button>
          {!markedSubmitted && claimStatus === "draft" && (
            <Button size="sm" variant="outline" className="rounded-xl gap-2" onClick={handleMarkSubmittedAfterFiling}>
              <CheckCircle className="h-4 w-4" /> Mark as Submitted After Filing
            </Button>
          )}
        </div>
      </div>
    );
  }

  // redirect_official mode
  if (submissionMode === "redirect_official") {
    return (
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <p className="text-sm text-muted-foreground">Submit on official claim website.</p>
        <Button size="sm" className="rounded-xl gap-2" onClick={handleRedirect} disabled={!claimUrl}>
          <ExternalLink className="h-4 w-4" /> Go to Official Claim Site
        </Button>
        {!redirectConfirmed && claimStatus === "draft" && (
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <Checkbox
              id="confirm-redirect"
              onCheckedChange={(checked) => {
                if (checked) handleConfirmRedirectSubmission();
              }}
            />
            <label htmlFor="confirm-redirect" className="text-xs text-muted-foreground cursor-pointer">
              I have submitted my claim on the official settlement website.
            </label>
          </div>
        )}
      </div>
    );
  }

  return null;
};
