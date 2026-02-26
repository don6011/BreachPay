import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Users, FileText, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";

const PartnerIntake = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [partnerId, setPartnerId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      try {
        const { data: pu } = await supabase
          .from("partner_users")
          .select("partner_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();
        if (!pu) { setLoading(false); return; }
        setPartnerId(pu.partner_id);

        const { data } = await supabase
          .from("partner_intake_logs")
          .select("*")
          .eq("partner_id", pu.partner_id)
          .order("created_at", { ascending: false })
          .limit(100);
        setLogs(data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [user]);

  const total = logs.length;
  const completed = logs.filter(l => l.status === "completed").length;
  const failed = logs.filter(l => l.status === "failed").length;
  const breachIntakes = logs.filter(l => l.intake_type === "breach").length;
  const claimIntakes = logs.filter(l => l.intake_type === "claim").length;

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div>
      <PageHeader title="Intake Volume" subtitle="Inbound referrals from your integrations" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-8">
        <StatCard icon={Users} label="Total Referrals" value={total} variant="teal" />
        <StatCard icon={CheckCircle} label="Completed" value={completed} />
        <StatCard icon={XCircle} label="Failed" value={failed} />
        <StatCard icon={FileText} label="Claims Created" value={claimIntakes} />
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Breach</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No intake referrals yet</td></tr>
            ) : logs.map((log) => (
              <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 text-xs text-muted-foreground">{format(new Date(log.created_at), "MMM d, yyyy")}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${log.intake_type === "claim" ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary"}`}>
                    {log.intake_type}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{log.email?.replace(/(.{3}).*(@.*)/, "$1***$2")}</td>
                <td className="px-4 py-3">{log.breach_company || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    log.status === "completed" ? "bg-success/10 text-success" :
                    log.status === "failed" ? "bg-destructive/10 text-destructive" :
                    log.status === "processing" ? "bg-warning/10 text-warning" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {log.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PartnerIntake;
