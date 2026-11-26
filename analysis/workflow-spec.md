# Keka HR Android Client Reverse Engineering: Workflow & Architecture Specification

## 1. Executive Summary & Methodology

This specification details the client-side architecture, identifiable screens, navigation graphs, and user workflows extracted from the **Keka HR Android application (Package: `com.keka.xhr`, Version: `3.5.20`, Version Code: `52905`, Target SDK: `36`, Min SDK: `29`)**.

### Analysis Tools & Provenance:
- **XAPK Inspection**: Extracted base APK (`com.keka.xhr.apk`, ~53.8 MB) and configuration splits (`config.armeabi_v7a.apk`, `config.mdpi.apk`) using archive analysis tools.
- **Reverse Engineer Anything (REA 6.7.0)**: Initialized and configured REA MCP server integration in Antigravity (`~/.gemini/config/mcp_config.json`, `~/.gemini/config/skills/reverse-engineer-anything`). Audited capabilities via `rea doctor` and `rea mcp doctor` (207 MCP tools registered).
- **Static Bytecode & Resource Analysis**: Headless decompilation and indexing using Android resource parsers, binary XML decoders (AXML), and DEX analysis engines across all 5 classes DEX files (`classes.dex` through `classes5.dex`, totaling 24,674 Keka classes, 1,823 destination/screen classes, 6,841 ViewModels, and 59 Jetpack Navigation graphs).
- **Compose Values Resources (CVR)**: Decoded 13 Kotlin Multiplatform Compose resource bundles in `assets/composeResources/` extracting over 1,200 localized UI string constants, validation rules, button labels, and status tags.

---

## 2. Core Navigation Architecture & Shell Hierarchy

The application adopts a single-activity architecture centered around `com.keka.xhr.MainActivity` with a persistent bottom navigation bar hosting four primary tabs:
1. **Home (`HomeFragment`)**: Personal dashboard, quick clock-in widget, pending actions banner, announcements, celebrations/wishes, shift timer.
2. **Me (`MeFragment`)**: Employee hub subdivided into **Summary**, **Attendance & Time Off**, and **Finance** (Salary & Expenses).
3. **Inbox (`InboxFragment`)**: Consolidated manager approval workflow queue with filterable sub-queues (Leave, Attendance, Expenses, Timesheets, Exit, Requisitions).
4. **Engage / Wall (`WallFragment`)**: Social collaboration feed with announcements, employee praise, polls, and comments.

Global overlays and modals are coordinated via `core_ui_main_nav_graph.xml`, `main_nav_graph.xml`, and nested feature graphs.

---

## 3. Detailed Module Specifications

### Module 1: Authentication & Organization Selection
- **Navigation Graph**: `features_keka_login_auth_nav_graph.xml`
- **Identifiable Screens**:
  1. `EmailLoginFragment` (Entry point for corporate email)
  2. `CompanySelectionFragment` (Tenant routing for multi-tenant users or custom subdomains, e.g., `<company>.keka.com`)
  3. `PasswordLoginFragment` (Credential authentication with forgot password link)
  4. `OtpLoginFragment` (MFA / SMS / Email 6-digit OTP verification)
  5. `MsalLoginFragment` (Microsoft Azure AD / Office 365 OAuth SSO)
  6. `WebSSOLoginFragment` (SAML 2.0 / Okta / Google Workspace browser session)
  7. `ResetPasswordFragment`
- **Fields & Validations**:
  - Corporate Email: Valid RFC 5322 regex; domain extraction for tenant routing.
  - Password: Min 8 chars, mixed case, numeric, special char.
  - OTP: 6 numeric digits with countdown timer (60s resend lock).
- **UI States**:
  - *Loading*: Authenticating spinner, disabling submit buttons.
  - *Error*: Invalid credentials toast, Account locked modal, SSO handshake failure.
- **Evidence**: `com.keka.xhr.features.login.*`, `features_keka_login_auth_nav_graph.xml`.

---

