import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, CheckCircle2, AlertTriangle } from "lucide-react";

export default function PartnerSLA() {
  const { data: slaMetrics = [], isLoading } = useQuery({
    queryKey: ["partner-sla-metrics"],
    queryFn: async () => {
      const { data: pu } = await supabase.rpc("get_partner_id_for_user", { p_user_id: (await supabase.auth.getUser()).data.user?.id });
      if (!pu) return [];
      const { data, error } = await supabase
        .from("partner_sla_metrics")
        .select("*")
        .eq("partner_id", pu)
        .order("period_end", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data;
    },
  });

  const latest = slaMetrics[0];
  const complianceRate = latest ? Math.round(((latest.claims_processed - (latest.claims_breached_sla || 0)) / Math.max(latest.claims_processed, 1)) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">SLA Performance</h1>
        <p className="text-muted-foreground">Track processing times and SLA compliance</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2"><Clock className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-2xl font-bold">{latest?.avg_processing_time_hours?.toFixed(1) || "—"}h</p>
              <p className="text-xs text-muted-foreground">Avg Processing Time</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-green-500/10 p-2"><CheckCircle2 className="h-5 w-5 text-green-600" /></div>
            <div>
              <p className="text-2xl font-bold">{latest?.claims_processed || 0}</p>
              <p className="text-xs text-muted-foreground">Claims Processed (Period)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">SLA Compliance</span>
              <Badge variant={complianceRate >= 95 ? "default" : complianceRate >= 80 ? "secondary" : "destructive"}>
                {complianceRate}%
              </Badge>
            </div>
            <Progress value={complianceRate} className="h-2" />
            <p className="text-xs text-muted-foreground">Target: {latest?.sla_target_hours || 48}h</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>SLA History</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Claims Processed</TableHead>
                <TableHead>Avg Time (h)</TableHead>
                <TableHead>SLA Target (h)</TableHead>
                <TableHead>Breached</TableHead>
                <TableHead>Compliance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slaMetrics.map((m: any) => {
                const compliance = Math.round(((m.claims_processed - (m.claims_breached_sla || 0)) / Math.max(m.claims_processed, 1)) * 100);
                return (
                  <TableRow key={m.id}>
                    <TableCell className="text-sm">{m.period_start} — {m.period_end}</TableCell>
                    <TableCell>{m.claims_processed}</TableCell>
                    <TableCell>{m.avg_processing_time_hours?.toFixed(1) || "—"}</TableCell>
                    <TableCell>{m.sla_target_hours}h</TableCell>
                    <TableCell>
                      {m.claims_breached_sla > 0 ? (
                        <span className="flex items-center gap-1 text-destructive"><AlertTriangle className="h-3 w-3" /> {m.claims_breached_sla}</span>
                      ) : <span className="text-green-600">0</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={compliance >= 95 ? "default" : compliance >= 80 ? "secondary" : "destructive"}>
                        {compliance}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
              {slaMetrics.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{isLoading ? "Loading..." : "No SLA data yet"}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
