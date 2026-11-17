import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PublicLayout } from "@/components/public/PublicLayout";
import { DIRECTORY_PATH } from "@/lib/settlements/format";
import { useSeo } from "@/lib/useSeo";

const META = {
  title: "Page not found | BreachPay",
  description: "This page doesn't exist.",
  canonical: "",
  jsonLd: [],
  noindex: true,
};

const NotFound = () => {
  useSeo(META);
  return (
    <PublicLayout>
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">404</p>
        <h1 className="mt-3 text-3xl font-bold">Page not found</h1>
        <p className="mt-3 text-muted-foreground">The page may have moved, or the address may be mistyped.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild className="rounded-xl">
            <Link to={DIRECTORY_PATH}>Browse settlements</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-xl">
            <Link to="/">Go to the home page</Link>
          </Button>
        </div>
      </div>
    </PublicLayout>
  );
};

export default NotFound;
