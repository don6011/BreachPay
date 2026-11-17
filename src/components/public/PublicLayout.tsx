import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DIRECTORY_PATH } from "@/lib/settlements/format";
import { SUPPORT_EMAIL, hasSavedSession } from "@/lib/site";

/**
 * Whether to show account links. Always false on the first render so the
 * pre-rendered page and the browser agree, then updated once mounted.
 */
export function useSignedInHint(): boolean {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => setSignedIn(hasSavedSession()), []);
  return signedIn;
}

/** Header and footer shared by every public page. */
export function PublicLayout({ children }: { children: ReactNode }) {
  const signedIn = useSignedInHint();
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="shrink-0" aria-label="BreachPay home">
            <img src="/logo.png" alt="BreachPay" width={109} height={36} className="h-9 w-auto" />
          </Link>
          <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
            <Button variant="ghost" asChild className="hidden sm:inline-flex">
              <Link to={DIRECTORY_PATH}>Settlements</Link>
            </Button>
            {signedIn ? (
              <Button asChild className="rounded-xl">
                <Link to="/dashboard">My dashboard</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link to="/login">Log in</Link>
                </Button>
                <Button asChild className="rounded-xl">
                  <Link to="/signup">Free breach check</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-border py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Link to={DIRECTORY_PATH} className="hover:text-foreground">Data breach settlements</Link>
            <Link to="/pricing" className="hover:text-foreground">Pricing</Link>
            <Link to="/help" className="hover:text-foreground">Help</Link>
            {!signedIn && <Link to="/signup" className="hover:text-foreground">Create account</Link>}
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          </nav>
          <div className="mt-6 max-w-3xl space-y-2 text-xs leading-relaxed text-muted-foreground">
            <p>
              BreachPay is an independent directory. We are not a law firm, not a settlement administrator and not
              affiliated with the companies listed. Nothing on this site is legal advice.
            </p>
            <p>
              Settlement details come from public sources and can change. Always confirm deadlines, eligibility and
              payment terms on the official settlement site before you file. Filing a claim is free.
            </p>
            <p>
              © {new Date().getUTCFullYear()} BreachPay
              {SUPPORT_EMAIL && (
                <>
                  {" · "}
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-4 hover:text-foreground">
                    {SUPPORT_EMAIL}
                  </a>
                </>
              )}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function PageSpinner() {
  return (
    <div className="flex justify-center py-24" role="status" aria-label="Loading">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
    </div>
  );
}

export function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <h1 className="text-2xl font-bold">We couldn't load settlements</h1>
      <p className="mt-3 text-muted-foreground">Check your connection and try again.</p>
      <Button onClick={onRetry} className="mt-6 rounded-xl">Try again</Button>
    </div>
  );
}
