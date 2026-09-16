// ==========================================
// 🖥️ app.js - ควบคุม UI หน้าจอ (ลอจิกหน้าบ้านล้วนๆ)
// ==========================================

// ── DOM References ──
const tabHome                   = document.getElementById('tab-home');
const tabStudentCheckin         = document.getElementById('tab-student-checkin');
const tabRegister               = document.getElementById('tab-register');
const tabCheckin                = document.getElementById('tab-checkin');
const tabReport                 = document.getElementById('tab-report');

// Bottom Nav References
const tabBottomHome             = document.getElementById('tab-bottom-home');
const tabBottomStudentCheckin   = document.getElementById('tab-bottom-student-checkin');
const tabBottomStudentHistory   = document.getElementById('tab-bottom-student-history');
const tabBottomReport           = document.getElementById('tab-bottom-report');

const viewHome                  = document.getElementById('view-home');
const viewStudentCheckin        = document.getElementById('view-student-checkin');
const viewRegister              = document.getElementById('view-register');
const viewCheckin               = document.getElementById('view-checkin');
const viewReport                = document.getElementById('view-report');
const studentLoginContainer     = document.getElementById('student-login-container');
const studentDashboardContainer = document.getElementById('student-dashboard-container');
const recordCount               = document.getElementById('record-count');
let toastContainer               = document.getElementById('toast-container');

// ── Theme Switcher Setup ──
function initTheme() {
    const savedTheme = localStorage.getItem('jobone_theme_mode') || 'light';
    setTheme(savedTheme);
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('jobone_theme_mode', theme);
    updateThemeToggleIcons(theme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    showToast(nextTheme === 'dark' ? '🌙 เปลี่ยนเป็นธีมมืด (Dark Mode)' : '☀️ เปลี่ยนเป็นธีมสว่าง (Light Mode)', 'info', 2000);
}

// ── Sidebar Collapsible ──
function initSidebar() {
    const sidebar = document.getElementById('main-sidebar');
    if (!sidebar) return;
    // Only apply on desktop
    if (window.innerWidth <= 768) return;
    const isCollapsed = localStorage.getItem('jobone_sidebar_collapsed') === 'true';
    if (isCollapsed) {
        sidebar.classList.add('collapsed');
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('main-sidebar');
    if (!sidebar) return;
    const willCollapse = !sidebar.classList.contains('collapsed');
    sidebar.classList.toggle('collapsed', willCollapse);
    localStorage.setItem('jobone_sidebar_collapsed', String(willCollapse));
}

function updateThemeToggleIcons(theme) {
    const btns = document.querySelectorAll('.theme-toggle-btn');
    btns.forEach(btn => {
        if (theme === 'dark') {
            btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
            btn.title = 'สลับเป็นธีมสว่าง (Light Mode)';
        } else {
            btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
            btn.title = 'สลับเป็นธีมมืด (Dark Mode)';
        }
    });
}

// Camera modal
const cameraModal    = document.getElementById('camera-modal');
const webcamEl       = document.getElementById('webcam');
const photoCanvas    = document.getElementById('photo-canvas');
const fallbackUpload = document.getElementById('fallback-upload');
const btnCapture     = document.getElementById('btn-capture');
const photoPreviewContainer = document.getElementById('photo-preview-container');
const photoPreviewImg       = document.getElementById('photo-preview');
const btnCameraTrigger      = document.getElementById('btn-camera-trigger');

// Check-in view
const checkinStudentId          = document.getElementById('checkin-student-id');
const studentInfoCard           = document.getElementById('student-info-card');
const studentInfoPhoto          = document.getElementById('student-info-photo');
const studentInfoName           = document.getElementById('student-info-name');
const studentInfoIdEl           = document.getElementById('student-info-id');
const studentTodayStatus        = document.getElementById('student-today-status');
const studentNotFound           = document.getElementById('student-not-found');
const checkinPhotoSection       = document.getElementById('checkin-photo-section');
const checkinPhotoPreviewCon    = document.getElementById('checkin-photo-preview-container');
const checkinPhotoPreview       = document.getElementById('checkin-photo-preview');
const btnCheckinCamera          = document.getElementById('btn-checkin-camera');
const remarkSection             = document.getElementById('remark-section');
const btnOpenRemark             = document.getElementById('btn-open-remark');
const remarkIndicator           = document.getElementById('remark-indicator');
const remarkPreviewText         = document.getElementById('remark-preview-text');
const actionButtons             = document.getElementById('action-buttons');
const btnCheckin                = document.getElementById('btn-checkin');
const btnCheckout               = document.getElementById('btn-checkout');
const devModePanel              = document.getElementById('dev-mode-panel');
const devModeToggle             = document.getElementById('dev-mode-toggle');
const timeWindowIndicator       = document.getElementById('time-window-indicator');
const timeWindowText            = document.getElementById('time-window-text');

// Report view
const attendanceTable   = document.getElementById('attendance-table');
const attendanceTbody   = document.getElementById('attendance-tbody');
const noAttendanceEl    = document.getElementById('no-attendance');
const searchInput       = document.getElementById('search-input');
const reportSummary     = document.getElementById('report-summary');
const remarkModal       = document.getElementById('remark-modal');
const remarkTextarea    = document.getElementById('remark-textarea');

// ── Init เมื่อโหลดหน้าเว็บเสร็จ ──
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initSidebar();
    try {
        const configDoc = await db.collection('config').doc('settings').get();
        if (configDoc.exists) {
            const remoteData = configDoc.data();
            if (remoteData.timeConfig) timeConfig = remoteData.timeConfig;
            if (remoteData.admin_pin) localStorage.setItem('admin_pin', remoteData.admin_pin);
        } else {
            await db.collection('config').doc('settings').set({ timeConfig, admin_pin: '12345678' });
        }
        loadTimeSettingsUI();
    } catch (e) {
        const savedConfig = localStorage.getItem('timeConfig');
        if (savedConfig) timeConfig = JSON.parse(savedConfig);
        loadTimeSettingsUI();
    }

    showToast('🌐 กำลังตรวจสอบการเชื่อมต่อคลาวด์ Firebase...', 'info', 2500);
    const cloudConnected = await syncDataFromFirestore();

    if (cloudConnected) {
        showToast('✅ เชื่อมต่อฐานข้อมูล Firebase สำเร็จ', 'success', 3000);
        startRealtimeSync();
        await migrateLocalDataToCloud();
    } else {
        showToast('❌ ยังไม่ได้เชื่อมต่อกับ Firebase (เปิดใช้โหมดสำรองในเครื่อง)', 'error', 6000);
    }

    updateRecordCount(); updateDashboard(); filterAttendanceRecords(); startClock();
    
    // 🔐 ตรวจสอบสถานะการเข้าสู่ระบบและเริ่มการทำงาน
    checkStudentAuth();

    document.getElementById('clock-time').addEventListener('click', () => {
        devPanelClickCount++;
        if (devPanelClickCount >= 3) {
            devModePanel.classList.remove('hidden'); devPanelClickCount = 0;
            showToast('🔧 Developer Panel เปิดแล้ว', 'info');
        }
        setTimeout(() => { devPanelClickCount = 0; }, 1500);
    });
});

