const http = require('node:http');
const assert = require('node:assert');
const server = require('../server');

const TEST_PORT = 3456;
const BASE_URL = `http://localhost:${TEST_PORT}`;

// Helper: HTTP request wrapper
function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, body: parsed, headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, body: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('===============================================================');
  console.log(' RUNNING END-TO-END WORKFLOW & RBAC VERIFICATION SUITE');
  console.log('===============================================================');

  // Start test server
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`✓ Test server listening at ${BASE_URL}\n`);

  try {
    // -----------------------------------------------------------------
    // Step 1: Sign in as Alice (Employee managed by Bob)
    // -----------------------------------------------------------------
    console.log('[Step 1] Signing in as Alice Chen (alice@company.com)...');
    const aliceLogin = await request('POST', '/api/auth/login', {
      email: 'alice@company.com',
      password: 'employee123'
    });
    assert.strictEqual(aliceLogin.status, 200, 'Alice login should succeed');
    const aliceToken = aliceLogin.body.token;
    const aliceId = aliceLogin.body.user.id;
    assert.strictEqual(aliceLogin.body.user.reporting_manager_id, 2, 'Alice must report to Bob (ID: 2)');
    console.log(`  ✓ Logged in as Alice (ID: ${aliceId}, Manager ID: 2, Token: ${aliceToken.slice(0, 8)}...)`);

    // Check Alice initial Casual Leave balance
    const initialBalances = await request('GET', '/api/leave/balances', null, aliceToken);
    const clInitial = initialBalances.body.find(b => b.code === 'CL');
    console.log(`  ✓ Alice initial Casual Leave remaining: ${clInitial.remaining} days (Allocated: ${clInitial.allocated}, Used: ${clInitial.used})`);
    assert(clInitial.remaining >= 2, 'Alice must have at least 2 days of Casual Leave');

    // -----------------------------------------------------------------
    // Step 2: Alice submits a 2-day Casual Leave request
    // -----------------------------------------------------------------
    console.log('\n[Step 2] Alice submits a 2-day Casual Leave request (2026-12-01 to 2026-12-02)...');
    const leaveApplyRes = await request('POST', '/api/leave/apply', {
      leave_type_id: clInitial.leave_type_id,
      start_date: '2026-12-01',
      end_date: '2026-12-02',
      days: 2,
      is_half_day: false,
      reason: 'Personal family event in hometown'
    }, aliceToken);
    assert.strictEqual(leaveApplyRes.status, 201, 'Leave application should return HTTP 201 Created');
    const leaveRequestId = leaveApplyRes.body.request_id;
    console.log(`  ✓ Leave request created with ID: ${leaveRequestId}`);

    // Check Alice pending balance increased
    const aliceBalancesAfterApply = await request('GET', '/api/leave/balances', null, aliceToken);
    const clAfterApply = aliceBalancesAfterApply.body.find(b => b.code === 'CL');
    assert.strictEqual(clAfterApply.pending, clInitial.pending + 2, 'Pending days must increase by 2');
    console.log(`  ✓ Alice Casual Leave pending updated to: ${clAfterApply.pending} days (Remaining: ${clAfterApply.remaining})`);

    // -----------------------------------------------------------------
    // Step 3: Unrelated Manager (David Smith) signs in
    // -----------------------------------------------------------------
    console.log('\n[Step 3] Signing in as UNRELATED Manager David Smith (david@company.com)...');
    const davidLogin = await request('POST', '/api/auth/login', {
      email: 'david@company.com',
      password: 'manager123'
    });
    assert.strictEqual(davidLogin.status, 200, 'David login should succeed');
    const davidToken = davidLogin.body.token;
    console.log(`  ✓ Logged in as David (ID: ${davidLogin.body.user.id}, Role: ${davidLogin.body.user.role})`);

    // David checks his inbox
    console.log('  Checking David inbox for Alice request...');
    const davidInbox = await request('GET', '/api/inbox/pending', null, davidToken);
    assert.strictEqual(davidInbox.status, 200);
    const foundInDavid = davidInbox.body.leaves.find(l => l.id === leaveRequestId);
    assert.strictEqual(foundInDavid, undefined, 'CRITICAL: Alice request MUST NOT appear in David inbox!');
    console.log('  ✓ Verified: Alice leave request is NOT visible to unrelated manager David.');

    // David attempts to directly approve Alice's request via forged API call
    console.log('  David attempts unauthorized approval of Alice request...');
    const davidTamperRes = await request('POST', `/api/inbox/leave/${leaveRequestId}/approve`, {
      remarks: 'Malicious unauthorized approval attempt'
    }, davidToken);
    assert.strictEqual(davidTamperRes.status, 403, 'CRITICAL: Unrelated manager approval MUST return HTTP 403 Forbidden');
    console.log(`  ✓ Verified: Server strictly rejected David attempt with HTTP 403: "${davidTamperRes.body.error}"`);

    // -----------------------------------------------------------------
    // Step 4: Assigned Manager (Bob Martinez) signs in & approves
    // -----------------------------------------------------------------
    console.log('\n[Step 4] Signing in as ASSIGNED Manager Bob Martinez (bob@company.com)...');
    const bobLogin = await request('POST', '/api/auth/login', {
      email: 'bob@company.com',
      password: 'manager123'
    });
    assert.strictEqual(bobLogin.status, 200, 'Bob login should succeed');
    const bobToken = bobLogin.body.token;
    console.log(`  ✓ Logged in as Bob (ID: ${bobLogin.body.user.id}, Role: ${bobLogin.body.user.role})`);

    // Bob checks his inbox
    console.log('  Checking Bob inbox for Alice request...');
    const bobInbox = await request('GET', '/api/inbox/pending', null, bobToken);
    assert.strictEqual(bobInbox.status, 200);
    const foundInBob = bobInbox.body.leaves.find(l => l.id === leaveRequestId);
    assert(foundInBob !== undefined, 'Alice request MUST appear in assigned manager Bob inbox');
    assert.strictEqual(foundInBob.employee_name, 'Alice Chen');
    assert.strictEqual(foundInBob.days, 2);
    console.log(`  ✓ Found in Bob inbox: "${foundInBob.employee_name}" requesting ${foundInBob.days} days (${foundInBob.reason})`);

    // Bob approves Alice's request
    console.log('  Bob approves the leave request...');
    const bobApproveRes = await request('POST', `/api/inbox/leave/${leaveRequestId}/approve`, {
      remarks: 'Approved. Enjoy your time off Alice!'
    }, bobToken);
    assert.strictEqual(bobApproveRes.status, 200, 'Bob approval should return HTTP 200 OK');
    assert.strictEqual(bobApproveRes.body.status, 'APPROVED');
    console.log('  ✓ Bob approved Alice leave request successfully.');

    // -----------------------------------------------------------------
    // Step 5: Alice signs in again to verify the decision & balances
    // -----------------------------------------------------------------
    console.log('\n[Step 5] Alice Chen signs in again to verify decision and updated balance...');
    const aliceRecheck = await request('GET', '/api/leave/requests', null, aliceToken);
    const approvedRequest = aliceRecheck.body.find(r => r.id === leaveRequestId);
    assert(approvedRequest, 'Alice request must exist in leave history');
    assert.strictEqual(approvedRequest.status, 'APPROVED', 'Request status must be APPROVED');
    assert.strictEqual(approvedRequest.approver_name, 'Bob Martinez', 'Approver name must show Bob Martinez');
    console.log(`  ✓ Alice sees request status: APPROVED by ${approvedRequest.approver_name}`);

    // Verify balance deduction
    const finalBalances = await request('GET', '/api/leave/balances', null, aliceToken);
    const clFinal = finalBalances.body.find(b => b.code === 'CL');
    console.log(`  ✓ Final Casual Leave: Remaining: ${clFinal.remaining} days | Used: ${clFinal.used} days | Pending: ${clFinal.pending} days`);
    assert.strictEqual(clFinal.used, clInitial.used + 2, 'Used days must increase by 2');
    assert.strictEqual(clFinal.remaining, clInitial.remaining - 2, 'Remaining days must decrease by 2');
    assert.strictEqual(clFinal.pending, 0, 'Pending days must reset to 0');
    console.log('  ✓ Verified: Balance accurately decremented by 2 days.');

    console.log('\n===============================================================');
    console.log(' ALL END-TO-END WORKFLOW & RBAC TESTS PASSED WITH 100% SUCCESS!');
    console.log('===============================================================');

  } catch (err) {
    console.error('\n❌ TEST FAILURE:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
}

runTests();