### Module 2: Attendance & Shift Tracking
- **Navigation Graph**: `features_keka_attendance_nav_graph.xml` (38 destinations)
- **Workflows**:
  1. **Clock In / Out**:
     - *Entry*: Home quick action or Attendance screen.
     - *Capabilities*: Standard GPS Punch, Selfie Camera Clock-In (`SelfieCameraClockInFragment`), Geofenced Client Site Clock-In (`ClockInMapFragment`, `ClockInMapInfoFragment`).
     - *Payload Model*: `ClockInRequestBodyModel` (latitude, longitude, accuracy, timestamp, punchStatus [IN=1, OUT=2], selfieUrl, failedPermissions).
  2. **Attendance Regularization (Adjustment)**:
     - *Screen*: `AttendanceAdjustmentFragment` / `RegularizationFragment`.
     - *Fields*: Date, Requested In Time, Requested Out Time, Reason (Predefined drop-down or custom notes), Attachments.
     - *Status Transition*: `SUBMITTED` -> `PENDING_APPROVAL` -> `APPROVED` / `REJECTED`.
  3. **Work From Home (WFH) & Remote Clock-In**:
     - *Screen*: `WorkingRemotelyFragment`, `RemoteClockInRequestFragment`.
     - *Fields*: Start Date, End Date, Half-Day (1st Half / 2nd Half), Reason.
  4. **Overtime (OT) Request**:
     - *Screen*: `OvertimeRequestFragment`, `OtBreakUpBottomSheet`.
     - *Fields*: Date, Overtime Hours, Project Association, Reason.
  5. **Shift & Log View**:
     - *Screen*: `AttendanceLogFragment`, `ShiftDetailsFragment`.
     - *Metrics*: Gross Hours, Effective Hours, Break Duration, Deduction Alerts ("IN missing", "OUT missing").
- **Evidence**: `com.keka.xhr.features.attendance.*`, `features_keka_attendance_nav_graph.xml`.

---

### Module 3: Leave & Comp-Off Management
- **Navigation Graph**: `features_keka_leave_nav_graph.xml`
- **Identifiable Screens**:
  1. `LeaveApplicationFragment` (Primary leave apply screen)
  2. `PredefinedReasonBottomDialogFragment` (Standardized corporate leave reasons)
  3. `LeaveBalancesFragment` / `LeaveHistoryFragment`
  4. `CompOffRequestFragment` (Request credit for weekend/holiday working)
  5. `LeaveEncashmentFragment` (Year-end balance payout request)
  6. `AllHolidayFragment` / `SelectYearBottomSheet`
- **Fields & Validations**:
  - `leaveTypeId`: Integer / Enum (Casual Leave, Sick Leave, Earned/Privilege Leave, Maternity/Paternity, Optional Holiday, Unpaid Leave).
  - `fromDate`, `toDate`: Date range picker (`DateRangeSelectionFragment`).
  - `isHalfDay`: Boolean; `halfDayType`: `FIRST_HALF` | `SECOND_HALF`.
  - `reason`: Textarea (Mandatory if configured by policy; option to pick predefined reason).
  - `attachments`: File chooser (`DocumentChooserInput`).
  - `contactDetails`: Emergency contact phone during leave period.
  - Client-side validation: Balance check (`requestedDays <= availableBalance` unless negative balance permitted).
- **Status Transitions**:
  - `Draft` -> `Pending Approval` -> `Approved` / `Rejected` / `Cancelled by Employee` / `Revoked`.
- **Evidence**: `com.keka.xhr.features.leave.*`, `assets/composeResources/keka.kmm.leave.generated.resources`.

---

### Module 4: Inbox & Multi-Tier Approvals
- **Navigation Graphs**: `features_keka_inbox_inbox_nav_graph.xml` + 12 domain sub-graphs
- **Routing & Capabilities**:
  - Centralized manager task queue separated into **Pending** and **Archive (History)** tabs.
  - Deep links supported: `app://com.keka.xhr/inbox/<category>/requests?isPending={isPending}`.
