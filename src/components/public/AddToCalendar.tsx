import { CalendarPlus } from "lucide-react";
import type { PublicSettlement } from "@/lib/settlements/types";
import { SITE_URL, displayName, effectiveDeadline, parseDate, settlementPath } from "@/lib/settlements/format";

const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");

function icsEscape(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
}

/** All-day reminder on the claim deadline. Returns null when no usable date is on record. */
export function calendarLinks(s: PublicSettlement) {
  const date = parseDate(effectiveDeadline(s));
  if (!date) return null;
  const next = new Date(date.getTime() + 86_400_000);
  const title = `Claim deadline: ${displayName(s)}`;
  const pageUrl = `${SITE_URL}${settlementPath(s)}`;
  const details = `Last day to file a claim. Details: ${pageUrl}`;

  const google =
    "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    `&text=${encodeURIComponent(title)}` +
    `&dates=${ymd(date)}/${ymd(next)}` +
    `&details=${encodeURIComponent(details)}`;

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BreachPay//Claim deadlines//EN",
    "BEGIN:VEVENT",
    `UID:${s.id}@breachpay`,
    `DTSTAMP:${ymd(new Date(s.updated_at || Date.now()))}T000000Z`,
    `DTSTART;VALUE=DATE:${ymd(date)}`,
    `DTEND;VALUE=DATE:${ymd(next)}`,
    `SUMMARY:${icsEscape(title)}`,
    `DESCRIPTION:${icsEscape(details)}`,
    `URL:${pageUrl}`,
    "BEGIN:VALARM",
    "TRIGGER:-P3D",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsEscape(title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return { google, ics: `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}` };
}

export function AddToCalendar({ settlement }: { settlement: PublicSettlement }) {
  const links = calendarLinks(settlement);
  if (!links) return null;
  const linkClass = "font-medium text-primary underline-offset-4 hover:underline";
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
      <CalendarPlus className="h-4 w-4 text-primary" aria-hidden />
      Remind me:
      <a href={links.google} target="_blank" rel="noopener noreferrer" className={linkClass}>
        Google Calendar
      </a>
      <span aria-hidden>·</span>
      <a href={links.ics} download="claim-deadline.ics" className={linkClass}>
        Apple or Outlook (.ics)
      </a>
    </p>
  );
}