// ── ระบบนาฬิกา ──
function startClock() {
    function tick() {
        const now = new Date();
        const hh  = String(now.getHours()).padStart(2, '0');
        const mm  = String(now.getMinutes()).padStart(2, '0');
        const ss  = String(now.getSeconds()).padStart(2, '0');
        const timeStr = `${hh}:${mm}:${ss}`;
        const dateOpts = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
        const dateStr = now.toLocaleDateString('th-TH', dateOpts);

        const clockTime = document.getElementById('clock-time');
        if (clockTime) clockTime.textContent = timeStr;
        const clockDate = document.getElementById('clock-date');
        if (clockDate) clockDate.textContent = dateStr;

        const sclockTime = document.getElementById('sclock-time');
        if (sclockTime) sclockTime.textContent = timeStr;
        const sclockDate = document.getElementById('sclock-date');
        if (sclockDate) sclockDate.textContent = dateStr;

        updateTimeWindowUI(now);
    }
    tick(); clockInterval = setInterval(tick, 1000);
}

function toMinutes(h, m) { return h * 60 + m; }
function getNowMinutes() { const now = new Date(); return toMinutes(now.getHours(), now.getMinutes()); }
function strToMinutes(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':'); return toMinutes(parseInt(parts[0]) || 0, parseInt(parts[1]) || 0);
}

function getTimeWindow() {
    return 'open';
}

function updateTimeWindowUI(now) {
    const win = getTimeWindow();
    const stimeWindowIndicator = document.getElementById('stime-window-indicator');
    const stimeWindowText = document.getElementById('stime-window-text');

    if (timeWindowIndicator) timeWindowIndicator.className = 'time-window-indicator';
    if (stimeWindowIndicator) stimeWindowIndicator.className = 'time-window-indicator';

    const s = { cls: 'window-open-in', txt: `🟢 ลงเวลาเข้าได้ตลอดเวลา | เดดไลน์ออกงาน ${timeConfig.checkoutDeadline || '18:00'} น.` };
    if (timeWindowIndicator) { timeWindowIndicator.classList.add(s.cls); }
    if (timeWindowText) { timeWindowText.textContent = s.txt; }

    if (stimeWindowIndicator) { stimeWindowIndicator.classList.add(s.cls); }
    if (stimeWindowText) { stimeWindowText.textContent = s.txt; }

    if (currentLookedUpStudent) updateActionButtons();
}

function toggleDevMode(active) {
    devModeActive = active;
    showToast(active ? '🔧 Dev Mode เปิด — bypass เวลาทำงานแล้ว' : '🔧 Dev Mode ปิด — ใช้เวลาจริง', 'info');
    if (currentLookedUpStudent) updateActionButtons();
}

// ── Tab UI ──
async function switchTab(tab) {
    if (tab === 'report' && !isAdminAuthenticated) { openPinModal(); return; }
    const tabs       = { home: tabHome, 'student-checkin': tabStudentCheckin, register: tabRegister, checkin: tabCheckin, report: tabReport };
    const bottomTabs = { home: tabBottomHome, 'student-checkin': tabBottomStudentCheckin, report: tabBottomReport };
    const views      = { home: viewHome, 'student-checkin': viewStudentCheckin, register: viewRegister, checkin: viewCheckin, report: viewReport };

    // 🔒 ควบคุมการแสดงผล tab ใน Sidebar และ Bottom Nav ตามสิทธิ์ผู้ใช้งาน
    const isStudentLoggedIn = !!getStoredStudentAuth();
    if (tabCheckin) {
        tabCheckin.style.display = isAdminAuthenticated ? 'flex' : 'none';
    }
    if (tabReport) {
        tabReport.style.display = isAdminAuthenticated ? 'flex' : 'none';
    }
    if (tabBottomReport) {
        tabBottomReport.style.display = isAdminAuthenticated ? 'flex' : 'none';
    }
    if (tabRegister) {
        tabRegister.style.display = (isAdminAuthenticated || !isStudentLoggedIn) ? 'flex' : 'none';
    }
    if (tabStudentCheckin) {
        tabStudentCheckin.style.display = (isStudentLoggedIn && !isAdminAuthenticated) ? 'flex' : 'none';
    }

    Object.values(tabs).forEach(t => { if (t) t.classList.remove('active'); });
    Object.values(bottomTabs).forEach(t => { if (t) t.classList.remove('active'); });
    Object.values(views).forEach(v => { if (v) v.classList.remove('active'); });

    if (tabs[tab]) tabs[tab].classList.add('active');
    if (bottomTabs[tab]) bottomTabs[tab].classList.add('active');
    if (views[tab]) views[tab].classList.add('active');

    if (tab === 'home') {
        renderStudentHome();
    } else if (tab === 'student-checkin') {
        renderStudentCheckinView();
    } else if (tab === 'report') {
        try { await syncDataFromFirestore(); } catch(e) {}
        filterAttendanceRecords(); updateDashboard(); loadTimeSettingsUI();
    }
}

// ── Toast UI ──
function showToast(message, type = 'success', duration = 3500) {
    let container = document.getElementById('toast-container') || toastContainer;
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
        toastContainer = container;
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span><button class="toast-close-btn" onclick="this.parentElement.remove()">✕</button>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(10px)'; setTimeout(() => toast.remove(), 350); }, duration);
}

