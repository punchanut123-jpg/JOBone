/* ================================================================
   Student Attendance System — app.js
   Features: Registration, Check-in/out with time rules,
   Photo verification, Remark system, Excel export, Admin actions
   ================================================================ */

// ── State ───────────────────────────────────────────────────────
let dbStudents    = [];
let dbAttendance  = [];

let currentPhotoBase64      = null;  // for registration
let currentCheckinPhoto     = null;  // for check-in/out
let streamInstance          = null;
let cameraContext           = 'register'; // 'register' | 'checkin'

let currentRemark           = '';
let currentLookedUpStudent  = null;
let devModeActive           = false;
let clockInterval           = null;
let devPanelClickCount      = 0;
let isCheckingInVeryLate    = false;

// ── DOM References ───────────────────────────────────────────────
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

// Register form
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

// Remark modal
const remarkModal       = document.getElementById('remark-modal');
const remarkTextarea    = document.getElementById('remark-textarea');

// ── Init ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('test') === 'true') {
        localStorage.setItem('students', JSON.stringify([
            {"id":"1","username":"สมชาย รักดี","studentId":"65000001","photo":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==","registeredAt":"11/06/2569 08:00"},
            {"id":"2","username":"สมหญิง มุ่งมั่น","studentId":"65000002","photo":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==","registeredAt":"11/06/2569 08:05"}
        ]));
        localStorage.setItem('attendanceRecords', JSON.stringify([
            {
                "id": "1001",
                "studentId": "65000001",
                "username": "สมชาย รักดี",
                "date": new Date().toISOString().slice(0,10),
                "attendanceType": "ontime",
                "status": "checked_out",
                "checkInTime": "07:30",
                "checkOutTime": "16:45",
                "remark": "",
                "checkInPhoto":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
                "checkOutPhoto":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
                "createdAt": Date.now() - 3600000
            },
            {
                "id": "1002",
                "studentId": "65000002",
                "username": "สมหญิง มุ่งมั่น",
                "date": new Date().toISOString().slice(0,10),
                "attendanceType": "late",
                "status": "pending",
                "checkInTime": "08:15",
                "checkOutTime": "",
                "remark": "รถติดมาก",
                "checkInPhoto":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
                "checkOutPhoto":"",
                "createdAt": Date.now()
            }
        ]));
    }
    migrateKeysIfNeeded();
    updateRecordCount();
    updateDashboard();
    filterAttendanceRecords();
    startClock();

    // Triple-click on clock to reveal dev panel
    document.getElementById('clock-time').addEventListener('click', () => {
        devPanelClickCount++;
        if (devPanelClickCount >= 3) {
            devModePanel.classList.remove('hidden');
            devPanelClickCount = 0;
            showToast('🔧 Developer Panel เปิดแล้ว', 'info');
        }
        setTimeout(() => { devPanelClickCount = 0; }, 1500);
    });
});

// ── Migration Logic ──────────────────────────────────────────────
function migrateKeysIfNeeded() {
    const oldStudentKey = 'student_records';
    const oldAttendanceKey = 'attendance_records';

    let oldStudentsRaw = localStorage.getItem(oldStudentKey);
    let oldAttendanceRaw = localStorage.getItem(oldAttendanceKey);

    // Migrate students
    if (oldStudentsRaw && !localStorage.getItem('students')) {
        localStorage.setItem('students', oldStudentsRaw);
    }

    // Migrate attendance
    if (oldAttendanceRaw && !localStorage.getItem('attendanceRecords')) {
        try {
            let records = JSON.parse(oldAttendanceRaw);
            let migrated = migrateAttendanceRecords(records);
            localStorage.setItem('attendanceRecords', JSON.stringify(migrated));
        } catch (e) {
            console.error('Failed to parse and migrate old attendance records', e);
        }
    }

    // Load standard keys into memory
    dbStudents = JSON.parse(localStorage.getItem('students') || '[]');
    
    let rawAttendance = localStorage.getItem('attendanceRecords') || '[]';
    try {
        dbAttendance = JSON.parse(rawAttendance);
        dbAttendance = migrateAttendanceRecords(dbAttendance);
        if (JSON.stringify(dbAttendance) !== rawAttendance) {
            localStorage.setItem('attendanceRecords', JSON.stringify(dbAttendance));
        }
    } catch(e) {
        dbAttendance = [];
    }

    // Warning of old keys in console
    let oldKeysFound = [];
    if (oldStudentsRaw) oldKeysFound.push(oldStudentKey);
    if (oldAttendanceRaw) oldKeysFound.push(oldAttendanceKey);
    if (oldKeysFound.length > 0) {
        console.warn(`[Migration] พบคีย์เก่าที่ไม่ได้ใช้งาน: ${oldKeysFound.join(', ')}. กรุณาลบออกเพื่อความเป็นระเบียบเรียบร้อย.`);
    }
}

