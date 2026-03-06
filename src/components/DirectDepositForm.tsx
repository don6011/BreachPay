import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { CreditCard, Building2, CheckCircle, Loader2, Trash2, Edit3, ShieldCheck } from "lucide-react";

interface PaymentMethod {
  id: string;
  bank_name: string | null;
  account_holder_name: string | null;
  routing_number_last4: string | null;
  account_number_last4: string | null;
  account_type: string;
  status: string;
  is_verified: boolean;
  is_default: boolean;
}

const DirectDepositForm = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [method, setMethod] = useState<PaymentMethod | null>(null);

  // Form fields (full values only in memory, never stored full)
  const [bankName, setBankName] = useState("");
  const [holderName, setHolderName] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountType, setAccountType] = useState<"checking" | "savings">("checking");

  useEffect(() => {
    if (user) fetchMethod();
  }, [user]);

  const fetchMethod = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("user_payment_methods")
      .select("*")
      .eq("user_id", user!.id)
      .eq("is_default", true)
      .maybeSingle();
    if (data) {
      setMethod(data as PaymentMethod);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!routingNumber || routingNumber.length !== 9) {
      toast({ title: "Invalid routing number", description: "Routing number must be 9 digits.", variant: "destructive" });
      return;
    }
    if (!accountNumber || accountNumber.length < 4) {
      toast({ title: "Invalid account number", description: "Please enter a valid account number.", variant: "destructive" });
      return;
    }
    if (!holderName.trim()) {
      toast({ title: "Name required", description: "Please enter the account holder name.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const payload = {
      user_id: user!.id,
      method_type: "direct_deposit" as const,
      bank_name: bankName.trim() || null,
      account_holder_name: holderName.trim(),
      routing_number_last4: routingNumber.slice(-4),
      account_number_last4: accountNumber.slice(-4),
      account_type: accountType,
      is_default: true,
      status: "pending" as const,
    };

    let error;
    if (method) {
      ({ error } = await supabase
        .from("user_payment_methods")
        .update(payload)
        .eq("id", method.id));
    } else {
      ({ error } = await supabase
        .from("user_payment_methods")
        .insert(payload));
    }

    if (error) {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Direct deposit saved", description: "Your payment method has been updated." });
      resetForm();
      await fetchMethod();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!method) return;
    setSaving(true);
    const { error } = await supabase
      .from("user_payment_methods")
      .delete()
      .eq("id", method.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Removed", description: "Payment method removed." });
      setMethod(null);
      setEditing(false);
    }
    setSaving(false);
  };

  const resetForm = () => {
    setEditing(false);
    setBankName("");
    setHolderName("");
    setRoutingNumber("");
    setAccountNumber("");
    setAccountType("checking");
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-dashed bg-card p-6 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Show saved method
  if (method && !editing) {
    return (
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Direct Deposit</h3>
          </div>
          <div className="flex items-center gap-1">
            {method.status === "verified" ? (
              <span className="text-xs font-medium text-success flex items-center gap-1">
                <CheckCircle className="h-3 w-3" /> Verified
              </span>
            ) : (
              <span className="text-xs font-medium text-warning">Pending verification</span>
            )}
          </div>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{method.account_holder_name}</p>
              <p className="text-xs text-muted-foreground">
                {method.bank_name ? `${method.bank_name} · ` : ""}
                {method.account_type === "checking" ? "Checking" : "Savings"} ····{method.account_number_last4}
              </p>
              <p className="text-xs text-muted-foreground">Routing ····{method.routing_number_last4}</p>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={() => setEditing(true)}>
              <Edit3 className="h-3 w-3 mr-1" /> Update
            </Button>
            <Button variant="ghost" size="sm" className="rounded-xl text-xs text-destructive hover:text-destructive" onClick={handleDelete} disabled={saving}>
              <Trash2 className="h-3 w-3 mr-1" /> Remove
            </Button>
          </div>
        </div>
        <div className="px-5 py-3 border-t bg-muted/20">
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" /> Bank details are stored securely. Only the last 4 digits are retained.
          </p>
        </div>
      </div>
    );
  }

  // Form (add or edit)
  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b bg-muted/30 flex items-center gap-2">
        <Building2 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">{method ? "Update" : "Set Up"} Direct Deposit</h3>
      </div>
      <div className="p-5 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Account Holder Name</Label>
          <Input
            placeholder="Jane Doe"
            value={holderName}
            onChange={(e) => setHolderName(e.target.value)}
            className="rounded-xl"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Bank Name (optional)</Label>
          <Input
            placeholder="Chase, Wells Fargo, etc."
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            className="rounded-xl"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Routing Number</Label>
            <Input
              placeholder="9 digits"
              value={routingNumber}
              onChange={(e) => setRoutingNumber(e.target.value.replace(/\D/g, "").slice(0, 9))}
              className="rounded-xl"
              maxLength={9}
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Account Number</Label>
            <Input
              placeholder="Account number"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 17))}
              className="rounded-xl"
              maxLength={17}
              inputMode="numeric"
              type="password"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Account Type</Label>
          <div className="flex gap-2">
            {(["checking", "savings"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setAccountType(t)}
                className={`px-4 py-2 rounded-xl text-xs font-medium border transition-all ${
                  accountType === t
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input bg-transparent text-muted-foreground hover:border-primary/40"
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button onClick={handleSave} disabled={saving} className="rounded-xl">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            {method ? "Update" : "Save"} Payment Method
          </Button>
          {editing && (
            <Button variant="ghost" onClick={resetForm} className="rounded-xl">
              Cancel
            </Button>
          )}
        </div>
      </div>
      <div className="px-5 py-3 border-t bg-muted/20">
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          <ShieldCheck className="h-3 w-3" /> Only the last 4 digits of your routing and account numbers are stored. Full numbers are never saved.
        </p>
      </div>
    </div>
  );
};

export default DirectDepositForm;
