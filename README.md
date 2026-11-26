# Pulse HR - Enterprise Human Resource Suite

An original enterprise HR web application built from evidence-backed reverse engineering of the Keka HR Android application (`com.keka.xhr`, version 3.5.20).

Backed by **Node.js (v24)** and built-in **`node:sqlite`**, providing complete zero-dependency local execution, ACID compliance, and strict server-enforced role-based access control (RBAC).

---

## 1. Quick Start & Local Run Instructions

### Prerequisites
- Node.js v22.5.0+ or v24+ (Tested on v24.21.0).
- No external packages or database engines required (`node:sqlite` and `node:http` are built into Node).

### Start the Application
```bash
cd hr-app
node server.js
```
The server will boot and initialize the SQLite database (`hr.db`) at:
👉 **`http://localhost:3000`**

### Run Automated End-to-End Test Suite
```bash
cd hr-app
node tests/e2e-workflow.test.js
```
Or via npm:
```bash
npm test
```

---

## 2. Seeded Demo Accounts

The application includes pre-configured accounts representing an enterprise organizational hierarchy:

| Name | Role | Email | Password | Reporting Manager | Organization Scope |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Eva Green** | HR Admin | `eva@company.com` | `admin123` | *None (VP)* | All Departments (People Ops, Eng, Mktg) |
| **Bob Martinez** | Manager | `bob@company.com` | `manager123` | Eva Green | Engineering Director (Manages Alice) |
| **Alice Chen** | Employee | `alice@company.com` | `employee123` | Bob Martinez | Senior Engineer (Reports to Bob) |
| **David Smith** | Manager | `david@company.com` | `manager123` | Eva Green | Marketing Head (Manages Charlie) |
| **Charlie Patel** | Employee | `charlie@company.com` | `employee123` | David Smith | Marketing Specialist (Reports to David) |

*Tip: Use the top **⚡ DEMO WORKFLOW SWITCHER** bar in the web app to switch between accounts with 1 click.*

---

## 3. Module Implementation Matrix

| Module | Status | Features Implemented | Evidence Reference |
| :--- | :--- | :--- | :--- |
| **Authentication & Org** | **Implemented** | Email/Password auth, session tokens, tenant switcher, role metadata | `features_keka_login_auth_nav_graph.xml` |
| **Employee Directory** | **Implemented** | Directory cards, search by name/title, profile view, manager & direct report hierarchies | `features_keka_hr_employee_directory_nav_graph.xml` |
| **Attendance & Shifts** | **Implemented** | Live clock-in/out widget, GPS/mode tagging (Office/Remote), 30-day log history, regularization requests | `features_keka_attendance_nav_graph.xml` |
| **Leave & Comp-Off** | **Implemented** | Balances overview (CL, SL, EL, CO), dynamic days calculation, half-day sessions, apply leave modal, cancellation | `features_keka_leave_nav_graph.xml` |
| **Inbox & Approvals** | **Implemented** | Strict RBAC manager queue, 1-click Approve, Reject with remarks modal, real-time balance deductions | `features_keka_inbox_inbox_nav_graph.xml` |
| **Payroll & Payslips** | **Implemented** | Gross earnings, deductions (PF, PT, TDS), net take-home pay, printable/downloadable payslip dialog | `features_keka_payroll_navgraph_payslip.xml` |
| **Expenses & Travel** | **Implemented** | Expense claims (Travel, Meals, Lodging, Supplies), merchant tagging, billable flags, approvals | `features_keka_expense_nav_graph.xml` |
| **Timesheets (PSA)** | **Implemented** | Project & task logging, hours tracking, billable badges, supervisor submission queue | `features_keka_psa_nav_graph.xml` |
| **Helpdesk & Tickets** | **Implemented** | Multi-department tickets (IT, HR, Admin, Finance), priority badges, description threads, status flow | `features_keka_helpdesk_nav_graph.xml` |
| **Asset Management** | **Implemented** | Hardware/software inventory (MacBooks, Displays), serial numbers, employee policy receipt acknowledgment | `core_ui_asset` / `keka.kmm.core` |
| **Performance (PMS)** | **Implemented** | Goals / OKRs tracking, progress bars, metric target updater modal, status tags (In Progress, Completed) | `features_keka_pms_goals_nav_graph.xml` |
| **Learning (LMS)** | **Implemented** | Enrolled technical & compliance courses, duration, lesson counts, completion progress bars | `features_keka_learn_nav_graph.xml` |
| **Engage & Wall** | **Implemented** | Announcements feed, peer kudos, category tags, interactive post creation modal | `features_keka_engage_wall_nav_graph.xml` |
| **Settings & Policies** | **Implemented** | Corporate policy settings, leave approval modes, geofence radius (editable by HR Admin only) | `features_keka_settings_nav_graph.xml` |

---

## 4. End-to-End Workflow Verification

The test suite in `tests/e2e-workflow.test.js` programmatically proves strict role separation and request lifecycle enforcement:

1. **Employee Submission**: Alice Chen submits a 2-day Casual Leave request. Her pending balance increments by 2 days, and remaining balance decreases.
2. **Unrelated Manager Isolation**: David Smith (Marketing Manager) checks his Inbox: Alice's request is **completely absent**. When David attempts an unauthorized HTTP `POST` to approve Alice's request, the server returns **`HTTP 403 Forbidden`**.
3. **Assigned Manager Action**: Bob Martinez (Alice's Engineering Manager) logs in, sees Alice's request in his Inbox, and approves it.
4. **Employee Verification**: Alice logs back in, verifies the request status is **`APPROVED`** by Bob Martinez, and confirms her Used balance is permanently updated while Pending is cleared.

---

## 5. Clean-Room Business Rule Configurations

Where the decompiled Android APK delegated business calculations to closed server-side APIs, the following configurable rules were implemented:
1. **Approval Routing Policy**: Routed by default to direct reporting manager (`reporting_manager_id`). If an employee has no manager (e.g. VP level), requests route to the HR Administrator.
2. **Leave Balance Decrement**: Leave days are held in `pending` upon application and moved to `used` upon approval. Rejection or cancellation restores the available balance.
3. **Attendance Effective Hours**: Gross hours minus a standardized 45-minute meal/break deduction yields effective hours.
4. **Statutory Payroll Deductions**: Standard Indian payroll rules modeled (12% Employee Provident Fund capped at statutory basic, ₹200 Professional Tax, and estimated TDS brackets).
