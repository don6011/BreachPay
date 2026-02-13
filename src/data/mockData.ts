import type { BreachEvent, Settlement, Claim, Alert, AdminUser, AdminActivityLog, MonitoringStatus } from "@/types";

export const mockBreaches: BreachEvent[] = [
  { id: "b1", company: "LinkedIn", breach_year: 2021, exposed_data: ["Email", "Password Hash", "Phone Number"], severity: "high", records_affected: 700000000, description: "Massive data scraping incident exposing user profile data." },
  { id: "b2", company: "Facebook", breach_year: 2019, exposed_data: ["Email", "Phone Number", "Location"], severity: "critical", records_affected: 533000000, description: "Phone numbers and personal data of 533M users leaked online." },
  { id: "b3", company: "Equifax", breach_year: 2017, exposed_data: ["SSN", "Date of Birth", "Address", "Credit Card"], severity: "critical", records_affected: 147000000, description: "Major credit bureau breach exposing sensitive financial data." },
  { id: "b4", company: "Adobe", breach_year: 2013, exposed_data: ["Email", "Password Hash", "Username"], severity: "medium", records_affected: 153000000, description: "User credentials and payment information compromised." },
  { id: "b5", company: "T-Mobile", breach_year: 2023, exposed_data: ["Name", "SSN", "Date of Birth", "Phone Number"], severity: "high", records_affected: 37000000, description: "API vulnerability exposed customer account data." },
  { id: "b6", company: "Capital One", breach_year: 2019, exposed_data: ["SSN", "Bank Account", "Credit Score"], severity: "critical", records_affected: 106000000, description: "Cloud misconfiguration led to exposure of credit applications." },
];

export const mockSettlements: Settlement[] = [
  { id: "s1", name: "Equifax Data Breach Settlement", company: "Equifax", breach_year: 2017, status: "open", payout_min: 125, payout_max: 20000, deadline: "2026-06-30", description: "Settlement for consumers affected by the 2017 Equifax breach. Eligible for credit monitoring or cash payment.", matched_via: "Equifax breach exposure" },
  { id: "s2", name: "Facebook Privacy Settlement", company: "Facebook", breach_year: 2019, status: "open", payout_min: 50, payout_max: 500, deadline: "2026-04-15", description: "Class action settlement for users whose data was improperly shared.", matched_via: "Facebook breach exposure" },
  { id: "s3", name: "T-Mobile Data Breach Settlement", company: "T-Mobile", breach_year: 2023, status: "pending", payout_min: 25, payout_max: 25000, deadline: "2026-08-01", description: "Settlement covering customers affected by the 2023 API data breach.", matched_via: "T-Mobile breach exposure" },
  { id: "s4", name: "Capital One Settlement", company: "Capital One", breach_year: 2019, status: "open", payout_min: 100, payout_max: 15000, deadline: "2026-03-30", description: "Compensation for credit applicants whose data was exposed.", matched_via: "Capital One breach exposure" },
  { id: "s5", name: "LinkedIn Data Scraping Settlement", company: "LinkedIn", breach_year: 2021, status: "closed", payout_min: 10, payout_max: 200, deadline: "2025-12-01", description: "Settlement related to unauthorized scraping of user profiles." },
];

export const mockClaims: Claim[] = [
  { id: "c1", settlement_id: "s1", settlement_name: "Equifax Data Breach Settlement", status: "approved", estimated_payout: 425, filed_at: "2025-08-15", updated_at: "2025-11-20" },
  { id: "c2", settlement_id: "s2", settlement_name: "Facebook Privacy Settlement", status: "under_review", estimated_payout: 150, filed_at: "2025-10-01", updated_at: "2025-12-05" },
  { id: "c3", settlement_id: "s4", settlement_name: "Capital One Settlement", status: "submitted", estimated_payout: 300, filed_at: "2026-01-10", updated_at: "2026-01-10" },
];

export const mockAlerts: Alert[] = [
  { id: "a1", title: "Critical Breach Detected", description: "Your data was found in the Equifax 2017 breach. SSN and financial data may be exposed.", category: "breach_detected", severity: "critical", created_at: "2026-02-12T14:30:00Z", read: false },
  { id: "a2", title: "New Settlement Match", description: "You qualify for the Facebook Privacy Settlement ($50–$500 payout range).", category: "settlement_found", severity: "high", created_at: "2026-02-11T09:15:00Z", read: false },
  { id: "a3", title: "Claim Status Updated", description: "Your Equifax claim has been approved. Estimated payout: $425.", category: "claim_update", severity: "low", created_at: "2026-02-10T16:45:00Z", read: true },
  { id: "a4", title: "Settlement Deadline Approaching", description: "Capital One Settlement deadline is March 30, 2026. File your claim soon.", category: "settlement_found", severity: "medium", created_at: "2026-02-09T11:00:00Z", read: true },
  { id: "a5", title: "Payout Processed", description: "Your Equifax settlement payout of $425 has been processed.", category: "payout_update", severity: "low", created_at: "2026-02-08T08:30:00Z", read: true },
  { id: "a6", title: "New Breach Detected", description: "Your email was found in the T-Mobile 2023 data breach.", category: "breach_detected", severity: "high", created_at: "2026-02-07T13:20:00Z", read: true },
];

export const mockAdminUsers: AdminUser[] = [
  { id: "u1", email: "john@example.com", breaches: 4, matches: 3, claims: 2, estimated_value: 875, status: "active", created_at: "2025-06-15" },
  { id: "u2", email: "sarah@example.com", breaches: 6, matches: 4, claims: 3, estimated_value: 1250, status: "active", created_at: "2025-07-22" },
  { id: "u3", email: "mike@example.com", breaches: 2, matches: 1, claims: 0, estimated_value: 200, status: "active", created_at: "2025-09-01" },
  { id: "u4", email: "emily@example.com", breaches: 5, matches: 3, claims: 1, estimated_value: 650, status: "inactive", created_at: "2025-10-10" },
  { id: "u5", email: "alex@example.com", breaches: 3, matches: 2, claims: 2, estimated_value: 500, status: "active", created_at: "2025-11-05" },
];

export const mockActivityLogs: AdminActivityLog[] = [
  { id: "l1", action: "Added Settlement", admin_name: "Admin User", target: "T-Mobile Data Breach Settlement", timestamp: "2026-02-12T10:30:00Z" },
  { id: "l2", action: "Updated Claim Status", admin_name: "Admin User", target: "Claim #c1 → Approved", timestamp: "2026-02-11T14:15:00Z" },
  { id: "l3", action: "Exported User Data", admin_name: "Admin User", target: "All Users CSV", timestamp: "2026-02-10T09:00:00Z" },
  { id: "l4", action: "Sent Deadline Alert", admin_name: "Admin User", target: "Capital One Settlement", timestamp: "2026-02-09T16:45:00Z" },
  { id: "l5", action: "Flagged Claim", admin_name: "Admin User", target: "Claim #c5 — Suspicious", timestamp: "2026-02-08T11:20:00Z" },
];

export const mockMonitoring: MonitoringStatus = {
  active: true,
  last_scan: "2026-02-12",
  next_scan: "2026-02-19",
  databases_scanned: 12847,
  breaches_detected: 6,
  scan_frequency: "Weekly (Free Plan)",
};
