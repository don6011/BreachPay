import { useId, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { BellRing, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { callSubscriptions } from "@/lib/subscriptions";
import { cn } from "@/lib/utils";

type Props =
  | { kind: "deadline"; settlementId: string; title: string; description: string; className?: string }
  | { kind: "weekly"; title: string; description: string; className?: string };

/**
 * Email sign-up that needs no account. Nothing is sent except a confirmation
 * link until the person confirms (double opt-in).
 */
export function EmailSignup(props: Props) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setState("sending");
    const result = await callSubscriptions(
      props.kind === "deadline"
        ? { action: "subscribe", kind: "deadline", email, settlement_id: props.settlementId }
        : { action: "subscribe", kind: "weekly", email },
    );
    if (result.ok) setState("sent");
    else {
      setError(result.error ?? "Something went wrong. Please try again.");
      setState("idle");
    }
  };

  return (
    <section className={cn("glass-card p-5 sm:p-6", props.className)} aria-labelledby={`${id}-title`}>
      {state === "sent" ? (
        <div className="flex items-start gap-3" role="status">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div>
            <h2 id={`${id}-title`} className="font-semibold">Check your inbox</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              We've emailed <span className="font-medium text-foreground">{email}</span>. If this is your first time,
              click the link in that email to confirm. Nothing else is sent until you do.
            </p>
          </div>
        </div>
      ) : (
        <>
          <h2 id={`${id}-title`} className="flex items-center gap-2 font-semibold">
            <BellRing className="h-4 w-4 text-primary" aria-hidden /> {props.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{props.description}</p>
          <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <label htmlFor={`${id}-email`} className="sr-only">
              Email address
            </label>
            <Input
              id={`${id}-email`}
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-11 rounded-xl"
            />
            <Button type="submit" disabled={state === "sending"} className="h-11 shrink-0 rounded-xl">
              {state === "sending" ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Sending" /> : props.kind === "deadline" ? "Remind me" : "Subscribe"}
            </Button>
          </form>
          {error && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            No account needed. Unsubscribe from any email in one click. See our{" "}
            <Link to="/privacy" className="underline underline-offset-4 hover:text-foreground">
              privacy policy
            </Link>
            .
          </p>
        </>
      )}
    </section>
  );
}
