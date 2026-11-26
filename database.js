const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const isVercel = Boolean(process.env.VERCEL);
const dbPath = process.env.DB_PATH || (isVercel ? '/tmp/hr.db' : path.join(__dirname, 'hr.db'));

// In serverless environments like Vercel, copy pre-seeded database to writable /tmp
if (isVercel && !fs.existsSync('/tmp/hr.db')) {
  const seedPath = path.join(__dirname, 'hr.db');
  if (fs.existsSync(seedPath)) {
    try {
      fs.copyFileSync(seedPath, '/tmp/hr.db');
    } catch (e) {
      console.warn('Could not copy seed DB to /tmp, will initialize fresh:', e);
    }
  }
}

const db = new DatabaseSync(dbPath);

// Initialize Tables
function initDatabase() {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('employee', 'manager', 'hr_admin')),
      department TEXT NOT NULL,
      designation TEXT NOT NULL,
      employee_code TEXT UNIQUE NOT NULL,
      reporting_manager_id INTEGER,
      avatar_url TEXT,
      joining_date TEXT,
      location TEXT,
      phone TEXT,
      FOREIGN KEY (reporting_manager_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS leave_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      annual_allowance REAL NOT NULL,
      carry_forward_max REAL NOT NULL DEFAULT 5,
      color TEXT NOT NULL DEFAULT '#3b82f6'
    );

    CREATE TABLE IF NOT EXISTS leave_balances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      leave_type_id INTEGER NOT NULL,
      allocated REAL NOT NULL,
      used REAL NOT NULL DEFAULT 0,
      pending REAL NOT NULL DEFAULT 0,
      UNIQUE(user_id, leave_type_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (leave_type_id) REFERENCES leave_types(id)
    );

    CREATE TABLE IF NOT EXISTS leave_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      leave_type_id INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      days REAL NOT NULL,
      is_half_day INTEGER NOT NULL DEFAULT 0,
      half_day_period TEXT,
      reason TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
      approver_id INTEGER,
      decision_reason TEXT,
      decided_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (leave_type_id) REFERENCES leave_types(id),
      FOREIGN KEY (approver_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS attendance_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      clock_in_time TEXT,
      clock_out_time TEXT,
      work_mode TEXT NOT NULL DEFAULT 'OFFICE' CHECK(work_mode IN ('OFFICE', 'REMOTE', 'CLIENT')),
      gross_hours REAL DEFAULT 0,
      effective_hours REAL DEFAULT 0,
      latitude REAL,
      longitude REAL,
      status TEXT NOT NULL DEFAULT 'PRESENT' CHECK(status IN ('PRESENT', 'ABSENT', 'HALF_DAY', 'ON_DUTY')),
      UNIQUE(user_id, date),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS attendance_regularizations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      requested_in_time TEXT NOT NULL,
      requested_out_time TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')),
      approver_id INTEGER,
      decision_reason TEXT,
      decided_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (approver_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('Travel', 'Meals', 'Lodging', 'Supplies', 'Fuel', 'Other')),
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      date TEXT NOT NULL,
      merchant TEXT,
      billable INTEGER NOT NULL DEFAULT 0,
      receipt_url TEXT,
      status TEXT NOT NULL CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')),
      approver_id INTEGER,
      decision_reason TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (approver_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS timesheets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      project_name TEXT NOT NULL,
      task_name TEXT NOT NULL,
      date TEXT NOT NULL,
      hours REAL NOT NULL,
      is_billable INTEGER NOT NULL DEFAULT 1,
      comments TEXT,
      status TEXT NOT NULL CHECK(status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED')),
      approver_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (approver_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS helpdesk_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      department TEXT NOT NULL,
      category TEXT NOT NULL,
      priority TEXT NOT NULL CHECK(priority IN ('Low', 'Medium', 'High', 'Urgent')),
      subject TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
      assigned_to INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (assigned_to) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_tag TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      serial_number TEXT,
      assigned_to INTEGER NOT NULL,
      assigned_date TEXT NOT NULL,
      acknowledged INTEGER NOT NULL DEFAULT 0,
      acknowledged_at TEXT,
      FOREIGN KEY (assigned_to) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS payslips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      month_year TEXT NOT NULL,
      basic_salary REAL NOT NULL,
      hra REAL NOT NULL,
      special_allowance REAL NOT NULL,
      gross_earnings REAL NOT NULL,
      pf_deduction REAL NOT NULL,
      professional_tax REAL NOT NULL,
      tds_tax REAL NOT NULL,
      total_deductions REAL NOT NULL,
      net_salary REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'PAID',
      UNIQUE(user_id, month_year),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      target_metric TEXT NOT NULL,
      current_value REAL NOT NULL DEFAULT 0,
      target_value REAL NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('NOT_STARTED', 'IN_PROGRESS', 'AT_RISK', 'COMPLETED')),
      due_date TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      duration_mins INTEGER NOT NULL,
      lessons_count INTEGER NOT NULL,
      enrolled_user_id INTEGER NOT NULL,
      progress_percent INTEGER NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (enrolled_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Company Update',
      likes_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (author_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT
    );
  `);

  // Seed default data if empty
  seedData();
}

function seedData() {
  const userCount = db.prepare('SELECT count(*) as count FROM users').get().count;
  if (userCount > 0) return;

  console.log('Seeding initial HR demo database...');

  // 1. Seed Users
  // Structure:
  // Eva (HR Admin) -> VP
  // Bob (Engineering Manager) reports to Eva
  // Alice (Software Engineer) reports to Bob
  // David (Marketing Manager) reports to Eva
  // Charlie (Marketing Specialist) reports to David
  const insertUser = db.prepare(`
    INSERT INTO users (id, email, password, name, role, department, designation, employee_code, reporting_manager_id, avatar_url, joining_date, location, phone)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run(1, 'eva@company.com', 'admin123', 'Eva Green', 'hr_admin', 'People Operations', 'VP of People & HR Admin', 'KEKA-001', null, 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150', '2021-01-15', 'Bengaluru, India', '+91 98765 43210');
  insertUser.run(2, 'bob@company.com', 'manager123', 'Bob Martinez', 'manager', 'Engineering', 'Engineering Director', 'KEKA-002', 1, 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150', '2021-03-01', 'Bengaluru, India', '+91 98765 43211');
  insertUser.run(3, 'alice@company.com', 'employee123', 'Alice Chen', 'employee', 'Engineering', 'Senior Full Stack Engineer', 'KEKA-003', 2, 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150', '2022-06-15', 'Bengaluru, India', '+91 98765 43212');
  insertUser.run(4, 'david@company.com', 'manager123', 'David Smith', 'manager', 'Marketing', 'Head of Growth Marketing', 'KEKA-004', 1, 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150', '2021-05-10', 'Mumbai, India', '+91 98765 43213');
  insertUser.run(5, 'charlie@company.com', 'employee123', 'Charlie Patel', 'employee', 'Marketing', 'Digital Marketing Specialist', 'KEKA-005', 4, 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', '2023-02-01', 'Mumbai, India', '+91 98765 43214');

  // 2. Seed Leave Types
  const insertLeaveType = db.prepare(`
    INSERT INTO leave_types (id, name, code, annual_allowance, carry_forward_max, color)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertLeaveType.run(1, 'Casual Leave', 'CL', 12, 3, '#3b82f6');
  insertLeaveType.run(2, 'Sick Leave', 'SL', 10, 0, '#ef4444');
  insertLeaveType.run(3, 'Earned / Privilege Leave', 'EL', 18, 15, '#10b981');
  insertLeaveType.run(4, 'Compensatory Off', 'CO', 5, 0, '#f59e0b');

  // 3. Seed Leave Balances for all users
  const insertBalance = db.prepare(`
    INSERT INTO leave_balances (user_id, leave_type_id, allocated, used, pending)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (let u = 1; u <= 5; u++) {
    insertBalance.run(u, 1, 12, 2, 0); // CL: 10 remaining
    insertBalance.run(u, 2, 10, 1, 0); // SL: 9 remaining
    insertBalance.run(u, 3, 18, 4, 0); // EL: 14 remaining
    insertBalance.run(u, 4, 5, 0, 0);  // CO: 5 remaining
  }

  // 4. Seed Attendance for today and past days
  const insertAttendance = db.prepare(`
    INSERT INTO attendance_logs (user_id, date, clock_in_time, clock_out_time, work_mode, gross_hours, effective_hours, latitude, longitude, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const today = new Date().toISOString().split('T')[0];
  insertAttendance.run(1, today, '09:02', '18:15', 'OFFICE', 9.2, 8.5, 12.9716, 77.5946, 'PRESENT');
  insertAttendance.run(2, today, '09:15', '18:30', 'OFFICE', 9.25, 8.4, 12.9716, 77.5946, 'PRESENT');
  insertAttendance.run(3, today, '09:30', null, 'OFFICE', 3.5, 3.2, 12.9716, 77.5946, 'PRESENT'); // Alice clocked in, working
  insertAttendance.run(4, today, '09:00', '18:00', 'REMOTE', 9.0, 8.0, 19.0760, 72.8777, 'PRESENT');
  insertAttendance.run(5, today, '09:45', null, 'REMOTE', 3.0, 2.8, 19.0760, 72.8777, 'PRESENT');

  // 5. Seed Assets
  const insertAsset = db.prepare(`
    INSERT INTO assets (asset_tag, name, category, serial_number, assigned_to, assigned_date, acknowledged, acknowledged_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertAsset.run('AST-MAC-01', 'Apple MacBook Pro 16" M3', 'Hardware', 'C02XYZ12345', 3, '2022-06-15', 1, '2022-06-16 10:00:00');
  insertAsset.run('AST-MON-02', 'Dell Ultrasharp 27" 4K Monitor', 'Hardware', 'DL4K98765', 3, '2022-06-15', 1, '2022-06-16 10:05:00');
  insertAsset.run('AST-MAC-02', 'Apple MacBook Air 15" M2', 'Hardware', 'C02AIR56789', 5, '2023-02-01', 0, null);

  // 6. Seed Payslips for Alice (last month)
  const insertPayslip = db.prepare(`
    INSERT INTO payslips (user_id, month_year, basic_salary, hra, special_allowance, gross_earnings, pf_deduction, professional_tax, tds_tax, total_deductions, net_salary, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertPayslip.run(3, 'October 2026', 80000, 40000, 30000, 150000, 9600, 200, 15000, 24800, 125200, 'PAID');
  insertPayslip.run(3, 'September 2026', 80000, 40000, 30000, 150000, 9600, 200, 15000, 24800, 125200, 'PAID');
  insertPayslip.run(5, 'October 2026', 45000, 22500, 17500, 85000, 5400, 200, 6000, 11600, 73400, 'PAID');

  // 7. Seed Timesheets
  const insertTimesheet = db.prepare(`
    INSERT INTO timesheets (user_id, project_name, task_name, date, hours, is_billable, comments, status, approver_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertTimesheet.run(3, 'HR Platform Core', 'Implement Auth & RBAC', today, 5.5, 1, 'Implemented server middleware', 'SUBMITTED', 2);
  insertTimesheet.run(3, 'HR Platform Core', 'Leave API & Validations', today, 2.5, 1, 'Database models & balance checks', 'SUBMITTED', 2);

  // 8. Seed Helpdesk Tickets
  const insertTicket = db.prepare(`
    INSERT INTO helpdesk_tickets (user_id, department, category, priority, subject, description, status, assigned_to)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertTicket.run(3, 'IT Support', 'Software Access', 'Medium', 'Figma Pro license renewal', 'Requesting extension for the design team collaboration project.', 'IN_PROGRESS', 1);

  // 9. Seed Goals (OKRs)
  const insertGoal = db.prepare(`
    INSERT INTO goals (user_id, title, description, target_metric, current_value, target_value, status, due_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertGoal.run(3, 'Deliver Microservices Architecture v2', 'Migrate remaining monolithic endpoints to scalable Node services', 'Services Migrated', 8, 10, 'IN_PROGRESS', '2026-12-31');
  insertGoal.run(3, 'Maintain 95%+ Unit & Integration Test Coverage', 'Ensure test suite catches regression bugs before staging deploy', '% Coverage', 96, 95, 'COMPLETED', '2026-12-31');

  // 10. Seed Learning Courses
  const insertCourse = db.prepare(`
    INSERT INTO courses (title, category, duration_mins, lessons_count, enrolled_user_id, progress_percent, completed)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertCourse.run('Modern Security Architecture & Zero Trust', 'Security', 180, 8, 3, 75, 0);
  insertCourse.run('Clean Code & High Performance Node.js', 'Engineering', 240, 12, 3, 100, 1);
  insertCourse.run('Product-Led Growth in SaaS', 'Marketing', 150, 6, 5, 40, 0);

  // 11. Seed Announcements & Engagement
  const insertAnnouncement = db.prepare(`
    INSERT INTO announcements (author_id, title, content, category, likes_count)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertAnnouncement.run(1, 'Annual Company Offsite Announced! 🚀', 'We are thrilled to announce our 2026 annual offsite retreat in Goa from Dec 18 - Dec 21. Stay tuned for travel itinerary details!', 'Company Event', 24);
  insertAnnouncement.run(2, 'Kudos to the Engineering Team!', 'Huge congratulations to Alice and team for shipping the Q4 core infrastructure milestones ahead of schedule! 👏', 'Recognition', 18);

  // 12. Seed System Settings
  const insertSetting = db.prepare(`
    INSERT INTO system_settings (key, value, description)
    VALUES (?, ?, ?)
  `);
  insertSetting.run('leave_approval_mode', 'DIRECT_MANAGER', 'Routing mode: DIRECT_MANAGER or HR_ADMIN_ONLY or MULTI_TIER');
  insertSetting.run('geofence_radius_meters', '500', 'Allowed radius around office coordinates for GPS clock in');
  insertSetting.run('work_from_home_limit_per_month', '8', 'Maximum allowed remote days per employee per month');

  console.log('Database seeded successfully.');
}

module.exports = {
  db,
  initDatabase
};
