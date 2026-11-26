// Pulse HR - Frontend Application Engine

// Detect base URL path dynamically (e.g. '' or '/hr-payroll/keka')
const BASE_PATH = window.location.pathname.startsWith('/hr-payroll/keka') ? '/hr-payroll/keka' : '';

let currentUser = null;
let authToken = '';
let currentTab = 'home';

// Demo credentials
const DEMO_CREDENTIALS = {
  '1': { email: 'eva@company.com', password: 'admin123' },
  '2': { email: 'bob@company.com', password: 'manager123' },
  '3': { email: 'alice@company.com', password: 'employee123' },
  '4': { email: 'david@company.com', password: 'manager123' },
  '5': { email: 'charlie@company.com', password: 'employee123' },
};

// API Fetch Helper
async function api(path, options = {}) {
  const url = `${BASE_PATH}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
    ...(options.headers || {})
  };
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

// Switch Demo User
async function switchDemoUser(userId) {
  try {
    const creds = DEMO_CREDENTIALS[userId];
    if (!creds) return;
    const loginRes = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(creds)
    });
    authToken = loginRes.token;
    currentUser = loginRes.user;

    // Update UI headers
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('userRole').textContent = currentUser.role.replace('_', ' ');
    document.getElementById('userAvatar').src = currentUser.avatar_url;
    document.getElementById('demoUserSelect').value = userId;

    document.getElementById('demoRoleIndicator').innerHTML = `
      <span style="font-size:11px; background:#4338ca; padding:3px 8px; border-radius:4px; font-weight:600;">
        Active: ${currentUser.name} (${currentUser.role.toUpperCase()})
      </span>
    `;

    // Refresh inbox badge & current view
    await updateInboxBadge();
    navigate(currentTab);
  } catch (err) {
    alert(`Demo switch error: ${err.message}`);
  }
}

// Update Inbox Notification Badge
async function updateInboxBadge() {
  const badge = document.getElementById('inboxBadge');
  try {
    if (currentUser.role === 'employee') {
      badge.style.display = 'none';
      return;
    }
    const inbox = await api('/api/inbox/pending');
    if (inbox.total_count > 0) {
      badge.textContent = inbox.total_count;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  } catch {
    badge.style.display = 'none';
  }
}

// Navigation Handler
function navigate(tab) {
  currentTab = tab;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const activeNav = Array.from(document.querySelectorAll('.nav-item')).find(el => el.getAttribute('onclick')?.includes(`'${tab}'`));
  if (activeNav) activeNav.classList.add('active');

  const main = document.getElementById('mainContent');
  main.innerHTML = `<div style="padding:40px; text-align:center; color:#94a3b8;">Loading ${tab}...</div>`;

  switch (tab) {
    case 'home': renderHome(); break;
    case 'directory': renderDirectory(); break;
    case 'attendance': renderAttendance(); break;
    case 'leave': renderLeave(); break;
    case 'inbox': renderInbox(); break;
    case 'payroll': renderPayroll(); break;
    case 'expenses': renderExpenses(); break;
    case 'timesheets': renderTimesheets(); break;
    case 'helpdesk': renderHelpdesk(); break;
    case 'assets': renderAssets(); break;
    case 'performance': renderPerformance(); break;
    case 'learning': renderLearning(); break;
    case 'engage': renderEngage(); break;
    case 'settings': renderSettings(); break;
    default: renderHome();
  }
}

// ----------------------------------------------------
// 1. HOME DASHBOARD
// ----------------------------------------------------
async function renderHome() {
  const main = document.getElementById('mainContent');
  const [attendance, balances, inbox, announcements] = await Promise.all([
    api('/api/attendance/today'),
    api('/api/leave/balances'),
    api('/api/inbox/pending'),
    api('/api/announcements')
  ]);

  const isClockedIn = attendance && attendance.clock_in_time && !attendance.clock_out_time;

  main.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Good Day, ${currentUser.name.split(' ')[0]} 👋</h1>
        <div class="page-sub">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} | ${currentUser.designation} (${currentUser.department})</div>
      </div>
      <div>
        <button class="btn btn-primary" onclick="navigate('leave')">🏖️ Request Leave</button>
      </div>
    </div>

    ${inbox.total_count > 0 ? `
      <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: var(--radius-md); padding: 16px 20px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between;">
        <div style="display:flex; align-items:center; gap: 12px;">
          <span style="font-size:24px;">📥</span>
          <div>
            <div style="font-weight: 700; color: #92400e;">You have ${inbox.total_count} pending approval request(s) requiring your review.</div>
            <div style="font-size: 12px; color: #b45309;">Includes team leaves, timesheets, and expense claims.</div>
          </div>
        </div>
        <button class="btn btn-secondary" onclick="navigate('inbox')" style="background:#fff;">Review Inbox</button>
      </div>
    ` : ''}

    <div class="grid-cards">
      <!-- Quick Attendance Punch Card -->
      <div class="card" style="border-top: 4px solid var(--primary);">
        <div class="card-title">Live Attendance Tracker</div>
        <div style="display:flex; align-items:baseline; gap:8px;">
          <div class="card-val">${isClockedIn ? attendance.clock_in_time : (attendance.clock_out_time ? 'Completed' : 'Not Clocked In')}</div>
          <span class="status-pill ${isClockedIn ? 'status-approved' : 'status-pending'}">${isClockedIn ? 'CLOCKED IN' : (attendance.clock_out_time ? 'CLOCKED OUT' : 'NOT STARTED')}</span>
        </div>
        <div class="card-sub">Mode: <strong>${attendance.work_mode || 'OFFICE'}</strong> | Gross: ${attendance.gross_hours || 0} hrs</div>
        <div style="margin-top: 16px; display:flex; gap:10px;">
          ${!isClockedIn && !attendance.clock_out_time ? `
            <button class="btn btn-success" style="flex:1;" onclick="quickClockIn('OFFICE')">📍 Clock In (Office)</button>
            <button class="btn btn-secondary" onclick="quickClockIn('REMOTE')">🏠 Remote</button>
          ` : isClockedIn ? `
            <button class="btn btn-danger" style="flex:1;" onclick="quickClockOut()">⏱️ Clock Out</button>
          ` : `
            <button class="btn btn-secondary" style="flex:1;" disabled>Shift Finished Today</button>
          `}
        </div>
      </div>

      <!-- Casual Leave -->
      <div class="card" style="border-top: 4px solid #3b82f6;">
        <div class="card-title">Casual Leave (CL)</div>
        <div class="card-val">${balances.find(b => b.code === 'CL')?.remaining || 0} <span style="font-size:14px; font-weight:normal; color:#64748b;">days left</span></div>
        <div class="card-sub">Used: ${balances.find(b => b.code === 'CL')?.used || 0} | Pending: ${balances.find(b => b.code === 'CL')?.pending || 0}</div>
      </div>

      <!-- Sick Leave -->
      <div class="card" style="border-top: 4px solid #ef4444;">
        <div class="card-title">Sick Leave (SL)</div>
        <div class="card-val">${balances.find(b => b.code === 'SL')?.remaining || 0} <span style="font-size:14px; font-weight:normal; color:#64748b;">days left</span></div>
        <div class="card-sub">Used: ${balances.find(b => b.code === 'SL')?.used || 0} | Pending: ${balances.find(b => b.code === 'SL')?.pending || 0}</div>
      </div>

      <!-- Earned Leave -->
      <div class="card" style="border-top: 4px solid #10b981;">
        <div class="card-title">Earned / Privilege (EL)</div>
        <div class="card-val">${balances.find(b => b.code === 'EL')?.remaining || 0} <span style="font-size:14px; font-weight:normal; color:#64748b;">days left</span></div>
        <div class="card-sub">Used: ${balances.find(b => b.code === 'EL')?.used || 0} | Pending: ${balances.find(b => b.code === 'EL')?.pending || 0}</div>
      </div>
    </div>

    <!-- Announcements Feed Preview -->
    <div style="margin-top: 32px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h3 style="font-size: 18px; font-weight: 700;">Company Announcements & Celebrations</h3>
        <button class="btn btn-secondary" onclick="navigate('engage')">View All Feed</button>
      </div>
      <div style="display:flex; flex-direction:column; gap:16px;">
        ${announcements.slice(0, 2).map(a => `
          <div class="card" style="display:flex; gap:16px; align-items:flex-start;">
            <img src="${a.author_avatar}" class="user-avatar" style="width:48px; height:48px;">
            <div style="flex:1;">
              <div style="display:flex; justify-content:space-between;">
                <div style="font-weight:700; font-size:15px;">${a.title}</div>
                <span class="status-pill status-approved">${a.category}</span>
              </div>
              <div style="font-size:12px; color:var(--text-muted); margin-bottom:8px;">Posted by ${a.author_name} • ${new Date(a.created_at).toLocaleDateString()}</div>
              <div style="font-size:14px; line-height:1.5;">${a.content}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ----------------------------------------------------
// 2. EMPLOYEE DIRECTORY
// ----------------------------------------------------
async function renderDirectory() {
  const main = document.getElementById('mainContent');
  const employees = await api('/api/employees');

  main.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Employee Directory</h1>
        <div class="page-sub">Browse colleagues, departments, and reporting hierarchies.</div>
      </div>
      <div style="display:flex; gap:10px;">
        <input type="text" id="dirSearch" placeholder="Search by name, title..." class="form-control" style="width:260px;" oninput="filterDirectory(this.value)">
      </div>
    </div>

    <div class="grid-cards" id="directoryGrid" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));">
      ${employees.map(emp => `
        <div class="card" style="text-align:center; cursor:pointer;" onclick="showEmployeeModal(${emp.id})">
          <img src="${emp.avatar_url}" style="width:72px; height:72px; border-radius:50%; margin: 0 auto 12px; object-fit:cover; border:2px solid var(--primary-light);">
          <div style="font-size:16px; font-weight:700;">${emp.name}</div>
          <div style="font-size:13px; color:var(--primary); font-weight:600; margin-top:2px;">${emp.designation}</div>
          <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">${emp.department} • ${emp.location}</div>
          <div style="margin-top:12px; padding-top:12px; border-top:1px solid var(--border); font-size:11px; color:var(--text-muted); display:flex; justify-content:space-between;">
            <span>Code: <strong>${emp.employee_code}</strong></span>
            <span>Manager: <strong>${emp.reporting_manager_name || 'None (VP)'}</strong></span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

async function showEmployeeModal(empId) {
  const emp = await api(`/api/employees/${empId}`);
  showModal(`
    <div class="modal-header">
      <div class="modal-title">${emp.name} - Profile</div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body" style="text-align:center;">
      <img src="${emp.avatar_url}" style="width:96px; height:96px; border-radius:50%; object-fit:cover; margin-bottom:12px; border:3px solid var(--primary);">
      <div style="font-size:18px; font-weight:700;">${emp.name}</div>
      <div style="color:var(--primary); font-weight:600;">${emp.designation}</div>
      <div style="color:var(--text-muted); font-size:13px; margin-top:2px;">${emp.department} • ${emp.location}</div>
      
      <div style="margin-top:20px; text-align:left; background:var(--bg-main); padding:16px; border-radius:var(--radius-md); font-size:13px;">
        <div style="margin-bottom:8px;">📧 <strong>Email:</strong> ${emp.email}</div>
        <div style="margin-bottom:8px;">📱 <strong>Phone:</strong> ${emp.phone || '+91 98765 00000'}</div>
        <div style="margin-bottom:8px;">🏢 <strong>Employee Code:</strong> ${emp.employee_code}</div>
        <div style="margin-bottom:8px;">👔 <strong>Reporting Manager:</strong> ${emp.reporting_manager_name || 'None (Top Level)'}</div>
        <div>📅 <strong>Joined:</strong> ${emp.joining_date || '2022-01-01'}</div>
      </div>

      ${emp.direct_reports && emp.direct_reports.length > 0 ? `
        <div style="margin-top:20px; text-align:left;">
          <div style="font-weight:700; font-size:13px; margin-bottom:10px;">Direct Reports (${emp.direct_reports.length}):</div>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${emp.direct_reports.map(dr => `
              <div style="display:flex; align-items:center; gap:10px; background:white; padding:8px 12px; border-radius:6px; border:1px solid var(--border);">
                <img src="${dr.avatar_url}" style="width:32px; height:32px; border-radius:50%;">
                <div>
                  <div style="font-weight:600; font-size:13px;">${dr.name}</div>
                  <div style="font-size:11px; color:var(--text-muted);">${dr.designation}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Close</button>
    </div>
  `);
}

// ----------------------------------------------------
// 3. ATTENDANCE & SHIFTS
// ----------------------------------------------------
async function renderAttendance() {
  const main = document.getElementById('mainContent');
  const [todayLog, logs] = await Promise.all([
    api('/api/attendance/today'),
    api('/api/attendance/logs')
  ]);

  const isClockedIn = todayLog && todayLog.clock_in_time && !todayLog.clock_out_time;

  main.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Attendance & Shift Tracker</h1>
        <div class="page-sub">Biometric punches, work modes, effective hours, and regularizations.</div>
      </div>
      <div style="display:flex; gap:10px;">
        <button class="btn btn-secondary" onclick="openRegularizeModal()">📝 Request Regularization</button>
        ${!isClockedIn && !todayLog.clock_out_time ? `
          <button class="btn btn-success" onclick="quickClockIn('OFFICE')">📍 Clock In</button>
        ` : isClockedIn ? `
          <button class="btn btn-danger" onclick="quickClockOut()">⏱️ Clock Out</button>
        ` : `
          <button class="btn btn-secondary" disabled>Shift Logged</button>
        `}
      </div>
    </div>

    <div class="grid-cards">
      <div class="card">
        <div class="card-title">Today's Clock In</div>
        <div class="card-val">${todayLog.clock_in_time || '--:--'}</div>
        <div class="card-sub">${todayLog.clock_in_time ? `Mode: ${todayLog.work_mode}` : 'Not clocked in yet'}</div>
      </div>
      <div class="card">
        <div class="card-title">Today's Clock Out</div>
        <div class="card-val">${todayLog.clock_out_time || '--:--'}</div>
        <div class="card-sub">${todayLog.clock_out_time ? 'Day completed' : (isClockedIn ? 'In Progress...' : 'Waiting for punch')}</div>
      </div>
      <div class="card">
        <div class="card-title">Effective Work Hours</div>
        <div class="card-val">${todayLog.effective_hours || 0} <span style="font-size:14px; color:#64748b;">hrs</span></div>
        <div class="card-sub">Gross: ${todayLog.gross_hours || 0} hrs</div>
      </div>
      <div class="card">
        <div class="card-title">Attendance Status</div>
        <div class="card-val" style="color:var(--success); font-size:22px;">${todayLog.status || 'ABSENT'}</div>
        <div class="card-sub">Shift: General 09:00 - 18:00</div>
      </div>
    </div>

    <div class="table-container">
      <div style="padding:16px 20px; font-weight:700; font-size:15px; border-bottom:1px solid var(--border);">
        Past 30 Days Attendance Logs
      </div>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Clock In</th>
            <th>Clock Out</th>
            <th>Mode</th>
            <th>Gross Hrs</th>
            <th>Effective Hrs</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${logs.map(l => `
            <tr>
              <td><strong>${l.date}</strong></td>
              <td>${l.clock_in_time || '--'}</td>
              <td>${l.clock_out_time || '--'}</td>
              <td><span class="status-pill status-approved">${l.work_mode}</span></td>
              <td>${l.gross_hours || 0}h</td>
              <td>${l.effective_hours || 0}h</td>
              <td><span class="status-pill status-present">${l.status}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function quickClockIn(mode) {
  try {
    await api('/api/attendance/clock-in', {
      method: 'POST',
      body: JSON.stringify({
        work_mode: mode,
        latitude: 12.9716,
        longitude: 77.5946
      })
    });
    navigate(currentTab);
  } catch (err) {
    alert(err.message);
  }
}

async function quickClockOut() {
  try {
    await api('/api/attendance/clock-out', { method: 'POST' });
    navigate(currentTab);
  } catch (err) {
    alert(err.message);
  }
}

function openRegularizeModal() {
  showModal(`
    <div class="modal-header">
      <div class="modal-title">Attendance Regularization Request</div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Missed Date</label>
        <input type="date" id="regDate" class="form-control" value="${new Date().toISOString().split('T')[0]}">
      </div>
      <div style="display:flex; gap:12px;">
        <div class="form-group" style="flex:1;">
          <label class="form-label">Actual In Time</label>
          <input type="time" id="regInTime" class="form-control" value="09:15">
        </div>
        <div class="form-group" style="flex:1;">
          <label class="form-label">Actual Out Time</label>
          <input type="time" id="regOutTime" class="form-control" value="18:30">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Reason for Regularization</label>
        <textarea id="regReason" class="form-control" rows="3" placeholder="e.g. Biometric reader issue, Client meeting offsite"></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="submitRegularization()">Submit Request</button>
    </div>
  `);
}

async function submitRegularization() {
  const date = document.getElementById('regDate').value;
  const inTime = document.getElementById('regInTime').value;
  const outTime = document.getElementById('regOutTime').value;
  const reason = document.getElementById('regReason').value;

  try {
    await api('/api/attendance/regularize', {
      method: 'POST',
      body: JSON.stringify({
        date,
        requested_in_time: inTime,
        requested_out_time: outTime,
        reason
      })
    });
    closeModal();
    alert('Regularization request submitted to your manager.');
    navigate('attendance');
  } catch (err) {
    alert(err.message);
  }
}

// ----------------------------------------------------
// 4. LEAVE & TIME OFF
// ----------------------------------------------------
async function renderLeave() {
  const main = document.getElementById('mainContent');
  const [balances, requests, types] = await Promise.all([
    api('/api/leave/balances'),
    api('/api/leave/requests'),
    api('/api/leave/types')
  ]);

  main.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Leave & Time Off</h1>
        <div class="page-sub">View leave allowances, apply for time off, and track approvals.</div>
      </div>
      <button class="btn btn-primary" onclick="openApplyLeaveModal()">🏖️ Apply for Leave</button>
    </div>

    <!-- Balance Overview Cards -->
    <div class="grid-cards">
      ${balances.map(b => `
        <div class="card" style="border-top: 4px solid ${b.color};">
          <div class="card-title">${b.name} (${b.code})</div>
          <div class="card-val">${b.remaining} <span style="font-size:14px; font-weight:normal; color:#64748b;">days</span></div>
          <div class="card-sub">Allocated: ${b.allocated} | Used: ${b.used} | Pending: ${b.pending}</div>
        </div>
      `).join('')}
    </div>

    <!-- Leave Requests Table -->
    <div class="table-container">
      <div style="padding:16px 20px; font-weight:700; font-size:15px; border-bottom:1px solid var(--border);">
        My Leave History
      </div>
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Duration</th>
            <th>Days</th>
            <th>Reason</th>
            <th>Status</th>
            <th>Approver</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${requests.length === 0 ? `
            <tr><td colspan="7" style="text-align:center; color:#94a3b8; padding:32px;">No leave requests found.</td></tr>
          ` : requests.map(r => `
            <tr>
              <td>
                <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${r.leave_type_color}; margin-right:6px;"></span>
                <strong>${r.leave_type_name}</strong>
              </td>
              <td>${r.start_date} to ${r.end_date} ${r.is_half_day ? `(${r.half_day_period})` : ''}</td>
              <td><strong>${r.days}</strong> day(s)</td>
              <td>${r.reason}</td>
              <td>
                <span class="status-pill status-${r.status.toLowerCase()}">${r.status}</span>
              </td>
              <td>${r.approver_name || 'Reporting Manager'}</td>
              <td>
                ${r.status === 'PENDING' ? `
                  <button class="btn btn-secondary" style="padding:4px 8px; font-size:11px;" onclick="cancelLeave(${r.id})">Cancel</button>
                ` : '--'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function openApplyLeaveModal() {
  const [types, balances] = await Promise.all([
    api('/api/leave/types'),
    api('/api/leave/balances')
  ]);

  showModal(`
    <div class="modal-header">
      <div class="modal-title">Apply For Leave</div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Select Leave Type</label>
        <select id="leaveTypeId" class="form-control" onchange="updateLeaveBalancePreview()">
          ${balances.map(b => `
            <option value="${b.leave_type_id}" data-rem="${b.remaining}">${b.name} (${b.code}) - ${b.remaining} days available</option>
          `).join('')}
        </select>
      </div>

      <div style="display:flex; gap:12px;">
        <div class="form-group" style="flex:1;">
          <label class="form-label">From Date</label>
          <input type="date" id="leaveStartDate" class="form-control" value="${new Date().toISOString().split('T')[0]}" onchange="calculateLeaveDays()">
        </div>
        <div class="form-group" style="flex:1;">
          <label class="form-label">To Date</label>
          <input type="date" id="leaveEndDate" class="form-control" value="${new Date().toISOString().split('T')[0]}" onchange="calculateLeaveDays()">
        </div>
      </div>

      <div class="form-group" style="display:flex; align-items:center; gap:8px;">
        <input type="checkbox" id="leaveIsHalfDay" onchange="toggleHalfDay(this.checked)">
        <label for="leaveIsHalfDay" style="font-size:13px; font-weight:600; cursor:pointer;">Half Day Leave</label>
      </div>

      <div class="form-group" id="halfDayPeriodGroup" style="display:none;">
        <label class="form-label">Session</label>
        <select id="leaveHalfDayPeriod" class="form-control">
          <option value="First Half">First Half (Morning Session)</option>
          <option value="Second Half">Second Half (Afternoon Session)</option>
        </select>
      </div>

      <div style="background:var(--primary-light); padding:10px 14px; border-radius:6px; margin-bottom:16px; font-size:13px; color:var(--primary);">
        Total duration: <strong id="calculatedDaysBadge">1.0</strong> day(s)
      </div>

      <div class="form-group">
        <label class="form-label">Reason for Absence</label>
        <textarea id="leaveReason" class="form-control" rows="3" placeholder="Please mention the reason for leave..."></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="submitLeaveApplication()">Submit Leave Request</button>
    </div>
  `);
}

function toggleHalfDay(checked) {
  document.getElementById('halfDayPeriodGroup').style.display = checked ? 'block' : 'none';
  calculateLeaveDays();
}

function calculateLeaveDays() {
  const start = new Date(document.getElementById('leaveStartDate').value);
  const end = new Date(document.getElementById('leaveEndDate').value);
  const isHalfDay = document.getElementById('leaveIsHalfDay').checked;

  if (isHalfDay) {
    document.getElementById('calculatedDaysBadge').textContent = '0.5';
    return 0.5;
  }

  const diffTime = end - start;
  let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  if (diffDays < 1) diffDays = 1;
  document.getElementById('calculatedDaysBadge').textContent = diffDays.toFixed(1);
  return diffDays;
}

async function submitLeaveApplication() {
  const leaveTypeId = parseInt(document.getElementById('leaveTypeId').value, 10);
  const startDate = document.getElementById('leaveStartDate').value;
  const endDate = document.getElementById('leaveEndDate').value;
  const isHalfDay = document.getElementById('leaveIsHalfDay').checked;
  const halfDayPeriod = document.getElementById('leaveHalfDayPeriod').value;
  const reason = document.getElementById('leaveReason').value;
  const days = calculateLeaveDays();

  if (!reason.trim()) {
    alert('Please enter a valid reason.');
    return;
  }

  try {
    await api('/api/leave/apply', {
      method: 'POST',
      body: JSON.stringify({
        leave_type_id: leaveTypeId,
        start_date: startDate,
        end_date: endDate,
        days,
        is_half_day: isHalfDay,
        half_day_period: isHalfDay ? halfDayPeriod : null,
        reason
      })
    });
    closeModal();
    alert('Leave request submitted successfully! Awaiting your manager’s approval.');
    navigate('leave');
  } catch (err) {
    alert(err.message);
  }
}

async function cancelLeave(reqId) {
  if (!confirm('Are you sure you want to cancel this leave request?')) return;
  try {
    await api(`/api/leave/${reqId}/cancel`, { method: 'POST' });
    navigate('leave');
  } catch (err) {
    alert(err.message);
  }
}

// ----------------------------------------------------
// 5. INBOX & APPROVAL ROUTING (STRICT RBAC)
// ----------------------------------------------------
async function renderInbox() {
  const main = document.getElementById('mainContent');
  
  if (currentUser.role === 'employee') {
    main.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Inbox & Approvals</h1>
          <div class="page-sub">Managerial approval queue.</div>
        </div>
      </div>
      <div class="card" style="text-align:center; padding:60px 20px;">
        <div style="font-size:48px; margin-bottom:16px;">☕</div>
        <h2 style="font-size:20px; font-weight:700; margin-bottom:8px;">All Caught Up!</h2>
        <p style="color:var(--text-muted); max-width:440px; margin: 0 auto;">
          You are signed in as an <strong>Employee (${currentUser.name})</strong> without direct reporting staff. 
          Only assigned Managers and HR Admins receive team requests to approve.
        </p>
      </div>
    `;
    return;
  }

  const inbox = await api('/api/inbox/pending');

  main.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Approval Inbox (${inbox.total_count})</h1>
        <div class="page-sub">Review and act on pending requests from your direct reports.</div>
      </div>
    </div>

    ${inbox.total_count === 0 ? `
      <div class="card" style="text-align:center; padding:60px 20px;">
        <div style="font-size:48px; margin-bottom:16px;">🎉</div>
        <h2 style="font-size:20px; font-weight:700; margin-bottom:8px;">Zero Pending Tasks!</h2>
        <p style="color:var(--text-muted);">You have reviewed and acted on all submissions assigned to you.</p>
      </div>
    ` : `
      <!-- Pending Leaves -->
      ${inbox.leaves.length > 0 ? `
        <div class="table-container">
          <div style="padding:16px 20px; font-weight:700; font-size:15px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between;">
            <span>🏖️ Leave Applications (${inbox.leaves.length})</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Leave Type</th>
                <th>Dates</th>
                <th>Days</th>
                <th>Reason</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${inbox.leaves.map(req => `
                <tr>
                  <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                      <img src="${req.employee_avatar}" style="width:32px; height:32px; border-radius:50%;">
                      <div>
                        <div style="font-weight:700;">${req.employee_name}</div>
                        <div style="font-size:11px; color:var(--text-muted);">${req.employee_department}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${req.type_color}; margin-right:6px;"></span>
                    ${req.type_name}
                  </td>
                  <td>${req.start_date} to ${req.end_date}</td>
                  <td><strong>${req.days}</strong> day(s)</td>
                  <td>${req.reason}</td>
                  <td>
                    <div style="display:flex; gap:6px;">
                      <button class="btn btn-success" style="padding:4px 10px; font-size:11px;" onclick="approveLeave(${req.id})">✓ Approve</button>
                      <button class="btn btn-danger" style="padding:4px 10px; font-size:11px;" onclick="openRejectLeaveModal(${req.id})">✕ Reject</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      <!-- Attendance Regularizations -->
      ${inbox.attendance.length > 0 ? `
        <div class="table-container">
          <div style="padding:16px 20px; font-weight:700; font-size:15px; border-bottom:1px solid var(--border);">
            <span>⏱️ Attendance Regularization Requests (${inbox.attendance.length})</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Date</th>
                <th>Requested Punch</th>
                <th>Reason</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${inbox.attendance.map(ar => `
                <tr>
                  <td><strong>${ar.employee_name}</strong> (${ar.employee_department})</td>
                  <td>${ar.date}</td>
                  <td>${ar.requested_in_time} - ${ar.requested_out_time}</td>
                  <td>${ar.reason}</td>
                  <td>
                    <div style="display:flex; gap:6px;">
                      <button class="btn btn-success" style="padding:4px 10px; font-size:11px;" onclick="approveRegularization(${ar.id})">✓ Approve</button>
                      <button class="btn btn-danger" style="padding:4px 10px; font-size:11px;" onclick="rejectRegularization(${ar.id})">✕ Reject</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}
    `}
  `;
}

async function approveLeave(reqId) {
  try {
    await api(`/api/inbox/leave/${reqId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ remarks: 'Approved by manager.' })
    });
    alert('Leave request approved successfully.');
    updateInboxBadge();
    navigate('inbox');
  } catch (err) {
    alert(err.message);
  }
}

function openRejectLeaveModal(reqId) {
  showModal(`
    <div class="modal-header">
      <div class="modal-title">Reject Leave Request</div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Reason / Remarks for Rejection</label>
        <textarea id="rejectRemarks" class="form-control" rows="3" placeholder="Provide reason for rejection..."></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" onclick="submitRejectLeave(${reqId})">Confirm Rejection</button>
    </div>
  `);
}

async function submitRejectLeave(reqId) {
  const remarks = document.getElementById('rejectRemarks').value;
  try {
    await api(`/api/inbox/leave/${reqId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ remarks })
    });
    closeModal();
    alert('Leave request rejected.');
    updateInboxBadge();
    navigate('inbox');
  } catch (err) {
    alert(err.message);
  }
}

async function approveRegularization(reqId) {
  try {
    await api(`/api/inbox/attendance/${reqId}/approve`, { method: 'POST' });
    alert('Regularization approved.');
    updateInboxBadge();
    navigate('inbox');
  } catch (err) {
    alert(err.message);
  }
}

async function rejectRegularization(reqId) {
  try {
    await api(`/api/inbox/attendance/${reqId}/reject`, { method: 'POST' });
    alert('Regularization rejected.');
    updateInboxBadge();
    navigate('inbox');
  } catch (err) {
    alert(err.message);
  }
}

// ----------------------------------------------------
// 6. PAYROLL & PAYSLIPS
// ----------------------------------------------------
async function renderPayroll() {
  const main = document.getElementById('mainContent');
  const payslips = await api('/api/payslips');
  const latest = payslips[0] || {
    basic_salary: 80000, hra: 40000, special_allowance: 30000,
    gross_earnings: 150000, pf_deduction: 9600, professional_tax: 200, tds_tax: 15000,
    total_deductions: 24800, net_salary: 125200, month_year: 'October 2026'
  };

  main.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">My Pay & Payslips</h1>
        <div class="page-sub">Salary structure, payslip downloads, and income tax breakdown.</div>
      </div>
      <button class="btn btn-primary" onclick="showPrintablePayslip()">📄 View Printable Payslip</button>
    </div>

    <div class="grid-cards">
      <div class="card" style="border-top:4px solid var(--primary);">
        <div class="card-title">Net Take-Home Pay (${latest.month_year})</div>
        <div class="card-val" style="color:var(--primary);">₹${latest.net_salary.toLocaleString()}</div>
        <div class="card-sub">Credited to Salary Account</div>
      </div>
      <div class="card">
        <div class="card-title">Gross Earnings</div>
        <div class="card-val">₹${latest.gross_earnings.toLocaleString()}</div>
        <div class="card-sub">Basic + HRA + Special Allowance</div>
      </div>
      <div class="card">
        <div class="card-title">Total Deductions</div>
        <div class="card-val" style="color:var(--danger);">₹${latest.total_deductions.toLocaleString()}</div>
        <div class="card-sub">PF (12%) + PT + TDS</div>
      </div>
    </div>

    <div class="table-container">
      <div style="padding:16px 20px; font-weight:700; font-size:15px; border-bottom:1px solid var(--border);">
        Historical Payslips
      </div>
      <table>
        <thead>
          <tr>
            <th>Month</th>
            <th>Gross Earnings</th>
            <th>Deductions</th>
            <th>Net Pay</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${payslips.map(p => `
            <tr>
              <td><strong>${p.month_year}</strong></td>
              <td>₹${p.gross_earnings.toLocaleString()}</td>
              <td>₹${p.total_deductions.toLocaleString()}</td>
              <td><strong>₹${p.net_salary.toLocaleString()}</strong></td>
              <td><span class="status-pill status-paid">${p.status}</span></td>
              <td>
                <button class="btn btn-secondary" style="padding:4px 10px; font-size:11px;" onclick="showPrintablePayslip()">View PDF</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function showPrintablePayslip() {
  showModal(`
    <div class="modal-header">
      <div class="modal-title">Payslip - October 2026</div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body" style="background:#fff; font-size:12px; border:1px solid var(--border); border-radius:6px; padding:20px;">
      <div style="display:flex; justify-content:space-between; border-bottom:2px solid #0f172a; padding-bottom:12px; margin-bottom:16px;">
        <div>
          <h2 style="font-size:18px; font-weight:800; color:var(--primary);">PULSE HR TECH PVT LTD</h2>
          <div style="color:var(--text-muted);">Bengaluru, Karnataka, India</div>
        </div>
        <div style="text-align:right;">
          <div style="font-weight:700; font-size:14px;">PAYSLIP - OCTOBER 2026</div>
          <div style="color:var(--text-muted);">Date of Pay: 31-Oct-2026</div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px; background:var(--bg-main); padding:10px; border-radius:4px;">
        <div>Employee Name: <strong>${currentUser.name}</strong></div>
        <div>Employee Code: <strong>${currentUser.employee_code}</strong></div>
        <div>Department: <strong>${currentUser.department}</strong></div>
        <div>Designation: <strong>${currentUser.designation}</strong></div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; border-bottom:1px solid var(--border); padding-bottom:16px;">
        <div>
          <div style="font-weight:700; border-bottom:1px solid var(--border); padding-bottom:4px; margin-bottom:8px;">EARNINGS</div>
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>Basic Salary</span><span>₹80,000</span></div>
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>House Rent Allowance (HRA)</span><span>₹40,000</span></div>
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>Special Allowance</span><span>₹30,000</span></div>
          <div style="display:flex; justify-content:space-between; font-weight:700; border-top:1px solid var(--border); padding-top:4px; margin-top:8px;">
            <span>Gross Earnings</span><span>₹150,000</span>
          </div>
        </div>
        <div>
          <div style="font-weight:700; border-bottom:1px solid var(--border); padding-bottom:4px; margin-bottom:8px;">DEDUCTIONS</div>
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>Provident Fund (PF)</span><span>₹9,600</span></div>
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>Professional Tax</span><span>₹200</span></div>
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>Income Tax (TDS)</span><span>₹15,000</span></div>
          <div style="display:flex; justify-content:space-between; font-weight:700; border-top:1px solid var(--border); padding-top:4px; margin-top:8px;">
            <span>Total Deductions</span><span>₹24,800</span>
          </div>
        </div>
      </div>

      <div style="margin-top:16px; display:flex; justify-content:space-between; font-size:15px; font-weight:800; background:var(--primary-light); color:var(--primary); padding:12px; border-radius:6px;">
        <span>NET TAKE HOME PAY</span>
        <span>₹125,200</span>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Close</button>
      <button class="btn btn-primary" onclick="alert('Payslip PDF downloaded to device.')">📥 Download PDF</button>
    </div>
  `);
}

// ----------------------------------------------------
// 7. EXPENSES & TRAVEL
// ----------------------------------------------------
async function renderExpenses() {
  const main = document.getElementById('mainContent');
  const expenses = await api('/api/expenses');

  main.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Expenses & Reimbursements</h1>
        <div class="page-sub">Track corporate travel, meals, equipment claims, and mileage.</div>
      </div>
      <button class="btn btn-primary" onclick="openAddExpenseModal()">🧾 New Expense Claim</button>
    </div>

    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Title & Merchant</th>
            <th>Category</th>
            <th>Amount</th>
            <th>Billable</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${expenses.length === 0 ? `
            <tr><td colspan="6" style="text-align:center; padding:32px; color:#94a3b8;">No expense claims filed yet.</td></tr>
          ` : expenses.map(e => `
            <tr>
              <td><strong>${e.date}</strong></td>
              <td>
                <div style="font-weight:700;">${e.title}</div>
                <div style="font-size:11px; color:var(--text-muted);">${e.merchant || 'General Merchant'}</div>
              </td>
              <td><span class="status-pill status-approved">${e.category}</span></td>
              <td><strong>₹${e.amount.toLocaleString()}</strong></td>
              <td>${e.billable ? '✓ Billable' : 'Internal'}</td>
              <td><span class="status-pill status-${e.status.toLowerCase()}">${e.status}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function openAddExpenseModal() {
  showModal(`
    <div class="modal-header">
      <div class="modal-title">New Expense Claim</div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Expense Title</label>
        <input type="text" id="expTitle" class="form-control" placeholder="e.g. Client Dinner, Uber ride to airport">
      </div>
      <div style="display:flex; gap:12px;">
        <div class="form-group" style="flex:1;">
          <label class="form-label">Category</label>
          <select id="expCategory" class="form-control">
            <option value="Travel">Travel</option>
            <option value="Meals">Meals</option>
            <option value="Lodging">Lodging</option>
            <option value="Supplies">Supplies</option>
            <option value="Fuel">Fuel</option>
          </select>
        </div>
        <div class="form-group" style="flex:1;">
          <label class="form-label">Amount (₹)</label>
          <input type="number" id="expAmount" class="form-control" placeholder="0.00">
        </div>
      </div>
      <div style="display:flex; gap:12px;">
        <div class="form-group" style="flex:1;">
          <label class="form-label">Date of Expense</label>
          <input type="date" id="expDate" class="form-control" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-group" style="flex:1;">
          <label class="form-label">Merchant / Vendor</label>
          <input type="text" id="expMerchant" class="form-control" placeholder="e.g. Starbucks, Indigo">
        </div>
      </div>
      <div class="form-group" style="display:flex; align-items:center; gap:8px;">
        <input type="checkbox" id="expBillable">
        <label for="expBillable" style="font-size:13px; font-weight:600; cursor:pointer;">Billable to Client Project</label>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="submitExpense()">Submit Expense</button>
    </div>
  `);
}

async function submitExpense() {
  const title = document.getElementById('expTitle').value;
  const category = document.getElementById('expCategory').value;
  const amount = document.getElementById('expAmount').value;
  const date = document.getElementById('expDate').value;
  const merchant = document.getElementById('expMerchant').value;
  const billable = document.getElementById('expBillable').checked;

  try {
    await api('/api/expenses', {
      method: 'POST',
      body: JSON.stringify({ title, category, amount, date, merchant, billable })
    });
    closeModal();
    alert('Expense claim submitted to your manager.');
    navigate('expenses');
  } catch (err) {
    alert(err.message);
  }
}

// ----------------------------------------------------
// 8. TIMESHEETS (PSA)
// ----------------------------------------------------
async function renderTimesheets() {
  const main = document.getElementById('mainContent');
  const times = await api('/api/timesheets');

  main.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Weekly Timesheets</h1>
        <div class="page-sub">Log billable project tasks, client hours, and sprint activities.</div>
      </div>
      <button class="btn btn-primary" onclick="openLogTimeModal()">⏱️ Log Task Hours</button>
    </div>

    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Project</th>
            <th>Task & Description</th>
            <th>Logged Hours</th>
            <th>Billable</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${times.length === 0 ? `
            <tr><td colspan="6" style="text-align:center; padding:32px; color:#94a3b8;">No timesheet entries logged.</td></tr>
          ` : times.map(t => `
            <tr>
              <td><strong>${t.date}</strong></td>
              <td><span class="status-pill status-approved">${t.project_name}</span></td>
              <td>
                <div style="font-weight:700;">${t.task_name}</div>
                <div style="font-size:11px; color:var(--text-muted);">${t.comments || 'No comment'}</div>
              </td>
              <td><strong>${t.hours}</strong> hrs</td>
              <td>${t.is_billable ? '✓ Yes' : 'No'}</td>
              <td><span class="status-pill status-pending">${t.status}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function openLogTimeModal() {
  showModal(`
    <div class="modal-header">
      <div class="modal-title">Log Timesheet Task</div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Project Name</label>
        <input type="text" id="tsProject" class="form-control" value="HR Platform Core">
      </div>
      <div class="form-group">
        <label class="form-label">Task Name</label>
        <input type="text" id="tsTask" class="form-control" placeholder="e.g. Unit tests, Database indexing">
      </div>
      <div style="display:flex; gap:12px;">
        <div class="form-group" style="flex:1;">
          <label class="form-label">Date</label>
          <input type="date" id="tsDate" class="form-control" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-group" style="flex:1;">
          <label class="form-label">Hours</label>
          <input type="number" id="tsHours" class="form-control" value="8" step="0.5">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Work Description / Comments</label>
        <textarea id="tsComments" class="form-control" rows="2" placeholder="Summary of deliverables..."></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="submitTimesheet()">Log Hours</button>
    </div>
  `);
}

async function submitTimesheet() {
  const project = document.getElementById('tsProject').value;
  const task = document.getElementById('tsTask').value;
  const date = document.getElementById('tsDate').value;
  const hours = document.getElementById('tsHours').value;
  const comments = document.getElementById('tsComments').value;

  try {
    await api('/api/timesheets', {
      method: 'POST',
      body: JSON.stringify({ project_name: project, task_name: task, date, hours, is_billable: 1, comments })
    });
    closeModal();
    alert('Timesheet logged and submitted.');
    navigate('timesheets');
  } catch (err) {
    alert(err.message);
  }
}

// ----------------------------------------------------
// 9. HELPDESK TICKETS
// ----------------------------------------------------
async function renderHelpdesk() {
  const main = document.getElementById('mainContent');
  const tickets = await api('/api/helpdesk');

  main.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Helpdesk Support</h1>
        <div class="page-sub">IT, HR, Admin, and Facilities service requests.</div>
      </div>
      <button class="btn btn-primary" onclick="openRaiseTicketModal()">🎫 Raise Support Ticket</button>
    </div>

    <div style="display:flex; flex-direction:column; gap:16px;">
      ${tickets.length === 0 ? `
        <div class="card" style="text-align:center; padding:40px; color:#94a3b8;">No support tickets open.</div>
      ` : tickets.map(t => `
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="status-pill status-approved">${t.department}</span>
                <span class="status-pill status-pending">${t.priority} Priority</span>
                <span style="font-size:12px; color:var(--text-muted);">${new Date(t.created_at).toLocaleDateString()}</span>
              </div>
              <h3 style="font-size:16px; font-weight:700; margin: 8px 0 4px;">${t.subject}</h3>
              <p style="font-size:13px; color:var(--text-muted); line-height:1.5;">${t.description}</p>
            </div>
            <span class="status-pill ${t.status === 'RESOLVED' ? 'status-approved' : 'status-pending'}">${t.status}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function openRaiseTicketModal() {
  showModal(`
    <div class="modal-header">
      <div class="modal-title">Raise Support Ticket</div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div style="display:flex; gap:12px;">
        <div class="form-group" style="flex:1;">
          <label class="form-label">Department</label>
          <select id="tkDept" class="form-control">
            <option value="IT Support">IT Support</option>
            <option value="HR Operations">HR Operations</option>
            <option value="Admin & Facilities">Admin & Facilities</option>
            <option value="Finance">Finance</option>
          </select>
        </div>
        <div class="form-group" style="flex:1;">
          <label class="form-label">Priority</label>
          <select id="tkPriority" class="form-control">
            <option value="Low">Low</option>
            <option value="Medium" selected>Medium</option>
            <option value="High">High</option>
            <option value="Urgent">Urgent</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Subject</label>
        <input type="text" id="tkSubject" class="form-control" placeholder="Brief summary of request">
      </div>
      <div class="form-group">
        <label class="form-label">Detailed Description</label>
        <textarea id="tkDesc" class="form-control" rows="3" placeholder="Provide full details..."></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="submitTicket()">Submit Ticket</button>
    </div>
  `);
}

async function submitTicket() {
  const department = document.getElementById('tkDept').value;
  const priority = document.getElementById('tkPriority').value;
  const subject = document.getElementById('tkSubject').value;
  const description = document.getElementById('tkDesc').value;

  try {
    await api('/api/helpdesk', {
      method: 'POST',
      body: JSON.stringify({ department, category: 'General', priority, subject, description })
    });
    closeModal();
    alert('Ticket raised successfully.');
    navigate('helpdesk');
  } catch (err) {
    alert(err.message);
  }
}

// ----------------------------------------------------
// 10. ASSETS INVENTORY
// ----------------------------------------------------
async function renderAssets() {
  const main = document.getElementById('mainContent');
  const assets = await api('/api/assets');

  main.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">My Assigned Assets</h1>
        <div class="page-sub">Company hardware, laptops, and equipment assigned to your custody.</div>
      </div>
    </div>

    <div class="grid-cards">
      ${assets.length === 0 ? `
        <div class="card" style="text-align:center; padding:32px; color:#94a3b8;">No physical assets assigned.</div>
      ` : assets.map(a => `
        <div class="card">
          <div style="font-size:32px; margin-bottom:12px;">💻</div>
          <div class="card-title">${a.asset_tag} (${a.category})</div>
          <div style="font-size:16px; font-weight:700; margin-bottom:4px;">${a.name}</div>
          <div style="font-size:12px; color:var(--text-muted);">Serial: <strong>${a.serial_number}</strong></div>
          <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">Assigned: ${a.assigned_date}</div>

          <div style="margin-top:16px; padding-top:12px; border-top:1px solid var(--border);">
            ${a.acknowledged ? `
              <span class="status-pill status-approved">✓ Policy Acknowledged</span>
            ` : `
              <button class="btn btn-primary" style="width:100%;" onclick="acknowledgeAsset(${a.id})">Acknowledge Receipt</button>
            `}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

async function acknowledgeAsset(assetId) {
  try {
    await api(`/api/assets/${assetId}/acknowledge`, { method: 'POST' });
    alert('Asset receipt and IT policy successfully acknowledged.');
    navigate('assets');
  } catch (err) {
    alert(err.message);
  }
}

// ----------------------------------------------------
// 11. GOALS & PERFORMANCE (PMS)
// ----------------------------------------------------
async function renderPerformance() {
  const main = document.getElementById('mainContent');
  const goals = await api('/api/goals');

  main.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Goals & Performance (PMS)</h1>
        <div class="page-sub">Individual OKRs, target metrics, and quarterly performance reviews.</div>
      </div>
    </div>

    <div style="display:flex; flex-direction:column; gap:16px;">
      ${goals.map(g => {
        const pct = Math.min(100, Math.round((g.current_value / g.target_value) * 100));
        return `
          <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <div>
                <h3 style="font-size:16px; font-weight:700;">${g.title}</h3>
                <p style="font-size:13px; color:var(--text-muted); margin-top:4px;">${g.description}</p>
                <div style="font-size:12px; color:var(--text-muted); margin-top:8px;">Target: <strong>${g.target_value} ${g.target_metric}</strong> • Due: ${g.due_date}</div>
              </div>
              <span class="status-pill status-${g.status.toLowerCase().replace('_', '-')}">${g.status.replace('_', ' ')}</span>
            </div>

            <div style="margin-top:16px;">
              <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:6px; font-weight:600;">
                <span>Progress: ${g.current_value} / ${g.target_value} ${g.target_metric}</span>
                <span>${pct}%</span>
              </div>
              <div style="background:var(--border); height:8px; border-radius:999px; overflow:hidden;">
                <div style="background:var(--primary); height:100%; width:${pct}%;"></div>
              </div>
            </div>

            <div style="margin-top:16px; text-align:right;">
              <button class="btn btn-secondary" style="font-size:11px; padding:4px 10px;" onclick="openUpdateGoalModal(${g.id}, ${g.current_value}, '${g.status}', ${g.target_value})">Update Progress</button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function openUpdateGoalModal(goalId, curr, status, max) {
  showModal(`
    <div class="modal-header">
      <div class="modal-title">Update Goal Progress</div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Current Metric Value</label>
        <input type="number" id="goalVal" class="form-control" value="${curr}" max="${max}">
      </div>
      <div class="form-group">
        <label class="form-label">Status Tag</label>
        <select id="goalStatus" class="form-control">
          <option value="NOT_STARTED" ${status === 'NOT_STARTED' ? 'selected' : ''}>Not Started</option>
          <option value="IN_PROGRESS" ${status === 'IN_PROGRESS' ? 'selected' : ''}>In Progress</option>
          <option value="AT_RISK" ${status === 'AT_RISK' ? 'selected' : ''}>At Risk</option>
          <option value="COMPLETED" ${status === 'COMPLETED' ? 'selected' : ''}>Completed</option>
        </select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="submitGoalUpdate(${goalId})">Save Progress</button>
    </div>
  `);
}

async function submitGoalUpdate(goalId) {
  const val = document.getElementById('goalVal').value;
  const status = document.getElementById('goalStatus').value;
  try {
    await api(`/api/goals/${goalId}`, {
      method: 'PATCH',
      body: JSON.stringify({ current_value: val, status })
    });
    closeModal();
    navigate('performance');
  } catch (err) {
    alert(err.message);
  }
}

// ----------------------------------------------------
// 12. LEARNING (LMS)
// ----------------------------------------------------
async function renderLearning() {
  const main = document.getElementById('mainContent');
  const courses = await api('/api/courses');

  main.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Learning & Development</h1>
        <div class="page-sub">Skill enhancement, compliance certifications, and engineering courses.</div>
      </div>
    </div>

    <div class="grid-cards">
      ${courses.map(c => `
        <div class="card">
          <span class="status-pill status-approved">${c.category}</span>
          <h3 style="font-size:16px; font-weight:700; margin:10px 0 6px;">${c.title}</h3>
          <div style="font-size:12px; color:var(--text-muted); margin-bottom:16px;">⏱️ ${c.duration_mins} mins • ${c.lessons_count} Lessons</div>

          <div>
            <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:6px; font-weight:600;">
              <span>Progress</span>
              <span>${c.progress_percent}%</span>
            </div>
            <div style="background:var(--border); height:8px; border-radius:999px; overflow:hidden;">
              <div style="background:var(--success); height:100%; width:${c.progress_percent}%;"></div>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ----------------------------------------------------
// 13. ENGAGE WALL & ANNOUNCEMENTS
// ----------------------------------------------------
async function renderEngage() {
  const main = document.getElementById('mainContent');
  const feed = await api('/api/announcements');

  main.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Company Wall & Engagement</h1>
        <div class="page-sub">Celebrations, team kudos, executive updates, and peer polls.</div>
      </div>
      <button class="btn btn-primary" onclick="openNewPostModal()">📢 Post Announcement</button>
    </div>

    <div style="display:flex; flex-direction:column; gap:16px;">
      ${feed.map(post => `
        <div class="card">
          <div style="display:flex; gap:14px; align-items:flex-start;">
            <img src="${post.author_avatar}" class="user-avatar" style="width:48px; height:48px;">
            <div style="flex:1;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <div style="font-weight:700; font-size:16px;">${post.author_name}</div>
                  <div style="font-size:12px; color:var(--text-muted);">${new Date(post.created_at).toLocaleDateString()}</div>
                </div>
                <span class="status-pill status-approved">${post.category}</span>
              </div>
              <h4 style="font-size:16px; font-weight:700; margin: 12px 0 6px;">${post.title}</h4>
              <p style="font-size:14px; line-height:1.5; color:var(--text-main);">${post.content}</p>
              
              <div style="margin-top:16px; padding-top:12px; border-top:1px solid var(--border); display:flex; align-items:center; gap:12px; font-size:13px; color:var(--text-muted);">
                <span>❤️ ${post.likes_count} Likes</span>
                <span>💬 4 Comments</span>
              </div>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function openNewPostModal() {
  showModal(`
    <div class="modal-header">
      <div class="modal-title">New Wall Post</div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Title / Heading</label>
        <input type="text" id="postTitle" class="form-control" placeholder="Announcement title">
      </div>
      <div class="form-group">
        <label class="form-label">Category</label>
        <select id="postCat" class="form-control">
          <option value="Company Update">Company Update</option>
          <option value="Recognition">Peer Recognition</option>
          <option value="Celebration">Celebration</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Content</label>
        <textarea id="postContent" class="form-control" rows="4" placeholder="Share your message..."></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="submitPost()">Publish Post</button>
    </div>
  `);
}

async function submitPost() {
  const title = document.getElementById('postTitle').value;
  const category = document.getElementById('postCat').value;
  const content = document.getElementById('postContent').value;
  try {
    await api('/api/announcements', {
      method: 'POST',
      body: JSON.stringify({ title, category, content })
    });
    closeModal();
    navigate('engage');
  } catch (err) {
    alert(err.message);
  }
}

// ----------------------------------------------------
// 14. SETTINGS & POLICIES
// ----------------------------------------------------
async function renderSettings() {
  const main = document.getElementById('mainContent');
  const settings = await api('/api/settings');

  main.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Settings & Policy Rules</h1>
        <div class="page-sub">Configure leave routing, geofence rules, and approval policies.</div>
      </div>
    </div>

    <div class="card" style="max-width:700px;">
      <h3 style="font-size:16px; font-weight:700; margin-bottom:16px;">Corporate Tenant Configuration</h3>
      ${settings.map(s => `
        <div style="margin-bottom:18px; padding-bottom:14px; border-bottom:1px solid var(--border);">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-weight:700; font-size:14px;">${s.key.replace(/_/g, ' ').toUpperCase()}</div>
              <div style="font-size:12px; color:var(--text-muted);">${s.description}</div>
            </div>
            ${currentUser.role === 'hr_admin' ? `
              <input type="text" class="form-control" style="width:200px;" value="${s.value}" onchange="saveSetting('${s.key}', this.value)">
            ` : `
              <span class="status-pill status-approved">${s.value}</span>
            `}
          </div>
        </div>
      `).join('')}

      ${currentUser.role !== 'hr_admin' ? `
        <div style="font-size:12px; color:#b45309; background:#fffbeb; padding:10px; border-radius:6px;">
          Note: Only HR Administrators (e.g. Eva Green) can edit corporate tenant policies.
        </div>
      ` : ''}
    </div>
  `;
}

async function saveSetting(key, value) {
  try {
    await api('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify({ key, value })
    });
    alert(`Setting '${key}' updated to '${value}'.`);
  } catch (err) {
    alert(err.message);
  }
}

// ----------------------------------------------------
// Global Modal Utilities
// ----------------------------------------------------
function showModal(html) {
  const container = document.getElementById('modalContainer');
  container.innerHTML = `
    <div class="modal-overlay" onclick="handleOverlayClick(event)">
      <div class="modal" onclick="event.stopPropagation()">
        ${html}
      </div>
    </div>
  `;
}

function closeModal() {
  document.getElementById('modalContainer').innerHTML = '';
}

function handleOverlayClick(e) {
  if (e.target.classList.contains('modal-overlay')) {
    closeModal();
  }
}

// Initial Boot
window.addEventListener('DOMContentLoaded', () => {
  // Boot with demo user 3 (Alice Chen)
  switchDemoUser('3');
});