function migrateAttendanceRecords(records) {
    return records.map(rec => {
        let updated = { ...rec };
        
        if (!updated.id) {
            updated.id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
        }
        if (!updated.createdAt) {
            updated.createdAt = parseInt(updated.id) || Date.now();
        }

        // Map old keys to new keys
        updated.name = updated.name || updated.username || "";
        updated.checkIn = updated.checkIn || updated.checkInTime || "";
        updated.checkOut = updated.checkOut || updated.checkOutTime || "";

        // Map status
        if (!updated.status || updated.status === 'pending') {
            if (updated.checkOut) {
                updated.status = 'checked_out';
            } else if (updated.attendanceType === 'late') {
                updated.status = 'late';
            } else if (updated.attendanceType === 'verylate') {
                updated.status = 'verylate';
            } else {
                updated.status = 'ontime';
            }
        } else if (updated.status === 'ตรงเวลา' || updated.status === 'ontime') {
            updated.status = 'ontime';
        } else if (updated.status === 'มาสาย' || updated.status === 'late') {
            updated.status = 'late';
        } else if (updated.status === 'สายมาก' || updated.status === 'verylate') {
            updated.status = 'verylate';
        }

        if (updated.checkOut && updated.status !== 'checked_out') {
            updated.status = 'checked_out';
        }

        // Date migration (Buddhist to Gregorian or formats)
        if (updated.date && updated.date.includes('/')) {
            const parts = updated.date.split('/');
            if (parts.length === 3) {
                let day = parts[0].padStart(2, '0');
                let month = parts[1].padStart(2, '0');
                let year = parseInt(parts[2]);
                if (year > 2400) {
                    year = year - 543;
                }
                updated.date = `${year}-${month}-${day}`;
            }
        }
        
        return updated;
    });
}

// ── Realtime Clock ───────────────────────────────────────────────
function startClock() {
    function tick() {
        const now = new Date();
        const hh  = String(now.getHours()).padStart(2, '0');
        const mm  = String(now.getMinutes()).padStart(2, '0');
        const ss  = String(now.getSeconds()).padStart(2, '0');
        document.getElementById('clock-time').textContent = `${hh}:${mm}:${ss}`;

        const dateOpts = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
        document.getElementById('clock-date').textContent =
            now.toLocaleDateString('th-TH', dateOpts);

        updateTimeWindowUI(now);
    }
    tick();
    clockInterval = setInterval(tick, 1000);
}

// ── Time Logic ───────────────────────────────────────────────────
function toMinutes(h, m) { return h * 60 + m; }

function getNowMinutes() {
    const now = new Date();
    return toMinutes(now.getHours(), now.getMinutes());
}

/**
 * Returns: 'ontime' | 'late' | 'checkout' | 'closed'
 */
function getTimeWindow() {
    if (devModeActive) return 'dev';

    const now = getNowMinutes();
    const CI_OPEN   = toMinutes(7,  0);
    const CI_ONTIME = toMinutes(8,  0);
    const CI_CLOSE  = toMinutes(8, 30);
    const CO_OPEN   = toMinutes(16, 30);
    const CO_CLOSE  = toMinutes(17, 0);

    if (now >= CI_OPEN && now <= CI_ONTIME)  return 'ontime';
    if (now >  CI_ONTIME && now <= CI_CLOSE) return 'late';
    if (now >  CI_CLOSE && now < CO_OPEN)    return 'verylate';
    if (now >= CO_OPEN && now <= CO_CLOSE)   return 'checkout';
    return 'closed';
}

function updateTimeWindowUI(now) {
    const win = getTimeWindow();
    timeWindowIndicator.className = 'time-window-indicator';

    const statuses = {
        'ontime':  { cls: 'window-open-in',   txt: '✅ เปิดรับลงเวลาเข้างาน (ตรงเวลา) 07:00 – 08:00 น.' },
        'late':    { cls: 'window-open-late',  txt: '⚠️ เปิดรับลงเวลาเข้างาน (มาสาย) 08:01 – 08:30 น.' },
        'verylate':{ cls: 'window-closed',     txt: '🚨 ลงเวลาเข้างานสายมาก (ต้องระบุเหตุผล) หลัง 08:30 น.' },
        'checkout':{ cls: 'window-open-out',   txt: '🔵 เปิดรับลงเวลาออกงาน 16:30 – 17:00 น.' },
        'closed':  { cls: 'window-closed',     txt: '🔒 นอกช่วงเวลาลงเวลา' },
        'dev':     { cls: 'window-open-late',  txt: '🔧 Dev Mode: bypass เวลาเปิดอยู่' },
    };

    const s = statuses[win];
    timeWindowIndicator.classList.add(s.cls);
    timeWindowText.textContent = s.txt;

    if (currentLookedUpStudent) updateActionButtons();
}

