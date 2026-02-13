

# BreachPay MVP — Phase 1: Full UI Build with Mock Data

## Overview
Build the complete BreachPay application UI — a dark, premium fintech-style platform that helps users discover data breach exposures, match eligible settlements, and file claims. All data will use local mock arrays, structured for easy Supabase swap later. No Lovable Cloud — Supabase will be wired in Phase 2.

---

## Design System
- **Theme**: Dark, near-black background with subtle gradients
- **Cards**: Rounded corners, soft borders with subtle teal/cyan glow
- **Accent**: Teal/cyan (`#00D4AA`-ish) for primary buttons and highlights
- **Status pills**: Green (open), Yellow (pending), Gray (closed), Red (critical/high), Teal (info)
- **Typography**: Clean, modern sans-serif with bold section headers
- **Layout**: Fixed left sidebar + scrollable main content area

---

## Pages & Features

### 1. Landing Page (`/`)
- Top navbar with BreachPay logo, "Log In" and "Start Free Scan" CTA
- Hero section: "Your Data Was Breached. You Could Be Owed Money."
- Stats bar: 12,000+ databases, $2.4M+ settlements, 50,000+ identities, Daily detection
- "How It Works" section
- Footer with disclaimers

### 2. Auth Pages
- **`/signup`**: Centered card with email/password fields, checkboxes for Terms and authorize scan consent
- **`/login`**: Centered card with email/password fields, link to signup
- Both styled to match dark theme

### 3. User Dashboard (`/dashboard`)
- Left sidebar nav: Dashboard, Scan, Settlements, Claims, Monitoring, Settings (+ Admin Portal link, Log Out at bottom)
- **Risk Gauge**: Circular radial gauge showing IdentityRisk Index score (e.g., 100/Severe) with color coding
- **Stat cards**: Breaches Detected, Eligible Settlements, Estimated Value, Claims Filed, Monitoring Active status
- **Action buttons**: Run Scan, View Settlements, Track Claims
- **Recent Alerts list**: Alert rows with title, description, and severity pill (info, critical, breach detected, etc.)

### 4. Breach Scan (`/scan`)
- **Input form**: Email field + optional phone field + "Start Secure Scan" button
- **Loading state**: Animated scanning indicator (3–5 seconds)
- **Results view**: Summary header (X breaches found, risk score), "Demo mode" label, list of breach cards showing company name, year, exposed data types, and severity pill (medium/high/critical)
- **"Run Another Scan"** button to reset
- Footer disclaimer text

### 5. Settlements (`/settlements`)
- Summary card: "You qualify for X settlements" with estimated total range
- **Filter tabs**: All, Open, Pending, Closed, Filed
- **Sort dropdown**
- **Settlement cards**: Name, status pill, days left, filed status, description, payout range, deadline, "Matched via" text in teal
- **CTA per card**: "File Claim" (if not filed) or "Track Claim" (if filed)

### 6. Claims / Compensation Wallet (`/claims`)
- **Wallet summary cards**: Total Recovered, Pending Payouts, Approved, Estimated Eligible
- **Claim tracker list**: Each claim shows settlement name, status progression (submitted → under review → approved → paid), estimated payout, dates
- **Timeline card**: Visual status steps
- **Payment method section**: "Coming soon" placeholder

### 7. Monitoring Center (`/monitoring`)
- **Status card**: Monitoring Active/Inactive, last scan date, next scan date, databases scanned count, breaches detected, scan frequency
- **Alert Preferences**: Toggle switches for Email alerts, Deadline alerts, Push notifications (disabled/coming soon)
- **Premium upsell card**: Teal-bordered card with benefits list and "$9.99/mo" upgrade button
- **Alert History list**: Chronological alert rows with timestamps and category pills (payout update, breach detected, settlement found)

### 8. Settings (`/settings`)
- **Account section**: Email, Plan (Free), Member since date
- **Monitored Identifiers**: List or empty state
- **Data Controls**: Export My Data button, Delete Account button (red)
- **Legal links**: Terms of Service, Privacy Policy, Disclaimer
- **Log Out button**

### 9. Admin Portal (separate sidebar, role-gated)

#### Admin Analytics (`/admin/analytics`)
- Admin sidebar: Analytics, Users, Settlements, Claims, Activity Logs
- **Top stats**: Registered Users, Active Monitoring, Breaches Detected, Settlements Added
- **Section groups** with 4-card stat rows: Exposure Intelligence, Settlement Intelligence, Growth Metrics
- **Claims Pipeline**: Colored dot indicators for Total Filed, Pending, Approved, Rejected, Paid Out, Fraud Flagged
- **Revenue Operations**: Revenue Collected, Pending, Est. Revenue, Projected Monthly/Annual
- **Payout Reconciliation**: Total Paid Out, Pending, Avg Claim Value, Platform Fee
- **Charts** (using Recharts): Claims Filed Over Time, Payouts Over Time, Settlement Volume Growth, Revenue by Settlement
- **Action buttons**: + Add Settlement, Review Claims, Send Deadline Alerts, Export Report

#### Admin Users (`/admin/users`)
- User table with columns: email, breaches, matches, claims, est. value, status
- Search bar + Export CSV button

#### Admin Settlements (`/admin/settlements`)
- Settlement management table with CRUD
- Add/Edit Settlement modal: name, company, breach year, payout range, deadline, status, description
- Status dropdown, send deadline alerts action

#### Admin Claims (`/admin/claims`)
- Claims table with filters (status, date range)
- Update status dropdown per claim
- Export CSV, flag suspicious claims

#### Admin Activity Logs (`/admin/activity-logs`)
- Log list: action type, admin name, target entity, timestamp

---

## Reusable Components
- **SidebarNav** (user variant + admin variant with role badge)
- **StatCard** (icon, label, value — supports teal/white styling)
- **RiskGauge** (SVG circle gauge with score + severity label)
- **StatusPill** (color-coded badge)
- **AlertRow** (title, description, timestamp, category pill)
- **DataTable** (sortable columns, search, filter)
- **SettlementCard** (full settlement info with CTA)
- **Modal** (for Add/Edit Settlement)
- **PageHeader** (title + subtitle + optional action buttons)

## Mock Data
- Arrays of breaches, settlements, claims, alerts, users, and admin logs — all typed with TypeScript interfaces matching the future Supabase schema
- Simple rules-based settlement matching (company name + breach year)
- Scan simulation with timed loading state

## Compliance Copy (always visible)
- "BreachPay is not a law firm and does not provide legal advice."
- "We help users identify eligible settlement claims and track deadlines."
- "Data may be sourced from third-party providers and may be incomplete."
- Demo mode clearly labeled on simulated results

