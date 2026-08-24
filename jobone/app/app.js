// ==========================================
// 🖥️ app.js - ควบคุม UI หน้าจอ (ลอจิกหน้าบ้านล้วนๆ)
// ==========================================

// ── DOM References ──
const tabHome                   = document.getElementById('tab-home');
const tabStudentCheckin         = document.getElementById('tab-student-checkin');
const tabRegister               = document.getElementById('tab-register');
const tabCheckin                = document.getElementById('tab-checkin');
const tabReport                 = document.getElementById('tab-report');
const viewHome                  = document.getElementById('view-home');
const viewStudentCheckin        = document.getElementById('view-student-checkin');
const viewRegister              = document.getElementById('view-register');
const viewCheckin               = document.getElementById('view-checkin');
const viewReport                = document.getElementById('view-report');
const studentLoginContainer     = document.getElementById('student-login-container');
const studentDashboardContainer = document.getElementById('student-dashboard-container');
const recordCount               = document.getElementById('record-count');
const toastContainer            = document.getElementById('toast-container');

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
    if (devModeActive) return 'dev';
    const now = getNowMinutes();
    const CI_OPEN = strToMinutes(timeConfig.ciOpen), CI_ONTIME = strToMinutes(timeConfig.ciOntime), CI_CLOSE = strToMinutes(timeConfig.ciClose);
    const CO_OPEN = strToMinutes(timeConfig.coOpen), CO_CLOSE = strToMinutes(timeConfig.coClose);
    if (now >= CI_OPEN && now <= CI_ONTIME) return 'ontime';
    if (now > CI_ONTIME && now <= CI_CLOSE) return 'late';
    if (now > CI_CLOSE && now < CO_OPEN) return 'verylate';
    if (now >= CO_OPEN && now <= CO_CLOSE) return 'checkout';
    return 'closed';
}

