// ============ WAIT FOR FIREBASE ============
window.addEventListener('firebase-ready', () => {
    console.log('🚀 Aurora AI starting...');
    initApp();
});

// ============ GLOBAL STATE ============
let currentUser = null;
let currentRole = null;
let selectedRole = null;
let companyCode = '';
let companyName = '';
let adminPassword = '';
let leaveBalances = { sickUsed: 0, sickTotal: 5, emergencyUsed: 0, emergencyTotal: 2, normalUsed: 0, normalTotal: 10 };
let notifications = [];
let allRequests = [];
let employeeRequests = [];
let lastReqType = '';
let lastReqDate = '';

// ============ INIT ============
function initApp() {
    window.onAuthStateChanged(window.auth, (user) => {
        if (user) {
            currentUser = user;
            console.log('👤 Signed in:', user.email);
            checkUserExists(user.uid);
        } else {
            console.log('👤 No user');
            showScreen('screenWelcome');
        }
    });

    document.getElementById('googleSignInBtn').addEventListener('click', googleSignIn);
}

// ============ GOOGLE SIGN IN ============
function googleSignIn() {
    const provider = new window.GoogleAuthProvider();
    window.signInWithPopup(window.auth, provider)
        .then((result) => {
            currentUser = result.user;
            console.log('✅ Signed in:', result.user.email);
            checkUserExists(result.user.uid);
        })
        .catch((error) => {
            console.error('❌ Sign in error:', error);
            alert('Sign in failed: ' + error.message);
        });
}

// ============ CHECK USER EXISTS ============
function checkUserExists(uid) {
    const userDocRef = window.firestoreDoc(window.db, 'users', uid);
    window.firestoreGetDoc(userDocRef)
        .then((docSnap) => {
            if (docSnap.exists()) {
                const userData = docSnap.data();
                currentRole = userData.role;
                currentUser = { ...currentUser, ...userData };
                console.log('📂 Existing user, role:', userData.role);

                if (userData.role === 'admin') {
                    companyCode = userData.companyCode || '';
                    companyName = userData.companyName || '';
                    loadAdminDashboard();
                } else {
                    companyCode = userData.companyCode || '';
                    companyName = userData.companyName || '';
                    loadEmployeeDashboard();
                }
            } else {
                console.log('🆕 New user — show sign up');
                showScreen('screenSignUp');
            }
        })
        .catch((error) => {
            console.error('Error:', error);
        });
}

// ============ SCREEN NAVIGATION ============
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) {
        el.classList.add('active');
        el.style.animation = 'none';
        el.offsetHeight;
        el.style.animation = 'fadeInUp 0.45s ease';
    }
}

// ============ SELECT ROLE ============
function selectRole(r) {
    selectedRole = r;
    document.getElementById('roleCardAdmin').classList.toggle('selected', r === 'admin');
    document.getElementById('roleCardEmployee').classList.toggle('selected', r === 'employee');
}

// ============ SIGN UP ============
function completeSignUp() {
    const name = document.getElementById('signUpName').value.trim();
    const phone = document.getElementById('signUpPhone').value.trim();

    if (!name || !phone || !selectedRole) {
        alert('Please fill all fields and select a role.');
        return;
    }

    const userDocRef = window.firestoreDoc(window.db, 'users', currentUser.uid);
    window.firestoreSetDoc(userDocRef, {
        name: name,
        phone: phone,
        email: currentUser.email,
        role: selectedRole,
        createdAt: window.serverTimestamp()
    }).then(() => {
        console.log('✅ User saved');
        currentRole = selectedRole;
        if (selectedRole === 'admin') {
            showScreen('screenAdminSetup');
        } else {
            showScreen('screenEmployeeJoin');
        }
    }).catch((error) => {
        console.error('❌ Error saving:', error);
        alert('Error. Try again.');
    });
}

// ============ ADMIN: CREATE COMPANY ============
function showCreateCompany() {
    document.getElementById('createCompanySection').classList.remove('hidden');
    document.getElementById('joinCompanyAsAdminSection').classList.add('hidden');
    document.getElementById('adminChoiceCreate').classList.add('selected');
    document.getElementById('adminChoiceJoin').classList.remove('selected');
}

function showJoinCompanyAsAdmin() {
    document.getElementById('joinCompanyAsAdminSection').classList.remove('hidden');
    document.getElementById('createCompanySection').classList.add('hidden');
    document.getElementById('adminChoiceJoin').classList.add('selected');
    document.getElementById('adminChoiceCreate').classList.remove('selected');
}

