import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <Button
      size="icon"
      variant="outline"
      className="fixed bottom-6 right-6 z-50 rounded-full shadow-lg border-border/50 bg-background/80 backdrop-blur-sm hover:bg-accent transition-all duration-300"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
    >
      <ArrowUp className="h-4 w-4" />
    </Button>
  );
}
