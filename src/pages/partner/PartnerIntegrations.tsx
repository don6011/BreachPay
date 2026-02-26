import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Copy, Plus, Link2, Code2, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const PartnerIntegrations = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [affiliateLinks, setAffiliateLinks] = useState<any[]>([]);
  const [newCode, setNewCode] = useState("");

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
          .from("affiliate_links")
          .select("*")
          .eq("partner_id", pu.partner_id)
          .order("created_at", { ascending: false });
        setAffiliateLinks(data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [user]);

  const createLink = async () => {
    if (!partnerId || !newCode.trim()) return;
    const code = newCode.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "");
    const { error } = await supabase.from("affiliate_links").insert({
      partner_id: partnerId,
      code,
    });
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Code already taken" : error.message);
      return;
    }
    toast.success("Affiliate link created");
    setNewCode("");
    // Refresh
    const { data } = await supabase.from("affiliate_links").select("*").eq("partner_id", partnerId).order("created_at", { ascending: false });
    setAffiliateLinks(data || []);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const baseUrl = window.location.origin;
  const supabaseUrl = "https://zmjikithlaxeldvsmklz.supabase.co/functions/v1";

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div>
      <PageHeader title="Integrations" subtitle="API endpoints, widgets, and affiliate links" />

      {/* API Endpoints */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Code2 className="h-5 w-5 text-primary" /> API Endpoints
        </h2>
        <div className="space-y-4">
          <div className="rounded-2xl border bg-card p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">Breach Intake</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">POST</span>
            </div>
            <code className="text-xs bg-muted rounded-lg px-3 py-2 block mb-3 break-all text-muted-foreground">
              {supabaseUrl}/partner-intake-breach
            </code>
            <pre className="text-xs bg-muted/50 rounded-lg px-3 py-2 overflow-x-auto text-muted-foreground">
{`{
  "partner_id": "${partnerId || "your-partner-id"}",
  "email": "user@email.com",
  "breach_company": "T-Mobile",
  "breach_year": 2021
}`}
            </pre>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => copyToClipboard(`${supabaseUrl}/partner-intake-breach`)}>
              <Copy className="h-3 w-3 mr-1" /> Copy URL
            </Button>
          </div>

          <div className="rounded-2xl border bg-card p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">Claim Intake</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">POST</span>
            </div>
            <code className="text-xs bg-muted rounded-lg px-3 py-2 block mb-3 break-all text-muted-foreground">
              {supabaseUrl}/partner-intake-claim
            </code>
            <pre className="text-xs bg-muted/50 rounded-lg px-3 py-2 overflow-x-auto text-muted-foreground">
{`{
  "partner_id": "${partnerId || "your-partner-id"}",
  "full_name": "Jane Doe",
  "email": "user@email.com",
  "breach": "T-Mobile",
  "notes": "Client referred from intake form"
}`}
            </pre>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => copyToClipboard(`${supabaseUrl}/partner-intake-claim`)}>
              <Copy className="h-3 w-3 mr-1" /> Copy URL
            </Button>
          </div>
        </div>
      </section>

      {/* Widget Embed */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <ExternalLink className="h-5 w-5 text-primary" /> Embeddable Widget
        </h2>
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-sm text-muted-foreground mb-3">
            Add this code to your website to embed a BreachPay scan widget:
          </p>
          <pre className="text-xs bg-muted rounded-lg px-3 py-2 overflow-x-auto text-muted-foreground mb-3">
{`<div data-breachpay-scan data-partner-id="${partnerId || "your-partner-id"}" data-theme="light"></div>
<script src="${supabaseUrl}/partner-widget"></script>`}
          </pre>
          <Button variant="outline" size="sm" onClick={() => copyToClipboard(
            `<div data-breachpay-scan data-partner-id="${partnerId}" data-theme="light"></div>\n<script src="${supabaseUrl}/partner-widget"></script>`
          )}>
            <Copy className="h-3 w-3 mr-1" /> Copy Embed Code
          </Button>
        </div>
      </section>

      {/* Affiliate Links */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Link2 className="h-5 w-5 text-primary" /> Affiliate Links
        </h2>

        <div className="flex gap-3 mb-4">
          <Input
            placeholder="Enter referral code (e.g., my-firm)"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            className="max-w-xs rounded-xl"
          />
          <Button onClick={createLink} disabled={!newCode.trim()}>
            <Plus className="h-4 w-4 mr-1" /> Create Link
          </Button>
        </div>

        <div className="rounded-2xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Code</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Link</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Clicks</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Conversions</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody>
              {affiliateLinks.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No affiliate links yet</td></tr>
              ) : affiliateLinks.map((link) => (
                <tr key={link.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-medium">{link.code}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{baseUrl}/signup?ref={link.code}</td>
                  <td className="px-4 py-3 text-right">{link.clicks}</td>
                  <td className="px-4 py-3 text-right text-primary font-semibold">{link.conversions}</td>
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(`${baseUrl}/signup?ref=${link.code}`)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default PartnerIntegrations;