function toggleDevMode(active) {
    devModeActive = active;
    showToast(active ? '🔧 Dev Mode เปิด — bypass เวลาทำงานแล้ว' : '🔧 Dev Mode ปิด — ใช้เวลาจริง', 'info');
    if (currentLookedUpStudent) updateActionButtons();
}

// ── Tab Navigation ───────────────────────────────────────────────
function switchTab(tab) {
    const tabs  = { register: tabRegister, checkin: tabCheckin, report: tabReport };
    const views = { register: viewRegister, checkin: viewCheckin, report: viewReport };

    Object.values(tabs).forEach(t  => t.classList.remove('active'));
    Object.values(views).forEach(v => v.classList.remove('active'));

    tabs[tab].classList.add('active');
    views[tab].classList.add('active');

    if (tab === 'report') {
        filterAttendanceRecords();
        updateDashboard();
    }
}

// ── Toast ────────────────────────────────────────────────────────
function showToast(message, type = 'success', duration = 3500) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span>${message}</span>
        <button class="toast-close-btn" onclick="this.parentElement.remove()">✕</button>
    `;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 350);
    }, duration);
}

// ── Camera ───────────────────────────────────────────────────────
async function openCameraModal(context = 'register') {
    cameraContext = context;
    document.getElementById('camera-modal-title').textContent =
        context === 'register' ? 'ถ่ายภาพเพื่อลงทะเบียน' : 'ถ่ายภาพยืนยันตัวตน';

    cameraModal.classList.add('active');
    fallbackUpload.classList.add('hidden');
    webcamEl.classList.remove('hidden');
    btnCapture.classList.remove('hidden');

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: 640, height: 480 }, audio: false
        });
        streamInstance = stream;
        webcamEl.setAttribute('playsinline', 'true');
        webcamEl.setAttribute('webkit-playsinline', 'true');
        webcamEl.srcObject = stream;
    } catch (err) {
        console.warn('Camera error:', err);
        webcamEl.classList.add('hidden');
        btnCapture.classList.add('hidden');
        fallbackUpload.classList.remove('hidden');
    }
}

function closeCameraModal() {
    cameraModal.classList.remove('active');
    stopWebcamStream();
}

function stopWebcamStream() {
    if (streamInstance) {
        streamInstance.getTracks().forEach(t => t.stop());
        streamInstance = null;
    }
    webcamEl.srcObject = null;
}

function capturePhoto() {
    if (!streamInstance) return;
    const ctx = photoCanvas.getContext('2d');
    photoCanvas.width  = webcamEl.videoWidth  || 640;
    photoCanvas.height = webcamEl.videoHeight || 480;
    ctx.drawImage(webcamEl, 0, 0, photoCanvas.width, photoCanvas.height);
    const b64 = photoCanvas.toDataURL('image/jpeg', 0.82);
    displayPhotoPreview(b64, cameraContext);
    closeCameraModal();
    showToast('ถ่ายภาพเรียบร้อยแล้ว ✓', 'success');
}

function handleFallbackFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        displayPhotoPreview(e.target.result, cameraContext);
        closeCameraModal();
        showToast('อัปโหลดรูปภาพสำเร็จ ✓', 'success');
    };
    reader.readAsDataURL(file);
}

function displayPhotoPreview(src, context) {
    if (context === 'register') {
        currentPhotoBase64 = src;
        photoPreviewImg.src = src;
        photoPreviewContainer.classList.remove('hidden');
        btnCameraTrigger.innerHTML = '<span>ถ่ายใหม่</span>';
    } else {
        currentCheckinPhoto = src;
        checkinPhotoPreview.src = src;
        checkinPhotoPreviewCon.classList.remove('hidden');
        btnCheckinCamera.querySelector('span').textContent = 'ถ่ายใหม่';
        updateActionButtons();
    }
}

function deletePhoto(context) {
    if (context === 'register') {
        currentPhotoBase64 = null;
        photoPreviewContainer.classList.add('hidden');
        photoPreviewImg.src = '';
        btnCameraTrigger.innerHTML = '<span>ถ่ายรูป</span>';
        showToast('ลบรูปภาพแล้ว', 'warning');
    } else {
        currentCheckinPhoto = null;
        checkinPhotoPreviewCon.classList.add('hidden');
        checkinPhotoPreview.src = '';
        btnCheckinCamera.querySelector('span').textContent = 'ถ่ายรูปยืนยัน';
        showToast('ลบรูปภาพยืนยันแล้ว', 'warning');
        updateActionButtons();
    }
}

// ── Registration ─────────────────────────────────────────────────
function handleRegister(event) {
    event.preventDefault();

    const username  = document.getElementById('username').value.trim();
    const studentId = document.getElementById('student-id').value.trim();

    if (!username || !studentId) {
        showToast('กรุณากรอกข้อมูลให้ครบถ้วน', 'error'); return;
    }
    if (!currentPhotoBase64) {
        showToast('กรุณาถ่ายรูปเพื่อยืนยันตัวตน', 'error'); return;
    }
    if (dbStudents.some(s => s.studentId === studentId)) {
        showToast('รหัสนักศึกษานี้ลงทะเบียนไปแล้ว', 'error'); return;
    }

    const record = {
        id: Date.now().toString(),
        username,
        studentId,
        photo: currentPhotoBase64,
        registeredAt: new Date().toLocaleString('th-TH', { hour12: false })
    };

    dbStudents.unshift(record);
    saveStudents();
    document.getElementById('registration-form').reset();
    deletePhoto('register');
    updateRecordCount();
    updateDashboard();
    showToast(`ลงทะเบียน "${username}" สำเร็จ ✓`, 'success');
    setTimeout(() => switchTab('checkin'), 1400);
}

function saveStudents() {
    localStorage.setItem('students', JSON.stringify(dbStudents));
}

function updateRecordCount() {
    recordCount.textContent = dbStudents.length;
}

// ── Student Lookup ───────────────────────────────────────────────
function lookupStudent() {
    const id = checkinStudentId.value.trim();

    currentLookedUpStudent = null;
    currentCheckinPhoto    = null;
    currentRemark          = '';
    isCheckingInVeryLate   = false;
    updateRemarkUI();

    studentInfoCard.classList.add('hidden');
    studentNotFound.classList.add('hidden');
    checkinPhotoSection.classList.add('hidden');
    checkinPhotoPreviewCon.classList.add('hidden');
    remarkSection.classList.add('hidden');
    actionButtons.classList.add('hidden');

    if (id.length < 2) return;

    const found = dbStudents.find(s => s.studentId === id);
    if (!found) {
        studentNotFound.classList.remove('hidden');
        return;
    }

    currentLookedUpStudent = found;

    studentInfoPhoto.src = found.photo;
    studentInfoName.textContent  = found.username;
    studentInfoIdEl.textContent  = `รหัส: ${found.studentId}`;
    studentInfoCard.classList.remove('hidden');

    // Check if checked in today
    const rec = getTodayRecord(found.studentId);
    if (rec) {
        updateTodayStatusPill(found.studentId);
        showToast('วันนี้คุณได้ลงเวลาเข้าแล้ว', 'warning');
        
        // If they haven't checked out yet, allow check-out
        if (rec.status !== 'checked_out') {
            checkinPhotoSection.classList.remove('hidden');
            remarkSection.classList.remove('hidden');
            actionButtons.classList.remove('hidden');
            updateActionButtons();
        }
    } else {
        // Not checked in today -> trigger auto check-in
        triggerAutoCheckin(found);
    }
}

function getTodayRecord(studentId) {
    const today = getTodayDateStr();
    return dbAttendance.find(r => r.studentId === studentId && r.date === today) || null;
}

// Stored in standardized format YYYY-MM-DD
function getTodayDateStr() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function updateTodayStatusPill(studentId) {
    const rec = getTodayRecord(studentId);
    studentTodayStatus.className = 'today-status-pill';

    if (!rec) {
        studentTodayStatus.classList.add('status-none');
        studentTodayStatus.textContent = 'ยังไม่ลงเวลา';
    } else if (rec.status === 'checked_out') {
        studentTodayStatus.classList.add('status-checkout');
        studentTodayStatus.textContent = `ออกงานแล้ว ${rec.checkOut} น.`;
    } else if (rec.status === 'verylate') {
        studentTodayStatus.classList.add('status-verylate');
        studentTodayStatus.textContent = `สายมาก — ${rec.checkIn} น.`;
    } else if (rec.status === 'late') {
        studentTodayStatus.classList.add('status-late');
        studentTodayStatus.textContent = `มาสาย — ${rec.checkIn} น.`;
    } else {
        studentTodayStatus.classList.add('status-ontime');
        studentTodayStatus.textContent = `ตรงเวลา — ${rec.checkIn} น.`;
    }
}

function updateActionButtons() {
    if (!currentLookedUpStudent) return;

    const rec  = getTodayRecord(currentLookedUpStudent.studentId);
    const now = getNowMinutes();
    const CO_OPEN = toMinutes(16, 30);
    const CO_CLOSE = toMinutes(17, 0);
    
    const isCheckoutTime = (now >= CO_OPEN && now <= CO_CLOSE);
    const hasPhoto = !!currentCheckinPhoto;

    if (rec && rec.status === 'checked_out') {
        btnCheckout.disabled = true;
        return;
    }

    const canCheckout = rec && rec.status !== 'checked_out' && (devModeActive || isCheckoutTime);
    btnCheckout.disabled = !(canCheckout && hasPhoto);
}

// ── Remark Modal ─────────────────────────────────────────────────
function openRemarkModal() {
    remarkTextarea.value = currentRemark;
    remarkModal.classList.add('active');
    setTimeout(() => remarkTextarea.focus(), 200);
}

function closeRemarkModal() {
    remarkModal.classList.remove('active');
    if (isCheckingInVeryLate) {
        isCheckingInVeryLate = false;
        // Reset lookup input since check-in was cancelled
        checkinStudentId.value = '';
        currentLookedUpStudent = null;
        studentInfoCard.classList.add('hidden');
        checkinPhotoSection.classList.add('hidden');
        checkinPhotoPreviewCon.classList.add('hidden');
        actionButtons.classList.add('hidden');
        remarkSection.classList.add('hidden');
    }
}

function setQuickRemark(text) {
    remarkTextarea.value = text;
}

function saveRemark() {
    const val = remarkTextarea.value.trim();
    
    if (isCheckingInVeryLate) {
        if (!val) {
            showToast('กรุณาระบุเหตุผลการมาสาย', 'error');
            return;
        }
        // Save check-in with verylate status
        saveAutoCheckinRecord(currentLookedUpStudent, 'verylate', val);
        isCheckingInVeryLate = false;
        closeRemarkModal();
    } else {
        // Normal remark editing
        currentRemark = val;
        closeRemarkModal();
        updateRemarkUI();
        
        if (currentLookedUpStudent) {
            const rec = getTodayRecord(currentLookedUpStudent.studentId);
            if (rec) {
                rec.remark = val;
                saveAttendance();
                filterAttendanceRecords();
            }
        }
        if (val) showToast('บันทึกหมายเหตุแล้ว ✓', 'success');
    }
}
function updateRemarkUI() {
    if (currentRemark) {
        btnOpenRemark.classList.add('has-remark');
        remarkIndicator.classList.remove('hidden');
        remarkPreviewText.textContent = `"${currentRemark}"`;
    } else {
        btnOpenRemark.classList.remove('has-remark');
        remarkIndicator.classList.add('hidden');
        remarkPreviewText.textContent = '';
    }
    if (currentLookedUpStudent) updateActionButtons();
}

// ── Check-in Logic ───────────────────────────────────────────────
function triggerAutoCheckin(student) {
    const now = new Date();
    const hh = now.getHours();
    const mm = now.getMinutes();
    
    const currentMin = hh * 60 + mm;
    const CI_OPEN = toMinutes(7, 0);
    const CI_LATE = toMinutes(8, 0);
    const CI_VERYLATE = toMinutes(8, 30);

    if (!devModeActive && currentMin < CI_OPEN) {
        showToast('🔒 ยังไม่เปิดให้ลงเวลาเข้างาน (เปิด 07:00 น.)', 'error');
        return;
    }

    if (devModeActive || (currentMin >= CI_OPEN && currentMin <= CI_LATE)) {
        // 07:00 - 08:00 -> ontime
        saveAutoCheckinRecord(student, 'ontime', '');
    } else if (currentMin > CI_LATE && currentMin <= CI_VERYLATE) {
        // 08:01 - 08:30 -> late
        saveAutoCheckinRecord(student, 'late', '');
    } else {
        // หลัง 08:30 -> verylate
        isCheckingInVeryLate = true;
        currentLookedUpStudent = student;
        openRemarkModal();
    }
}

function saveAutoCheckinRecord(student, status, remark) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    const record = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        studentId: student.studentId,
        name: student.username,
        date: getTodayDateStr(),
        checkIn: timeStr,
        checkOut: '',
        status: status,
        remark: remark,
        checkInPhoto: '',
        checkOutPhoto: ''
    };

    dbAttendance.unshift(record);
    saveAttendance();

    updateTodayStatusPill(student.studentId);
    updateDashboard();
    filterAttendanceRecords();

    let thaiStatus = 'ตรงเวลา';
    let toastType = 'success';
    if (status === 'late') {
        thaiStatus = 'มาสาย';
        toastType = 'warning';
    } else if (status === 'verylate') {
        thaiStatus = 'สายมาก';
        toastType = 'error';
    }

    showToast(`✅ บันทึกเวลาเข้างานอัตโนมัติ ${timeStr} น. — สถานะ: ${thaiStatus}`, toastType, 4500);
    autoSaveToExcel();

    // Allow check-out workflow if they need to check out later
    checkinPhotoSection.classList.remove('hidden');
    remarkSection.classList.remove('hidden');
    actionButtons.classList.remove('hidden');
    updateActionButtons();
}

function handleCheckIn() {
    // Hidden in UI, auto check-in is used
}

// ── Check-out Logic ──────────────────────────────────────────────
function handleCheckOut() {
    if (!currentLookedUpStudent) return;

    const now = getNowMinutes();
    const CO_OPEN = toMinutes(16, 30);
    const CO_CLOSE = toMinutes(17, 0);
    const isCheckoutTime = (now >= CO_OPEN && now <= CO_CLOSE);

    if (!devModeActive && !isCheckoutTime) {
        showToast('ไม่อยู่ในช่วงเวลาลงเวลาออกงาน (16:30 – 17:00 น.)', 'error'); return;
    }

    if (!currentCheckinPhoto) {
        showToast('กรุณาถ่ายรูปยืนยันตัวตนก่อนลงเวลาออกงาน', 'error'); return;
    }

    const rec = getTodayRecord(currentLookedUpStudent.studentId);
    if (!rec) {
        showToast('ยังไม่ได้ลงเวลาเข้างานวันนี้', 'error'); return;
    }
    if (rec.checkOut || rec.status === 'checked_out') {
        showToast('คุณได้ลงเวลาออกงานวันนี้แล้ว', 'warning'); return;
    }

    const timeNow = new Date();
    const timeStr = timeNow.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });

    const idx = dbAttendance.findIndex(r => r.studentId === rec.studentId && r.date === rec.date);
    if (idx !== -1) {
        dbAttendance[idx].checkOut  = timeStr;
        dbAttendance[idx].checkOutPhoto = currentCheckinPhoto;
        dbAttendance[idx].status        = 'checked_out';
        if (currentRemark && !dbAttendance[idx].remark) {
            dbAttendance[idx].remark = currentRemark;
        }
    }

    saveAttendance();
    updateTodayStatusPill(currentLookedUpStudent.studentId);
    resetCheckinState();
    updateDashboard();
    filterAttendanceRecords();
    showToast(`🔵 บันทึกเวลาออกงาน ${timeStr} น. เรียบร้อยแล้ว`, 'success', 4500);

    autoSaveToExcel();
}

function resetCheckinState() {
    currentCheckinPhoto = null;
    currentRemark       = '';
    updateRemarkUI();
    checkinPhotoPreviewCon.classList.add('hidden');
    checkinPhotoPreview.src = '';
    btnCheckinCamera.querySelector('span').textContent = 'ถ่ายรูปยืนยัน';
    updateActionButtons();
}

// ── Attendance Storage ───────────────────────────────────────────
function saveAttendance() {
    localStorage.setItem('attendanceRecords', JSON.stringify(dbAttendance));
}

// ── Dashboard Logic ──────────────────────────────────────────────
function updateDashboard() {
    const totalEl = document.getElementById('val-total');
    const ontimeEl = document.getElementById('val-ontime');
    const lateEl = document.getElementById('val-late');
    const verylateEl = document.getElementById('val-verylate');
    const doneEl = document.getElementById('val-done');

    if (!totalEl || !ontimeEl || !lateEl || !verylateEl || !doneEl) return;

    const todayDate = getTodayDateStr();

    totalEl.textContent = dbStudents.length;

    const todayRecords = dbAttendance.filter(r => r.date === todayDate);

    const ontimeToday = todayRecords.filter(r => r.status === 'ontime');
    ontimeEl.textContent = ontimeToday.length;

    const lateToday = todayRecords.filter(r => r.status === 'late');
    lateEl.textContent = lateToday.length;

    const verylateToday = todayRecords.filter(r => r.status === 'verylate');
    verylateEl.textContent = verylateToday.length;

    const doneToday = todayRecords.filter(r => r.status === 'checked_out' || r.checkOut);
    doneEl.textContent = doneToday.length;
}

// ── Search & Filter Logic ────────────────────────────────────────
function filterAttendanceRecords() {
    const q = searchInput.value.toLowerCase().trim();
    const filterDate = document.getElementById('filter-date').value; // YYYY-MM-DD
    const filterStatus = document.getElementById('filter-status').value;

    let filtered = dbAttendance;

    if (q) {
        filtered = filtered.filter(r => 
            (r.name && r.name.toLowerCase().includes(q)) || 
            (r.username && r.username.toLowerCase().includes(q)) || 
            r.studentId.toLowerCase().includes(q)
        );
    }

    if (filterDate) {
        filtered = filtered.filter(r => r.date === filterDate);
    }

    if (filterStatus) {
        filtered = filtered.filter(r => {
            if (filterStatus === 'checked_out') {
                return r.status === 'checked_out' || !!r.checkOut;
            }
            return r.status === filterStatus;
        });
    }

    renderAttendanceTable(filtered);
}

// Backward compatibility wrapper
function filterAttendance() {
    filterAttendanceRecords();
}

// ── Date Display Formatter ───────────────────────────────────────
function formatDisplayDate(dateStr) {
    if (!dateStr) return '—';
    if (!dateStr.includes('-')) return dateStr;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        const y = parseInt(parts[0]) + 543; // BE Year
        const m = parts[1];
        const d = parts[2];
        return `${d}/${m}/${y}`;
    }
    return dateStr;
}

// ── Report Table ─────────────────────────────────────────────────
function renderAttendanceTable(data = dbAttendance) {
    attendanceTbody.innerHTML = '';

    if (data.length === 0) {
        noAttendanceEl.classList.remove('hidden');
        attendanceTable.classList.add('hidden');
        reportSummary.textContent = 'ทั้งหมด 0 รายการ';
        return;
    }

    noAttendanceEl.classList.add('hidden');
    attendanceTable.classList.remove('hidden');
    reportSummary.textContent = `ทั้งหมด ${data.length} รายการ`;

    data.forEach((rec, i) => {
        const student = dbStudents.find(s => s.studentId === rec.studentId);
        const photo   = student ? student.photo : '';

        let statusClass = 'tbl-pending';
        let displayStatus = 'On Time';

        if (rec.status === 'checked_out' || rec.checkOut) {
            statusClass = 'tbl-checkout';
            displayStatus = 'Checked Out';
        } else if (rec.status === 'verylate') {
            statusClass = 'tbl-verylate';
            displayStatus = 'Very Late';
        } else if (rec.status === 'late') {
            statusClass = 'tbl-late';
            displayStatus = 'Late';
        } else {
            statusClass = 'tbl-ontime';
            displayStatus = 'On Time';
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="color:var(--text-muted);text-align:center">${i + 1}</td>
            <td>
                <div style="display:flex;align-items:center;gap:8px;">
                    ${photo ? `<img src="${photo}" class="table-photo" alt="">` : ''}
                    <span style="font-weight:500">${rec.name || rec.username}</span>
                </div>
            </td>
            <td style="font-family:'Inter',monospace;font-size:0.78rem;color:var(--text-muted)">${rec.studentId}</td>
            <td>${formatDisplayDate(rec.date)}</td>
            <td style="font-weight:500">${rec.checkIn || '—'}</td>
            <td style="font-weight:500">${rec.checkOut || '—'}</td>
            <td><span class="tbl-status ${statusClass}">${displayStatus}</span></td>
            <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-muted);font-size:0.78rem" title="${rec.remark || ''}">${rec.remark || '—'}</td>
            <td>
                <button class="btn-table-photo" onclick="openPhotoModal('${rec.checkInPhoto || ''}', '${rec.name || rec.username}', 'เวลาเข้า: ${rec.checkIn || '—'} น.', 'checkin')">ดูรูปเข้า</button>
            </td>
            <td>
                <button class="btn-table-photo" onclick="openPhotoModal('${rec.checkOutPhoto || ''}', '${rec.name || rec.username}', 'เวลาออก: ${rec.checkOut || '—'} น.', 'checkout')">ดูรูปออก</button>
            </td>
            <td style="text-align:center">
                <button style="background:none;border:none;color:#9fb3c8;cursor:pointer;font-size:1rem;padding:4px;transition:color 0.2s;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#9fb3c8'" onclick="deleteAttendance('${rec.id || rec.studentId + '_' + rec.date}')" title="ลบ">✕</button>
            </td>
        `;
        attendanceTbody.appendChild(tr);
    });
}

