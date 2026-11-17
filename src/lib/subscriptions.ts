/** Calls the email-subscriptions backend function. Works without an account. */
export type SubscriptionAction =
  | { action: "subscribe"; email: string; kind: "deadline"; settlement_id: string }
  | { action: "subscribe"; email: string; kind: "weekly" }
  | { action: "confirm"; token: string }
  | { action: "unsubscribe"; token: string };

export interface SubscriptionResult {
  ok: boolean;
  error?: string;
  kind?: "deadline" | "weekly";
  settlement?: { id: string; name: string; company: string; claim_deadline: string | null } | null;
}

export async function callSubscriptions(body: SubscriptionAction): Promise<SubscriptionResult> {
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  try {
    const res = await fetch(`${base}/functions/v1/email-subscriptions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as SubscriptionResult;
    if (!res.ok || !data.ok) return { ok: false, error: data.error || "Something went wrong. Please try again." };
    return data;
  } catch {
    return { ok: false, error: "Couldn't reach BreachPay. Check your connection and try again." };
  }
}
