import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Mail, Plus, Trash2, CheckCircle, AlertCircle, Loader2, RefreshCw, Crown, ArrowRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

interface MonitoredEmail {
  id: string;
  display_label: string | null;
  value_last4: string | null;
  verified: boolean;
  is_active: boolean;
}

export function MonitoredEmailsManager() {
  const { user, plan } = useAuth();
  const isPremium = plan === "premium";
  const maxEmails = isPremium ? 5 : 1;

  const [emails, setEmails] = useState<MonitoredEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  // Verification state
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const fetchEmails = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("monitored_identifiers")
      .select("id, display_label, value_last4, verified, is_active")
      .eq("user_id", user.id)
      .eq("type", "email")
      .order("created_at", { ascending: true });
    setEmails((data as MonitoredEmail[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchEmails();
  }, [user]);

  const handleAddEmail = async () => {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed) || trimmed.length > 255) {
      toast({ title: "Invalid email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }

    setAdding(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-email-verification", {
        body: { action: "send", email: trimmed },
      });

      if (error || data?.error) {
        toast({ title: "Error", description: data?.error || error?.message || "Failed to add email", variant: "destructive" });
        return;
      }

      toast({ title: "Verification sent", description: `A 6-digit code was sent to ${trimmed}` });
      setNewEmail("");
      setShowAdd(false);
      setVerifyingId(data.identifier_id);
      setVerifyCode("");
      await fetchEmails();
    } catch (err) {
      toast({ title: "Error", description: "Failed to send verification email", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const handleVerify = async () => {
    if (!verifyingId || !verifyCode.trim()) return;
    setVerifyLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-email-verification", {
        body: { action: "verify", identifier_id: verifyingId, code: verifyCode.trim() },
      });

      if (error || data?.error) {
        toast({ title: "Verification failed", description: data?.error || "Invalid code", variant: "destructive" });
        return;
      }

      toast({ title: "Email verified!", description: "This email is now being monitored for breaches." });
      setVerifyingId(null);
      setVerifyCode("");
      await fetchEmails();
    } catch {
      toast({ title: "Error", description: "Verification failed", variant: "destructive" });
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleResend = async (id: string) => {
    setResending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-email-verification", {
        body: { action: "resend", identifier_id: id },
      });
      if (error || data?.error) {
        toast({ title: "Error", description: data?.error || "Failed to resend", variant: "destructive" });
      } else {
        toast({ title: "Code resent", description: "Check your inbox for the new code." });
        setVerifyingId(id);
        setVerifyCode("");
      }
    } catch {
      toast({ title: "Error", description: "Failed to resend code", variant: "destructive" });
    } finally {
      setResending(false);
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm("Remove this email from monitoring?")) return;
    await supabase.from("monitored_identifiers").delete().eq("id", id).eq("user_id", user!.id);
    if (verifyingId === id) {
      setVerifyingId(null);
      setVerifyCode("");
    }
    toast({ title: "Removed", description: "Email removed from monitoring." });
    await fetchEmails();
  };

  const canAddMore = emails.length < maxEmails;

  return (
    <section className="mb-6 rounded-2xl border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Monitored Emails</h2>
          <Badge variant="outline" className="text-[10px]">
            {emails.length}/{maxEmails}
          </Badge>
        </div>
        {canAddMore && !showAdd && (
          <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={() => setShowAdd(true)}>
            <Plus className="mr-1 h-3 w-3" /> Add Email
          </Button>
        )}
      </div>

      {loading ? (
        <div className="h-12 animate-pulse rounded-xl bg-muted" />
      ) : (
        <div className="space-y-3">
          {/* Email list */}
          {emails.map((em) => (
            <div key={em.id} className="flex items-center justify-between rounded-xl bg-muted/30 px-4 py-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-sm truncate">{em.display_label || `****${em.value_last4}`}</span>
                {em.verified ? (
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] shrink-0">
                    <CheckCircle className="mr-0.5 h-2.5 w-2.5" /> Verified
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-warning border-warning/30 shrink-0">
                    <AlertCircle className="mr-0.5 h-2.5 w-2.5" /> Pending
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {!em.verified && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => { setVerifyingId(em.id); setVerifyCode(""); }}
                    >
                      Enter Code
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={resending}
                      onClick={() => handleResend(em.id)}
                    >
                      <RefreshCw className={`h-3 w-3 ${resending ? "animate-spin" : ""}`} />
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={() => handleRemove(em.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}

          {/* Verification code entry */}
          {verifyingId && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
              <p className="text-xs text-muted-foreground">Enter the 6-digit code sent to your email:</p>
              <div className="flex gap-2">
                <Input
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="rounded-xl font-mono text-center tracking-[0.3em] max-w-[180px]"
                  maxLength={6}
                  onKeyDown={(e) => e.key === "Enter" && verifyCode.length === 6 && handleVerify()}
                />
                <Button
                  onClick={handleVerify}
                  disabled={verifyCode.length !== 6 || verifyLoading}
                  className="rounded-xl"
                  size="sm"
                >
                  {verifyLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Verify"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => { setVerifyingId(null); setVerifyCode(""); }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Add new email form */}
          {showAdd && (
            <div className="flex gap-2">
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Enter email to monitor"
                className="rounded-xl"
                maxLength={255}
                onKeyDown={(e) => e.key === "Enter" && handleAddEmail()}
              />
              <Button onClick={handleAddEmail} disabled={adding || !newEmail.trim()} className="rounded-xl" size="sm">
                {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Send Code"}
              </Button>
              <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => { setShowAdd(false); setNewEmail(""); }}>
                Cancel
              </Button>
            </div>
          )}

          {/* Empty state */}
          {emails.length === 0 && !showAdd && (
            <p className="text-sm text-muted-foreground text-center py-2">
              No emails monitored yet. Add an email to start scanning for breaches.
            </p>
          )}

          {/* Upgrade prompt */}
          {!canAddMore && !isPremium && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Upgrade to Premium for up to 5 monitored emails</span>
              </div>
              <Button asChild variant="outline" size="sm" className="rounded-xl text-xs">
                <Link to="/pricing">Upgrade <ArrowRight className="ml-1 h-3 w-3" /></Link>
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