function createCompany() {
    companyName = document.getElementById('companyNameInput').value.trim();
    adminPassword = document.getElementById('adminPasswordInput').value.trim();

    if (!companyName || !adminPassword) {
        alert('Enter company name and admin password.');
        return;
    }

    const prefix = companyName.replace(/\s+/g, '').substring(0, 8).toUpperCase();
    companyCode = prefix + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();

    const companyDocRef = window.firestoreDoc(window.db, 'companies', companyCode);
    window.firestoreSetDoc(companyDocRef, {
        name: companyName,
        adminPassword: adminPassword,
        createdBy: currentUser.uid,
        createdAt: window.serverTimestamp()
    }).then(() => {
        const userDocRef = window.firestoreDoc(window.db, 'users', currentUser.uid);
        return window.firestoreUpdateDoc(userDocRef, {
            companyCode: companyCode,
            companyName: companyName
        });
    }).then(() => {
        console.log('✅ Company created:', companyCode);
        document.getElementById('companyCodeDisplay').textContent = companyCode;
        document.getElementById('companyCreatedBox').classList.remove('hidden');
    }).catch((error) => {
        console.error('❌ Error:', error);
        alert('Error creating company.');
    });
}

function copyCode() {
    navigator.clipboard.writeText(companyCode).then(() => {
        alert('✅ Company code copied!');
    });
}

// ============ ADMIN: JOIN COMPANY ============
function verifyCompanyCodeForAdmin() {
    const code = document.getElementById('joinCodeAdminInput').value.trim();
    if (!code) { alert('Enter company code.'); return; }

    const companyDocRef = window.firestoreDoc(window.db, 'companies', code);
    window.firestoreGetDoc(companyDocRef)
        .then((docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                companyCode = code;
                companyName = data.name;
                adminPassword = data.adminPassword;
                document.getElementById('foundCompanyMsg').innerHTML = `✅ Company Found: <strong>${companyName}</strong>`;
                document.getElementById('adminPasswordPrompt').classList.remove('hidden');
            } else {
                alert('❌ Company not found.');
            }
        });
}

function joinAsAdmin() {
    const pass = document.getElementById('joinAdminPasswordInput').value.trim();
    if (!pass) { alert('Enter admin password.'); return; }
    if (pass !== adminPassword) { alert('❌ Wrong admin password!'); return; }

    const userDocRef = window.firestoreDoc(window.db, 'users', currentUser.uid);
    window.firestoreUpdateDoc(userDocRef, {
        companyCode: companyCode,
        companyName: companyName,
        role: 'admin'
    }).then(() => {
        currentRole = 'admin';
        console.log('✅ Joined as admin');
        loadAdminDashboard();
    });
}

function goToAdminDashboard() {
    loadAdminDashboard();
}

// ============ EMPLOYEE JOIN ============
function findCompanyEmployee() {
    const code = document.getElementById('joinCodeEmpInput').value.trim();
    if (!code) { alert('Enter company code.'); return; }

    const companyDocRef = window.firestoreDoc(window.db, 'companies', code);
    window.firestoreGetDoc(companyDocRef)
        .then((docSnap) => {
            if (docSnap.exists()) {
                companyCode = code;
                companyName = docSnap.data().name;
                document.getElementById('foundEmpCompanyName').textContent = companyName;
                document.getElementById('empJoinSection').classList.remove('hidden');
            } else {
                alert('❌ Company not found.');
            }
        });
}

function joinAsEmployee() {
    const dept = document.getElementById('empDeptSelect').value;
    const role = document.getElementById('empRoleInput').value.trim();
    if (!dept || !role) { alert('Select department and enter role.'); return; }

    const userDocRef = window.firestoreDoc(window.db, 'users', currentUser.uid);
    window.firestoreUpdateDoc(userDocRef, {
        companyCode: companyCode,
        companyName: companyName,
        role: 'employee',
        department: dept,
        jobRole: role
    }).then(() => {
        currentRole = 'employee';
        console.log('✅ Joined as employee');
        loadEmployeeDashboard();
    });
}

