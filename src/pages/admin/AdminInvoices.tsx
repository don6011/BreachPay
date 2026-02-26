import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Receipt, Loader2, Plus, Send, CheckCircle, XCircle, DollarSign, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface InvoiceRow {
  id: string;
  partner_id: string;
  partner_name: string;
  period_start: string;
  period_end: string;
  status: string;
  subtotal: number;
  notes: string | null;
  created_at: string;
  sent_at: string | null;
  paid_at: string | null;
  item_count: number;
}

interface InvoiceItem {
  id: string;
  referral_id: string;
  description: string | null;
  amount: number;
  created_at: string;
}

interface PartnerOption {
  id: string;
  name: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-primary/10 text-primary",
  paid: "bg-success/10 text-success",
  void: "bg-destructive/10 text-destructive",
};

const AdminInvoices = () => {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [partners, setPartners] = useState<PartnerOption[]>([]);

  // Generate modal
  const [showGenerate, setShowGenerate] = useState(false);
  const [genPartnerId, setGenPartnerId] = useState("");
  const [genStart, setGenStart] = useState("");
  const [genEnd, setGenEnd] = useState("");
  const [genNotes, setGenNotes] = useState("");
  const [generating, setGenerating] = useState(false);

  // Detail modal
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRow | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchInvoices();
    fetchPartners();
  }, [user]);

  const fetchPartners = async () => {
    const { data } = await supabase.from("partners").select("id, name").eq("is_active", true).order("name");
    setPartners(data || []);
  };

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("partner_invoices")
        .select("id, partner_id, period_start, period_end, status, subtotal, notes, created_at, sent_at, paid_at, partners(name)")
        .order("created_at", { ascending: false })
        .limit(100);

      if (data) {
        // Get item counts
        const invoiceIds = data.map((i: any) => i.id);
        const { data: items } = await supabase
          .from("partner_invoice_items")
          .select("invoice_id")
          .in("invoice_id", invoiceIds);

        const countMap: Record<string, number> = {};
        items?.forEach((i: any) => { countMap[i.invoice_id] = (countMap[i.invoice_id] || 0) + 1; });

        setInvoices(data.map((i: any) => ({
          id: i.id,
          partner_id: i.partner_id,
          partner_name: i.partners?.name || "Unknown",
          period_start: i.period_start,
          period_end: i.period_end,
          status: i.status,
          subtotal: Number(i.subtotal),
          notes: i.notes,
          created_at: i.created_at,
          sent_at: i.sent_at,
          paid_at: i.paid_at,
          item_count: countMap[i.id] || 0,
        })));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!genPartnerId || !genStart || !genEnd) {
      toast.error("Select partner and date range");
      return;
    }
    setGenerating(true);
    try {
      // Find invoiceable referrals for this partner in the period
      const { data: referrals, error: refErr } = await supabase
        .from("referrals")
        .select("id, amount_expected, claim_id, claims(settlements(name))")
        .eq("partner_id", genPartnerId)
        .eq("status", "invoiced")
        .gte("created_at", new Date(genStart).toISOString())
        .lte("created_at", new Date(genEnd + "T23:59:59").toISOString());

      if (refErr) throw refErr;
      if (!referrals || referrals.length === 0) {
        toast.error("No invoiceable referrals found for this period");
        setGenerating(false);
        return;
      }

      const subtotal = referrals.reduce((s, r: any) => s + (Number(r.amount_expected) || 0), 0);

      // Create invoice
      const { data: invoice, error: invErr } = await supabase
        .from("partner_invoices")
        .insert({
          partner_id: genPartnerId,
          period_start: genStart,
          period_end: genEnd,
          subtotal,
          notes: genNotes || null,
        })
        .select("id")
        .single();

      if (invErr || !invoice) throw invErr || new Error("Failed to create invoice");

      // Create invoice items
      const items = referrals.map((r: any) => ({
        invoice_id: invoice.id,
        referral_id: r.id,
        description: `Referral — ${(r.claims as any)?.settlements?.name || "Claim"}`,
        amount: Number(r.amount_expected) || 0,
      }));

      const { error: itemsErr } = await supabase.from("partner_invoice_items").insert(items);
      if (itemsErr) throw itemsErr;

      toast.success(`Invoice generated — ${referrals.length} items, $${subtotal.toLocaleString()}`);
      setShowGenerate(false);
      setGenPartnerId("");
      setGenStart("");
      setGenEnd("");
      setGenNotes("");
      fetchInvoices();
    } catch (err: any) {
      toast.error(err.message || "Failed to generate invoice");
    } finally {
      setGenerating(false);
    }
  };

  const openDetail = async (inv: InvoiceRow) => {
    setSelectedInvoice(inv);
    setLoadingItems(true);
    const { data } = await supabase
      .from("partner_invoice_items")
      .select("id, referral_id, description, amount, created_at")
      .eq("invoice_id", inv.id)
      .order("created_at");
    setInvoiceItems((data as InvoiceItem[]) || []);
    setLoadingItems(false);
  };

  const handleAction = async (action: "send" | "paid" | "void") => {
    if (!selectedInvoice) return;
    setActionLoading(true);
    try {
      const updates: Record<string, any> = {};
      if (action === "send") {
        updates.status = "sent";
        updates.sent_at = new Date().toISOString();
      } else if (action === "paid") {
        updates.status = "paid";
        updates.paid_at = new Date().toISOString();
        // Also mark referrals as paid
        const refIds = invoiceItems.map(i => i.referral_id);
        if (refIds.length > 0) {
          await supabase.from("referrals").update({ status: "paid", amount_paid: 0 }).in("id", refIds);
          // Update amount_paid individually
          for (const item of invoiceItems) {
            await supabase.from("referrals").update({ amount_paid: item.amount }).eq("id", item.referral_id);
          }
        }
      } else if (action === "void") {
        updates.status = "void";
      }

      const { error } = await supabase.from("partner_invoices").update(updates).eq("id", selectedInvoice.id);
      if (error) throw error;

      toast.success(`Invoice ${action === "send" ? "sent" : action === "paid" ? "marked paid" : "voided"}`);
      setSelectedInvoice(null);
      fetchInvoices();
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="Partner Invoices" subtitle="Generate and manage partner billing">
        <Button size="sm" className="rounded-xl gap-1.5" onClick={() => setShowGenerate(true)}>
          <Plus className="h-3.5 w-3.5" /> Generate Invoice
        </Button>
      </PageHeader>

      <div className="rounded-2xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Partner</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Period</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Subtotal</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Items</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Created</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
            ) : invoices.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No invoices yet</td></tr>
            ) : invoices.map((inv) => (
              <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => openDetail(inv)}>
                <td className="px-4 py-3 font-medium">{inv.partner_name}</td>
                <td className="px-4 py-3 text-xs">{inv.period_start} → {inv.period_end}</td>
                <td className="px-4 py-3 text-right font-semibold text-primary">${inv.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-xs">{inv.item_count}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[inv.status] || "bg-muted text-muted-foreground"}`}>
                    {inv.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs">{new Date(inv.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <Button size="sm" variant="ghost" className="rounded-lg" onClick={(e) => { e.stopPropagation(); openDetail(inv); }}>
                    <Receipt className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Generate Invoice Modal */}
      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="h-4 w-4 text-primary" /> Generate Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Partner</Label>
              <select value={genPartnerId} onChange={(e) => setGenPartnerId(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm mt-1">
                <option value="">Select partner...</option>
                {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Period Start</Label>
                <Input type="date" value={genStart} onChange={(e) => setGenStart(e.target.value)} />
              </div>
              <div>
                <Label>Period End</Label>
                <Input type="date" value={genEnd} onChange={(e) => setGenEnd(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea value={genNotes} onChange={(e) => setGenNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerate(false)}>Cancel</Button>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</> : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Detail Modal */}
      <Dialog open={!!selectedInvoice} onOpenChange={(open) => !open && setSelectedInvoice(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" /> Invoice — {selectedInvoice?.partner_name}
            </DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-[10px] text-muted-foreground uppercase">Period</p>
                  <p className="font-medium">{selectedInvoice.period_start} → {selectedInvoice.period_end}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-[10px] text-muted-foreground uppercase">Status</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[selectedInvoice.status]}`}>
                    {selectedInvoice.status}
                  </span>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-[10px] text-muted-foreground uppercase">Subtotal</p>
                  <p className="font-bold text-primary">${selectedInvoice.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-[10px] text-muted-foreground uppercase">Items</p>
                  <p className="font-medium">{invoiceItems.length}</p>
                </div>
              </div>

              {selectedInvoice.notes && (
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <p className="text-[10px] text-muted-foreground uppercase mb-1">Notes</p>
                  <p>{selectedInvoice.notes}</p>
                </div>
              )}

              <div>
                <h4 className="text-sm font-semibold mb-2">Line Items</h4>
                {loadingItems ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                ) : invoiceItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-3 bg-muted/30 rounded-lg">No items</p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {invoiceItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
                        <span className="text-xs truncate flex-1 mr-2">{item.description || "Referral"}</span>
                        <span className="font-semibold text-primary shrink-0">${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t">
                {selectedInvoice.status === "draft" && (
                  <>
                    <Button size="sm" className="flex-1 gap-1.5" disabled={actionLoading} onClick={() => handleAction("send")}>
                      <Send className="h-3.5 w-3.5" /> Mark Sent
                    </Button>
                    <Button size="sm" variant="destructive" className="gap-1.5" disabled={actionLoading} onClick={() => handleAction("void")}>
                      <XCircle className="h-3.5 w-3.5" /> Void
                    </Button>
                  </>
                )}
                {selectedInvoice.status === "sent" && (
                  <>
                    <Button size="sm" className="flex-1 gap-1.5" disabled={actionLoading} onClick={() => handleAction("paid")}>
                      <CheckCircle className="h-3.5 w-3.5" /> Mark Paid
                    </Button>
                    <Button size="sm" variant="destructive" className="gap-1.5" disabled={actionLoading} onClick={() => handleAction("void")}>
                      <XCircle className="h-3.5 w-3.5" /> Void
                    </Button>
                  </>
                )}
                {(selectedInvoice.status === "paid" || selectedInvoice.status === "void") && (
                  <p className="text-xs text-muted-foreground flex-1 text-center py-2">
                    {selectedInvoice.status === "paid" ? `Paid on ${selectedInvoice.paid_at ? new Date(selectedInvoice.paid_at).toLocaleDateString() : "—"}` : "Invoice voided"}
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminInvoices;