function deleteAttendance(id) {
    if (!confirm('ลบรายการนี้ใช่ไหม?')) return;
    dbAttendance = dbAttendance.filter(r => r.id !== id && (r.studentId + '_' + r.date) !== id);
    saveAttendance();
    filterAttendanceRecords();
    updateDashboard();
    showToast('ลบรายการแล้ว', 'warning');
}

// ── Photo Modal ──────────────────────────────────────────────────
function openPhotoModal(photoSrc, username, timeInfo, photoType) {
    if (!photoSrc) {
        showToast('ไม่พบรูปภาพ', 'warning');
        return;
    }

    const modal = document.getElementById('photo-modal');
    const modalImg = document.getElementById('photo-modal-img');
    const modalName = document.getElementById('photo-modal-name');
    const modalTime = document.getElementById('photo-modal-time');
    const modalTitle = document.getElementById('photo-modal-title');

    if (!modal || !modalImg || !modalName || !modalTime || !modalTitle) return;

    modalImg.src = photoSrc;
    modalName.textContent = username;
    modalTitle.textContent = photoType === 'checkin' ? 'รูปลงเวลาเข้า' : 'รูปลงเวลาออก';
    modalTime.textContent = timeInfo;

    modal.classList.add('active');
}

function closePhotoModal() {
    const modal = document.getElementById('photo-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// ── Admin Actions ────────────────────────────────────────────────
function clearAttendanceOnly() {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลการลงเวลาทั้งหมด?')) return;
    dbAttendance = [];
    localStorage.removeItem('attendanceRecords');
    localStorage.removeItem('attendance_records');
    updateDashboard();
    filterAttendanceRecords();
    showToast('ล้างข้อมูลการลงเวลาแล้ว', 'success');
}

function clearStudentsOnly() {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลนักศึกษาทั้งหมด?')) return;
    dbStudents = [];
    localStorage.removeItem('students');
    localStorage.removeItem('student_records');
    updateRecordCount();
    updateDashboard();
    filterAttendanceRecords();
    showToast('ล้างข้อมูลนักศึกษาแล้ว', 'success');
}

function clearAllData() {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลทั้งหมดในระบบ?')) return;
    dbStudents = [];
    dbAttendance = [];
    localStorage.removeItem('students');
    localStorage.removeItem('student_records');
    localStorage.removeItem('attendanceRecords');
    localStorage.removeItem('attendance_records');
    updateRecordCount();
    updateDashboard();
    filterAttendanceRecords();
    showToast('ล้างข้อมูลทั้งหมดในระบบเรียบร้อยแล้ว', 'success');
}

// ── Excel Export ─────────────────────────────────────────────────
function buildExcelData() {
    const header = ['ลำดับ', 'ชื่อ', 'รหัสนักศึกษา', 'วันที่', 'เวลาเข้า', 'เวลาออก', 'สถานะ', 'เหตุผลการมาสาย', 'มีรูปเข้า', 'มีรูปออก'];
    const rows = dbAttendance.map((rec, i) => {
        let displayStatus = 'On Time';
        if (rec.status === 'checked_out' || rec.checkOut) {
            displayStatus = 'Checked Out';
        } else if (rec.status === 'verylate') {
            displayStatus = 'Very Late';
        } else if (rec.status === 'late') {
            displayStatus = 'Late';
        }

        return [
            i + 1,
            rec.name || rec.username || '',
            rec.studentId,
            formatDisplayDate(rec.date),
            rec.checkIn  || '—',
            rec.checkOut || '—',
            displayStatus,
            rec.remark || '—',
            rec.checkInPhoto ? 'ใช่' : 'ไม่ใช่',
            rec.checkOutPhoto ? 'ใช่' : 'ไม่ใช่'
        ];
    });
    return [header, ...rows];
}

function exportToExcel() {
    if (dbAttendance.length === 0) {
        showToast('ไม่มีข้อมูลสำหรับส่งออก', 'warning'); return;
    }

    const wb   = XLSX.utils.book_new();
    const ws   = XLSX.utils.aoa_to_sheet(buildExcelData());

    ws['!cols'] = [
        { wch: 6 }, { wch: 24 }, { wch: 14 }, { wch: 14 },
        { wch: 10 }, { wch: 10 }, { wch: 16 }, { wch: 24 },
        { wch: 10 }, { wch: 10 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'รายงานการลงเวลา');

    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const filename = `attendance_${y}-${m}-${d}_${hh}-${mm}.xlsx`;

    XLSX.writeFile(wb, filename);
    showToast('ดาวน์โหลดไฟล์ Excel สำเร็จ ✓', 'success');
}

function autoSaveToExcel() {
    if (typeof XLSX === 'undefined') return;
    try {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(buildExcelData());
        ws['!cols'] = [
            { wch: 6 }, { wch: 24 }, { wch: 14 }, { wch: 14 },
            { wch: 10 }, { wch: 10 }, { wch: 16 }, { wch: 24 },
            { wch: 10 }, { wch: 10 }
        ];
        XLSX.utils.book_append_sheet(wb, ws, 'รายงานการลงเวลา');
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const filename = `attendance_${y}-${m}-${d}_${hh}-${mm}.xlsx`;
        XLSX.writeFile(wb, filename);
        showToast('💾 บันทึกไฟล์ Excel อัตโนมัติแล้ว', 'info', 2500);
    } catch (e) {
        console.warn('Auto-save Excel failed:', e);
    }
}