function updateRecordCount() { recordCount.textContent = dbStudents.length; }
function getTodayDateStr() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; }
function getTodayRecord(studentId) { const today = getTodayDateStr(); return dbAttendance.find(r => r.studentId === studentId && r.date === today) || null; }

// ── ค้นหานักศึกษาและการลงเวลา UI ──
function lookupStudent() {
    const id = checkinStudentId.value.trim();
    currentLookedUpStudent = null; currentCheckinPhoto = null; currentRemark = '';
    updateRemarkUI(); studentInfoCard.classList.add('hidden'); studentNotFound.classList.add('hidden');
    checkinPhotoSection.classList.add('hidden'); checkinPhotoPreviewCon.classList.add('hidden');
    remarkSection.classList.add('hidden'); actionButtons.classList.add('hidden');

    if (id.length < 2) return;
    const found = dbStudents.find(s => s.studentId === id);
    if (!found) { studentNotFound.classList.remove('hidden'); return; }

    currentLookedUpStudent = found;
    studentInfoPhoto.src = found.photo; studentInfoName.textContent = found.username;
    studentInfoIdEl.textContent = `รหัส: ${found.studentId}`; studentInfoCard.classList.remove('hidden');

    const rec = getTodayRecord(found.studentId);
    if (rec) {
        updateTodayStatusPill(found.studentId); showToast('วันนี้คุณได้ลงเวลาเข้าแล้ว', 'warning');
        if (!rec.checkOut) {
            checkinPhotoSection.classList.remove('hidden'); remarkSection.classList.remove('hidden');
            actionButtons.classList.remove('hidden'); btnCheckout.classList.remove('hidden'); updateActionButtons();
        }
    } else {
        triggerAutoCheckin(found);
    }
}

async function triggerAutoCheckin(student) {
    // 1. ตรวจสอบพื้นที่ด้วย GPS ก่อนลงเวลา
    showToast('📍 กำลังตรวจสอบตำแหน่งสถานที่...', 'info', 2000);
    const locationCheck = await getValidatedAttendanceLocation('เข้า');
    if (!locationCheck.allowed) return;

    // 2. ผ่านเงื่อนไขพื้นที่แล้ว → ลงเวลาเข้าได้ทุกเวลา
    saveAutoCheckinRecord(student, '');
}

function handleCheckIn() { /* Auto check-in is used */ }
function resetCheckinState() {
    currentCheckinPhoto = null; currentRemark = ''; updateRemarkUI();
    checkinPhotoPreviewCon.classList.add('hidden'); checkinPhotoPreview.src = '';
    btnCheckinCamera.querySelector('span').textContent = 'ถ่ายรูปยืนยัน'; btnCheckout.classList.add('hidden'); updateActionButtons();
}

function updateTodayStatusPill(studentId) {
    const rec = getTodayRecord(studentId);
    studentTodayStatus.className = 'today-status-pill';
    if (!rec) { studentTodayStatus.classList.add('status-none'); studentTodayStatus.textContent = 'ยังไม่ลงเวลา'; }
    else if (rec.checkOut) { studentTodayStatus.classList.add('status-checkout'); studentTodayStatus.textContent = `ออกงานแล้ว ${rec.checkOut} น.`; }
    else { studentTodayStatus.classList.add('status-ontime'); studentTodayStatus.textContent = `เข้างานแล้ว ${rec.checkIn} น.`; }
}

function updateActionButtons() {
    if (!currentLookedUpStudent) return;
    const rec  = getTodayRecord(currentLookedUpStudent.studentId);
    if (rec && rec.checkOut) { btnCheckout.disabled = true; return; }
    btnCheckout.disabled = !(rec && !!currentCheckinPhoto);
}

function openRemarkModal() { remarkTextarea.value = currentRemark; remarkModal.classList.add('active'); setTimeout(() => remarkTextarea.focus(), 200); }
function closeRemarkModal() {
    remarkModal.classList.remove('active');
}
function setQuickRemark(text) { remarkTextarea.value = text.slice(0, 5); }
function saveRemark() {
    let val = remarkTextarea.value.trim();
    if (val.length > 5) {
        val = val.slice(0, 5);
    }
    currentRemark = val; closeRemarkModal(); updateRemarkUI();
    if (currentLookedUpStudent) {
        const rec = getTodayRecord(currentLookedUpStudent.studentId);
        if (rec) { rec.remark = val; localStorage.setItem('attendanceRecords', JSON.stringify(dbAttendance)); filterAttendanceRecords(); }
    }
    if (val) showToast('บันทึกหมายเหตุแล้ว ✓', 'success');
}
function updateRemarkUI() {
    if (currentRemark) { btnOpenRemark.classList.add('has-remark'); remarkIndicator.classList.remove('hidden'); remarkPreviewText.textContent = `"${currentRemark}"`; }
    else { btnOpenRemark.classList.remove('has-remark'); remarkIndicator.classList.add('hidden'); remarkPreviewText.textContent = ''; }
    if (currentLookedUpStudent) updateActionButtons();
}

// ── Dashboard & Report UI ──
function updateDashboard() {
    const todayDate = getTodayDateStr();
    document.getElementById('val-total').textContent = dbStudents.length;
    const todayRecords = dbAttendance.filter(r => r.date === todayDate);
    document.getElementById('val-checkin').textContent = todayRecords.filter(r => r.checkIn).length;
    document.getElementById('val-pending').textContent = todayRecords.filter(r => r.checkIn && !r.checkOut).length;
    document.getElementById('val-done').textContent = todayRecords.filter(r => r.checkIn && r.checkOut).length;
    document.getElementById('val-late-leave').textContent = todayRecords.filter(r => r.lateLeaveReason).length;
}

function filterAttendanceRecords() {
    const q = searchInput.value.toLowerCase().trim();
    const filterDate = document.getElementById('filter-date').value;
    const filterStatus = document.getElementById('filter-status').value;
    const reportDate = filterDate || getTodayDateStr();
    const attendanceStudentIds = new Set(
        dbAttendance.filter(record => record.date === reportDate).map(record => record.studentId)
    );
    const missingStudents = dbStudents
        .filter(student => !attendanceStudentIds.has(student.studentId))
        .map(student => ({
            _noAttendance: true,
            studentId: student.studentId,
            name: student.username,
            username: student.username,
            date: reportDate
        }));

    let filtered = [...dbAttendance, ...missingStudents];
    if (q) filtered = filtered.filter(r => (r.name && r.name.toLowerCase().includes(q)) || (r.username && r.username.toLowerCase().includes(q)) || r.studentId.toLowerCase().includes(q));
    if (filterDate) filtered = filtered.filter(r => r.date === filterDate);
    if (filterStatus === 'checked_in') filtered = filtered.filter(r => !r._noAttendance && r.checkIn && !r.checkOut);
    if (filterStatus === 'checked_out') filtered = filtered.filter(r => !r._noAttendance && r.checkIn && r.checkOut);
    renderAttendanceTable(filtered);
}
function filterAttendance() { filterAttendanceRecords(); }

