import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Key, Copy, Loader2, RefreshCw, Trash2, Eye, EyeOff, BarChart3, Shield } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

async function hashString(raw: string): Promise<string> {
  const enc = new TextEncoder().encode(raw);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = "bp_live_";
  for (let i = 0; i < 40; i++) key += chars.charAt(Math.floor(Math.random() * chars.length));
  return key;
}

const PartnerApiAccess = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [usage, setUsage] = useState<any[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  const supabaseUrl = "https://zmjikithlaxeldvsmklz.supabase.co/functions/v1";

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const { data: pu } = await supabase
          .from("partner_users")
          .select("partner_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();
        if (!pu) { setLoading(false); return; }
        setPartnerId(pu.partner_id);

        const { data: keys } = await supabase
          .from("api_keys" as any)
          .select("*")
          .eq("partner_id", pu.partner_id)
          .order("created_at", { ascending: false });
        setApiKeys(keys || []);

        // Get usage summary for last 24h
        const since = new Date(Date.now() - 86400000).toISOString();
        const keyIds = (keys || []).map((k: any) => k.id);
        if (keyIds.length > 0) {
          const { data: usageData } = await supabase
            .from("api_usage_logs" as any)
            .select("api_key_id, endpoint, request_count, created_at")
            .in("api_key_id", keyIds)
            .gte("created_at", since)
            .order("created_at", { ascending: false })
            .limit(100);
          setUsage(usageData || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const createKey = async () => {
    if (!partnerId) return;
    const rawKey = generateApiKey();
    const keyHash = await hashString(rawKey);
    const keyPrefix = rawKey.substring(0, 12) + "...";

    const { error } = await supabase.from("api_keys" as any).insert({
      partner_id: partnerId,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      label: newLabel.trim() || "Default",
      scopes: ["settlements", "exposure", "claims_intake"],
    });

    if (error) { toast.error(error.message); return; }

    setCreatedKey(rawKey);
    setShowKey(true);
    setNewLabel("");
    toast.success("API key created — copy it now, it won't be shown again");

    const { data: keys } = await supabase
      .from("api_keys" as any)
      .select("*")
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false });
    setApiKeys(keys || []);
  };

  const revokeKey = async (id: string) => {
    await supabase.from("api_keys" as any).update({ status: "revoked", revoked_at: new Date().toISOString() }).eq("id", id);
    toast.success("API key revoked");
    setApiKeys(prev => prev.map(k => k.id === id ? { ...k, status: "revoked" } : k));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  const totalRequests24h = usage.reduce((sum, u) => sum + (u.request_count || 0), 0);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div>
      <PageHeader title="API Access" subtitle="Manage enterprise API keys, monitor usage, and rate limits" />

      {/* New key creation + reveal */}
      {createdKey && showKey && (
        <div className="mb-6 rounded-2xl border-2 border-primary/30 bg-primary/5 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-primary">New API Key Created</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-3">Copy this key now. It will not be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-muted rounded-lg px-3 py-2 break-all font-mono">{createdKey}</code>
            <Button size="sm" variant="outline" onClick={() => copyToClipboard(createdKey)}>
              <Copy className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setCreatedKey(null); setShowKey(false); }}>
              <EyeOff className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Create key */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Key className="h-5 w-5 text-primary" /> API Keys
        </h2>
        <div className="flex gap-3 mb-4">
          <Input
            placeholder="Key label (e.g., Production)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="max-w-xs rounded-xl"
          />
          <Button onClick={createKey}>
            <RefreshCw className="h-4 w-4 mr-1" /> Generate Key
          </Button>
        </div>

        <div className="rounded-2xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Label</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Key</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Scopes</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Rate Limit</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No API keys yet</td></tr>
              ) : apiKeys.map((k) => (
                <tr key={k.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{k.label}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{k.key_prefix}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(k.scopes || []).map((s: string) => (
                        <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">{k.rate_limit}/hr</td>
                  <td className="px-4 py-3">
                    <Badge variant={k.status === "active" ? "default" : "destructive"}>
                      {k.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {k.status === "active" && (
                      <Button variant="ghost" size="sm" onClick={() => revokeKey(k.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Usage Stats */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" /> Usage (Last 24h)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="rounded-2xl border bg-card p-5">
            <p className="text-sm text-muted-foreground">Total Requests</p>
            <p className="text-2xl font-bold">{totalRequests24h}</p>
          </div>
          <div className="rounded-2xl border bg-card p-5">
            <p className="text-sm text-muted-foreground">Active Keys</p>
            <p className="text-2xl font-bold">{apiKeys.filter(k => k.status === "active").length}</p>
          </div>
          <div className="rounded-2xl border bg-card p-5">
            <p className="text-sm text-muted-foreground">Endpoints Hit</p>
            <p className="text-2xl font-bold">{new Set(usage.map(u => u.endpoint)).size}</p>
          </div>
        </div>
      </section>

      {/* API Documentation */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Quick Reference</h2>
        <div className="space-y-4">
          <div className="rounded-2xl border bg-card p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">List Settlements</h3>
              <Badge variant="secondary">GET</Badge>
            </div>
            <code className="text-xs bg-muted rounded-lg px-3 py-2 block mb-2 break-all text-muted-foreground">
              {supabaseUrl}/enterprise-api/settlements
            </code>
            <p className="text-xs text-muted-foreground">Header: <code className="bg-muted px-1 rounded">x-api-key: your_key</code></p>
          </div>

          <div className="rounded-2xl border bg-card p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">Check Exposure</h3>
              <Badge variant="secondary">POST</Badge>
            </div>
            <code className="text-xs bg-muted rounded-lg px-3 py-2 block mb-2 break-all text-muted-foreground">
              {supabaseUrl}/enterprise-api/exposure/check
            </code>
            <pre className="text-xs bg-muted/50 rounded-lg px-3 py-2 overflow-x-auto text-muted-foreground">
{`{ "email": "user@example.com" }`}
            </pre>
          </div>

          <div className="rounded-2xl border bg-card p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">Submit Claim Intake</h3>
              <Badge variant="secondary">POST</Badge>
            </div>
            <code className="text-xs bg-muted rounded-lg px-3 py-2 block mb-2 break-all text-muted-foreground">
              {supabaseUrl}/enterprise-api/claims/intake
            </code>
            <pre className="text-xs bg-muted/50 rounded-lg px-3 py-2 overflow-x-auto text-muted-foreground">
{`{
  "user": { "name": "Jane Doe", "email": "user@email.com" },
  "settlement_id": "...",
  "notes": "Optional"
}`}
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
};

export default PartnerApiAccess;
