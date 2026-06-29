// ==========================================
// 🖥️ app.js - ควบคุม UI หน้าจอ (ลอจิกหน้าบ้านล้วนๆ)
// ==========================================

// ── DOM References ──
const tabRegister   = document.getElementById('tab-register');
const tabCheckin    = document.getElementById('tab-checkin');
const tabReport     = document.getElementById('tab-report');
const viewRegister  = document.getElementById('view-register');
const viewCheckin   = document.getElementById('view-checkin');
const viewReport    = document.getElementById('view-report');
const recordCount   = document.getElementById('record-count');
const toastContainer= document.getElementById('toast-container');

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
            await db.collection('config').doc('settings').set({ timeConfig, admin_pin: '1234' });
        }
        loadTimeSettingsUI();
    } catch (e) {
        const savedConfig = localStorage.getItem('timeConfig');
        if (savedConfig) timeConfig = JSON.parse(savedConfig);
        loadTimeSettingsUI();
    }

    showToast('🌐 กำลังซิงค์ฐานข้อมูลออนไลน์คณะ IT...', 'info', 2000);
    const cloudConnected = await syncDataFromFirestore();

    if (cloudConnected) {
        showToast('✅ เชื่อมต่อฐานข้อมูลออนไลน์สำเร็จ', 'success', 2000);
        await migrateLocalDataToCloud();
    } else {
        showToast('⚠️ ไม่สามารถเชื่อมต่อคลาวด์ได้ ระบบรันโหมด Offline สำรอง', 'warning', 4000);
    }

    updateRecordCount(); updateDashboard(); filterAttendanceRecords(); startClock();

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
        document.getElementById('clock-time').textContent = `${hh}:${mm}:${ss}`;
        const dateOpts = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
        document.getElementById('clock-date').textContent = now.toLocaleDateString('th-TH', dateOpts);
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
    timeWindowIndicator.className = 'time-window-indicator';
    const statuses = {
        'ontime':  { cls: 'window-open-in',   txt: `✅ เปิดรับลงเวลาเข้างาน (ตรงเวลา) ${timeConfig.ciOpen} – ${timeConfig.ciOntime} น.` },
        'late':    { cls: 'window-open-late',  txt: `⚠️ เปิดรับลงเวลาเข้างาน (มาสาย) ${timeConfig.ciOntime} – ${timeConfig.ciClose} น.` },
        'verylate':{ cls: 'window-closed',     txt: `🚨 ลงเวลาเข้างานสายมาก (ต้องระบุเหตุผล) หลัง ${timeConfig.ciClose} น.` },
        'checkout':{ cls: 'window-open-out',   txt: `🔵 เปิดรับลงเวลาออกงาน ${timeConfig.coOpen} – ${timeConfig.coClose} น.` },
        'closed':  { cls: 'window-closed',     txt: '🔒 นอกช่วงเวลาลงเวลา' },
        'dev':     { cls: 'window-open-late',  txt: '🔧 Dev Mode: bypass เวลาเปิดอยู่' },
    };
    const s = statuses[win];
    timeWindowIndicator.classList.add(s.cls); timeWindowText.textContent = s.txt;
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
    const tabs  = { register: tabRegister, checkin: tabCheckin, report: tabReport };
    const views = { register: viewRegister, checkin: viewCheckin, report: viewReport };
    Object.values(tabs).forEach(t  => t.classList.remove('active'));
    Object.values(views).forEach(v => v.classList.remove('active'));
    tabs[tab].classList.add('active'); views[tab].classList.add('active');

    if (tab === 'report') {
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
function setQuickRemark(text) { remarkTextarea.value = text; }
function saveRemark() {
    const val = remarkTextarea.value.trim();
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

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="color:var(--text-muted);text-align:center">${i + 1}</td>
            <td><div style="display:flex;align-items:center;gap:8px;">${photo ? `<img src="${photo}" class="table-photo" alt="">` : ''}<span style="font-weight:500; color:var(--accent-color); cursor:pointer;" onclick="openIndividualStatsModal('${rec.studentId}')">${rec.name || rec.username} 🔍</span></div></td>
            <td style="font-family:'Inter',monospace;font-size:0.78rem;color:var(--text-muted)">${rec.studentId}</td>
            <td>${formatDisplayDate(rec.date)}</td>
            <td style="font-weight:500">${rec.checkIn || '—'}</td>
            <td style="font-weight:500">${rec.checkOut || '—'}</td>
            <td><span class="tbl-status ${statusClass}">${displayStatus}</span></td>
            <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.78rem">${rec.remark || '—'}</td>
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
    document.getElementById('pin-tab-target').value = 'report';
    document.getElementById('pin-modal').classList.add('active');
    setTimeout(() => document.getElementById('pin-input').focus(), 200);
}
function closePinModal() {
    document.getElementById('pin-modal').classList.remove('active');
    document.getElementById('pin-input').value = '';
    document.querySelectorAll('.pin-dot').forEach(d => d.classList.remove('filled'));
}
function onPinInput(e) {
    const val  = e.target.value.replace(/\D/g, '').slice(0, 6);
    e.target.value = val;
    document.querySelectorAll('.pin-dot').forEach((d, i) => d.classList.toggle('filled', i < val.length));
    document.getElementById('pin-error').classList.add('hidden');
    if (val.length >= 4) submitPin();
}
function submitPin() {
    const val = document.getElementById('pin-input').value;
    if (verifyAdminPIN(val)) {
        closePinModal(); switchTab(document.getElementById('pin-tab-target').value || 'report');
    } else {
        document.getElementById('pin-error').classList.remove('hidden');
        document.getElementById('pin-input').value = '';
        document.querySelectorAll('.pin-dot').forEach(d => d.classList.remove('filled'));
    }
}
function logoutAdmin() { isAdminAuthenticated = false; switchTab('checkin'); showToast('🔒 ออกจากระบบแอดมินแล้ว', 'info'); }
function appendPin(digit) {
    const input = document.getElementById('pin-input');
    if (input.value.length < 6) { input.value += digit; onPinInput({ target: input }); }
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