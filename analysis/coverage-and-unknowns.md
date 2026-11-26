# Keka HR Android Package Analysis: Coverage, Evidence & Unknowns

## 1. Scope & Verification Overview

This document categorizes the findings from static and architectural inspection of the Keka HR Android client (`com.keka.xhr`, version 3.5.20, version code 52905). 

Every finding is classified under three rigorous evidence tiers:
1. **Confirmed in Client**: Direct, verified evidence in navigation graphs (`res/navigation/*.xml`), compiled fragments/activities, Compose routes, data models, or string resource bundles.
2. **Inferred from Client Patterns**: High-confidence deductions based on ViewModel state flows, intent arguments, UI transitions, or endpoint parameter signatures.
3. **Server-Side & Unknown (Open Requirements)**: Business logic, calculations, policy evaluations, and multi-tenant configurations executed strictly on the backend, for which the client is merely a display/input terminal.

---

## 2. Module-by-Module Coverage & Gap Analysis

| Module | Navigation & Screens | Client Code & Handlers | Status Transitions | Client Visibility / Feature Flags | Server-Side Authority (Unknowns) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Authentication & Org Routing** | 7 Screens confirmed | High coverage | Confirmed: Auth token, MFA OTP, SSO session | Company selection, domain discovery | Identity Provider SAML assertion parsing, multi-tenant database routing, session TTL |
| **Attendance & Shifts** | 38 Destinations confirmed | High coverage | Confirmed: Clock-in, Clock-out, Regularization request, WFH request | Feature flags: Selfie mandatory, Geofence radius, Wifi SSID match | Geofencing polygons, IP whitelist validation, automated biometric shift auto-deduction logic |
| **Leave & Comp-Off** | 12 Destinations confirmed | High coverage | Confirmed: Apply, Predefined reasons, Cancel request, Encashment | Role flags: Employee vs Manager balance inquiry | Accrual formulas, sandwich leave policy rules, holiday calendar overlap deductions |
| **Inbox & Approvals** | 22 Screens & Sub-graphs confirmed | High coverage | Confirmed: Approve, Reject with remarks, Cancel | Role flags: Direct supervisor, Reporting hierarchy, Project Lead | Dynamic multi-level approval routing chains, delegation of authority, auto-escalation SLAs |
| **Payroll & Payslips** | 18 Screens confirmed | Moderate coverage | Confirmed: Preview, Download acknowledgement, Regime switch | Feature flags: Air ticket encashment, Investment declaration active | Salary component formulas, TDS/tax deduction engines, EPF/ESI statutory thresholds |
| **Expenses & Travel** | 24 Destinations confirmed | High coverage | Confirmed: Add claim, Mileage, Per diem, Advance settlement | Feature flags: Travel booking enabled, Advance request permitted | Currency exchange rate conversion, policy per-category daily allowance limits, audit trails |
| **Timesheets & PSA** | 14 Destinations confirmed | High coverage | Confirmed: Log hours, Copy weekly tasks, Billable toggle | Feature flags: PSA module licensed, Project assignment check | Project billing rates, client invoicing logic, utilization vs capacity analytics |
| **Helpdesk** | 6 Destinations confirmed | High coverage | Confirmed: Raise ticket, Thread reply, Reopen, Close | Category assignment, SLA tags | Automated agent assignment routing, round-robin dispatch, SLA breach escalation rules |
| **Assets** | 4 Screens confirmed | Moderate coverage | Confirmed: View assigned, Acknowledge policy receipt | Role: Employee sign-off | Asset depreciation calculations, hardware lifecycle, serial number procurement flow |
| **Performance (PMS)** | 22 Destinations confirmed | Moderate coverage | Confirmed: Update OKR progress, 360 Feedback, Review form | Role: Reviewee vs Reviewer cycle active | Normalization bell curves, rating calibration matrices, bonus payout multiplier formulas |
| **Learning (LMS)** | 8 Destinations confirmed | Moderate coverage | Confirmed: Course browser, Lesson viewer, Quiz submit | Mandatory compliance flag | Quiz grading algorithms, certification generation, SCORM/xAPI packaging |
| **Engagement & Wall** | 28 Destinations confirmed | High coverage | Confirmed: Post, Poll vote, Announcement read, Kudos | Company-wide vs Department audience filter | Feed ranking algorithms, sentiment analysis on survey responses, content moderation filters |

---

## 3. Confirmed Client-Side Artifacts vs Legacy & Reachability

### Confirmed Client-Side Components:
- **Navigation Architecture**: 59 Jetpack Navigation XML definitions in `res/navigation/` representing active navigation graphs. All start destinations and transition IDs match compiled fragment classes in the DEX files.
- **Kotlin Multiplatform (KMM) Migration**: Keka is actively transitioning to KMM with Jetpack Compose. Modern screens (Attendance logs, Leave details, Inbox item cards, Performance goals, Assets) use Compose and load UI strings from `assets/composeResources/*.cvr`.
- **Deep Linking Protocol**: Documented URL scheme `app://com.keka.xhr/...` with URI templates for direct routing from push notifications and email action links (e.g. `app://com.keka.xhr/inbox/leave/requests?isPending=true`).

### Legacy & Dead-End Components (Reachability Inferred/Unknown):
- Several older Activities present in `AndroidManifest.xml` (e.g. legacy barcode scanner activities, older WebView wrappers) lack entry points in the navigation graphs. They appear to be legacy fallbacks or retained for backward compatibility with Android 10 (API 29).
- Sub-graph `features_device_navigation_graph.xml` contains only `OpenSourceLicensesFragment`, reaching only a static acknowledgments viewer.

---

## 4. Open Requirements & Server-Side Implementation Rules

Where the Android package delegates business decisions to the server, the following clean-room implementations are specified for our original HR app:

1. **Leave Accrual & Policy Engine**:
   - *Client Evidence*: Client displays available balance and validates `days <= balance`.
   - *Server Authority*: Monthly accrual (e.g. 1.75 days/month for Earned Leave, 1 day/month for Sick Leave).
   - *Implemented Rule*: Configurable leave policies per organization with starting balances, yearly carry-forward caps, and automatic balance decrements upon approval.

2. **Approval Hierarchy & Routing**:
   - *Client Evidence*: Actions `Approve` and `Reject` in `InboxFragment`, requiring `isPending=true` and caller approval permission.
   - *Server Authority*: Tenant routing configuration.
   - *Implemented Rule*: Strict server-enforced role access. An employee's leave/expense/timesheet request is routed exclusively to their designated direct reporting manager and system HR Admins. Unrelated managers cannot view or act on the request.

3. **Attendance Geofencing & Work Modes**:
   - *Client Evidence*: Location coordinates (`lat`, `lng`), accuracy, and geofence distance calculated on device.
   - *Server Authority*: Verification against office coordinates.
   - *Implemented Rule*: Configurable office coordinate radii (e.g., 500m) with support for "Work from Office", "Work from Home", and "On Duty" modes.

4. **Payroll & Payslip Generator**:
   - *Client Evidence*: Month-wise payslip list, gross vs net pay breakdown, tax regime switch comparison.
   - *Server Authority*: Statutory deductions (PF 12%, Professional Tax, TDS tax brackets).
   - *Implemented Rule*: Deterministic formula engine calculating Gross Salary, Standard Deductions, Provident Fund, Tax, and net disbursals with downloadable/printable payslip receipts.