- **Approval Handlers**:
  1. **Leave Approvals** (`InboxLeaveRequestsFragment`, `InboxLeaveRequestDetailFragment`):
     - View applicant profile, requested type, duration, overlapping team leaves, current balance.
     - Actions: **Approve**, **Reject** (prompts `InboxRejectRequestBottomSheet` requiring remarks), **Cancel**.
  2. **Attendance Regularisation** (`InboxAdjustmentRegularisationRequestsFragment`, `InboxAdjustmentRegularisationRequestDetailFragment`):
     - View original biometrics vs requested times, shift discrepancy, reason.
  3. **Work From Home / Remote Clock-In** (`InboxWorkingRemotelyRequestsFragment`).
  4. **Overtime Requests** (`InboxOvertimeRequestsFragment`, `OtBreakUpBottomSheet`).
  5. **Comp-Off Credit Requests** (`InboxCompOffRequestsFragment`).
  6. **Expense Approvals** (`InboxExpenseRequestsFragment`, `InboxExpenseRequestDetailFragment`).
  7. **Timesheet Approvals** (`InboxPendingRequestsFragment`, `InboxEmployeeTimesheetFragment`, `TasksBottomSheetFragment`).
  8. **Exit / Resignation Approvals** (`features_keka_inbox_nav_graph_exit_requests.xml`).
  9. **Helpdesk Escalations** (`features_keka_inbox_nav_graph_helpdesk.xml`).
- **Evidence**: `com.keka.xhr.features.inbox.*`, `features_keka_inbox_inbox_nav_graph.xml`.

---

### Module 5: Payroll, Payslips & Taxation
- **Navigation Graphs**:
  - `features_keka_payroll_my_pay_nav_graph.xml`
  - `features_keka_payroll_navgraph_payslip.xml`
  - `features_keka_payroll_manage_tax_nav_graph.xml`
  - `features_keka_payroll_navgraph_tax_form.xml`
- **Workflows**:
  1. **My Pay & Salary Breakup**:
     - Net Pay summary, Gross Pay, Deductions (PF, Professional Tax, Income Tax/TDS).
     - Earnings breakdown: Basic, HRA, Special Allowance, LTA, Performance Bonus.
  2. **Payslip Preview & Download**:
     - `PayslipsFragment` (Historical month grid), `ViewPayslipFragment` (PDF renderer).
     - Download flow with password protection notice (`PayslipDownloadAcknowledgeBottomSheet`).
  3. **Income Tax Declaration & Regime Switch**:
     - `SwitchTaxRegimeFragment`: Comparison of tax liability under **Old Tax Regime** (80C, 80D, HRA exemptions) vs **New Tax Regime** (concessional slabs, standard deduction).
     - `TaxFormsFragment`: Form 16 Part A/B download.
  4. **Air Ticket Benefit**:
     - `features_keka_payroll_nav_graph_air_tickets.xml`: Corporate travel entitlement and cash encashment option.
- **Evidence**: `com.keka.xhr.features.payroll.*`, `features_keka_payroll_navgraph_payslip.xml`.

---

### Module 6: Expenses & Travel Reimbursements
- **Navigation Graph**: `features_keka_expense_nav_graph.xml` (24 destinations)
- **Workflows**:
  1. **Expense Claim Entry**:
     - `AddExpenseFragment`, `MileageExpenseFragment` (Rate per km), `PerDiemExpenseFragment` (Daily allowance).
     - Fields: Category (Travel, Meal, Hotel, Stationery, Fuel), Amount, Currency, Merchant/Vendor, Date, Receipt Upload (`DocumentChooserFragment`), Billable Flag.
  2. **Expense Reports & Advance Requests**:
     - Group individual expenses into an Expense Report for submission.
     - Cash advance request and settlement reconciliation.
- **Evidence**: `com.keka.expense.compose.*`, `features_keka_expense_nav_graph.xml`.

---

### Module 7: Timesheets & PSA (Professional Services Automation)
- **Navigation Graph**: `features_keka_psa_nav_graph.xml` (14 destinations)
- **Workflows**:
  1. **Weekly & Daily Time Logging**:
     - `TimesheetFragment`: Day view & weekly grid.
     - `AddTasksBottomSheetFragment`: Select Project, Select Phase/Task.
     - `AddTimeAndCommentBottomSheet`: Enter logged hours (0.25h increments), description, Billable toggle (`BillingItemsBottomSheetDialog`).
  2. **Bulk Actions**:
     - `CopyWeeklyTasksBottomSheetFragment`: Clone prior week's task structure to current week.
     - Weekly timesheet submission for project manager approval.