function formatDisplayDate(dateStr) {
    if (!dateStr || !dateStr.includes('-')) return dateStr || '—';
    const parts = dateStr.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parseInt(parts[0]) + 543}` : dateStr;
}

function parseDurationMinutes(duration) {
    if (!duration || duration === '—') return 0;
    const hours = Number((duration.match(/(\d+(?:\.\d+)?)\s*ชม/) || [])[1] || 0);
    const minutes = Number((duration.match(/(\d+)\s*นาที/) || [])[1] || 0);
    return hours * 60 + minutes;
}

function renderAttendanceTable(data = dbAttendance) {
    attendanceTbody.innerHTML = '';
    if (data.length === 0) {
        noAttendanceEl.classList.remove('hidden'); attendanceTable.classList.add('hidden'); reportSummary.textContent = 'ทั้งหมด 0 รายการ'; return;
    }
    noAttendanceEl.classList.add('hidden'); attendanceTable.classList.remove('hidden'); reportSummary.textContent = `ทั้งหมด ${data.length} รายการ`;

    data.forEach((rec, i) => {
        const student = dbStudents.find(s => s.studentId === rec.studentId);
        const photo = student ? student.photo : '';
        const hasNoAttendance = !!rec._noAttendance;
        const checkedOut = !!rec.checkOut;
        const statusClass = hasNoAttendance ? 'tbl-none' : (checkedOut ? 'tbl-checkout' : 'tbl-ontime');
        const displayStatus = hasNoAttendance ? 'ยังไม่ลงเวลา' : (checkedOut ? 'ออกงานแล้ว' : 'ยังไม่ออกงาน');

        const durationText = rec.workDuration || '—';
        let remarkCombined = rec.remark || '';
        if (rec.lateLeaveReason) {
            remarkCombined = remarkCombined ? `${remarkCombined} | ออกช้า: ${rec.lateLeaveReason}` : `ออกช้า: ${rec.lateLeaveReason}`;
        }
        if (!remarkCombined) remarkCombined = '—';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="color:var(--text-muted);text-align:center">${i + 1}</td>
            <td><div style="display:flex;align-items:center;gap:8px;">${photo ? `<img src="${photo}" class="table-photo" alt="">` : ''}<span style="font-weight:500; color:var(--accent-color); cursor:cursor;" onclick="openIndividualStatsModal('${rec.studentId}')">${rec.name || rec.username} 🔍</span></div></td>
            <td style="font-family:'Inter',monospace;font-size:0.78rem;color:var(--text-muted)">${rec.studentId}</td>
            <td>${formatDisplayDate(rec.date)}</td>
            <td style="font-weight:500">${rec.checkIn || '—'}</td>
            <td style="font-weight:500">${rec.checkOut || '—'}</td>
            <td style="font-weight:600; color:var(--accent-color);">${durationText}</td>
            <td><span class="tbl-status ${statusClass}">${displayStatus}</span></td>
            <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.78rem" title="${remarkCombined}">${remarkCombined}</td>
            <td>${hasNoAttendance ? '—' : `<button class="btn-table-photo" onclick="openPhotoModal('${rec.checkInPhoto || ''}', '${rec.name || rec.username}', 'เวลาเข้า: ${rec.checkIn || '—'} น.', 'checkin')">ดูรูปเข้า</button>`}</td>
            <td>${hasNoAttendance ? '—' : `<button class="btn-table-photo" onclick="openPhotoModal('${rec.checkOutPhoto || ''}', '${rec.name || rec.username}', 'เวลาออก: ${rec.checkOut || '—'} น.', 'checkout')">ดูรูปออก</button>${rec.lateLeaveAttachment ? ` <button class="btn-table-photo" onclick="openAttachment('${rec.lateLeaveAttachment}', '${rec.name || rec.username}')">ดูเอกสาร</button>` : ''}`}</td>
            <td style="text-align:center">${hasNoAttendance ? '—' : `<button style="background:none;border:none;color:#9fb3c8;cursor:pointer;font-size:1rem;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#9fb3c8'" onclick="deleteAttendance('${rec.id || rec.studentId + '_' + rec.date}')">✕</button>`}</td>
        `;
        attendanceTbody.appendChild(tr);
    });
}

function openPhotoModal(photoSrc, username, timeInfo, photoType) {
    if (!photoSrc) { showToast('ไม่พบรูปภาพ', 'warning'); return; }
    document.getElementById('photo-modal-img').src = photoSrc;
    document.getElementById('photo-modal-name').textContent = username;
    document.getElementById('photo-modal-title').textContent = photoType === 'checkin' ? 'รูปลงเวลาเข้า' : 'รูปลงเวลาออก';
    document.getElementById('photo-modal-time').textContent = timeInfo;
    document.getElementById('photo-modal').classList.add('active');
}
function openAttachment(attachmentSrc, username) {
    if (!attachmentSrc) { showToast('ไม่พบเอกสารแนบ', 'warning'); return; }
    const link = document.createElement('a');
    link.href = attachmentSrc;
    link.target = '_blank';
    link.rel = 'noopener';
    link.download = `${username || 'late-leave-attachment'}`;
    link.click();
}
function closePhotoModal() { document.getElementById('photo-modal').classList.remove('active'); }