// ============ LOAD ADMIN DASHBOARD ============
function loadAdminDashboard() {
    document.getElementById('adminName').textContent = currentUser.displayName || currentUser.name || 'Admin';
    document.getElementById('adminAvatar').textContent = (currentUser.displayName || currentUser.name || 'A').charAt(0).toUpperCase();

    document.getElementById('adminMainContent').innerHTML = `
        <h1 class="page-title">Admin Dashboard</h1>
        <p class="page-subtitle">${companyName || 'Your Company'}</p>
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Company Code</div>
                <div class="stat-value teal" style="font-size:22px;">${companyCode}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Status</div>
                <div class="stat-value green" style="font-size:20px;">✅ Connected</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total Employees</div>
                <div class="stat-value purple" id="statTotalEmp">0</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Pending Requests</div>
                <div class="stat-value" style="color:var(--accent-yellow);" id="statPending">0</div>
            </div>
        </div>
        <div style="background:var(--gradient-card);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);padding:24px;text-align:center;">
            <p style="font-size:40px;margin-bottom:12px;">🛡️</p>
            <h3 style="margin-bottom:6px;">Admin Panel Active</h3>
            <p style="color:var(--text-muted);font-size:13px;">Full features: Employee management, leave approvals, conflict resolution.</p>
        </div>
    `;
    showScreen('screenAdminDashboard');
}

// ============ LOAD EMPLOYEE DASHBOARD ============
function loadEmployeeDashboard() {
    document.getElementById('empName').textContent = currentUser.displayName || currentUser.name || 'Employee';
    document.getElementById('empAvatar').textContent = (currentUser.displayName || currentUser.name || 'E').charAt(0).toUpperCase();
    document.getElementById('empDeptRole').textContent = currentUser.department || 'Staff';

    updateLeaveBalUI();

    document.getElementById('empMainContent').innerHTML = `
        <h1 class="page-title">💬 AI Leave Assistant</h1>
        <p class="page-subtitle">${companyName || 'Your Company'} | Type naturally to request leave</p>
        <div class="chat-deadline-banner hidden" id="deadlineBanner" style="background:rgba(255,80,96,0.08);border:1px solid rgba(255,80,96,0.3);border-radius:var(--radius-md);padding:10px 16px;text-align:center;font-size:12px;color:var(--accent-red);margin-bottom:12px;">
            ⛔ Requests closed for today (cut-off 6:00 PM). Results at 8:00 PM.
        </div>
        <div style="background:var(--gradient-card);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);display:flex;flex-direction:column;height:450px;">
            <div style="padding:14px 20px;border-bottom:1px solid var(--border-subtle);display:flex;align-items:center;gap:10px;">
                <div style="width:36px;height:36px;border-radius:50%;background:var(--gradient-btn-primary);display:flex;align-items:center;justify-content:center;font-size:16px;">🤖</div>
                <div>
                    <div style="font-weight:600;font-size:14px;">Aurora AI</div>
                    <div style="font-size:10.5px;color:var(--accent-green);" id="chatOnlineStatus">● Online</div>
                </div>
            </div>
            <div style="flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:14px;" id="chatMessages">
                <div style="display:flex;gap:8px;max-width:82%;">
                    <div style="width:28px;height:28px;border-radius:50%;background:var(--accent-purple);display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;">🤖</div>
                    <div style="padding:11px 16px;border-radius:18px;font-size:13.5px;background:rgba(139,108,255,0.14);border:1px solid rgba(139,108,255,0.2);border-bottom-left-radius:5px;">
                        Hello! I'm <strong>Aurora AI</strong>. Request leave by typing:<br>
                        • "I want sick leave"<br>
                        • "Apply emergency leave"<br>
                        • "I need normal leave"<br><br>
                        ⏰ Cut-off: <strong>6:00 PM</strong> | Results: <strong>8:00 PM</strong>
                    </div>
                </div>
            </div>
            <div style="padding:14px 20px;border-top:1px solid var(--border-subtle);display:flex;gap:10px;" id="chatInputRow">
                <input type="text" style="flex:1;padding:11px 16px;background:rgba(255,255,255,0.04);border:1.5px solid var(--border-medium);border-radius:9999px;color:var(--text-primary);font-size:13.5px;font-family:var(--font-stack);outline:none;" id="chatInput" placeholder="Type your leave request..." onkeypress="if(event.key==='Enter')sendMessage()">
                <button style="width:40px;height:40px;border-radius:50%;background:var(--gradient-btn-primary);border:none;cursor:pointer;font-size:16px;color:#fff;flex-shrink:0;" onclick="sendMessage()">➤</button>
            </div>
        </div>
        <div style="text-align:center;margin-top:12px;font-size:11px;color:var(--text-muted);">
            🤖 AI auto-approves at 8:00 PM | ⚠️ Conflicts resolved by admin
        </div>
    `;
    showScreen('screenEmployeeDashboard');
    checkCutoff();
}