- **Evidence**: `com.keka.xhr.psa.*`, `features_keka_psa_nav_graph.xml`.

---

### Module 8: Helpdesk & Internal Service Desk
- **Navigation Graphs**: `features_keka_helpdesk_nav_graph.xml`, `features_keka_helpdesk_raise_ticket_nav_graph.xml`, `features_keka_helpdesk_ticket_details_nav_graph.xml`
- **Workflows**:
  1. **Raise Ticket**:
     - Select Department / Category (IT Support, HR Operations, Admin / Facilities, Finance).
     - Priority: Low, Medium, High, Urgent.
     - Subject, Description, Attachment upload.
  2. **Ticket Discussion & Resolution**:
     - `TicketDetailsFragment`: Chronological message thread, status tracker (Open, In Progress, Resolved, Closed), rating resolution satisfaction.
- **Evidence**: `com.keka.xhr.features.helpdesk.*`.

---

### Module 9: Employee Directory, Organization & Assets
- **Navigation Graphs**:
  - `features_keka_hr_employee_directory_nav_graph.xml`
  - `features_keka_hr_my_team_nav_graph.xml`
  - `features_keka_hr_user_profile_nav_graph.xml`
  - `features_keka_hr_documents_nav_graph.xml`
- **Workflows**:
  1. **Employee Directory**:
     - Search by Name, Department, Designation, Location.
     - Quick call, email, or chat launcher.
  2. **User Profile**:
     - Overview, Contact, Work Info (Department, Reporting Manager, Direct Reports, Employee No).
     - Organization hierarchy tree view.
  3. **Asset Inventory**:
     - Hardware & software asset assignments (`core_ui_asset_id`, `core_ui_asset_name`).
     - Employee policy acknowledgment flow (`features_hr_acknowledge`, signature/confirmation).
- **Evidence**: `com.keka.xhr.features.hr.*`, `assets/composeResources/keka.kmm.core.generated.resources`.

---

### Module 10: Performance Management & Goals (PMS)
- **Navigation Graphs**: `features_keka_pms_nav_graph.xml`, `features_keka_pms_goals_nav_graph.xml`
- **Workflows**:
  - Goal / OKR creation, Target Metric (Numeric, Currency, Percentage, Boolean).
  - Progress updates via `GoalsUpdateProgressBottomSheet` (Status: On Track, At Risk, Lagging, Completed).
  - 360-degree feedback: `RequestFeedbackFragment`, `GivePersonalFeedbackFragment`.
- **Evidence**: `com.keka.xhr.features.pms.*`, `assets/composeResources/keka.kmm.performance.goals.generated.resources`.

---

### Module 11: Learning & Development (LMS)
- **Navigation Graph**: `features_keka_learn_nav_graph.xml`
- **Workflows**:
  - Enrolled courses list, course progress tracker, modules/chapters.
  - Timed assessments and quizzes (`feature_learn_instruction1`, `answer_outcome_correct`).
- **Evidence**: `com.keka.xhr.features.learn.*`, `assets/composeResources/keka.kmm.feature.learn.generated.resources`.

---

### Module 12: Employee Engagement, Pulse, Wall & Celebrations
- **Navigation Graphs**:
  - `features_keka_engage_wall_nav_graph.xml` (Company wall, posts, badges, polls)
  - `features_keka_engage_announcements_nav_graph.xml` (Company-wide announcements with attachments)
  - `features_keka_engage_pulse_nav_graph.xml` (eNPS pulse surveys with rating scales)
  - `features_keka_engage_survey_nav_graph.xml` (Custom surveys with multiple choice & text responses)
  - `features_keka_engage_wish_nav_graph.xml` (Peer birthday and work anniversary greetings)
- **Evidence**: `com.keka.xhr.engage.*`, `features_keka_engage_wall_nav_graph.xml`.

---

### Module 13: Settings & Preferences
- **Navigation Graph**: `features_keka_settings_nav_graph.xml`
- **Options**:
  - Theme Selection (Light, Dark, System Default)
  - Language Selection (English, Hindi, Telugu, Tamil, Marathi, Gujarati, Kannada, Malayalam, Arabic, etc.)
  - Date Format configuration (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD)
  - Biometric App Lock toggle (Fingerprint / Face Unlock).
