export type UserRole = "user" | "admin";
export type PlanType = "free" | "premium";

export interface Profile {
  id: string;
  email: string;
  role: UserRole;
  plan: PlanType;
  created_at: string;
}

export type SeverityLevel = "low" | "medium" | "high" | "critical";

export interface BreachEvent {
  id: string;
  company: string;
  breach_year: number;
  exposed_data: string[];
  severity: SeverityLevel;
  records_affected: number;
  description: string;
}

export type SettlementStatus = "open" | "pending" | "closed" | "draft" | "pending_review" | "verified" | "rejected" | "expired";

export interface Settlement {
  id: string;
  name: string;
  company: string;
  breach_year: number;
  status: SettlementStatus;
  payout_min: number;
  payout_max: number;
  deadline: string;
  description: string;
  matched_via?: string;
}

export type ClaimStatus = "draft" | "submitted" | "under_review" | "documentation_required" | "approved" | "rejected" | "paid";

export interface Claim {
  id: string;
  settlement_id: string;
  settlement_name: string;
  status: ClaimStatus;
  estimated_payout: number;
  filed_at: string;
  updated_at: string;
}

export type AlertCategory = "breach_detected" | "settlement_found" | "payout_update" | "claim_update" | "system";

export interface Alert {
  id: string;
  title: string;
  description: string;
  category: AlertCategory;
  severity: SeverityLevel;
  created_at: string;
  read: boolean;
}

export interface AdminUser {
  id: string;
  email: string;
  breaches: number;
  matches: number;
  claims: number;
  estimated_value: number;
  status: "active" | "inactive";
  created_at: string;
}

export interface AdminActivityLog {
  id: string;
  action: string;
  admin_name: string;
  target: string;
  timestamp: string;
}

export interface MonitoringStatus {
  active: boolean;
  last_scan: string;
  next_scan: string;
  databases_scanned: number;
  breaches_detected: number;
  scan_frequency: string;
}
