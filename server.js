const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { db, initDatabase } = require('./database');

// Initialize DB schema & seed
initDatabase();

const PORT = process.env.PORT || 3000;
const sessions = new Map(); // token -> user_id

// Helper: parse JSON body (compatible with both standalone node:http and Vercel serverless)
function parseBody(req) {
  if (req.body && typeof req.body === 'object') {
    return Promise.resolve(req.body);
  }
  if (req.body && typeof req.body === 'string') {
    try {
      return Promise.resolve(JSON.parse(req.body));
    } catch {
      return Promise.resolve({});
    }
  }
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

// Helper: authenticate request
function getAuthUser(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const userId = sessions.get(token);
  if (!userId) return null;
  return db.prepare('SELECT id, email, name, role, department, designation, employee_code, reporting_manager_id, avatar_url, location FROM users WHERE id = ?').get(userId);
}

// Helper: send JSON response
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

// Helper: send error response
function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message });
}

// MIME types for static assets
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const handleRequest = async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  // ----------------------------------------------------
  // API Routes
  // ----------------------------------------------------
  if (pathname.startsWith('/api/')) {
    try {
      // 1. Auth: Login
      if (pathname === '/api/auth/login' && method === 'POST') {
        const { email, password } = await parseBody(req);
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        if (!user || user.password !== password) {
          return sendError(res, 401, 'Invalid email or password.');
        }
        const token = crypto.randomUUID();
        sessions.set(token, user.id);
        const userProfile = {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          department: user.department,
          designation: user.designation,
          employee_code: user.employee_code,
          reporting_manager_id: user.reporting_manager_id,
          avatar_url: user.avatar_url,
          location: user.location
        };
        return sendJson(res, 200, { token, user: userProfile });
      }

      // Auth: Demo Accounts
      if (pathname === '/api/auth/demo-users' && method === 'GET') {
        const users = db.prepare(`
          SELECT u.id, u.email, u.name, u.role, u.department, u.designation, u.employee_code, 
                 u.reporting_manager_id, m.name as reporting_manager_name, u.avatar_url
          FROM users u
          LEFT JOIN users m ON u.reporting_manager_id = m.id
        `).all();
        return sendJson(res, 200, users);
      }

      // Auth: Current User
      if (pathname === '/api/auth/me' && method === 'GET') {
        const user = getAuthUser(req);
        if (!user) return sendError(res, 401, 'Unauthorized');
        return sendJson(res, 200, user);
      }

      // Auth: Logout
      if (pathname === '/api/auth/logout' && method === 'POST') {
        const authHeader = req.headers['authorization'];
        if (authHeader) {
          const token = authHeader.replace(/^Bearer\s+/i, '');
          sessions.delete(token);
        }
        return sendJson(res, 200, { success: true });
      }

      // Check authentication for all remaining APIs
      const currentUser = getAuthUser(req);
      if (!currentUser) {
        return sendError(res, 401, 'Authentication required');
      }

      // 2. Employee Directory
      if (pathname === '/api/employees' && method === 'GET') {
        const q = parsedUrl.searchParams.get('q') || '';
        const dept = parsedUrl.searchParams.get('department') || '';
        let query = `
          SELECT u.id, u.email, u.name, u.role, u.department, u.designation, u.employee_code,
                 u.reporting_manager_id, m.name as reporting_manager_name, u.avatar_url, u.location, u.phone
          FROM users u
          LEFT JOIN users m ON u.reporting_manager_id = m.id
          WHERE 1=1
        `;
        const params = [];
        if (q) {
          query += ` AND (u.name LIKE ? OR u.email LIKE ? OR u.designation LIKE ?)`;
          params.push(`%${q}%`, `%${q}%`, `%${q}%`);
        }
        if (dept) {
          query += ` AND u.department = ?`;
          params.push(dept);
        }
        query += ` ORDER BY u.name ASC`;
        const employees = db.prepare(query).all(...params);
        return sendJson(res, 200, employees);
      }

      // Employee Profile
      if (pathname.startsWith('/api/employees/') && method === 'GET') {
        const empId = parseInt(pathname.split('/')[3], 10);
        const emp = db.prepare(`
          SELECT u.id, u.email, u.name, u.role, u.department, u.designation, u.employee_code,
                 u.reporting_manager_id, m.name as reporting_manager_name, u.avatar_url, u.location, u.phone, u.joining_date
          FROM users u
          LEFT JOIN users m ON u.reporting_manager_id = m.id
          WHERE u.id = ?
        `).get(empId);
        if (!emp) return sendError(res, 404, 'Employee not found');
        const directReports = db.prepare('SELECT id, name, designation, avatar_url FROM users WHERE reporting_manager_id = ?').all(empId);
        return sendJson(res, 200, { ...emp, direct_reports: directReports });
      }

      // 3. Attendance
      if (pathname === '/api/attendance/today' && method === 'GET') {
        const today = new Date().toISOString().split('T')[0];
        const log = db.prepare('SELECT * FROM attendance_logs WHERE user_id = ? AND date = ?').get(currentUser.id, today);
        return sendJson(res, 200, log || { clocked_in: false, date: today });
      }

      if (pathname === '/api/attendance/logs' && method === 'GET') {
        const logs = db.prepare('SELECT * FROM attendance_logs WHERE user_id = ? ORDER BY date DESC LIMIT 30').all(currentUser.id);
        return sendJson(res, 200, logs);
      }

      if (pathname === '/api/attendance/clock-in' && method === 'POST') {
        const { work_mode, latitude, longitude } = await parseBody(req);
        const today = new Date().toISOString().split('T')[0];
        const nowTime = new Date().toTimeString().slice(0, 5); // HH:MM
        
        const existing = db.prepare('SELECT * FROM attendance_logs WHERE user_id = ? AND date = ?').get(currentUser.id, today);
        if (existing && existing.clock_in_time) {
          return sendError(res, 400, 'Already clocked in for today.');
        }

        if (existing) {
          db.prepare('UPDATE attendance_logs SET clock_in_time = ?, work_mode = ?, latitude = ?, longitude = ? WHERE id = ?')
            .run(nowTime, work_mode || 'OFFICE', latitude || null, longitude || null, existing.id);
        } else {
          db.prepare(`
            INSERT INTO attendance_logs (user_id, date, clock_in_time, work_mode, latitude, longitude, status)
            VALUES (?, ?, ?, ?, ?, ?, 'PRESENT')
          `).run(currentUser.id, today, nowTime, work_mode || 'OFFICE', latitude || null, longitude || null);
        }

        const updated = db.prepare('SELECT * FROM attendance_logs WHERE user_id = ? AND date = ?').get(currentUser.id, today);
        return sendJson(res, 200, { success: true, log: updated });
      }

      if (pathname === '/api/attendance/clock-out' && method === 'POST') {
        const today = new Date().toISOString().split('T')[0];
        const nowTime = new Date().toTimeString().slice(0, 5);
        
        const existing = db.prepare('SELECT * FROM attendance_logs WHERE user_id = ? AND date = ?').get(currentUser.id, today);
        if (!existing || !existing.clock_in_time) {
          return sendError(res, 400, 'Must clock in before clocking out.');
        }

        // Calculate hours
        const [inH, inM] = existing.clock_in_time.split(':').map(Number);
        const [outH, outM] = nowTime.split(':').map(Number);
        let diffHours = (outH + outM / 60) - (inH + inM / 60);
        if (diffHours < 0) diffHours = 8.0; // fallback if crossed midnight
        const effectiveHours = Math.max(0, diffHours - 0.75); // 45m break

        db.prepare('UPDATE attendance_logs SET clock_out_time = ?, gross_hours = ?, effective_hours = ? WHERE id = ?')
          .run(nowTime, Number(diffHours.toFixed(2)), Number(effectiveHours.toFixed(2)), existing.id);

        const updated = db.prepare('SELECT * FROM attendance_logs WHERE id = ?').get(existing.id);
        return sendJson(res, 200, { success: true, log: updated });
      }

      // Regularize Attendance Request
      if (pathname === '/api/attendance/regularize' && method === 'POST') {
        const { date, requested_in_time, requested_out_time, reason } = await parseBody(req);
        if (!date || !requested_in_time || !requested_out_time || !reason) {
          return sendError(res, 400, 'All fields are required for regularization.');
        }

        const approverId = currentUser.reporting_manager_id || 1; // default to HR Admin if no manager
        const resInsert = db.prepare(`
          INSERT INTO attendance_regularizations (user_id, date, requested_in_time, requested_out_time, reason, status, approver_id)
          VALUES (?, ?, ?, ?, ?, 'PENDING', ?)
        `).run(currentUser.id, date, requested_in_time, requested_out_time, reason, approverId);

        return sendJson(res, 201, { success: true, id: resInsert.lastInsertRowid });
      }

      // 4. Leave Management
      if (pathname === '/api/leave/types' && method === 'GET') {
        const types = db.prepare('SELECT * FROM leave_types ORDER BY id ASC').all();
        return sendJson(res, 200, types);
      }

      if (pathname === '/api/leave/balances' && method === 'GET') {
        const balances = db.prepare(`
          SELECT lt.id as leave_type_id, lt.name, lt.code, lt.color, lt.annual_allowance,
                 lb.allocated, lb.used, lb.pending, (lb.allocated - lb.used - lb.pending) as remaining
          FROM leave_types lt
          JOIN leave_balances lb ON lt.id = lb.leave_type_id
          WHERE lb.user_id = ?
        `).all(currentUser.id);
        return sendJson(res, 200, balances);
      }

      if (pathname === '/api/leave/requests' && method === 'GET') {
        const requests = db.prepare(`
          SELECT lr.*, lt.name as leave_type_name, lt.code as leave_type_code, lt.color as leave_type_color,
                 approver.name as approver_name
          FROM leave_requests lr
          JOIN leave_types lt ON lr.leave_type_id = lt.id
          LEFT JOIN users approver ON lr.approver_id = approver.id
          WHERE lr.user_id = ?
          ORDER BY lr.created_at DESC
        `).all(currentUser.id);
        return sendJson(res, 200, requests);
      }

      // Apply Leave
      if (pathname === '/api/leave/apply' && method === 'POST') {
        const { leave_type_id, start_date, end_date, days, is_half_day, half_day_period, reason } = await parseBody(req);
        if (!leave_type_id || !start_date || !end_date || !days || !reason) {
          return sendError(res, 400, 'Missing mandatory leave fields.');
        }

        const leaveDays = Number(days);
        if (leaveDays <= 0) return sendError(res, 400, 'Leave duration must be greater than 0.');

        // Verify balance
        const balance = db.prepare(`
          SELECT (allocated - used - pending) as remaining, pending
          FROM leave_balances
          WHERE user_id = ? AND leave_type_id = ?
        `).get(currentUser.id, leave_type_id);

        if (!balance || balance.remaining < leaveDays) {
          return sendError(res, 400, `Insufficient leave balance. Available: ${balance ? balance.remaining : 0} days.`);
        }

        // Determine approver: Direct reporting manager
        const approverId = currentUser.reporting_manager_id || 1; // if top of org, routes to HR Admin

        // Update pending balance
        db.prepare(`
          UPDATE leave_balances 
          SET pending = pending + ? 
          WHERE user_id = ? AND leave_type_id = ?
        `).run(leaveDays, currentUser.id, leave_type_id);

        // Insert request
        const resInsert = db.prepare(`
          INSERT INTO leave_requests (user_id, leave_type_id, start_date, end_date, days, is_half_day, half_day_period, reason, status, approver_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
        `).run(currentUser.id, leave_type_id, start_date, end_date, leaveDays, is_half_day ? 1 : 0, half_day_period || null, reason, approverId);

        return sendJson(res, 201, { success: true, request_id: resInsert.lastInsertRowid });
      }

      // Cancel Leave
      if (pathname.match(/^\/api\/leave\/\d+\/cancel$/) && method === 'POST') {
        const reqId = parseInt(pathname.split('/')[3], 10);
        const reqRow = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(reqId);
        if (!reqRow) return sendError(res, 404, 'Leave request not found');
        if (reqRow.user_id !== currentUser.id && currentUser.role !== 'hr_admin') {
          return sendError(res, 403, 'Cannot cancel another employee’s request');
        }
        if (reqRow.status !== 'PENDING') {
          return sendError(res, 400, `Cannot cancel request in status: ${reqRow.status}`);
        }

        // Restore pending balance
        db.prepare('UPDATE leave_balances SET pending = pending - ? WHERE user_id = ? AND leave_type_id = ?')
          .run(reqRow.days, reqRow.user_id, reqRow.leave_type_id);

        db.prepare('UPDATE leave_requests SET status = "CANCELLED", decision_reason = "Cancelled by employee", decided_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(reqId);

        return sendJson(res, 200, { success: true });
      }

      // 5. INBOX & APPROVAL ROUTING (STRICT RBAC)
      if (pathname === '/api/inbox/pending' && method === 'GET') {
        // Strict routing:
        // - Managers can ONLY see requests for which they are the assigned approver (or their direct reports)
        // - HR Admin can see all requests
        let leaveQuery = `
          SELECT lr.*, 'LEAVE' as request_type, u.name as employee_name, u.email as employee_email, 
                 u.department as employee_department, u.avatar_url as employee_avatar,
                 lt.name as type_name, lt.code as type_code, lt.color as type_color
          FROM leave_requests lr
          JOIN users u ON lr.user_id = u.id
          JOIN leave_types lt ON lr.leave_type_id = lt.id
          WHERE lr.status = 'PENDING'
        `;
        let regQuery = `
          SELECT ar.*, 'ATTENDANCE_REGULARIZATION' as request_type, u.name as employee_name, u.email as employee_email,
                 u.department as employee_department, u.avatar_url as employee_avatar
          FROM attendance_regularizations ar
          JOIN users u ON ar.user_id = u.id
          WHERE ar.status = 'PENDING'
        `;
        let expQuery = `
          SELECT e.*, 'EXPENSE' as request_type, u.name as employee_name, u.email as employee_email,
                 u.department as employee_department, u.avatar_url as employee_avatar
          FROM expenses e
          JOIN users u ON e.user_id = u.id
          WHERE e.status = 'PENDING'
        `;
        let timeQuery = `
          SELECT t.*, 'TIMESHEET' as request_type, u.name as employee_name, u.email as employee_email,
                 u.department as employee_department, u.avatar_url as employee_avatar
          FROM timesheets t
          JOIN users u ON t.user_id = u.id
          WHERE t.status = 'SUBMITTED'
        `;

        if (currentUser.role === 'employee') {
          // Normal employees have zero approval duties
          return sendJson(res, 200, { leaves: [], attendance: [], expenses: [], timesheets: [] });
        } else if (currentUser.role === 'manager') {
          // Managers ONLY see requests assigned to them
          leaveQuery += ` AND lr.approver_id = ${currentUser.id}`;
          regQuery += ` AND ar.approver_id = ${currentUser.id}`;
          expQuery += ` AND e.approver_id = ${currentUser.id}`;
          timeQuery += ` AND t.approver_id = ${currentUser.id}`;
        }
        // HR Admin sees all

        const pendingLeaves = db.prepare(leaveQuery).all();
        const pendingRegs = db.prepare(regQuery).all();
        const pendingExps = db.prepare(expQuery).all();
        const pendingTimes = db.prepare(timeQuery).all();

        return sendJson(res, 200, {
          leaves: pendingLeaves,
          attendance: pendingRegs,
          expenses: pendingExps,
          timesheets: pendingTimes,
          total_count: pendingLeaves.length + pendingRegs.length + pendingExps.length + pendingTimes.length
        });
      }

      // Inbox: Decision (Approve / Reject Leave)
      if (pathname.match(/^\/api\/inbox\/leave\/\d+\/(approve|reject)$/) && method === 'POST') {
        const parts = pathname.split('/');
        const reqId = parseInt(parts[4], 10);
        const action = parts[5]; // approve or reject
        const { remarks } = await parseBody(req);

        const request = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(reqId);
        if (!request) return sendError(res, 404, 'Leave request not found');

        // RBAC Check: Must be the designated approver OR an HR admin!
        if (request.approver_id !== currentUser.id && currentUser.role !== 'hr_admin') {
          return sendError(res, 403, 'Forbidden: You are not authorized to approve or reject this employee’s leave request.');
        }

        if (request.status !== 'PENDING') {
          return sendError(res, 400, `Request is already in status: ${request.status}`);
        }

        const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';

        if (action === 'approve') {
          // Deduct from pending, add to used
          db.prepare(`
            UPDATE leave_balances 
            SET pending = pending - ?, used = used + ? 
            WHERE user_id = ? AND leave_type_id = ?
          `).run(request.days, request.days, request.user_id, request.leave_type_id);
        } else {
          // Reject: Deduct from pending only (restore balance)
          db.prepare(`
            UPDATE leave_balances 
            SET pending = pending - ? 
            WHERE user_id = ? AND leave_type_id = ?
          `).run(request.days, request.user_id, request.leave_type_id);
        }

        db.prepare(`
          UPDATE leave_requests 
          SET status = ?, decision_reason = ?, decided_at = CURRENT_TIMESTAMP, approver_id = ?
          WHERE id = ?
        `).run(newStatus, remarks || (action === 'approve' ? 'Approved by manager' : 'Rejected by manager'), currentUser.id, reqId);

        return sendJson(res, 200, { success: true, status: newStatus });
      }

      // Inbox: Decision (Approve / Reject Attendance Regularization)
      if (pathname.match(/^\/api\/inbox\/attendance\/\d+\/(approve|reject)$/) && method === 'POST') {
        const parts = pathname.split('/');
        const reqId = parseInt(parts[4], 10);
        const action = parts[5];
        const { remarks } = await parseBody(req);

        const request = db.prepare('SELECT * FROM attendance_regularizations WHERE id = ?').get(reqId);
        if (!request) return sendError(res, 404, 'Regularization request not found');

        if (request.approver_id !== currentUser.id && currentUser.role !== 'hr_admin') {
          return sendError(res, 403, 'Forbidden: Not authorized to act on this regularization.');
        }

        const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';

        if (action === 'approve') {
          // Update attendance log
          const log = db.prepare('SELECT * FROM attendance_logs WHERE user_id = ? AND date = ?').get(request.user_id, request.date);
          if (log) {
            db.prepare('UPDATE attendance_logs SET clock_in_time = ?, clock_out_time = ?, status = "PRESENT" WHERE id = ?')
              .run(request.requested_in_time, request.requested_out_time, log.id);
          } else {
            db.prepare('INSERT INTO attendance_logs (user_id, date, clock_in_time, clock_out_time, status) VALUES (?, ?, ?, ?, "PRESENT")')
              .run(request.user_id, request.date, request.requested_in_time, request.requested_out_time);
          }
        }

        db.prepare('UPDATE attendance_regularizations SET status = ?, decision_reason = ?, decided_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(newStatus, remarks || null, reqId);

        return sendJson(res, 200, { success: true, status: newStatus });
      }

      // 6. Expenses
      if (pathname === '/api/expenses' && method === 'GET') {
        const exps = db.prepare('SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC').all(currentUser.id);
        return sendJson(res, 200, exps);
      }

      if (pathname === '/api/expenses' && method === 'POST') {
        const { title, category, amount, date, merchant, billable } = await parseBody(req);
        if (!title || !category || !amount || !date) {
          return sendError(res, 400, 'Missing mandatory expense fields.');
        }
        const approverId = currentUser.reporting_manager_id || 1;
        const resInsert = db.prepare(`
          INSERT INTO expenses (user_id, title, category, amount, date, merchant, billable, status, approver_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
        `).run(currentUser.id, title, category, Number(amount), date, merchant || '', billable ? 1 : 0, approverId);

        return sendJson(res, 201, { success: true, id: resInsert.lastInsertRowid });
      }

      // 7. Timesheets
      if (pathname === '/api/timesheets' && method === 'GET') {
        const entries = db.prepare('SELECT * FROM timesheets WHERE user_id = ? ORDER BY date DESC').all(currentUser.id);
        return sendJson(res, 200, entries);
      }

      if (pathname === '/api/timesheets' && method === 'POST') {
        const { project_name, task_name, date, hours, is_billable, comments } = await parseBody(req);
        if (!project_name || !task_name || !date || !hours) {
          return sendError(res, 400, 'Missing mandatory timesheet fields.');
        }
        const approverId = currentUser.reporting_manager_id || 1;
        const resInsert = db.prepare(`
          INSERT INTO timesheets (user_id, project_name, task_name, date, hours, is_billable, comments, status, approver_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'SUBMITTED', ?)
        `).run(currentUser.id, project_name, task_name, date, Number(hours), is_billable ? 1 : 0, comments || '', approverId);

        return sendJson(res, 201, { success: true, id: resInsert.lastInsertRowid });
      }

      // 8. Helpdesk
      if (pathname === '/api/helpdesk' && method === 'GET') {
        const tickets = db.prepare(`
          SELECT t.*, u.name as user_name, u.avatar_url as user_avatar
          FROM helpdesk_tickets t
          JOIN users u ON t.user_id = u.id
          WHERE t.user_id = ? OR ? IN ('manager', 'hr_admin')
          ORDER BY t.created_at DESC
        `).all(currentUser.id, currentUser.role);
        return sendJson(res, 200, tickets);
      }

      if (pathname === '/api/helpdesk' && method === 'POST') {
        const { department, category, priority, subject, description } = await parseBody(req);
        if (!department || !category || !priority || !subject || !description) {
          return sendError(res, 400, 'All fields are required.');
        }
        const resInsert = db.prepare(`
          INSERT INTO helpdesk_tickets (user_id, department, category, priority, subject, description, status, assigned_to)
          VALUES (?, ?, ?, ?, ?, ?, 'OPEN', 1)
        `).run(currentUser.id, department, category, priority, subject, description);

        return sendJson(res, 201, { success: true, id: resInsert.lastInsertRowid });
      }

      // 9. Assets
      if (pathname === '/api/assets' && method === 'GET') {
        const assets = db.prepare('SELECT * FROM assets WHERE assigned_to = ?').all(currentUser.id);
        return sendJson(res, 200, assets);
      }

      if (pathname.match(/^\/api\/assets\/\d+\/acknowledge$/) && method === 'POST') {
        const assetId = parseInt(pathname.split('/')[3], 10);
        const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(assetId);
        if (!asset || asset.assigned_to !== currentUser.id) {
          return sendError(res, 404, 'Asset not found');
        }
        db.prepare('UPDATE assets SET acknowledged = 1, acknowledged_at = CURRENT_TIMESTAMP WHERE id = ?').run(assetId);
        return sendJson(res, 200, { success: true });
      }

      // 10. Payslips
      if (pathname === '/api/payslips' && method === 'GET') {
        const slips = db.prepare('SELECT * FROM payslips WHERE user_id = ? ORDER BY id DESC').all(currentUser.id);
        return sendJson(res, 200, slips);
      }

      // 11. Goals
      if (pathname === '/api/goals' && method === 'GET') {
        const goals = db.prepare('SELECT * FROM goals WHERE user_id = ?').all(currentUser.id);
        return sendJson(res, 200, goals);
      }

      if (pathname.match(/^\/api\/goals\/\d+$/) && method === 'PATCH') {
        const goalId = parseInt(pathname.split('/')[3], 10);
        const { current_value, status } = await parseBody(req);
        db.prepare('UPDATE goals SET current_value = ?, status = ? WHERE id = ? AND user_id = ?')
          .run(Number(current_value), status, goalId, currentUser.id);
        return sendJson(res, 200, { success: true });
      }

      // 12. Learning Courses
      if (pathname === '/api/courses' && method === 'GET') {
        const courses = db.prepare('SELECT * FROM courses WHERE enrolled_user_id = ?').all(currentUser.id);
        return sendJson(res, 200, courses);
      }

      // 13. Announcements / Wall
      if (pathname === '/api/announcements' && method === 'GET') {
        const feed = db.prepare(`
          SELECT a.*, u.name as author_name, u.avatar_url as author_avatar
          FROM announcements a
          JOIN users u ON a.author_id = u.id
          ORDER BY a.created_at DESC
        `).all();
        return sendJson(res, 200, feed);
      }

      if (pathname === '/api/announcements' && method === 'POST') {
        const { title, content, category } = await parseBody(req);
        if (!title || !content) return sendError(res, 400, 'Title and content required.');
        const resInsert = db.prepare(`
          INSERT INTO announcements (author_id, title, content, category)
          VALUES (?, ?, ?, ?)
        `).run(currentUser.id, title, content, category || 'Company Update');
        return sendJson(res, 201, { success: true, id: resInsert.lastInsertRowid });
      }

      // 14. Settings / Policy Configuration (HR Admin only for updates)
      if (pathname === '/api/settings' && method === 'GET') {
        const settings = db.prepare('SELECT * FROM system_settings').all();
        return sendJson(res, 200, settings);
      }

      if (pathname === '/api/settings' && method === 'PATCH') {
        if (currentUser.role !== 'hr_admin') return sendError(res, 403, 'HR Admin access required.');
        const { key, value } = await parseBody(req);
        db.prepare('INSERT INTO system_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?')
          .run(key, value, value);
        return sendJson(res, 200, { success: true });
      }

      return sendError(res, 404, 'Endpoint not found');
    } catch (err) {
      console.error('API Error:', err);
      return sendError(res, 500, err.message || 'Internal Server Error');
    }
  }

  // ----------------------------------------------------
  // Static File Serving
  // ----------------------------------------------------
  let filePath = path.join(__dirname, 'public', pathname === '/' ? 'index.html' : pathname);
  
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // SPA Fallback to index.html
      filePath = path.join(__dirname, 'public', 'index.html');
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('Not Found');
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });
};

const server = http.createServer(handleRequest);

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(` Pulse HR App running at: http://localhost:${PORT}`);
    console.log(` Zero dependencies, backed by Node.js built-in SQLite`);
    console.log(`=======================================================`);
  });
}

module.exports = server;
module.exports.handleRequest = handleRequest;
