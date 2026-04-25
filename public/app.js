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
let adminNotifications = [];
let pendingRequest = null; // Stores current request being built

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
                showScreen('screenSignUp');
            }
        });
}

// ============ SCREEN NAVIGATION ============
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) { el.classList.add('active'); }
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
    if (!name || !phone || !selectedRole) { alert('Please fill all fields and select a role.'); return; }

    const userDocRef = window.firestoreDoc(window.db, 'users', currentUser.uid);
    window.firestoreSetDoc(userDocRef, {
        name, phone, email: currentUser.email, role: selectedRole,
        createdAt: window.serverTimestamp()
    }).then(() => {
        currentRole = selectedRole;
        if (selectedRole === 'admin') showScreen('screenAdminSetup');
        else showScreen('screenEmployeeJoin');
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
    if (!companyName || !adminPassword) { alert('Enter company name and admin password.'); return; }

    const prefix = companyName.replace(/\s+/g, '').substring(0, 8).toUpperCase();
    companyCode = prefix + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();

    window.firestoreSetDoc(window.firestoreDoc(window.db, 'companies', companyCode), {
        name: companyName, adminPassword: adminPassword, createdBy: currentUser.uid,
        createdAt: window.serverTimestamp()
    }).then(() => {
        return window.firestoreUpdateDoc(window.firestoreDoc(window.db, 'users', currentUser.uid), {
            companyCode, companyName
        });
    }).then(() => {
        document.getElementById('companyCodeDisplay').textContent = companyCode;
        document.getElementById('companyCreatedBox').classList.remove('hidden');
    });
}

function copyCode() { navigator.clipboard.writeText(companyCode).then(() => alert('✅ Company code copied!')); }

function verifyCompanyCodeForAdmin() {
    const code = document.getElementById('joinCodeAdminInput').value.trim();
    if (!code) { alert('Enter company code.'); return; }
    window.firestoreGetDoc(window.firestoreDoc(window.db, 'companies', code)).then((docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            companyCode = code; companyName = data.name; adminPassword = data.adminPassword;
            document.getElementById('foundCompanyMsg').innerHTML = `✅ Company Found: <strong>${companyName}</strong>`;
            document.getElementById('adminPasswordPrompt').classList.remove('hidden');
        } else { alert('❌ Company not found.'); }
    });
}

function joinAsAdmin() {
    const pass = document.getElementById('joinAdminPasswordInput').value.trim();
    if (!pass) { alert('Enter admin password.'); return; }
    if (pass !== adminPassword) { alert('❌ Wrong admin password!'); return; }
    window.firestoreUpdateDoc(window.firestoreDoc(window.db, 'users', currentUser.uid), {
        companyCode, companyName, role: 'admin'
    }).then(() => { currentRole = 'admin'; loadAdminDashboard(); });
}

function goToAdminDashboard() { loadAdminDashboard(); }

// ============ EMPLOYEE JOIN ============
function findCompanyEmployee() {
    const code = document.getElementById('joinCodeEmpInput').value.trim();
    if (!code) { alert('Enter company code.'); return; }
    window.firestoreGetDoc(window.firestoreDoc(window.db, 'companies', code)).then((docSnap) => {
        if (docSnap.exists()) {
            companyCode = code; companyName = docSnap.data().name;
            document.getElementById('foundEmpCompanyName').textContent = companyName;
            document.getElementById('empJoinSection').classList.remove('hidden');
        } else { alert('❌ Company not found.'); }
    });
}

function joinAsEmployee() {
    const dept = document.getElementById('empDeptSelect').value;
    const role = document.getElementById('empRoleInput').value.trim();
    if (!dept || !role) { alert('Select department and enter role.'); return; }
    window.firestoreUpdateDoc(window.firestoreDoc(window.db, 'users', currentUser.uid), {
        companyCode, companyName, role: 'employee', department: dept, jobRole: role
    }).then(() => { currentRole = 'employee'; loadEmployeeDashboard(); });
}

