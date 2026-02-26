import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, Clock, Eye, FileWarning, Shield, Users, Headphones } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function AdminOpsConsole() {
  const queryClient = useQueryClient();
  const [queueFilter, setQueueFilter] = useState<string>("all");

  // Review queue
  const { data: reviewQueue = [], isLoading: queueLoading } = useQuery({
    queryKey: ["admin-review-queue", queueFilter],
    queryFn: async () => {
      let q = supabase
        .from("claim_review_queue")
        .select("*, claims(id, user_id, settlement_id, status, est_payout, flagged, flag_reason, exposure_confidence)")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: true });

      if (queueFilter !== "all") q = q.eq("status", queueFilter);
      const { data, error } = await q.limit(50);
      if (error) throw error;
      return data;
    },
  });

  // Fraud flags
  const { data: fraudFlags = [] } = useQuery({
    queryKey: ["admin-fraud-flags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fraud_flags")
        .select("*")
        .eq("resolved", false)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  // Doc AI analysis with fraud
  const { data: docFlags = [] } = useQuery({
    queryKey: ["admin-doc-flags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_ai_analysis")
        .select("*, claim_documents(id, file_name, claim_id, doc_type)")
        .eq("fraud_flag", true)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  // Support escalations
  const { data: escalatedTickets = [] } = useQuery({
    queryKey: ["admin-escalated-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .in("status", ["escalated", "open"])
        .order("priority", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  // Resolve queue item
  const resolveMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("claim_review_queue")
        .update({ status, resolved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-review-queue"] });
      toast.success("Queue item updated");
    },
  });

  // Resolve ticket
  const resolveTicketMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status: "resolved", resolved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-escalated-tickets"] });
      toast.success("Ticket resolved");
    },
  });

  const pendingCount = reviewQueue.filter((r: any) => r.status === "pending").length;
  const fraudCount = fraudFlags.length;
  const docFlagCount = docFlags.length;
  const ticketCount = escalatedTickets.length;

  const queueTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      fraud_review: "bg-destructive/10 text-destructive",
      doc_review: "bg-amber-500/10 text-amber-600",
      partner_escalation: "bg-blue-500/10 text-blue-600",
      manual_verification: "bg-purple-500/10 text-purple-600",
    };
    return colors[type] || "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ops Console</h1>
        <p className="text-muted-foreground">Unified operations dashboard — review queues, fraud, escalations</p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-amber-500/10 p-2"><Clock className="h-5 w-5 text-amber-600" /></div>
            <div>
              <p className="text-2xl font-bold">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">Pending Review</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-destructive/10 p-2"><Shield className="h-5 w-5 text-destructive" /></div>
            <div>
              <p className="text-2xl font-bold">{fraudCount}</p>
              <p className="text-xs text-muted-foreground">Fraud Alerts</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-amber-500/10 p-2"><FileWarning className="h-5 w-5 text-amber-600" /></div>
            <div>
              <p className="text-2xl font-bold">{docFlagCount}</p>
              <p className="text-xs text-muted-foreground">Doc AI Flags</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-blue-500/10 p-2"><Headphones className="h-5 w-5 text-blue-600" /></div>
            <div>
              <p className="text-2xl font-bold">{ticketCount}</p>
              <p className="text-xs text-muted-foreground">Support Escalations</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="queue">
        <TabsList>
          <TabsTrigger value="queue">Review Queue ({pendingCount})</TabsTrigger>
          <TabsTrigger value="fraud">Fraud Alerts ({fraudCount})</TabsTrigger>
          <TabsTrigger value="docs">Doc AI Flags ({docFlagCount})</TabsTrigger>
          <TabsTrigger value="support">Support ({ticketCount})</TabsTrigger>
        </TabsList>

        {/* Review Queue */}
        <TabsContent value="queue" className="space-y-4">
          <div className="flex gap-2">
            <Select value={queueFilter} onValueChange={setQueueFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Claim</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviewQueue.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge className={queueTypeBadge(item.queue_type)} variant="outline">
                        {item.queue_type?.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{item.claim_id?.slice(0, 8)}</TableCell>
                    <TableCell>
                      <span className={`font-bold ${item.priority >= 80 ? "text-destructive" : item.priority >= 60 ? "text-amber-600" : "text-muted-foreground"}`}>
                        {item.priority}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs">{item.notes}</TableCell>
                    <TableCell>
                      <Badge variant={item.status === "pending" ? "default" : item.status === "resolved" ? "secondary" : "outline"}>
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{format(new Date(item.created_at), "MMM d, HH:mm")}</TableCell>
                    <TableCell>
                      {item.status === "pending" && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => resolveMutation.mutate({ id: item.id, status: "in_review" })}>
                            <Eye className="h-3 w-3 mr-1" /> Review
                          </Button>
                          <Button size="sm" variant="default" onClick={() => resolveMutation.mutate({ id: item.id, status: "resolved" })}>
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Resolve
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {reviewQueue.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No items in queue</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Fraud Alerts */}
        <TabsContent value="fraud">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Claim</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fraudFlags.map((flag: any) => (
                  <TableRow key={flag.id}>
                    <TableCell className="font-mono text-xs">{flag.claim_id?.slice(0, 8)}</TableCell>
                    <TableCell>
                      <Badge variant={flag.severity === "critical" ? "destructive" : "outline"}>{flag.severity}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate">{flag.reason}</TableCell>
                    <TableCell className="text-xs">{format(new Date(flag.created_at), "MMM d, HH:mm")}</TableCell>
                  </TableRow>
                ))}
                {fraudFlags.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No fraud alerts</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Doc AI Flags */}
        <TabsContent value="docs">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Detected Type</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Fraud Reasons</TableHead>
                  <TableHead>Completeness</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docFlags.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell className="text-xs">{(d.claim_documents as any)?.file_name || "—"}</TableCell>
                    <TableCell><Badge variant="outline">{d.doc_type_detected}</Badge></TableCell>
                    <TableCell>{d.confidence_score}%</TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-destructive">
                      {(d.fraud_reasons || []).join(", ")}
                    </TableCell>
                    <TableCell>{d.completeness_score}%</TableCell>
                    <TableCell className="text-xs">{format(new Date(d.created_at), "MMM d, HH:mm")}</TableCell>
                  </TableRow>
                ))}
                {docFlags.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No AI-flagged documents</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Support Escalations */}
        <TabsContent value="support">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {escalatedTickets.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="max-w-[200px] truncate">{t.subject}</TableCell>
                    <TableCell><Badge variant="outline">{t.category || "general"}</Badge></TableCell>
                    <TableCell>
                      <span className={`font-bold ${t.priority >= 80 ? "text-destructive" : "text-muted-foreground"}`}>{t.priority}</span>
                    </TableCell>
                    <TableCell><Badge>{t.status}</Badge></TableCell>
                    <TableCell className="text-xs">{format(new Date(t.created_at), "MMM d, HH:mm")}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="default" onClick={() => resolveTicketMutation.mutate(t.id)}>
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Resolve
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {escalatedTickets.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No escalated tickets</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
