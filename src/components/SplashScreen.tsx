import { useState, useEffect } from "react";
import shieldIcon from "@/assets/shield-icon.png";

const messages = [
  "Securing your data…",
  "Scanning breach networks…",
  "Initializing protection…",
];

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [msgIndex, setMsgIndex] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const msgTimer = setInterval(() => {
      setMsgIndex((i) => (i + 1) % messages.length);
    }, 1200);

    const exitTimer = setTimeout(() => {
      setFadeOut(true);
      setTimeout(onComplete, 600);
    }, 3600);

    return () => {
      clearInterval(msgTimer);
      clearTimeout(exitTimer);
    };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background transition-opacity duration-500 ${fadeOut ? "opacity-0" : "opacity-100"}`}
    >
      {/* Subtle circuit texture */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `radial-gradient(circle at 25% 25%, hsl(var(--primary) / 0.15) 1px, transparent 1px),
                          radial-gradient(circle at 75% 75%, hsl(var(--primary) / 0.1) 1px, transparent 1px)`,
        backgroundSize: "60px 60px",
      }} />

      {/* Emerald radial glow */}
      <div
        className="absolute rounded-full animate-pulse-glow"
        style={{
          width: 340,
          height: 340,
          background: "radial-gradient(circle, hsl(var(--primary) / 0.12) 0%, hsl(var(--primary) / 0.04) 40%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      {/* Shield icon */}
      <img
        src={shieldIcon}
        alt="BreachPay Shield"
        className="relative z-10 h-32 w-32 object-contain drop-shadow-[0_0_30px_hsl(164_100%_45%/0.35)]"
      />

      {/* Microcopy */}
      <p
        className="relative z-10 mt-10 text-sm font-medium tracking-wide transition-opacity duration-300"
        style={{ color: "hsl(0 0% 100% / 0.55)" }}
      >
        {messages[msgIndex]}
      </p>

      {/* Loading dots */}
      <div className="relative z-10 mt-6 flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-primary/40"
            style={{
              animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
