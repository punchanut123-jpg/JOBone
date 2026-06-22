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
let isAdminAuthenticated    = false; // เช็คว่าแอดมินล็อกอินผ่าน PIN หรือยัง

// ตัวแปรเก็บค่าช่วงเวลาทำงาน (เจมส์ ปรับปรุงดึงค่าแฮนเดิลอัตโนมัติ)
let timeConfig = {
    ciOpen: '07:00',
    ciOntime: '08:00',
    ciClose: '08:30',
    coOpen: '16:30',
    coClose: '17:00'
};

// 🌐 ชุดรหัสกุญแจเชื่อมต่อคลาวด์ Firebase Firestore ตัวจริงของคณะ IT (เจมส์ ถอดค่าให้เข้ากับระบบเดิม)
const firebaseConfig = {
    apiKey: "AIzaSyDGRW_m1puYzumzE-qNYXO9n7IMwAgdV74",
    authDomain: "jobnoe-4d585.firebaseapp.com",
    projectId: "jobnoe-4d585",
    storageBucket: "jobnoe-4d585.firebasestorage.app",
    messagingSenderId: "599444815367",
    appId: "1:599444815367:web:bf7fb38e6f4751cb23b4a2",
    measurementId: "G-H47Z0EFHWC"
};

// 🚨 ปรับแก้ตรงนี้เพื่อให้ทำงานร่วมกับ CDN Compat Mode ได้อย่างราบรื่นครับ
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore(); // ✨ สำคัญมาก! ต้องประกาศ db ไว้ใช้คุยกับ Firestore คลาวด์ครับ

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
document.addEventListener('DOMContentLoaded', async () => {

    // 1. โหลดการตั้งค่าช่วงเวลางานและรหัส PIN จากคลาวด์ก่อนเสมอ
    try {
        const configDoc = await db.collection('config').doc('settings').get();
        if (configDoc.exists) {
            const remoteData = configDoc.data();
            if (remoteData.timeConfig) timeConfig = remoteData.timeConfig;
            if (remoteData.admin_pin) localStorage.setItem('admin_pin', remoteData.admin_pin);
        } else {
            // หากยังไม่มี Document ในคลาวด์ ให้สร้างค่าเริ่มต้นทิ้งไว้
            await db.collection('config').doc('settings').set({ timeConfig, admin_pin: '1234' });
        }
        loadTimeSettingsUI();
    } catch (e) {
        const savedConfig = localStorage.getItem('timeConfig');
        if (savedConfig) timeConfig = JSON.parse(savedConfig);
        loadTimeSettingsUI();
    }

    // 2. เรียกเอนจินออนไลน์ กวาดข้อมูลจากคลาวด์ Firestore ลงแรมทันที
    showToast('🌐 กำลังซิงค์ฐานข้อมูลออนไลน์คณะ IT...', 'info', 2000);
    const cloudConnected = await syncDataFromFirestore();

    if (cloudConnected) {
        showToast('✅ เชื่อมต่อฐานข้อมูลออนไลน์สำเร็จ', 'success', 2000);
        // ย้ายข้อมูลเก่าจาก LocalStorage ขึ้นคลาวด์ (ทำเพียงครั้งเดียว)
        await migrateLocalDataToCloud();
    } else {
        showToast('⚠️ ไม่สามารถเชื่อมต่อคลาวด์ได้ ระบบรันโหมด Offline สำรอง', 'warning', 4000);
        migrateKeysIfNeeded();
    }

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

// ── ดึงข้อมูลทั้งหมดจาก Firestore เข้า RAM ─────────────────────
async function syncDataFromFirestore() {
    try {
        // 1. ดึงข้อมูลรายชื่อนักศึกษาฝึกงาน/จ้างงานทั้งหมดจากคอลเลกชัน 'students'
        const studentSnap = await db.collection('students').get();
        dbStudents = studentSnap.docs.map(doc => doc.data());

        // 2. ดึงประวัติการเข้าทำงานทั้งหมด เรียงลำดับตามวันที่จากใหม่ไปเก่า
        const attendanceSnap = await db.collection('attendance').orderBy('date', 'desc').get();
        dbAttendance = attendanceSnap.docs.map(doc => ({
            ...doc.data(),
            _docId: doc.id  // เก็บ Firestore document ID ไว้สำหรับอ้างอิงตอน update checkout
        }));

        console.log('🌐 [Firebase] ซิงค์ข้อมูลลง RAM เรียบร้อยสำเร็จ:', {
            studentsCount: dbStudents.length,
            attendanceCount: dbAttendance.length
        });
        return true; // ✅ เชื่อมต่อสำเร็จ
    } catch (error) {
        console.error('❌ [Firebase] เกิดข้อผิดพลาดในฟังก์ชัน syncDataFromFirestore:', error);
        // โหมดสำรองออฟไลน์ — ดึงจากแคชในเครื่อง
        dbStudents   = JSON.parse(localStorage.getItem('students') || '[]');
        dbAttendance = JSON.parse(localStorage.getItem('attendanceRecords') || '[]');
        return false; // ⚠️ เชื่อมต่อล้มเหลว ใช้ข้อมูลจาก LocalStorage แทน
    }
}

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

// แปลงข้อความ HH:MM ให้กลายเป็นตัวเลขนาทีสำหรับการคิด Logic
function strToMinutes(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    return toMinutes(parseInt(parts[0]) || 0, parseInt(parts[1]) || 0);
}

function getTimeWindow() {
    if (devModeActive) return 'dev';

    const now = getNowMinutes();
    const CI_OPEN   = strToMinutes(timeConfig.ciOpen);
    const CI_ONTIME = strToMinutes(timeConfig.ciOntime);
    const CI_CLOSE  = strToMinutes(timeConfig.ciClose);
    const CO_OPEN   = strToMinutes(timeConfig.coOpen);
    const CO_CLOSE  = strToMinutes(timeConfig.coClose);

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
        'ontime':  { cls: 'window-open-in',   txt: `✅ เปิดรับลงเวลาเข้างาน (ตรงเวลา) ${timeConfig.ciOpen} – ${timeConfig.ciOntime} น.` },
        'late':    { cls: 'window-open-late',  txt: `⚠️ เปิดรับลงเวลาเข้างาน (มาสาย) ${timeConfig.ciOntime} – ${timeConfig.ciClose} น.` },
        'verylate':{ cls: 'window-closed',     txt: `🚨 ลงเวลาเข้างานสายมาก (ต้องระบุเหตุผล) หลัง ${timeConfig.ciClose} น.` },
        'checkout':{ cls: 'window-open-out',   txt: `🔵 เปิดรับลงเวลาออกงาน ${timeConfig.coOpen} – ${timeConfig.coClose} น.` },
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
async function switchTab(tab) {
    if (tab === 'report' && !isAdminAuthenticated) {
        openPinModal();
        return;
    }

    const tabs  = { register: tabRegister, checkin: tabCheckin, report: tabReport };
    const views = { register: viewRegister, checkin: viewCheckin, report: viewReport };

    Object.values(tabs).forEach(t  => t.classList.remove('active'));
    Object.values(views).forEach(v => v.classList.remove('active'));

    tabs[tab].classList.add('active');
    views[tab].classList.add('active');

    if (tab === 'report') {
        try {
            // ซิงค์ดึงข้อมูลสด ๆ จากคลาวด์ก่อนเปิดหน้ารายงาน
            await syncDataFromFirestore();
        } catch(e) { console.error('Refresh report failed:', e); }

        filterAttendanceRecords();
        updateDashboard();
        loadTimeSettingsUI();
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

// ── Image Compression Engine ─────────────────────────────────────
/**
 * บีบอัดรูปภาพให้ไม่เกิน maxKB KB และ maxSize px
 * คืนค่า Promise<base64string>
 */
function compressImage(src, maxKB = 80, maxSize = 480) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let { width, height } = img;

            // ย่อขนาดถ้าใหญ่เกิน
            if (width > maxSize || height > maxSize) {
                if (width > height) {
                    height = Math.round((height / width) * maxSize);
                    width  = maxSize;
                } else {
                    width  = Math.round((width / height) * maxSize);
                    height = maxSize;
                }
            }

            canvas.width  = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // ลด quality จนไม่เกิน maxKB
            let quality = 0.82;
            let result  = canvas.toDataURL('image/jpeg', quality);

            while (result.length > maxKB * 1024 * 1.37 && quality > 0.2) {
                quality -= 0.08;
                result = canvas.toDataURL('image/jpeg', quality);
            }

            resolve(result);
        };
        img.src = src;
    });
}

function capturePhoto() {
    if (!streamInstance) return;
    const ctx = photoCanvas.getContext('2d');
    photoCanvas.width  = webcamEl.videoWidth  || 640;
    photoCanvas.height = webcamEl.videoHeight || 480;
    ctx.drawImage(webcamEl, 0, 0, photoCanvas.width, photoCanvas.height);
    const raw = photoCanvas.toDataURL('image/jpeg', 0.92);
    closeCameraModal();

    compressImage(raw).then(compressed => {
        displayPhotoPreview(compressed, cameraContext);
        showToast('ถ่ายภาพเรียบร้อยแล้ว ✓', 'success');
    });
}

function handleFallbackFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        closeCameraModal();
        compressImage(e.target.result).then(compressed => {
            displayPhotoPreview(compressed, cameraContext);
            showToast('อัปโหลดรูปภาพสำเร็จ ✓', 'success');
        });
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
async function handleRegister(event) {
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

    try {
        // บันทึกขึ้น Firestore โดยใช้ studentId เป็น document key
        await db.collection('students').doc(studentId).set(record);
        dbStudents.unshift(record);
        localStorage.setItem('students', JSON.stringify(dbStudents)); // สำรองโลคอลเผื่อออฟไลน์

        document.getElementById('registration-form').reset();
        deletePhoto('register');
        updateRecordCount();
        updateDashboard();
        showToast(`ลงทะเบียน "${username}" ขึ้นระบบคลาวด์สำเร็จ ✓`, 'success');
        setTimeout(() => switchTab('checkin'), 1400);
    } catch (err) {
        console.error(err);
        showToast('❌ ไม่สามารถบันทึกข้อมูลลงฐานข้อมูลออนไลน์ได้', 'error');
    }
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
    const CO_OPEN = strToMinutes(timeConfig.coOpen);
    const CO_CLOSE = strToMinutes(timeConfig.coClose);
    
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
    const CI_OPEN = strToMinutes(timeConfig.ciOpen);
    const CI_LATE = strToMinutes(timeConfig.ciOntime);
    const CI_VERYLATE = strToMinutes(timeConfig.ciClose);

    if (!devModeActive && currentMin < CI_OPEN) {
        showToast(`🔒 ยังไม่เปิดให้ลงเวลาเข้างาน (เปิด ${timeConfig.ciOpen} น.)`, 'error');
        return;
    }

    if (devModeActive || (currentMin >= CI_OPEN && currentMin <= CI_LATE)) {
        saveAutoCheckinRecord(student, 'ontime', '');
    } else if (currentMin > CI_LATE && currentMin <= CI_VERYLATE) {
        saveAutoCheckinRecord(student, 'late', '');
    } else {
        isCheckingInVeryLate = true;
        currentLookedUpStudent = student;
        openRemarkModal();
    }
}

async function saveAutoCheckinRecord(student, status, remark) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });

    const record = {
        studentId: student.studentId,
        name: student.username,
        date: getTodayDateStr(),
        checkIn: timeStr,
        checkOut: '',
        status: status,
        remark: remark,
        checkInPhoto: currentCheckinPhoto || '',
        checkOutPhoto: ''
    };

    try {
        // เพิ่ม document ใหม่เข้า Firestore และรับ document ID กลับมา
        const docRef = await db.collection('attendance').add(record);
        record._docId = docRef.id;

        dbAttendance.unshift(record);
        localStorage.setItem('attendanceRecords', JSON.stringify(dbAttendance));

        updateTodayStatusPill(student.studentId);
        updateDashboard();
        filterAttendanceRecords();

        let thaiStatus = 'ตรงเวลา'; let toastType = 'success';
        if (status === 'late')     { thaiStatus = 'มาสาย';  toastType = 'warning'; }
        else if (status === 'verylate') { thaiStatus = 'สายมาก'; toastType = 'error'; }

        showToast(`✅ บันทึกเวลาเข้างานออนไลน์เรียบร้อย ${timeStr} น. — สถานะ: ${thaiStatus}`, toastType, 4500);

        checkinPhotoSection.classList.remove('hidden');
        remarkSection.classList.remove('hidden');
        actionButtons.classList.remove('hidden');
        updateActionButtons();
    } catch(err) {
        console.error(err);
        showToast('❌ เกิดข้อผิดพลาดในการบันทึกเวลาเข้างานลงคลาวด์', 'error');
    }
}