// ============ LEAVE BALANCE UI ============
function updateLeaveBalUI() {
    document.getElementById('sickCount').textContent = leaveBalances.sickTotal - leaveBalances.sickUsed;
    document.getElementById('emergencyCount').textContent = leaveBalances.emergencyTotal - leaveBalances.emergencyUsed;
    document.getElementById('normalCount').textContent = leaveBalances.normalTotal - leaveBalances.normalUsed;
}

// ============ ADMIN TABS ============
function adminTab(t) {
    document.querySelectorAll('[id^="adminNav"]').forEach(el => el.classList.remove('active'));
    const navEl = document.getElementById('adminNav' + t.charAt(0).toUpperCase() + t.slice(1));
    if (navEl) navEl.classList.add('active');
    console.log('Admin tab:', t);
}

// ============ EMPLOYEE TABS ============
function empTab(t) {
    document.querySelectorAll('[id^="empNav"]').forEach(el => el.classList.remove('active'));
    const navEl = document.getElementById('empNav' + t.charAt(0).toUpperCase() + t.slice(1));
    if (navEl) navEl.classList.add('active');
    console.log('Employee tab:', t);
}

// ============ AI CHAT ============
function checkCutoff() {
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const cutoff = 18 * 60; // 6:00 PM
    const banner = document.getElementById('deadlineBanner');
    const inputRow = document.getElementById('chatInputRow');
    const status = document.getElementById('chatOnlineStatus');

    if (banner && inputRow && status) {
        if (mins >= cutoff) {
            banner.classList.remove('hidden');
            inputRow.style.opacity = '0.5';
            inputRow.style.pointerEvents = 'none';
            status.textContent = '● Offline (Past 6PM)';
            status.style.color = 'var(--accent-red)';
        } else {
            banner.classList.add('hidden');
            inputRow.style.opacity = '1';
            inputRow.style.pointerEvents = 'auto';
            status.textContent = '● Online';
            status.style.color = 'var(--accent-green)';
        }
    }
}

function sendMessage() {
    const input = document.getElementById('chatInput');
    if (!input) return;
    const msg = input.value.trim();
    if (!msg) return;

    const now = new Date();
    if (now.getHours() * 60 + now.getMinutes() >= 18 * 60) {
        addAIMsg('⛔ Requests closed for today (cut-off 6:00 PM). Results at 8:00 PM.');
        input.value = '';
        return;
    }

    addUserMsg(msg);
    input.value = '';
    setTimeout(() => processAI(msg), 500 + Math.random() * 600);
}

function addUserMsg(t) {
    const m = document.getElementById('chatMessages');
    if (!m) return;
    const d = document.createElement('div');
    d.style.cssText = 'display:flex;gap:8px;max-width:82%;align-self:flex-end;flex-direction:row-reverse;animation:fadeInUp 0.3s ease;';
    d.innerHTML = `<div style="width:28px;height:28px;border-radius:50%;background:var(--accent-teal);display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;">👤</div><div style="padding:11px 16px;border-radius:18px;font-size:13.5px;background:rgba(0,224,176,0.12);border:1px solid rgba(0,224,176,0.2);border-bottom-right-radius:5px;">${esc(t)}</div>`;
    m.appendChild(d);
    m.scrollTop = m.scrollHeight;
}

