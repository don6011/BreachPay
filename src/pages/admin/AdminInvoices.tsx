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
  due_date: string | null;
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
  // Default to current month
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const [genStart, setGenStart] = useState(monthStart);
  const [genEnd, setGenEnd] = useState(monthEnd);
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
        .select("id, partner_id, period_start, period_end, status, subtotal, notes, created_at, sent_at, paid_at, due_date, partners(name)")
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
          due_date: i.due_date,
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
    if (!genStart || !genEnd) {
      toast.error("Select date range");
      return;
    }
    setGenerating(true);
    try {
      const { data: count, error: rpcErr } = await supabase.rpc("rpc_admin_generate_partner_invoices", {
        p_period_start: genStart,
        p_period_end: genEnd,
      });

      if (rpcErr) throw rpcErr;

      if (count === 0) {
        toast.error("No invoiceable referrals found for this period");
      } else {
        toast.success(`Generated ${count} invoice(s)`);
      }

      setShowGenerate(false);
      setGenStart("");
      setGenEnd("");
      setGenNotes("");
      fetchInvoices();
    } catch (err: any) {
      toast.error(err.message || "Failed to generate invoices");
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
      if (action === "paid") {
        // Use the RPC to atomically mark paid + update referrals
        const { error: rpcErr } = await supabase.rpc("rpc_admin_mark_invoice_paid", {
          p_invoice_id: selectedInvoice.id,
        });
        if (rpcErr) throw rpcErr;
      } else {
        const updates: Record<string, any> = {};
        if (action === "send") {
          updates.status = "sent";
          updates.sent_at = new Date().toISOString();
        } else if (action === "void") {
          updates.status = "void";
        }
        const { error } = await supabase.from("partner_invoices").update(updates).eq("id", selectedInvoice.id);
        if (error) throw error;
      }

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
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Due</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
            ) : invoices.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No invoices yet</td></tr>
            ) : invoices.map((inv) => (
              <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => openDetail(inv)}>
                <td className="px-4 py-3 font-medium">{inv.partner_name}</td>
                <td className="px-4 py-3 text-xs">{inv.period_start} → {inv.period_end}</td>
                <td className="px-4 py-3 text-right font-semibold text-primary">${inv.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-xs">{inv.item_count}</td>
                <td className="px-4 py-3 text-xs">
                  {inv.due_date ? (
                    <span className={inv.status !== "paid" && new Date(inv.due_date) < new Date() ? "text-destructive font-semibold" : ""}>
                      {inv.due_date}
                    </span>
                  ) : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[inv.status] || "bg-muted text-muted-foreground"}`}>
                    {inv.status}
                  </span>
                </td>
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
            <p className="text-xs text-muted-foreground">Generates draft invoices (Net 15 terms) for <strong>all partners</strong> with paid-claim referrals in the selected monthly period. CPA rate: <strong>$5/claim</strong>.</p>
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
                  <p className="text-[10px] text-muted-foreground uppercase">Due Date (Net 15)</p>
                  <p className={`font-medium ${selectedInvoice.due_date && selectedInvoice.status !== "paid" && new Date(selectedInvoice.due_date) < new Date() ? "text-destructive" : ""}`}>
                    {selectedInvoice.due_date || "—"}
                  </p>
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