// ============ LOAD ADMIN DASHBOARD ============
function loadAdminDashboard() {
    document.getElementById('adminName').textContent = currentUser.displayName || currentUser.name || 'Admin';
    document.getElementById('adminAvatar').textContent = (currentUser.displayName || currentUser.name || 'A').charAt(0).toUpperCase();
    document.getElementById('adminMainContent').innerHTML = `
        <h1 class="page-title">Admin Dashboard</h1>
        <p class="page-subtitle">${companyName || 'Your Company'}</p>
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-label">Company Code</div><div class="stat-value teal" style="font-size:22px;">${companyCode}</div></div>
            <div class="stat-card"><div class="stat-label">Status</div><div class="stat-value green" style="font-size:20px;">✅ Connected</div></div>
            <div class="stat-card"><div class="stat-label">Notifications</div><div class="stat-value orange" style="font-size:20px;" id="adminNotifCount">0</div></div>
        </div>
        <div id="adminNotifPanel" style="margin-top:16px;"></div>
    `;
    showScreen('screenAdminDashboard');
    renderAdminNotifications();
}

function renderAdminNotifications() {
    const panel = document.getElementById('adminNotifPanel');
    if (!panel) return;
    if (adminNotifications.length === 0) {
        panel.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px;">No employee requests yet.</p>';
    } else {
        panel.innerHTML = adminNotifications.map((n, i) => `
            <div class="request-card">
                <div class="flex-between">
                    <div><strong>${n.employee}</strong> — ${n.department}<br>
                    <span class="badge badge-${n.type==='Sick Leave'?'sick':n.type==='Emergency Leave'?'emergency':'normal'}">${n.type}</span>
                    </div>
                    <span style="font-size:12px;color:var(--text-muted);">${n.days} day(s) — ${n.startDate}${n.endDate !== n.startDate ? ' to ' + n.endDate : ''}</span>
                </div>
                <p style="font-size:11px;color:var(--text-muted);margin-top:4px;">📅 ${n.appliedAt}</p>
            </div>
        `).join('');
    }
    document.getElementById('adminNotifCount').textContent = adminNotifications.length;
}