function handleCheckIn() {
    // Hidden in UI, auto check-in is used
}

// ── Check-out Logic ──────────────────────────────────────────────
async function handleCheckOut() {
    if (!currentLookedUpStudent) return;

    const now = getNowMinutes();
    const CO_OPEN  = strToMinutes(timeConfig.coOpen);
    const CO_CLOSE = strToMinutes(timeConfig.coClose);
    const isCheckoutTime = (now >= CO_OPEN && now <= CO_CLOSE);

    if (!devModeActive && !isCheckoutTime) {
        showToast(`ไม่อยู่ในช่วงเวลาลงเวลาออกงาน (${timeConfig.coOpen} – ${timeConfig.coClose} น.)`, 'error'); return;
    }
    if (!currentCheckinPhoto) {
        showToast('กรุณาถ่ายรูปยืนยันตัวตนก่อนลงเวลาออกงาน', 'error'); return;
    }

    const rec = getTodayRecord(currentLookedUpStudent.studentId);
    if (!rec)                                    { showToast('ยังไม่ได้ลงเวลาเข้างานวันนี้', 'error'); return; }
    if (rec.checkOut || rec.status === 'checked_out') { showToast('คุณได้ลงเวลาออกงานวันนี้แล้ว', 'warning'); return; }

    const timeStr = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
    const idx = dbAttendance.findIndex(r => r.studentId === rec.studentId && r.date === rec.date);

    if (idx !== -1 && dbAttendance[idx]._docId) {
        const docId = dbAttendance[idx]._docId;
        const cloudUpdate = {
            checkOut: timeStr,
            checkOutPhoto: currentCheckinPhoto,
            status: 'checked_out'
        };
        if (currentRemark && !dbAttendance[idx].remark) cloudUpdate.remark = currentRemark;

        try {
            // อัปเดตเอกสาร Firestore เดิมโดยอ้างอิง document ID
            await db.collection('attendance').doc(docId).update(cloudUpdate);

            dbAttendance[idx].checkOut     = timeStr;
            dbAttendance[idx].checkOutPhoto = currentCheckinPhoto;
            dbAttendance[idx].status        = 'checked_out';
            if (cloudUpdate.remark) dbAttendance[idx].remark = currentRemark;

            localStorage.setItem('attendanceRecords', JSON.stringify(dbAttendance));
            updateTodayStatusPill(currentLookedUpStudent.studentId);
            resetCheckinState();
            updateDashboard();
            filterAttendanceRecords();
            showToast(`🔵 บันทึกเวลาออกงานออนไลน์สำเร็จ ${timeStr} น.`, 'success', 4500);
            autoSaveToExcel();
        } catch(err) {
            console.error(err);
            showToast('❌ ไม่สามารถส่งเวลาออกงานขึ้นระบบคลาวด์ได้', 'error');
        }
    }
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
                    <span style="font-weight:500; color:var(--accent-color); cursor:pointer; white-space: nowrap;" onclick="openIndividualStatsModal('${rec.studentId}')" title="คลิกเพื่อดูสถิติรายบุคคล">
                        ${rec.name || rec.username} 🔍
                    </span>
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
async function clearAttendanceOnly() {
    if (!isAdminAuthenticated) { openPinModal(); return; }
    if (!confirm('⚠️ แอดมินแน่ใจไหม? ข้อมูลประวัติลงเวลาบนคลาวด์ทั้งหมดจะถูกลบถาวร!')) return;

    try {
        const snap = await db.collection('attendance').get();
        const batch = db.batch();
        snap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        dbAttendance = [];
        localStorage.removeItem('attendanceRecords');
        localStorage.removeItem('attendance_records');
        updateDashboard();
        filterAttendanceRecords();
        showToast('🗑️ ล้างประวัติการทำงานบนคลาวด์เรียบร้อยแล้ว', 'success');
    } catch(e) {
        console.error(e);
        showToast('❌ ไม่สามารถเคลียร์ข้อมูลออนไลน์ได้', 'error');
    }
}

async function clearStudentsOnly() {
    if (!isAdminAuthenticated) { openPinModal(); return; }
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลนักศึกษาทั้งหมด?')) return;

    try {
        const snap = await db.collection('students').get();
        const batch = db.batch();
        snap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        dbStudents = [];
        localStorage.removeItem('students');
        localStorage.removeItem('student_records');
        updateRecordCount();
        updateDashboard();
        filterAttendanceRecords();
        showToast('ล้างข้อมูลนักศึกษาบนคลาวด์แล้ว', 'success');
    } catch(e) {
        console.error(e);
        showToast('❌ ไม่สามารถเคลียร์ข้อมูลนักศึกษาออนไลน์ได้', 'error');
    }
}

async function clearAllData() {
    if (!isAdminAuthenticated) { openPinModal(); return; }
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลทั้งหมดในระบบ?')) return;

    try {
        const [aSnap, sSnap] = await Promise.all([
            db.collection('attendance').get(),
            db.collection('students').get()
        ]);
        const batch = db.batch();
        aSnap.docs.forEach(doc => batch.delete(doc.ref));
        sSnap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        dbStudents = []; dbAttendance = [];
        localStorage.removeItem('students');
        localStorage.removeItem('student_records');
        localStorage.removeItem('attendanceRecords');
        localStorage.removeItem('attendance_records');
        updateRecordCount(); updateDashboard(); filterAttendanceRecords();
        showToast('ล้างข้อมูลทั้งหมดในระบบคลาวด์เรียบร้อยแล้ว', 'success');
    } catch(e) {
        console.error(e);
        showToast('❌ ไม่สามารถเคลียร์ข้อมูลทั้งหมดออนไลน์ได้', 'error');
    }
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

// ── Admin PIN System (Logic by เจมส์, UI by คลอด) ──────────────
function verifyAdminPIN(inputPIN) {
    const savedPIN = localStorage.getItem('admin_pin') || '1234';
    if (inputPIN === savedPIN) {
        isAdminAuthenticated = true;
        showToast('🔓 เข้าสู่ระบบแอดมินสำเร็จ', 'success');
        return true;
    } else {
        showToast('❌ รหัส PIN ไม่ถูกต้อง กรุณาลองใหม่', 'error');
        return false;
    }
}

function changeAdminPIN(oldPIN, newPIN) {
    const savedPIN = localStorage.getItem('admin_pin') || '1234';
    if (oldPIN !== savedPIN) {
        showToast('❌ รหัสเดิมไม่ถูกต้อง', 'error');
        return false;
    }
    if (!newPIN || newPIN.length < 4) {
        showToast('⚠️ รหัสใหม่ต้องมีอย่างน้อย 4 ตัวอักษร/ตัวเลข', 'warning');
        return false;
    }
    // บันทึกทั้งบน Firestore คลาวด์และ localStorage สำรอง
    db.collection('config').doc('settings').set({ admin_pin: newPIN }, { merge: true })
        .then(() => { showToast('🔑 เปลี่ยนรหัส PIN แอดมินออนไลน์เรียบร้อยแล้ว ✓', 'success'); })
        .catch(() => { showToast('❌ บันทึกรหัสใหม่ลงคลาวด์ล้มเหลว', 'error'); });
    localStorage.setItem('admin_pin', newPIN);
    return true;
}

// ── PIN Modal UI Functions (by คลอด) ────────────────────────────
function openPinModal(onSuccess) {
    const modal = document.getElementById('pin-modal');
    const input = document.getElementById('pin-input');
    const dots  = document.querySelectorAll('.pin-dot');
    if (!modal) return;

    // รีเซ็ต
    input.value = '';
    dots.forEach(d => d.classList.remove('filled'));
    document.getElementById('pin-error').classList.add('hidden');
    document.getElementById('pin-tab-target').value = 'report';

    modal.classList.add('active');
    setTimeout(() => input.focus(), 200);
}

function closePinModal() {
    document.getElementById('pin-modal').classList.remove('active');
    document.getElementById('pin-input').value = '';
    document.querySelectorAll('.pin-dot').forEach(d => d.classList.remove('filled'));
}

function onPinInput(e) {
    const val  = e.target.value.replace(/\D/g, '').slice(0, 6);
    e.target.value = val;
    const dots = document.querySelectorAll('.pin-dot');
    dots.forEach((d, i) => d.classList.toggle('filled', i < val.length));
    document.getElementById('pin-error').classList.add('hidden');
    if (val.length >= 4) submitPin();
}

function submitPin() {
    const val = document.getElementById('pin-input').value;
    if (verifyAdminPIN(val)) {
        closePinModal();
        const target = document.getElementById('pin-tab-target').value || 'report';
        switchTab(target);
    } else {
        document.getElementById('pin-error').classList.remove('hidden');
        document.getElementById('pin-input').value = '';
        document.querySelectorAll('.pin-dot').forEach(d => d.classList.remove('filled'));
    }
}

function logoutAdmin() {
    isAdminAuthenticated = false;
    switchTab('checkin');
    showToast('🔒 ออกจากระบบแอดมินแล้ว', 'info');
}

function appendPin(digit) {
    const input = document.getElementById('pin-input');
    if (input.value.length < 6) {
        input.value += digit;
        onPinInput({ target: input });
    }
}

function clearPin() {
    const input = document.getElementById('pin-input');
    input.value = input.value.slice(0, -1);
    onPinInput({ target: input });
}

// 💾 ฟังก์ชันสำหรับ Export ข้อมูลทั้งหมดออกเป็นไฟล์ JSON (Backup)
function backupDataToJSON() {
    if (dbStudents.length === 0 && dbAttendance.length === 0) {
        showToast('⚠️ ไม่มีข้อมูลในระบบสำหรับสำรองข้อมูล', 'warning');
        return;
    }
    const backupData = {
        version: "1.0",
        backupAt: new Date().toLocaleString('th-TH'),
        students: dbStudents,
        attendance: dbAttendance
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `attendance_backup_${dateStr}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('💾 สำรองข้อมูลเป็นไฟล์ JSON สำเร็จ ✓', 'success');
}

// 📂 ฟังก์ชันกู้คืนข้อมูลจากไฟล์ JSON (Restore)
function restoreDataFromJSON(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (!importedData.students || !importedData.attendance) {
                showToast('❌ รูปแบบไฟล์สำรองไม่ถูกต้อง ไม่สามารถกู้คืนได้', 'error');
                return;
            }
            if (!confirm('⚠️ การกู้คืนข้อมูลจะเขียนทับข้อมูลปัจจุบันทั้งหมดในเครื่องนี้ คุณต้องการดำเนินการต่อใช่หรือไม่?')) {
                event.target.value = '';
                return;
            }
            dbStudents = importedData.students;
            dbAttendance = importedData.attendance;
            localStorage.setItem('students', JSON.stringify(dbStudents));
            localStorage.setItem('attendanceRecords', JSON.stringify(dbAttendance));
            updateRecordCount();
            updateDashboard();
            filterAttendanceRecords();
            showToast('🔄 กู้คืนข้อมูลระบบทั้งหมดเรียบร้อยแล้ว ✓', 'success');
        } catch (err) {
            console.error(err);
            showToast('❌ เกิดข้อผิดพลาดในการอ่านไฟล์ JSON', 'error');
        }
        event.target.value = '';
    };
    reader.readAsText(file);
}

// 🔍 ฟังก์ชันดึงประวัติการลงเวลาและสรุปสถิติเฉพาะบุคคล
function getStudentStatsAndHistory(studentId) {
    const personalHistory = dbAttendance.filter(record => record.studentId === studentId);
    let countOnTime = 0, countLate = 0, countVeryLate = 0;
    personalHistory.forEach(record => {
        if (record.status === 'ontime') countOnTime++;
        else if (record.status === 'late') countLate++;
        else if (record.status === 'verylate') countVeryLate++;
    });
    return {
        studentId: studentId,
        totalRecords: personalHistory.length,
        stats: { onTime: countOnTime, late: countLate, veryLate: countVeryLate },
        history: personalHistory
    };
}

// 📱 ฟังก์ชันเปิด Modal แสดงสถิติและประวัติรายบุคคล
function openIndividualStatsModal(studentId) {
    const student = dbStudents.find(s => s.studentId === studentId);
    if (!student) return;
    const data = getStudentStatsAndHistory(studentId);
    const total = data.totalRecords || 1;
    const pctOnTime = Math.round((data.stats.onTime / total) * 100);
    const pctLate = Math.round((data.stats.late / total) * 100);
    const pctVeryLate = Math.round((data.stats.veryLate / total) * 100);

    document.getElementById('ind-modal-photo').src = student.photo;
    document.getElementById('ind-modal-name').textContent = student.username;
    document.getElementById('ind-modal-id').textContent = `รหัสนักศึกษา: ${student.studentId}`;
    document.getElementById('ind-total-count').textContent = `${data.totalRecords} ครั้ง`;

    document.getElementById('bar-ontime').style.width = `${pctOnTime}%`;
    document.getElementById('val-ontime-pct').textContent = `${data.stats.onTime} ครั้ง (${pctOnTime}%)`;
    document.getElementById('bar-late').style.width = `${pctLate}%`;
    document.getElementById('val-late-pct').textContent = `${data.stats.late} ครั้ง (${pctLate}%)`;
    document.getElementById('bar-verylate').style.width = `${pctVeryLate}%`;
    document.getElementById('val-verylate-pct').textContent = `${data.stats.veryLate} ครั้ง (${pctVeryLate}%)`;

    const tbody = document.getElementById('ind-history-tbody');
    tbody.innerHTML = '';
    if (data.history.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">ยังไม่มีประวัติการลงเวลา</td></tr>`;
    } else {
        data.history.forEach((rec, idx) => {
            let statusText = 'ตรงเวลา', statusClass = 'tbl-ontime';
            if (rec.status === 'late') { statusText = 'มาสาย'; statusClass = 'tbl-late'; }
            else if (rec.status === 'verylate') { statusText = 'สายมาก'; statusClass = 'tbl-verylate'; }
            else if (rec.status === 'checked_out') { statusText = 'ออกงานแล้ว'; statusClass = 'tbl-checkout'; }
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
    document.body.classList.add('modal-open'); // ล็อกสกอร์ลพื้นหลังตัวหลัก
    document.getElementById('individual-modal').classList.add('active');
}

function closeIndividualModal() {
    document.body.classList.remove('modal-open');
    document.getElementById('individual-modal').classList.remove('active');
}

// ⚙️ ฟังก์ชันโหลดค่าเวลาใส่กล่อง UI หน้าต่างรายงานแอดมิน
function loadTimeSettingsUI() {
    const cfgOpen = document.getElementById('cfg-ci-open');
    const cfgOntime = document.getElementById('cfg-ci-ontime');
    const cfgClose = document.getElementById('cfg-ci-close');
    const cfgCoOpen = document.getElementById('cfg-co-open');
    const cfgCoClose = document.getElementById('cfg-co-close');

    if (cfgOpen) cfgOpen.value = timeConfig.ciOpen;
    if (cfgOntime) cfgOntime.value = timeConfig.ciOntime;
    if (cfgClose) cfgClose.value = timeConfig.ciClose;
    if (cfgCoOpen) cfgCoOpen.value = timeConfig.coOpen;
    if (cfgCoClose) cfgCoClose.value = timeConfig.coClose;
}

// ⚙️ บันทึกการตั้งค่าช่วงเวลาขึ้นคลาวด์
async function saveTimeSettings() {
    if (!isAdminAuthenticated) { openPinModal(); return; }

    const ciOpen   = document.getElementById('cfg-ci-open').value;
    const ciOntime = document.getElementById('cfg-ci-ontime').value;
    const ciClose  = document.getElementById('cfg-ci-close').value;
    const coOpen   = document.getElementById('cfg-co-open').value;
    const coClose  = document.getElementById('cfg-co-close').value;

    if (strToMinutes(ciOpen) >= strToMinutes(ciOntime)) {
        showToast('❌ เวลาเปิดรับเข้างาน ต้องน้อยกว่า เวลาสิ้นสุดตรงเวลา', 'error'); return;
    }
    if (strToMinutes(ciOntime) >= strToMinutes(ciClose)) {
        showToast('❌ เวลาสิ้นสุดตรงเวลา ต้องน้อยกว่า เวลาปิดรับเข้างาน', 'error'); return;
    }
    if (strToMinutes(coOpen) >= strToMinutes(coClose)) {
        showToast('❌ เวลาเปิดออกงานตอนเย็น ต้องน้อยกว่า เวลาปิดรับออกงาน', 'error'); return;
    }

    timeConfig = { ciOpen, ciOntime, ciClose, coOpen, coClose };

    try {
        await db.collection('config').doc('settings').set({ timeConfig }, { merge: true });
        localStorage.setItem('timeConfig', JSON.stringify(timeConfig));
        showToast('⚙️ บันทึกการตั้งค่าช่วงเวลาขึ้นระบบคลาวด์สำเร็จ ✓', 'success');
        updateTimeWindowUI(new Date());
    } catch(e) {
        console.error(e);
        showToast('❌ ไม่สามารถบันทึกค่าลงคลาวด์ได้', 'error');
    }
}

// ── Change PIN UI Functions (เจมส์ เพิ่มเติมเพื่อผูกฟังก์ชันหลังบ้าน) ───
function openChangePinModal() {
    if (!isAdminAuthenticated) { openPinModal(); return; } // กันเหนียวถ้าหลุดสิทธิ์

    document.getElementById('cfg-old-pin').value = '';
    document.getElementById('cfg-new-pin').value = '';
    document.getElementById('cfg-confirm-pin').value = '';

    document.getElementById('change-pin-modal').classList.add('active');
    document.body.classList.add('modal-open');
}

function closeChangePinModal() {
    document.getElementById('change-pin-modal').classList.remove('active');
    document.body.classList.remove('modal-open');
}

function submitChangePin() {
    const oldPin    = document.getElementById('cfg-old-pin').value.trim();
    const newPin    = document.getElementById('cfg-new-pin').value.trim();
    const confirmPin = document.getElementById('cfg-confirm-pin').value.trim();

    if (!oldPin || !newPin || !confirmPin) {
        showToast('⚠️ กรุณากรอกข้อมูลให้ครบทุกช่อง', 'warning');
        return;
    }

    if (newPin !== confirmPin) {
        showToast('❌ รหัส PIN ใหม่และช่องยืนยันไม่ตรงกัน', 'error');
        return;
    }

    // เรียกฟังก์ชันหลักหลังบ้านที่มีอยู่แล้วเพื่อตรวจสอบและเซฟค่า
    if (changeAdminPIN(oldPin, newPin)) {
        closeChangePinModal();
    }
}

// 📦 ย้ายข้อมูลเก่าจาก LocalStorage ขึ้น Firestore (ทำงานครั้งเดียวตอนเปิดเว็บ)
async function migrateLocalDataToCloud() {
    const localStudents = JSON.parse(localStorage.getItem('students') || '[]');
    if (localStudents.length > 0 && dbStudents.length === 0) {
        showToast('🔄 พบข้อมูลเก่าในเครื่อง กำลังดันขึ้นคลาวด์...', 'info', 2500);
        for (const s of localStudents) {
            await db.collection('students').doc(s.studentId).set(s, { merge: true });
        }
        const localAttendance = JSON.parse(localStorage.getItem('attendanceRecords') || '[]');
        for (const a of localAttendance) {
            const { _docId, ...data } = a;
            await db.collection('attendance').add(data);
        }
        await syncDataFromFirestore();
        showToast('✅ ย้ายข้อมูลเดิมขึ้นคลาวด์สำเร็จแล้ว', 'success');
    }
}