function openStudentHistoryModal() {
    const auth = getStoredStudentAuth();
    if (!auth || !auth.studentId) {
        showToast('กรุณากรอกข้อมูลหรือลงทะเบียนเพื่อเข้าสู่ระบบก่อน', 'error');
        enterStandaloneMode();
        return;
    }

    const studentId = auth.studentId;
    const student = dbStudents.find(s => s.studentId === studentId);
    const photo = student ? student.photo : '';
    const name = student ? student.username : auth.studentName || studentId;

    const photoEl = document.getElementById('sh-student-photo');
    const nameEl = document.getElementById('sh-student-name');
    const idEl = document.getElementById('sh-student-id-display');

    if (photoEl) photoEl.src = photo || '';
    if (nameEl) nameEl.textContent = name;
    if (idEl) idEl.textContent = `รหัส: ${studentId}`;

    const personalHistory = dbAttendance.filter(r => r.studentId === studentId)
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const countEl = document.getElementById('sh-student-total-count');
    if (countEl) countEl.textContent = `${personalHistory.length} ครั้ง`;

    const tbody = document.getElementById('sh-history-tbody');
    if (tbody) {
        tbody.innerHTML = '';
        if (personalHistory.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">ยังไม่มีประวัติการลงเวลา</td></tr>`;
        } else {
            const limitedHistory = personalHistory.slice(0, 30);
            limitedHistory.forEach((rec, idx) => {
                const statusText = rec.checkOut ? 'ออกงานแล้ว' : 'ยังไม่ออกงาน';
                const statusClass = rec.checkOut ? 'tbl-checkout' : 'tbl-ontime';

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="text-align:center">${idx + 1}</td>
                    <td>${formatDisplayDate(rec.date)}</td>
                    <td style="font-weight:500">${rec.checkIn || '—'} / ${rec.checkOut || '—'}</td>
                    <td><span class="tbl-status ${statusClass}">${statusText}</span></td>
                `;
                tbody.appendChild(tr);
            });
        }
    }

    const modal = document.getElementById('student-history-modal');
    if (modal) modal.classList.add('active');
    document.body.classList.add('modal-open');
}

function closeStudentHistoryModal() {
    const modal = document.getElementById('student-history-modal');
    if (modal) modal.classList.remove('active');
    document.body.classList.remove('modal-open');
}

function openIndividualStatsModal(studentId) {
    const student = dbStudents.find(s => s.studentId === studentId);
    if (!student) return;
    const data = getStudentStatsAndHistory(studentId);
    const total = data.totalRecords || 1;
    const pctWorked = Math.round((data.stats.worked / total) * 100), pctLateLeave = Math.round((data.stats.lateLeave / total) * 100);

    document.getElementById('ind-modal-photo').src = student.photo;
    document.getElementById('ind-modal-name').textContent = student.username;
    document.getElementById('ind-modal-id').textContent = `รหัสนักศึกษา: ${student.studentId}`;
    document.getElementById('ind-total-count').textContent = `${data.totalRecords} ครั้ง`;

    document.getElementById('bar-ontime').style.width = `${pctWorked}%`; document.getElementById('val-ontime-pct').textContent = `${data.stats.worked} วันเข้างาน (${pctWorked}%)`;
    document.getElementById('bar-late').style.width = `${pctLateLeave}%`; document.getElementById('val-late-pct').textContent = `${data.stats.lateLeave} ครั้งออกช้า (${pctLateLeave}%)`;
    document.getElementById('bar-verylate').style.width = '0%'; document.getElementById('val-verylate-pct').textContent = 'ไม่ใช้สถานะเข้างานสาย';

    const tbody = document.getElementById('ind-history-tbody'); tbody.innerHTML = '';
    if (data.history.length === 0) { tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">ยังไม่มีประวัติ</td></tr>`; }
    else {
        data.history.forEach((rec, idx) => {
            let statusText = 'ยังไม่ออกงาน', statusClass = 'tbl-ontime';
            if (rec.checkOut) { statusText = 'ออกงานแล้ว'; statusClass = 'tbl-checkout'; }
            else { statusText = 'ยังไม่ออกงาน'; statusClass = 'tbl-ontime'; }
            const tr = document.createElement('tr');
            tr.innerHTML = `<td style="text-align:center">${idx + 1}</td><td>${formatDisplayDate(rec.date)}</td><td style="font-weight:500">${rec.checkIn || '—'} / ${rec.checkOut || '—'}</td><td><span class="tbl-status ${statusClass}">${statusText}</span></td>`;
            tbody.appendChild(tr);
        });
    }
    document.body.classList.add('modal-open'); document.getElementById('individual-modal').classList.add('active');
}
function closeIndividualModal() { document.body.classList.remove('modal-open'); document.getElementById('individual-modal').classList.remove('active'); }

// ── Admin Settings & PIN UI ──
function loadTimeSettingsUI() {
    ['cfg-checkout-deadline'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.value = timeConfig.checkoutDeadline || '18:00';
        }
    });
}

async function saveTimeSettings() {
    if (!isAdminAuthenticated) { openPinModal(); return; }
    const checkoutDeadline = document.getElementById('cfg-checkout-deadline').value;
    if (!checkoutDeadline) { showToast('กรุณาระบุเดดไลน์ออกงาน', 'error'); return; }
    timeConfig = { checkoutDeadline };
    try {
        await db.collection('config').doc('settings').set({ timeConfig }, { merge: true });
        localStorage.setItem('timeConfig', JSON.stringify(timeConfig));
        showToast('⚙️ บันทึกการตั้งค่าช่วงเวลาขึ้นระบบคลาวด์สำเร็จ ✓', 'success'); updateTimeWindowUI(new Date());
    } catch(e) { showToast('❌ ไม่สามารถบันทึกค่าลงคลาวด์ได้', 'error'); }
}

function openPinModal() {
    document.getElementById('pin-input').value = '';
    document.querySelectorAll('.pin-dot').forEach(d => d.classList.remove('filled'));
    document.getElementById('pin-error').classList.add('hidden');
    const modalContent = document.querySelector('.pin-modal-content');
    if (modalContent) modalContent.classList.remove('shake');
    document.getElementById('pin-tab-target').value = 'report';
    document.getElementById('pin-modal').classList.add('active');
    setTimeout(() => document.getElementById('pin-input').focus(), 200);
}
function closePinModal() {
    document.getElementById('pin-modal').classList.remove('active');
    document.getElementById('pin-input').value = '';
    document.querySelectorAll('.pin-dot').forEach(d => d.classList.remove('filled'));
    const modalContent = document.querySelector('.pin-modal-content');
    if (modalContent) modalContent.classList.remove('shake');
}
function onPinInput(e) {
    const val  = e.target.value.replace(/\D/g, '').slice(0, 8);
    e.target.value = val;
    document.querySelectorAll('.pin-dot').forEach((d, i) => d.classList.toggle('filled', i < val.length));
    document.getElementById('pin-error').classList.add('hidden');
    const modalContent = document.querySelector('.pin-modal-content');
    if (modalContent) modalContent.classList.remove('shake');
    if (val.length >= 8) submitPin();
}
function submitPin() {
    const val = document.getElementById('pin-input').value;
    if (verifyAdminPIN(val)) {
        closePinModal();
        if (tabCheckin) tabCheckin.style.display = 'flex';
        if (tabReport) tabReport.style.display = 'flex';
        if (tabBottomReport) tabBottomReport.style.display = 'flex';
        if (tabRegister) tabRegister.style.display = 'flex';
        if (tabStudentCheckin) tabStudentCheckin.style.display = 'none';
        exitStandaloneMode();
        switchTab(document.getElementById('pin-tab-target').value || 'report');
    } else {
        const modalContent = document.querySelector('.pin-modal-content');
        if (modalContent) {
            modalContent.classList.remove('shake');
            void modalContent.offsetWidth; // Trigger reflow to restart animation
            modalContent.classList.add('shake');
        }
        document.getElementById('pin-error').classList.remove('hidden');
        document.getElementById('pin-input').value = '';
        document.querySelectorAll('.pin-dot').forEach(d => d.classList.remove('filled'));
    }
}
function logoutAdmin() {
    isAdminAuthenticated = false;
    const isStudentLoggedIn = !!getStoredStudentAuth();
    if (tabCheckin) tabCheckin.style.display = 'none';
    if (tabReport) tabReport.style.display = 'none';
    if (tabBottomReport) tabBottomReport.style.display = 'none';
    if (tabRegister) tabRegister.style.display = isStudentLoggedIn ? 'none' : 'flex';
    if (tabStudentCheckin) tabStudentCheckin.style.display = isStudentLoggedIn ? 'flex' : 'none';
    showToast('🔒 ออกจากระบบแอดมินแล้ว', 'info');
    checkStudentAuth();
}
function logoutStudent() {
    clearStoredStudentAuth();
    showToast('🔒 ออกจากระบบนักศึกษาแล้ว', 'info');
    enterStandaloneMode();
}
function appendPin(digit) {
    const input = document.getElementById('pin-input');
    if (input.value.length < 8) { input.value += digit; onPinInput({ target: input }); }
}
function clearPin() {
    const input = document.getElementById('pin-input'); input.value = input.value.slice(0, -1); onPinInput({ target: input });
}
function openChangePinModal() {
    if (!isAdminAuthenticated) { openPinModal(); return; }
    ['cfg-old-pin', 'cfg-new-pin', 'cfg-confirm-pin'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('change-pin-modal').classList.add('active'); document.body.classList.add('modal-open');
}
function closeChangePinModal() { document.getElementById('change-pin-modal').classList.remove('active'); document.body.classList.remove('modal-open'); }
function submitChangePin() {
    const oldPin = document.getElementById('cfg-old-pin').value.trim(), newPin = document.getElementById('cfg-new-pin').value.trim(), confirmPin = document.getElementById('cfg-confirm-pin').value.trim();
    if (!oldPin || !newPin || !confirmPin) { showToast('⚠️ กรุณากรอกข้อมูลให้ครบทุกช่อง', 'warning'); return; }
    if (newPin !== confirmPin) { showToast('❌ รหัส PIN ใหม่และช่องยืนยันไม่ตรงกัน', 'error'); return; }
    if (changeAdminPIN(oldPin, newPin)) closeChangePinModal();
}

// ── Student Auth & Standalone Mode Control ──
let pendingLateLeaveReason = '';

function checkStudentAuth() {
    const auth = getStoredStudentAuth();
    if (auth && auth.studentId) {
        const localStudents = JSON.parse(localStorage.getItem('students') || '[]');
        const allStudents = dbStudents.length > 0 ? dbStudents : localStudents;
        if (allStudents.length > 0 && allStudents.some(s => s.studentId === auth.studentId)) {
            exitStandaloneMode();
            switchTab('home');
            return true;
        } else {
            // Student session is invalid (e.g. database was wiped), clear it
            clearStoredStudentAuth();
        }
    }
    enterStandaloneMode();
    return false;
}

function enterStandaloneMode() {
    document.body.classList.add('standalone-mode');
    if (tabCheckin) tabCheckin.style.display = 'none';
    if (tabReport) tabReport.style.display = 'none';
    if (tabBottomReport) tabBottomReport.style.display = 'none';
    if (tabRegister) tabRegister.style.display = 'flex';
    if (tabStudentCheckin) tabStudentCheckin.style.display = 'none';
    // ซ่อน Bottom Nav Bar ทั้งหมดใน standalone mode
    const bottomNav = document.getElementById('bottom-nav');
    if (bottomNav) bottomNav.style.display = 'none';
    switchTab('register');
}

function exitStandaloneMode() {
    document.body.classList.remove('standalone-mode');
    if (tabRegister) {
        tabRegister.style.display = isAdminAuthenticated ? 'flex' : 'none';
    }
    if (tabStudentCheckin) {
        tabStudentCheckin.style.display = isAdminAuthenticated ? 'none' : 'flex';
    }
    if (tabReport) {
        tabReport.style.display = isAdminAuthenticated ? 'flex' : 'none';
    }
    if (tabBottomReport) {
        tabBottomReport.style.display = isAdminAuthenticated ? 'flex' : 'none';
    }
    // คืน Bottom Nav Bar เมื่อ Login แล้ว (mobile จะแสดงอัตโนมัติ desktop หายเพราะ CSS media query)
    const bottomNav = document.getElementById('bottom-nav');
    if (bottomNav) bottomNav.style.display = '';
}

function renderStudentHome() {
    const auth = getStoredStudentAuth();
    const loginContainer = document.getElementById('student-login-container');
    const dashboardContainer = document.getElementById('student-dashboard-container');

    console.log('renderStudentHome: auth =', auth);
    console.log('renderStudentHome: loginContainer =', loginContainer);
    console.log('renderStudentHome: dashboardContainer =', dashboardContainer);

    if (!auth || !auth.studentId) {
        if (loginContainer) {
            loginContainer.classList.remove('hidden');
            console.log('renderStudentHome: not logged in, loginContainer classes =', loginContainer.className);
        }
        if (dashboardContainer) {
            dashboardContainer.classList.add('hidden');
            console.log('renderStudentHome: not logged in, dashboardContainer classes =', dashboardContainer.className);
        }
        const loginError = document.getElementById('login-error');
        if (loginError) loginError.classList.add('hidden');
        return;
    }

    exitStandaloneMode();
    if (loginContainer) {
        loginContainer.classList.add('hidden');
        console.log('renderStudentHome: logged in, loginContainer classes =', loginContainer.className);
    }
    if (dashboardContainer) {
        dashboardContainer.classList.remove('hidden');
        console.log('renderStudentHome: logged in, dashboardContainer classes =', dashboardContainer.className);
    }
    updateStudentHomeData(auth);
}

function showRecoveryLogin() {
    const registerView = document.getElementById('view-register');
    const homeView = document.getElementById('view-home');
    const loginContainer = document.getElementById('student-login-container');
    const dashboardContainer = document.getElementById('student-dashboard-container');
    const registrationForm = document.getElementById('registration-form');
    const loginError = document.getElementById('login-error');

    if (registerView) registerView.classList.remove('active');
    if (homeView) homeView.classList.add('active');
    if (registrationForm) registrationForm.reset();
    if (loginError) loginError.classList.add('hidden');
    if (dashboardContainer) dashboardContainer.classList.add('hidden');
    if (loginContainer) {
        loginContainer.classList.remove('hidden');
        document.getElementById('login-student-id')?.focus();
    }
}

function showRegistrationForm() {
    const registerView = document.getElementById('view-register');
    const homeView = document.getElementById('view-home');
    const loginContainer = document.getElementById('student-login-container');
    const dashboardContainer = document.getElementById('student-dashboard-container');
    const loginForm = document.getElementById('student-login-form');

    if (loginForm) loginForm.reset();
    document.getElementById('login-error')?.classList.add('hidden');
    if (loginContainer) loginContainer.classList.add('hidden');
    if (dashboardContainer) dashboardContainer.classList.add('hidden');
    if (homeView) homeView.classList.remove('active');
    if (registerView) registerView.classList.add('active');
}

function handleStudentLogin(event) {
    event.preventDefault();
    const loginId = document.getElementById('login-student-id').value.trim();
    const loginPin = document.getElementById('login-student-pin').value.trim();
    const loginError = document.getElementById('login-error');

    if (!loginId || !loginPin) {
        showToast('กรุณากรอกข้อมูลให้ครบถ้วน', 'error');
        return;
    }
    if (!/^6\d{8}$/.test(loginId)) {
        showToast('รหัสนักศึกษาต้องเป็นตัวเลข 9 หลัก และขึ้นต้นด้วย 6', 'error');
        return;
    }

    const localStudents = JSON.parse(localStorage.getItem('students') || '[]');
    const allStudents = dbStudents.length > 0 ? dbStudents : localStudents;
    const foundStudent = allStudents.find(s => s.studentId === loginId);

    if (foundStudent && foundStudent.pin === loginPin) {
        const authData = {
            studentId: foundStudent.studentId,
            studentName: foundStudent.username,
            loginAt: Date.now()
        };
        setStoredStudentAuth(authData);
        document.getElementById('student-login-form').reset();
        if (loginError) loginError.classList.add('hidden');
        exitStandaloneMode();
        switchTab('home');
        showToast(`👋 ยินดีต้อนรับกลับคุณ ${foundStudent.username}`, 'success');
    } else {
        if (loginError) loginError.classList.remove('hidden');
    }
}

function updateStudentHomeData(auth) {
    const student = dbStudents.find(s => s.studentId === auth.studentId);
    const name = student ? student.username : auth.studentName || auth.studentId;
    const photo = student ? student.photo : '';

    const nameEl = document.getElementById('shome-name');
    const idEl = document.getElementById('shome-id');
    const photoEl = document.getElementById('shome-photo');

    if (nameEl) nameEl.textContent = name;
    if (idEl) idEl.textContent = `รหัส: ${auth.studentId}`;
    if (photoEl && photo) photoEl.src = photo;

    // 1. สถานะวันนี้และเวลาปฏิบัติงาน
    const todayDateOpts = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    const todayDateEl = document.getElementById('shome-today-date');
    if (todayDateEl) todayDateEl.textContent = new Date().toLocaleDateString('th-TH', todayDateOpts);

    const rec = getTodayRecord(auth.studentId);
    const badge = document.getElementById('shome-today-badge');
    const checkinTimeEl = document.getElementById('shome-checkin-time');
    const checkoutTimeEl = document.getElementById('shome-checkout-time');

    if (badge) {
        badge.className = 'today-status-pill';
        if (!rec) {
            badge.classList.add('status-none');
            badge.textContent = 'ยังไม่ลงเวลา';
        } else if (rec.checkOut) {
            badge.classList.add('status-checkout');
            badge.textContent = 'ออกงานแล้ว';
        } else {
            badge.classList.add('status-ontime');
            badge.textContent = 'เข้างานแล้ว';
        }
    }

    if (checkinTimeEl) checkinTimeEl.textContent = (rec && rec.checkIn) ? `${rec.checkIn} น.` : '—';
    if (checkoutTimeEl) checkoutTimeEl.textContent = (rec && rec.checkOut) ? `${rec.checkOut} น.` : 'ยังไม่ออกงาน';

    // 2. อัปเดตปุ่ม "ลงเวลา" dynamic บนหน้า Home
    updateHomeActionButtonStatus(auth.studentId);

    // 3. สรุปเดือนนี้
    const now = new Date();
    const yearMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthNameStr = now.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
    
    const monthNameEl = document.getElementById('shome-month-name');
    if (monthNameEl) monthNameEl.textContent = monthNameStr;

    const monthlyRecords = getStudentMonthlyRecords(auth.studentId, yearMonthPrefix);

    const totalDays = document.getElementById('shome-month-days');
    const totalHours = document.getElementById('shome-month-hours');
    const lateLeaves = document.getElementById('shome-month-late-leave');
    if (totalDays) totalDays.textContent = monthlyRecords.length;
    if (totalHours) totalHours.textContent = monthlyRecords.reduce((sum, r) => sum + (parseDurationMinutes(r.workDuration) / 60), 0).toFixed(1);
    if (lateLeaves) lateLeaves.textContent = monthlyRecords.filter(r => r.lateLeaveReason).length;
}

function renderStudentCheckinView() {
    const auth = getStoredStudentAuth();
    if (!auth || !auth.studentId) {
        showToast('กรุณาลงทะเบียนหรือเข้าสู่ระบบก่อน', 'error');
        enterStandaloneMode();
        return;
    }
    updateHomeActionButtonStatus(auth.studentId);
}

// 🟢 อัปเดตปุ่ม "ลงเวลา" ตามสถานะวันนี้
function updateHomeActionButtonStatus(studentId) {
    const btns = [
        { btn: document.getElementById('btn-home-attendance'), textEl: document.getElementById('btn-home-text'), iconEl: document.getElementById('btn-home-icon') },
        { btn: document.getElementById('btn-student-attendance'), textEl: document.getElementById('btn-student-text'), iconEl: document.getElementById('btn-student-icon') }
    ];

    const rec = getTodayRecord(studentId);

    btns.forEach(({ btn, textEl, iconEl }) => {
        if (!btn || !textEl || !iconEl) return;
        if (!rec) {
            btn.disabled = false;
            btn.className = 'btn-home-attendance btn-home-checkin';
            textEl.textContent = 'ลงเวลาเข้า';
            iconEl.innerHTML = '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>';
        } else if (!rec.checkOut) {
            btn.disabled = false;
            btn.className = 'btn-home-attendance btn-home-checkout';
            textEl.textContent = 'ลงเวลาออก';
            iconEl.innerHTML = '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>';
        } else {
            btn.disabled = true;
            btn.className = 'btn-home-attendance btn-home-done';
            textEl.textContent = 'ลงเวลาครบแล้ววันนี้';
            iconEl.innerHTML = '<polyline points="20 6 9 17 4 12"/>';
        }
    });
}

// ⚡ จัดการ Action เมื่อกดปุ่ม "ลงเวลา"
function handleHomeAttendanceAction() {
    const auth = getStoredStudentAuth();
    if (!auth || !auth.studentId) {
        showToast('กรุณาลงทะเบียนหรือเข้าสู่ระบบก่อน', 'error');
        enterStandaloneMode();
        return;
    }

    const student = dbStudents.find(s => s.studentId === auth.studentId);
    if (!student) {
        showToast('ไม่พบข้อมูลนักศึกษาในระบบ', 'error');
        enterStandaloneMode();
        return;
    }

    const rec = getTodayRecord(student.studentId);

    // กรณี 1: วันนี้ยังไม่ได้เข้างาน -> ลงเวลาเข้า
    if (!rec) {
        currentLookedUpStudent = student;
        openCameraModal('home_checkin');
    }
    // กรณี 2: เข้างานแล้วแต่ยังไม่ออก -> ลงเวลาออก
    else if (!rec.checkOut) {
        currentLookedUpStudent = student;
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();

        // เช็คเงื่อนไขเวลา 18:00 น. (18 * 60 = 1080)
        if (nowMinutes >= strToMinutes(timeConfig.checkoutDeadline || '18:00')) {
            openLateLeaveModal();
        } else {
            pendingLateLeaveReason = '';
            openCameraModal('home_checkout');
        }
    }
    // กรณี 3: ออกงานเรียบร้อยแล้ว
    else {
        showToast('คุณได้ลงเวลาครบถ้วนแล้ววันนี้', 'info');
    }
}

function openLateLeaveModal() {
    document.getElementById('late-leave-textarea').value = '';
    document.getElementById('late-leave-attachment').value = '';
    pendingLateLeaveAttachment = '';
    document.getElementById('late-leave-error').classList.add('hidden');
    document.getElementById('late-leave-modal').classList.add('active');
    setTimeout(() => document.getElementById('late-leave-textarea').focus(), 200);
}

function handleLateLeaveAttachment(event) {
    const file = event.target.files[0];
    if (!file) { pendingLateLeaveAttachment = ''; return; }
    if (file.size > 500 * 1024) {
        event.target.value = '';
        pendingLateLeaveAttachment = '';
        showToast('ไฟล์ต้องมีขนาดไม่เกิน 500KB', 'error');
        return;
    }
    const reader = new FileReader();
    reader.onload = () => { pendingLateLeaveAttachment = reader.result; };
    reader.onerror = () => { pendingLateLeaveAttachment = ''; showToast('ไม่สามารถอ่านไฟล์แนบได้', 'error'); };
    reader.readAsDataURL(file);
}

function setQuickLateReason(text) {
    document.getElementById('late-leave-textarea').value = text;
    document.getElementById('late-leave-error').classList.add('hidden');
}

function submitLateLeaveReason() {
    const val = document.getElementById('late-leave-textarea').value.trim();
    if (!val) {
        document.getElementById('late-leave-error').classList.remove('hidden');
        return;
    }
    pendingLateLeaveReason = val;
    document.getElementById('late-leave-modal').classList.remove('active');
    openCameraModal('home_checkout');
}

async function onHomeCheckinPhotoCaptured(photoBase64) {
    const auth = getStoredStudentAuth();
    if (!auth) return;
    const student = dbStudents.find(s => s.studentId === auth.studentId);
    if (!student) return;

    currentCheckinPhoto = photoBase64;
    await triggerAutoCheckin(student);
    renderStudentHome();
    switchTab('home');
}

async function onHomeCheckoutPhotoCaptured(photoBase64) {
    const auth = getStoredStudentAuth();
    if (!auth) return;

    await saveStudentCheckoutRecord(auth.studentId, photoBase64, pendingLateLeaveReason, pendingLateLeaveAttachment);
    pendingLateLeaveReason = '';
    pendingLateLeaveAttachment = '';
    renderStudentHome();
    switchTab('home');
}

// Global key handler for accessibility (Escape key to close modals)
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const pinModal = document.getElementById('pin-modal');
        if (pinModal && pinModal.classList.contains('active')) {
            closePinModal();
        }
        const changePinModal = document.getElementById('change-pin-modal');
        if (changePinModal && changePinModal.classList.contains('active')) {
            closeChangePinModal();
        }
        const shModal = document.getElementById('student-history-modal');
        if (shModal && shModal.classList.contains('active')) {
            closeStudentHistoryModal();
        }
    }
});