// ============ LOAD EMPLOYEE DASHBOARD ============
function loadEmployeeDashboard() {
    document.getElementById('empName').textContent = currentUser.displayName || currentUser.name || 'Employee';
    document.getElementById('empAvatar').textContent = (currentUser.displayName || currentUser.name || 'E').charAt(0).toUpperCase();
    document.getElementById('empDeptRole').textContent = (currentUser.department || 'Staff') + (currentUser.jobRole ? ' - ' + currentUser.jobRole : '');
    updateLeaveBalUI();

    document.getElementById('empMainContent').innerHTML = `
        <h1 class="page-title">💬 AI Leave Assistant</h1>
        <p class="page-subtitle">${companyName || 'Your Company'} | Type naturally to request leave</p>
        <div class="chat-deadline-banner hidden" id="deadlineBanner">
            ⛔ Requests closed for today (cut-off 6:00 PM). Results at 8:00 PM. New requests open at 12:00 AM.
        </div>
        <div style="background:var(--gradient-card);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);display:flex;flex-direction:column;height:450px;">
            <div style="padding:14px 20px;border-bottom:1px solid var(--border-subtle);display:flex;align-items:center;gap:10px;">
                <div style="width:36px;height:36px;border-radius:50%;background:var(--gradient-btn-primary);display:flex;align-items:center;justify-content:center;font-size:16px;">🤖</div>
                <div><div style="font-weight:600;font-size:14px;">Aurora AI</div><div style="font-size:10.5px;color:var(--accent-green);" id="chatOnlineStatus">● Online</div></div>
            </div>
            <div style="flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:14px;" id="chatMessages">
                <div class="chat-msg ai"><div class="chat-avatar-sm">🤖</div><div class="chat-bubble">
                    Hello! I'm <strong>Aurora AI</strong>. Request leave by typing:<br>• "I want sick leave"<br>• "Apply emergency leave"<br>• "I need normal leave"<br><br>🟢 Window: <strong>12:00 AM - 6:00 PM</strong><br>⏰ Results: <strong>8:00 PM</strong>
                </div></div>
            </div>
            <div style="padding:14px 20px;border-top:1px solid var(--border-subtle);display:flex;gap:10px;" id="chatInputRow">
                <input type="text" style="flex:1;padding:11px 16px;background:rgba(255,255,255,0.04);border:1.5px solid var(--border-medium);border-radius:9999px;color:var(--text-primary);font-size:13.5px;font-family:var(--font-stack);outline:none;" id="chatInput" placeholder="Type your leave request..." onkeypress="if(event.key==='Enter')sendMessage()">
                <button style="width:40px;height:40px;border-radius:50%;background:var(--gradient-btn-primary);border:none;cursor:pointer;font-size:16px;color:#fff;flex-shrink:0;" onclick="sendMessage()">➤</button>
            </div>
        </div>
        <div style="text-align:center;margin-top:12px;font-size:11px;color:var(--text-muted);">
            🟢 Requests: 12AM - 6PM | 🤖 AI processes at 8:00 PM | ⚠️ Conflicts by department
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
}

// ============ EMPLOYEE TABS ============
function empTab(t) {
    document.querySelectorAll('[id^="empNav"]').forEach(el => el.classList.remove('active'));
    const navEl = document.getElementById('empNav' + t.charAt(0).toUpperCase() + t.slice(1));
    if (navEl) navEl.classList.add('active');
}

// ============ AI CHAT - COMPLETELY REWRITTEN ============
let chatState = 'idle'; // idle | waiting_date | waiting_days | waiting_proof | done
let detectedType = null;
let selectedStartDate = null;
let selectedDays = 1;

function checkCutoff() {
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const cutoff = 18 * 60;
    const banner = document.getElementById('deadlineBanner');
    const inputRow = document.getElementById('chatInputRow');
    const status = document.getElementById('chatOnlineStatus');
    if (banner && inputRow && status) {
        if (mins >= cutoff) {
            banner.classList.remove('hidden');
            inputRow.style.opacity = '0.5'; inputRow.style.pointerEvents = 'none';
            status.textContent = '● Offline (Past 6PM)'; status.style.color = 'var(--accent-red)';
        } else {
            banner.classList.add('hidden');
            inputRow.style.opacity = '1'; inputRow.style.pointerEvents = 'auto';
            status.textContent = '● Online'; status.style.color = 'var(--accent-green)';
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
        addAIMsg('⛔ Requests closed for today (cut-off 6:00 PM). Results at 8:00 PM. New requests open at 12:00 AM.');
        input.value = ''; return;
    }

    addUserMsg(msg);
    input.value = '';

    if (chatState === 'waiting_date') {
        handleDateInput(msg);
    } else if (chatState === 'waiting_days') {
        handleDaysInput(msg);
    } else {
        handleInitialMessage(msg);
    }
}

function handleInitialMessage(msg) {
    const lower = msg.toLowerCase();
    if (/sick|mc|medical|unwell|fever|doctor/.test(lower)) {
        detectedType = 'sick';
        chatState = 'waiting_date';
        addAIMsg('I understand you need <strong>Sick Leave</strong>.<br><br>📅 <strong>Which date do you want to start your leave?</strong><br>Please type in format: <strong>DD/MM/YYYY</strong> (e.g., 25/04/2026)');
    } else if (/emergency|urgent|accident/.test(lower)) {
        detectedType = 'emergency';
        chatState = 'waiting_date';
        addAIMsg('I understand you need <strong>Emergency Leave</strong>.<br><br>📅 <strong>Which date do you want to start your leave?</strong><br>Please type in format: <strong>DD/MM/YYYY</strong> (e.g., 25/04/2026)');
    } else if (/normal|regular|annual|vacation|holiday|day off|leave/.test(lower)) {
        detectedType = 'normal';
        chatState = 'waiting_date';
        addAIMsg('I understand you need <strong>Normal Leave</strong>.<br><br>📅 <strong>Which date do you want to start your leave?</strong><br>Please type in format: <strong>DD/MM/YYYY</strong> (e.g., 25/04/2026)');
    } else {
        addAIMsg('Please specify leave type: <strong>sick leave</strong>, <strong>emergency leave</strong>, or <strong>normal leave</strong>.');
    }
}

function handleDateInput(msg) {
    const dateRegex = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/;
    const match = msg.match(dateRegex);
    
    if (match) {
        const day = parseInt(match[1]);
        const month = parseInt(match[2]);
        const year = parseInt(match[3]);
        selectedStartDate = `${day}/${month}/${year}`;
        
        chatState = 'waiting_days';
        addAIMsg(`✅ Start date: <strong>${selectedStartDate}</strong><br><br>📆 <strong>How many days of leave do you need?</strong><br>Please type a number (e.g., 1, 2, 3...)`);
    } else {
        addAIMsg('❌ I couldn\'t understand that date format.<br>Please type in format: <strong>DD/MM/YYYY</strong><br>Example: <strong>25/04/2026</strong>');
    }
}

function handleDaysInput(msg) {
    const days = parseInt(msg);
    
    if (isNaN(days) || days < 1) {
        addAIMsg('❌ Please enter a valid number of days (e.g., 1, 2, 3...).<br><strong>How many days of leave do you need?</strong>');
        return;
    }
    
    selectedDays = days;
    
    // Calculate end date
    const parts = selectedStartDate.split('/');
    const startDate = new Date(parts[2], parts[1] - 1, parts[0]);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + days - 1);
    const endDateStr = `${endDate.getDate()}/${endDate.getMonth() + 1}/${endDate.getFullYear()}`;
    
    addAIMsg(`✅ <strong>${days} day(s)</strong> of ${detectedType === 'sick' ? 'Sick' : detectedType === 'emergency' ? 'Emergency' : 'Normal'} Leave<br>📅 <strong>${selectedStartDate}</strong>${days > 1 ? ' to <strong>' + endDateStr + '</strong>' : ''}`);
    
    const typeFull = detectedType === 'sick' ? 'Sick Leave' : detectedType === 'emergency' ? 'Emergency Leave' : 'Normal Leave';
    
    if (detectedType === 'sick' || detectedType === 'emergency') {
        chatState = 'waiting_proof';
        addUploadPrompt();
    } else {
        // Normal leave - no proof needed
        submitRequest(typeFull, selectedStartDate, endDateStr, days, false);
    }
}

function addUploadPrompt() {
    const m = document.getElementById('chatMessages');
    const d = document.createElement('div');
    d.className = 'chat-msg ai';
    d.id = 'uploadPromptMsg';
    d.innerHTML = `
        <div class="chat-avatar-sm">🤖</div>
        <div class="chat-bubble">
            <p style="margin-bottom:10px;">📎 <strong>Please upload your proof document:</strong></p>
            <input type="file" id="realFileInput" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style="display:none;" onchange="handleRealFileUpload(this)">
            <button class="btn btn-copy btn-small" onclick="document.getElementById('realFileInput').click()">📁 Choose File from Computer</button>
        </div>
    `;
    m.appendChild(d);
    m.scrollTop = m.scrollHeight;
}

function handleRealFileUpload(input) {
    if (input.files.length > 0) {
        const fileName = input.files[0].name;
        const fileSize = (input.files[0].size / 1024).toFixed(1) + ' KB';
        
        const uploadEl = document.getElementById('uploadPromptMsg');
        if (uploadEl) {
            uploadEl.querySelector('.chat-bubble').innerHTML = `
                <p style="color:var(--accent-green);">✅ <strong>File selected:</strong> ${fileName} (${fileSize})</p>
            `;
        }
        
        setTimeout(() => {
            addAIMsg('✅ Proof received. Submitting your request...');
            const typeFull = detectedType === 'sick' ? 'Sick Leave' : 'Emergency Leave';
            const parts = selectedStartDate.split('/');
            const startDate = new Date(parts[2], parts[1] - 1, parts[0]);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + selectedDays - 1);
            const endDateStr = `${endDate.getDate()}/${endDate.getMonth() + 1}/${endDate.getFullYear()}`;
            
            setTimeout(() => submitRequest(typeFull, selectedStartDate, endDateStr, selectedDays, true), 500);
        }, 600);
    }
}

function submitRequest(typeFull, startDate, endDate, days, hasProof) {
    const now = new Date();
    const appliedAt = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    
    // Save request
    const requestData = {
        employee: currentUser.displayName || currentUser.name || 'Employee',
        employeeId: currentUser.uid,
        department: currentUser.department || 'Unknown',
        companyCode: companyCode,
        type: typeFull,
        startDate: startDate,
        endDate: endDate,
        days: days,
        proof: hasProof,
        status: 'pending',
        appliedAt: appliedAt,
        createdAt: window.serverTimestamp ? window.serverTimestamp() : new Date().toISOString()
    };
    
    // Save to Firestore if available
    if (window.db && window.firestoreAddDoc) {
        window.firestoreAddDoc(window.firestoreCollection(window.db, 'leaveRequests'), requestData);
    }
    
    // Add to admin notifications
    adminNotifications.unshift({
        employee: requestData.employee,
        department: requestData.department,
        type: typeFull,
        startDate: startDate,
        endDate: endDate,
        days: days,
        appliedAt: appliedAt
    });
    
    // Add to employee notifications
    addNotification(typeFull, startDate, endDate, days, 'pending');
    
    // Show confirmation
    addConfirmMsg(typeFull, startDate, endDate, days);
    
    // Update leave balance UI
    if (typeFull === 'Sick Leave') leaveBalances.sickUsed += days;
    else if (typeFull === 'Emergency Leave') leaveBalances.emergencyUsed += days;
    else leaveBalances.normalUsed += days;
    updateLeaveBalUI();
    
    // Reset chat state
    chatState = 'idle';
    detectedType = null;
    selectedStartDate = null;
    selectedDays = 1;
}

function addConfirmMsg(type, startDate, endDate, days) {
    const m = document.getElementById('chatMessages');
    const d = document.createElement('div');
    d.style.cssText = 'background:rgba(48,224,128,0.07);border:1px solid rgba(48,224,128,0.2);border-radius:var(--radius-md);padding:11px 16px;font-size:12.5px;color:var(--accent-green);text-align:center;animation:fadeInUp 0.4s ease;';
    d.innerHTML = `📩 <strong>${type}</strong> — ${days} day(s)<br>📅 ${startDate}${days > 1 ? ' to ' + endDate : ''}<br><br>Request <strong>submitted</strong>. Result by <strong>8:00 PM</strong>.`;
    m.appendChild(d);
    m.scrollTop = m.scrollHeight;
}

// ============ CHAT HELPERS ============
function addUserMsg(t) {
    const m = document.getElementById('chatMessages');
    if (!m) return;
    const d = document.createElement('div');
    d.className = 'chat-msg user';
    d.innerHTML = `<div class="chat-avatar-sm">👤</div><div class="chat-bubble">${esc(t)}</div>`;
    m.appendChild(d); m.scrollTop = m.scrollHeight;
}

function addAIMsg(t) {
    const m = document.getElementById('chatMessages');
    if (!m) return;
    const d = document.createElement('div');
    d.className = 'chat-msg ai';
    d.innerHTML = `<div class="chat-avatar-sm">🤖</div><div class="chat-bubble">${t}</div>`;
    m.appendChild(d); m.scrollTop = m.scrollHeight;
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

// ============ NOTIFICATIONS ============
function addNotification(type, startDate, endDate, days, decision) {
    const now = new Date();
    notifications.unshift({
        type, startDate, endDate, days, decision,
        time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    });
    const badge = document.getElementById('notifBadge');
    if (badge) { badge.textContent = notifications.length; badge.classList.remove('hidden'); }
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
        <div class="notif-item ${n.decision === 'approved' ? 'approved' : n.decision === 'rejected' ? 'rejected' : ''}" style="border-left-color:${n.decision==='pending'?'var(--accent-yellow)':''};">
            <div class="notif-item-title">${n.decision === 'approved' ? '✅ Approved' : n.decision === 'rejected' ? '❌ Rejected' : '📩 Submitted'}: ${n.type}</div>
            <div style="font-size:11px;color:var(--text-secondary);">📅 ${n.startDate}${n.days > 1 ? ' to ' + n.endDate : ''} (${n.days} day(s))</div>
            <div class="notif-item-time">${n.time}</div>
        </div>
    `).join('');
}

document.addEventListener('click', function(e) {
    if (!e.target.closest('.notif-bell-container')) {
        const dd = document.getElementById('notifDropdown');
        if (dd) dd.classList.remove('show');
    }
});

// ============ LOGOUT ============
function logout() {
    window.signOut(window.auth).then(() => {
        currentUser = null; currentRole = null; companyCode = ''; companyName = ''; notifications = []; adminNotifications = [];
        chatState = 'idle'; detectedType = null; selectedStartDate = null; selectedDays = 1;
        showScreen('screenWelcome');
    });
}

console.log('📄 app.js loaded — waiting for Firebase...');