function updateTimeWindowUI(now) {
    const win = getTimeWindow();
    const stimeWindowIndicator = document.getElementById('stime-window-indicator');
    const stimeWindowText = document.getElementById('stime-window-text');

    if (timeWindowIndicator) timeWindowIndicator.className = 'time-window-indicator';
    if (stimeWindowIndicator) stimeWindowIndicator.className = 'time-window-indicator';

    const statuses = {
        'ontime':  { cls: 'window-open-in',   txt: `✅ เปิดรับลงเวลาเข้างาน (ตรงเวลา) ${timeConfig.ciOpen} – ${timeConfig.ciOntime} น.` },
        'late':    { cls: 'window-open-late',  txt: `⚠️ เปิดรับลงเวลาเข้างาน (มาสาย) ${timeConfig.ciOntime} – ${timeConfig.ciClose} น.` },
        'verylate':{ cls: 'window-closed',     txt: `🚨 ลงเวลาเข้างานสายมาก (ต้องระบุเหตุผล) หลัง ${timeConfig.ciClose} น.` },
        'checkout':{ cls: 'window-open-out',   txt: `🔵 เปิดรับลงเวลาออกงาน ${timeConfig.coOpen} – ${timeConfig.coClose} น.` },
        'closed':  { cls: 'window-closed',     txt: '🔒 นอกช่วงเวลาลงเวลา' },
        'dev':     { cls: 'window-open-late',  txt: '🔧 Dev Mode: bypass เวลาเปิดอยู่' },
    };
    const s = statuses[win];
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
    const tabs  = { home: tabHome, 'student-checkin': tabStudentCheckin, register: tabRegister, checkin: tabCheckin, report: tabReport };
    const views = { home: viewHome, 'student-checkin': viewStudentCheckin, register: viewRegister, checkin: viewCheckin, report: viewReport };

    // 🔒 ควบคุมการแสดงผล tab ใน Sidebar ตามสิทธิ์ผู้ใช้งาน
    const isStudentLoggedIn = !!getStoredStudentAuth();
    if (tabCheckin) {
        tabCheckin.style.display = isAdminAuthenticated ? 'flex' : 'none';
    }
    if (tabReport) {
        tabReport.style.display = isAdminAuthenticated ? 'flex' : 'none';
    }
    if (tabRegister) {
        tabRegister.style.display = (isAdminAuthenticated || !isStudentLoggedIn) ? 'flex' : 'none';
    }
    if (tabStudentCheckin) {
        tabStudentCheckin.style.display = (isStudentLoggedIn && !isAdminAuthenticated) ? 'flex' : 'none';
    }

    Object.values(tabs).forEach(t  => { if (t) t.classList.remove('active'); });
    Object.values(views).forEach(v => { if (v) v.classList.remove('active'); });
    if (tabs[tab]) tabs[tab].classList.add('active');
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
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span><button class="toast-close-btn" onclick="this.parentElement.remove()">✕</button>`;
    toastContainer.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(10px)'; setTimeout(() => toast.remove(), 350); }, duration);
}

function updateRecordCount() { recordCount.textContent = dbStudents.length; }
function getTodayDateStr() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; }
function getTodayRecord(studentId) { const today = getTodayDateStr(); return dbAttendance.find(r => r.studentId === studentId && r.date === today) || null; }

// ── ค้นหานักศึกษาและการลงเวลา UI ──
function lookupStudent() {
    const id = checkinStudentId.value.trim();
    currentLookedUpStudent = null; currentCheckinPhoto = null; currentRemark = ''; isCheckingInVeryLate = false;
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
        if (rec.status !== 'checked_out') {
            checkinPhotoSection.classList.remove('hidden'); remarkSection.classList.remove('hidden');
            actionButtons.classList.remove('hidden'); btnCheckout.classList.remove('hidden'); updateActionButtons();
        }
    } else {
        triggerAutoCheckin(found);
    }
}

async function triggerAutoCheckin(student) {
    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();
    const CI_OPEN    = strToMinutes(timeConfig.ciOpen);
    const CI_LATE    = strToMinutes(timeConfig.ciOntime);
    const CI_VERYLATE = strToMinutes(timeConfig.ciClose);

    // 1. ตรวจสอบพื้นที่ด้วย GPS ก่อนลงเวลา
    showToast('📍 กำลังตรวจสอบตำแหน่งสถานที่...', 'info', 2000);
    const location = await getGPSLocation();

    if (!devModeActive && location) {
        const distance = getDistanceInMeters(
            location.lat, location.lng,
            facultyLocation.lat, facultyLocation.lng
        );
        if (distance > GEOFENCE_RADIUS_METERS) {
            showToast(`🚫 ลงเวลาไม่ได้! คุณอยู่นอกพื้นที่คณะ (ห่าง ${Math.round(distance)} เมตร)`, 'error', 5000);
            return;
        }
    } else if (!devModeActive && !location) {
        showToast('⚠️ ไม่สามารถตรวจสอบตำแหน่งได้ โปรดเปิด GPS แล้วลองใหม่', 'warning', 4000);
        return;
    }

    // 2. ผ่านเงื่อนไขพื้นที่แล้ว → ตรวจสอบช่วงเวลาและบันทึก
    if (!devModeActive && currentMin < CI_OPEN) {
        showToast(`🔒 ยังไม่เปิดให้ลงเวลาเข้างาน (เปิด ${timeConfig.ciOpen} น.)`, 'error'); return;
    }
    if (devModeActive || (currentMin >= CI_OPEN && currentMin <= CI_LATE)) {
        saveAutoCheckinRecord(student, 'ontime', '');
    } else if (currentMin > CI_LATE && currentMin <= CI_VERYLATE) {
        saveAutoCheckinRecord(student, 'late', '');
    } else {
        isCheckingInVeryLate = true; currentLookedUpStudent = student; openRemarkModal();
    }
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
    else if (rec.status === 'checked_out') { studentTodayStatus.classList.add('status-checkout'); studentTodayStatus.textContent = `ออกงานแล้ว ${rec.checkOut} น.`; }
    else if (rec.status === 'verylate') { studentTodayStatus.classList.add('status-verylate'); studentTodayStatus.textContent = `สายมาก — ${rec.checkIn} น.`; }
    else if (rec.status === 'late') { studentTodayStatus.classList.add('status-late'); studentTodayStatus.textContent = `มาสาย — ${rec.checkIn} น.`; }
    else { studentTodayStatus.classList.add('status-ontime'); studentTodayStatus.textContent = `ตรงเวลา — ${rec.checkIn} น.`; }
}

function updateActionButtons() {
    if (!currentLookedUpStudent) return;
    const rec  = getTodayRecord(currentLookedUpStudent.studentId);
    const now = getNowMinutes(), CO_OPEN = strToMinutes(timeConfig.coOpen), CO_CLOSE = strToMinutes(timeConfig.coClose);
    if (rec && rec.status === 'checked_out') { btnCheckout.disabled = true; return; }
    btnCheckout.disabled = !(rec && rec.status !== 'checked_out' && (devModeActive || (now >= CO_OPEN && now <= CO_CLOSE)) && !!currentCheckinPhoto);
}

function openRemarkModal() { remarkTextarea.value = currentRemark; remarkModal.classList.add('active'); setTimeout(() => remarkTextarea.focus(), 200); }
function closeRemarkModal() {
    remarkModal.classList.remove('active');
    if (isCheckingInVeryLate) {
        isCheckingInVeryLate = false; checkinStudentId.value = ''; currentLookedUpStudent = null;
        studentInfoCard.classList.add('hidden'); checkinPhotoSection.classList.add('hidden'); checkinPhotoPreviewCon.classList.add('hidden');
        actionButtons.classList.add('hidden'); remarkSection.classList.add('hidden');
    }
}
function setQuickRemark(text) { remarkTextarea.value = text.slice(0, 5); }
function saveRemark() {
    let val = remarkTextarea.value.trim();
    if (val.length > 5) {
        val = val.slice(0, 5);
    }
    if (isCheckingInVeryLate) {
        if (!val) { showToast('กรุณาระบุเหตุผลการมาสาย', 'error'); return; }
        saveAutoCheckinRecord(currentLookedUpStudent, 'verylate', val);
        isCheckingInVeryLate = false; closeRemarkModal();
    } else {
        currentRemark = val; closeRemarkModal(); updateRemarkUI();
        if (currentLookedUpStudent) {
            const rec = getTodayRecord(currentLookedUpStudent.studentId);
            if (rec) { rec.remark = val; localStorage.setItem('attendanceRecords', JSON.stringify(dbAttendance)); filterAttendanceRecords(); }
        }
        if (val) showToast('บันทึกหมายเหตุแล้ว ✓', 'success');
    }
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
    document.getElementById('val-ontime').textContent = todayRecords.filter(r => r.status === 'ontime').length;
    document.getElementById('val-late').textContent = todayRecords.filter(r => r.status === 'late').length;
    document.getElementById('val-verylate').textContent = todayRecords.filter(r => r.status === 'verylate').length;
    document.getElementById('val-done').textContent = todayRecords.filter(r => r.status === 'checked_out' || r.checkOut).length;
}

function filterAttendanceRecords() {
    const q = searchInput.value.toLowerCase().trim();
    const filterDate = document.getElementById('filter-date').value;
    const filterStatus = document.getElementById('filter-status').value;
    let filtered = dbAttendance;
    if (q) filtered = filtered.filter(r => (r.name && r.name.toLowerCase().includes(q)) || (r.username && r.username.toLowerCase().includes(q)) || r.studentId.toLowerCase().includes(q));
    if (filterDate) filtered = filtered.filter(r => r.date === filterDate);
    if (filterStatus) filtered = filtered.filter(r => filterStatus === 'checked_out' ? (r.status === 'checked_out' || !!r.checkOut) : r.status === filterStatus);
    renderAttendanceTable(filtered);
}
function filterAttendance() { filterAttendanceRecords(); }

function formatDisplayDate(dateStr) {
    if (!dateStr || !dateStr.includes('-')) return dateStr || '—';
    const parts = dateStr.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parseInt(parts[0]) + 543}` : dateStr;
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
        let statusClass = 'tbl-pending', displayStatus = 'On Time';
        if (rec.status === 'checked_out' || rec.checkOut) { statusClass = 'tbl-checkout'; displayStatus = 'Checked Out'; }
        else if (rec.status === 'verylate') { statusClass = 'tbl-verylate'; displayStatus = 'Very Late'; }
        else if (rec.status === 'late') { statusClass = 'tbl-late'; displayStatus = 'Late'; }
        else { statusClass = 'tbl-ontime'; displayStatus = 'On Time'; }

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
            <td><button class="btn-table-photo" onclick="openPhotoModal('${rec.checkInPhoto || ''}', '${rec.name || rec.username}', 'เวลาเข้า: ${rec.checkIn || '—'} น.', 'checkin')">ดูรูปเข้า</button></td>
            <td><button class="btn-table-photo" onclick="openPhotoModal('${rec.checkOutPhoto || ''}', '${rec.name || rec.username}', 'เวลาออก: ${rec.checkOut || '—'} น.', 'checkout')">ดูรูปออก</button></td>
            <td style="text-align:center"><button style="background:none;border:none;color:#9fb3c8;cursor:pointer;font-size:1rem;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#9fb3c8'" onclick="deleteAttendance('${rec.id || rec.studentId + '_' + rec.date}')">✕</button></td>
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
                let statusText = 'ตรงเวลา', statusClass = 'tbl-ontime';
                if (rec.status === 'late') { statusText = 'มาสาย'; statusClass = 'tbl-late'; }
                else if (rec.status === 'verylate') { statusText = 'สายมาก'; statusClass = 'tbl-verylate'; }
                else if (rec.status === 'checked_out' || rec.checkOut) { statusText = 'ออกงานแล้ว'; statusClass = 'tbl-checkout'; }

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
    const pctOnTime = Math.round((data.stats.onTime / total) * 100), pctLate = Math.round((data.stats.late / total) * 100), pctVeryLate = Math.round((data.stats.veryLate / total) * 100);

    document.getElementById('ind-modal-photo').src = student.photo;
    document.getElementById('ind-modal-name').textContent = student.username;
    document.getElementById('ind-modal-id').textContent = `รหัสนักศึกษา: ${student.studentId}`;
    document.getElementById('ind-total-count').textContent = `${data.totalRecords} ครั้ง`;

    document.getElementById('bar-ontime').style.width = `${pctOnTime}%`; document.getElementById('val-ontime-pct').textContent = `${data.stats.onTime} ครั้ง (${pctOnTime}%)`;
    document.getElementById('bar-late').style.width = `${pctLate}%`; document.getElementById('val-late-pct').textContent = `${data.stats.late} ครั้ง (${pctLate}%)`;
    document.getElementById('bar-verylate').style.width = `${pctVeryLate}%`; document.getElementById('val-verylate-pct').textContent = `${data.stats.veryLate} ครั้ง (${pctVeryLate}%)`;

    const tbody = document.getElementById('ind-history-tbody'); tbody.innerHTML = '';
    if (data.history.length === 0) { tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">ยังไม่มีประวัติ</td></tr>`; }
    else {
        data.history.forEach((rec, idx) => {
            let statusText = 'ตรงเวลา', statusClass = 'tbl-ontime';
            if (rec.status === 'late') { statusText = 'มาสาย'; statusClass = 'tbl-late'; }
            else if (rec.status === 'verylate') { statusText = 'สายมาก'; statusClass = 'tbl-verylate'; }
            else if (rec.status === 'checked_out') { statusText = 'ออกงานแล้ว'; statusClass = 'tbl-checkout'; }
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
    ['cfg-ci-open', 'cfg-ci-ontime', 'cfg-ci-close', 'cfg-co-open', 'cfg-co-close'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if(id === 'cfg-ci-open') el.value = timeConfig.ciOpen;
            if(id === 'cfg-ci-ontime') el.value = timeConfig.ciOntime;
            if(id === 'cfg-ci-close') el.value = timeConfig.ciClose;
            if(id === 'cfg-co-open') el.value = timeConfig.coOpen;
            if(id === 'cfg-co-close') el.value = timeConfig.coClose;
        }
    });
}

async function saveTimeSettings() {
    if (!isAdminAuthenticated) { openPinModal(); return; }
    const ciOpen = document.getElementById('cfg-ci-open').value, ciOntime = document.getElementById('cfg-ci-ontime').value, ciClose = document.getElementById('cfg-ci-close').value;
    const coOpen = document.getElementById('cfg-co-open').value, coClose = document.getElementById('cfg-co-close').value;
    if (strToMinutes(ciOpen) >= strToMinutes(ciOntime)) { showToast('❌ เวลาเปิดรับเข้างาน ต้องน้อยกว่า เวลาสิ้นสุดตรงเวลา', 'error'); return; }
    if (strToMinutes(ciOntime) >= strToMinutes(ciClose)) { showToast('❌ เวลาสิ้นสุดตรงเวลา ต้องน้อยกว่า เวลาปิดรับเข้างาน', 'error'); return; }
    if (strToMinutes(coOpen) >= strToMinutes(coClose)) { showToast('❌ เวลาเปิดออกงานตอนเย็น ต้องน้อยกว่า เวลาปิดรับออกงาน', 'error'); return; }

    timeConfig = { ciOpen, ciOntime, ciClose, coOpen, coClose };
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
        if (tabRegister) tabRegister.style.display = 'flex';
        if (tabStudentCheckin) tabStudentCheckin.style.display = 'none';
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
    if (tabRegister) tabRegister.style.display = isStudentLoggedIn ? 'none' : 'flex';
    if (tabStudentCheckin) tabStudentCheckin.style.display = isStudentLoggedIn ? 'flex' : 'none';
    showToast('🔒 ออกจากระบบแอดมินแล้ว', 'info');
    checkStudentAuth();
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
        if (allStudents.length === 0 || allStudents.some(s => s.studentId === auth.studentId)) {
            exitStandaloneMode();
            switchTab('home');
            return true;
        }
    }
    enterStandaloneMode();
    return false;
}

function enterStandaloneMode() {
    document.body.classList.add('standalone-mode');
    if (tabCheckin) tabCheckin.style.display = 'none';
    if (tabReport) tabReport.style.display = 'none';
    if (tabRegister) tabRegister.style.display = 'flex';
    if (tabStudentCheckin) tabStudentCheckin.style.display = 'none';
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
}

function renderStudentHome() {
    const auth = getStoredStudentAuth();
    if (!auth || !auth.studentId) {
        enterStandaloneMode();
        return;
    }

    exitStandaloneMode();
    if (studentLoginContainer) studentLoginContainer.classList.add('hidden');
    if (studentDashboardContainer) studentDashboardContainer.classList.remove('hidden');
    updateStudentHomeData(auth);
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
        } else if (rec.status === 'checked_out' || rec.checkOut) {
            badge.classList.add('status-checkout');
            badge.textContent = 'ออกงานแล้ว';
        } else if (rec.status === 'verylate') {
            badge.classList.add('status-verylate');
            badge.textContent = 'สายมาก';
        } else if (rec.status === 'late') {
            badge.classList.add('status-late');
            badge.textContent = 'มาสาย';
        } else {
            badge.classList.add('status-ontime');
            badge.textContent = 'ตรงเวลา';
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

    let countOntime = 0;
    let countLate = 0;
    let countVeryLate = 0;

    monthlyRecords.forEach(r => {
        if (r.status === 'late') countLate++;
        else if (r.status === 'verylate') countVeryLate++;
        else countOntime++;
    });

    const valOntime = document.getElementById('shome-month-ontime');
    const valLate = document.getElementById('shome-month-late');
    const valVeryLate = document.getElementById('shome-month-verylate');

    if (valOntime) valOntime.textContent = countOntime;
    if (valLate) valLate.textContent = countLate;
    if (valVeryLate) valVeryLate.textContent = countVeryLate;
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
        } else if (!rec.checkOut && rec.status !== 'checked_out') {
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
    else if (!rec.checkOut && rec.status !== 'checked_out') {
        currentLookedUpStudent = student;
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();

        // เช็คเงื่อนไขเวลา 18:00 น. (18 * 60 = 1080)
        if (nowMinutes > 1080) {
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
    document.getElementById('late-leave-error').classList.add('hidden');
    document.getElementById('late-leave-modal').classList.add('active');
    setTimeout(() => document.getElementById('late-leave-textarea').focus(), 200);
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

    await saveStudentCheckoutRecord(auth.studentId, photoBase64, pendingLateLeaveReason);
    pendingLateLeaveReason = '';
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