function addAIMsg(t) {
    const m = document.getElementById('chatMessages');
    if (!m) return;
    const d = document.createElement('div');
    d.style.cssText = 'display:flex;gap:8px;max-width:82%;animation:fadeInUp 0.3s ease;';
    d.innerHTML = `<div style="width:28px;height:28px;border-radius:50%;background:var(--accent-purple);display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;">🤖</div><div style="padding:11px 16px;border-radius:18px;font-size:13.5px;background:rgba(139,108,255,0.14);border:1px solid rgba(139,108,255,0.2);border-bottom-left-radius:5px;">${t}</div>`;
    m.appendChild(d);
    m.scrollTop = m.scrollHeight;
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function processAI(msg) {
    const lower = msg.toLowerCase();
    let type = null;
    if (/sick|mc|medical|unwell|fever|doctor/.test(lower)) type = 'sick';
    else if (/emergency|urgent|accident/.test(lower)) type = 'emergency';
    else if (/normal|regular|annual|vacation|holiday|day off|leave/.test(lower)) type = 'normal';

    if (!type) {
        addAIMsg('Please specify: <strong>sick leave</strong>, <strong>emergency leave</strong>, or <strong>normal leave</strong>.');
        return;
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    lastReqDate = dateStr;
    lastReqType = type === 'sick' ? 'Sick Leave' : type === 'emergency' ? 'Emergency Leave' : 'Normal Leave';
    const full = lastReqType;

    if (type === 'sick' || type === 'emergency') {
        addAIMsg(`I understand — <strong>${full}</strong> on <strong>${dateStr}</strong>. Please upload proof.`);
        setTimeout(() => addUploadBtn(), 500);
        if (type === 'sick') leaveBalances.sickUsed++;
        else leaveBalances.emergencyUsed++;
        updateLeaveBalUI();
    } else {
        addAIMsg(`Got it — <strong>Normal Leave</strong> on <strong>${dateStr}</strong>. No proof needed. Submitted.`);
        leaveBalances.normalUsed++;
        updateLeaveBalUI();
        setTimeout(() => addConfirmMsg(), 500);
    }
}

function addUploadBtn() {
    const m = document.getElementById('chatMessages');
    if (!m) return;
    const d = document.createElement('div');
    d.style.cssText = 'display:flex;gap:8px;max-width:82%;animation:fadeInUp 0.3s ease;';
    d.id = 'uploadMsg';
    d.innerHTML = `<div style="width:28px;height:28px;border-radius:50%;background:var(--accent-purple);display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;">🤖</div><div style="padding:11px 16px;border-radius:18px;font-size:13.5px;background:rgba(139,108,255,0.14);border:1px solid rgba(139,108,255,0.2);border-bottom-left-radius:5px;"><p style="margin-bottom:8px;">📎 Upload proof:</p><button class="btn btn-copy btn-small" onclick="simulateUpload()">📁 Choose File</button></div>`;
    m.appendChild(d);
    m.scrollTop = m.scrollHeight;
}

function simulateUpload() {
    const el = document.getElementById('uploadMsg');
    if (el) el.querySelector('div:last-child').innerHTML = '<p style="color:var(--accent-green);">✅ Proof uploaded (document.pdf)</p>';
    setTimeout(() => { addAIMsg('Proof attached. Request <strong>submitted</strong>.'); setTimeout(addConfirmMsg, 600); }, 400);
}

function addConfirmMsg() {
    const m = document.getElementById('chatMessages');
    if (!m) return;
    const d = document.createElement('div');
    d.style.cssText = 'background:rgba(48,224,128,0.07);border:1px solid rgba(48,224,128,0.2);border-radius:var(--radius-md);padding:11px 16px;font-size:12.5px;color:var(--accent-green);text-align:center;animation:fadeInUp 0.4s ease;';
    d.innerHTML = '📩 Request <strong>in process</strong>. Result by <strong>8:00 PM</strong>. Check My Requests.';
    m.appendChild(d);
    m.scrollTop = m.scrollHeight;
}

// ============ NOTIFICATIONS ============
function addNotification(type, date, decision) {
    const now = new Date();
    notifications.unshift({
        type, date, decision,
        time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    });
    const badge = document.getElementById('notifBadge');
    if (badge) {
        badge.textContent = notifications.length;
        badge.classList.remove('hidden');
    }
    const bell = document.getElementById('notifBell');
    if (bell) { bell.classList.add('ring'); setTimeout(() => bell.classList.remove('ring'), 800); }
    updateNotifDropdown();
}

function toggleNotifications() {
    const dd = document.getElementById('notifDropdown');
    if (dd) dd.classList.toggle('show');
    updateNotifDropdown();
}

function updateNotifDropdown() {
    const dd = document.getElementById('notifDropdown');
    if (!dd) return;
    if (notifications.length === 0) {
        dd.innerHTML = '<p style="padding:12px;color:var(--text-muted);text-align:center;">No notifications yet.</p>';
        return;
    }
    dd.innerHTML = notifications.map(n => `
        <div class="notif-item ${n.decision}">
            <div class="notif-item-title">${n.decision === 'approved' ? '✅ Approved' : '❌ Rejected'}: ${n.type}</div>
            <div style="font-size:11px;color:var(--text-secondary);">${n.date}</div>
            <div class="notif-item-time">${n.time}</div>
        </div>
    `).join('');
}

// Close dropdown on outside click
document.addEventListener('click', function(e) {
    if (!e.target.closest('.notif-bell-container')) {
        const dd = document.getElementById('notifDropdown');
        if (dd) dd.classList.remove('show');
    }
});

// ============ LOGOUT ============
function logout() {
    window.signOut(window.auth).then(() => {
        console.log('👋 Signed out');
        currentUser = null;
        currentRole = null;
        companyCode = '';
        companyName = '';
        notifications = [];
        showScreen('screenWelcome');
    });
}

console.log('📄 app.js loaded — waiting for Firebase...');