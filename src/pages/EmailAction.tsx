import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicLayout } from "@/components/public/PublicLayout";
import { callSubscriptions, type SubscriptionResult } from "@/lib/subscriptions";
import { DIRECTORY_PATH, formatDate, settlementPath } from "@/lib/settlements/format";
import { useSeo } from "@/lib/useSeo";

type Mode = "confirm" | "unsubscribe";

const COPY: Record<Mode, { title: string; intro: string; button: string }> = {
  confirm: {
    title: "Confirm your email",
    intro: "Click below to confirm that you want these emails from BreachPay.",
    button: "Confirm my email",
  },
  unsubscribe: {
    title: "Unsubscribe",
    intro: "Click below to stop these emails. You won't get any more of this kind.",
    button: "Unsubscribe",
  },
};

/**
 * Landing page for the links in confirmation and reminder emails. It waits for
 * a click, because mail scanners open links automatically and that shouldn't
 * confirm or cancel anything.
 */
function EmailAction({ mode }: { mode: Mode }) {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<"idle" | "working" | "done">("idle");
  const [result, setResult] = useState<SubscriptionResult | null>(null);
  const copy = COPY[mode];

  useSeo({ title: `${copy.title} | BreachPay`, description: copy.intro, canonical: "", jsonLd: [], noindex: true });

  const run = async () => {
    setState("working");
    setResult(await callSubscriptions({ action: mode, token }));
    setState("done");
  };

  const settlement = result?.settlement ?? null;

  return (
    <PublicLayout>
      <div className="mx-auto max-w-lg px-6 py-20 text-center">
        {state !== "done" ? (
          <>
            <h1 className="text-3xl font-bold">{copy.title}</h1>
            <p className="mt-3 text-muted-foreground">{token ? copy.intro : "This link is missing its code. Open it again from the email."}</p>
            {token && (
              <Button onClick={run} disabled={state === "working"} size="lg" className="mt-8 rounded-xl">
                {state === "working" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                {copy.button}
              </Button>
            )}
          </>
        ) : result?.ok ? (
          <div role="status">
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary" aria-hidden />
            <h1 className="mt-4 text-3xl font-bold">{mode === "confirm" ? "You're confirmed" : "You're unsubscribed"}</h1>
            <p className="mt-3 text-muted-foreground">
              {mode === "unsubscribe"
                ? "You won't get any more of these emails."
                : result.kind === "weekly"
                  ? "You'll get one email a week with new or updated settlements and upcoming deadlines."
                  : settlement
                    ? `We'll email you before the claim deadline for ${settlement.name}${
                        formatDate(settlement.claim_deadline) ? ` (${formatDate(settlement.claim_deadline)})` : ""
                      }.`
                    : "Your reminder is set."}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {settlement && (
                <Button asChild className="rounded-xl">
                  <Link to={settlementPath(settlement)}>Back to the settlement</Link>
                </Button>
              )}
              <Button asChild variant={settlement ? "outline" : "default"} className="rounded-xl">
                <Link to={DIRECTORY_PATH}>Browse settlements</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div role="alert">
            <XCircle className="mx-auto h-12 w-12 text-destructive" aria-hidden />
            <h1 className="mt-4 text-3xl font-bold">That didn't work</h1>
            <p className="mt-3 text-muted-foreground">{result?.error}</p>
            <Button asChild variant="outline" className="mt-8 rounded-xl">
              <Link to={DIRECTORY_PATH}>Browse settlements</Link>
            </Button>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}

export const EmailConfirm = () => <EmailAction mode="confirm" />;
export const EmailUnsubscribe = () => <EmailAction mode="unsubscribe" />;
