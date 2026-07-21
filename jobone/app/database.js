// ==========================================
// 🗄️ database.js - คุยกับ Firebase และระบบลงเวลา (พร้อม GPS)
// ==========================================

// 📍 ฟังก์ชันดึงพิกัด GPS ปัจจุบันของผู้ใช้งาน
function getGPSLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            console.warn("เบราว์เซอร์นี้ไม่รองรับ Geolocation");
            resolve(null);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({ lat: position.coords.latitude, lng: position.coords.longitude });
            },
            (error) => {
                console.warn("ไม่สามารถดึงพิกัด GPS ได้:", error);
                resolve(null);
            },
            { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
        );
    });
}

// 🌐 ดึงข้อมูลทั้งหมดจาก Firestore เข้า RAM
async function syncDataFromFirestore() {
    try {
        const studentSnap = await db.collection('students').get();
        dbStudents = studentSnap.docs.map(doc => doc.data());

        const attendanceSnap = await db.collection('attendance').orderBy('date', 'desc').get();
        dbAttendance = attendanceSnap.docs.map(doc => ({
            ...doc.data(),
            _docId: doc.id
        }));
        console.log('🌐 ซิงค์ข้อมูลลง RAM สำเร็จ');
        return true;
    } catch (error) {
        console.error('❌ ซิงค์ล้มเหลว ใช้ข้อมูล LocalStorage:', error);
        dbStudents   = JSON.parse(localStorage.getItem('students') || '[]');
        dbAttendance = JSON.parse(localStorage.getItem('attendanceRecords') || '[]');
        return false;
    }
}

// 📌 ฟังก์ชันลงทะเบียน
async function handleRegister(event) {
    event.preventDefault();
    const username  = document.getElementById('username').value.trim();
    const studentId = document.getElementById('student-id').value.trim();

    if (!username || !studentId) { showToast('กรุณากรอกข้อมูลให้ครบถ้วน', 'error'); return; }
    if (!currentPhotoBase64) { showToast('กรุณาถ่ายรูปเพื่อยืนยันตัวตน', 'error'); return; }
    if (dbStudents.some(s => s.studentId === studentId)) { showToast('รหัสนักศึกษานี้ลงทะเบียนไปแล้ว', 'error'); return; }

    const record = {
        id: Date.now().toString(),
        username,
        studentId,
        photo: currentPhotoBase64,
        registeredAt: new Date().toLocaleString('th-TH', { hour12: false })
    };

    try {
        await db.collection('students').doc(studentId).set(record);
        dbStudents.unshift(record);
        localStorage.setItem('students', JSON.stringify(dbStudents));
        
        document.getElementById('registration-form').reset();
        deletePhoto('register');
        updateRecordCount();
        updateDashboard();
        showToast(`ลงทะเบียน "${username}" สำเร็จ ✓`, 'success');
        setTimeout(() => switchTab('checkin'), 1400);
    } catch (err) {
        showToast('❌ ไม่สามารถบันทึกข้อมูลได้', 'error');
    }
}

// 📌 บันทึกเวลาเข้างาน (ช่วงเช้า) พร้อมเก็บ GPS
async function saveAutoCheckinRecord(student, status, remark) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });

    showToast('📍 กำลังดึงพิกัดตำแหน่ง...', 'info', 1500);
    const location = await getGPSLocation(); // 📍 ดึงพิกัด GPS

    const record = {
        studentId: student.studentId,
        name: student.username,
        date: getTodayDateStr(),   
        checkIn: timeStr,
        checkOut: '',
        status: status,
        remark: remark,
        checkInPhoto: currentCheckinPhoto || '',
        checkOutPhoto: '',
        checkInLocation: location || null, // 📍 เก็บพิกัดขาเข้า
        checkOutLocation: null
    };

    try {
        const docRef = await db.collection('attendance').add(record);
        record._docId = docRef.id;
        record.id     = docRef.id;
        
        dbAttendance.unshift(record);
        localStorage.setItem('attendanceRecords', JSON.stringify(dbAttendance));
        
        updateRecordCount();
        updateTodayStatusPill(student.studentId);
        updateDashboard();
        filterAttendanceRecords();
        
        showToast(`✅ บันทึกเวลาเข้างานเรียบร้อย ${timeStr} น.`, 'success', 4500);
        checkinPhotoSection.classList.remove('hidden');
        remarkSection.classList.remove('hidden');
        actionButtons.classList.remove('hidden');
        btnCheckout.classList.remove('hidden');
        updateActionButtons();
        return record;
    } catch (err) {
        showToast('❌ เกิดข้อผิดพลาดในการบันทึกเวลา', 'error');
        return null;
    }
}

// 🔵 อัปเดตเวลาออกงาน (ตอนเย็น) พร้อมเก็บ GPS ทับเอกสารเดิม
async function handleCheckOut() {
    if (!currentLookedUpStudent) return;
    const now = getNowMinutes();
    const CO_OPEN  = strToMinutes(timeConfig.coOpen);
    const CO_CLOSE = strToMinutes(timeConfig.coClose);

    if (!devModeActive && !(now >= CO_OPEN && now <= CO_CLOSE)) {
        showToast(`ไม่อยู่ในช่วงเวลาลงเวลาออกงาน`, 'error'); return;
    }
    if (!currentCheckinPhoto) { showToast('กรุณาถ่ายรูปยืนยันตัวตน', 'error'); return; }

    const rec = getTodayRecord(currentLookedUpStudent.studentId);
    if (!rec) { showToast('ยังไม่ได้ลงเวลาเข้างานวันนี้', 'error'); return; }
    if (rec.checkOut || rec.status === 'checked_out') { showToast('คุณได้ลงเวลาออกงานวันนี้แล้ว', 'warning'); return; }

    const idx = dbAttendance.findIndex(r => r.studentId === rec.studentId && r.date === rec.date);
    if (idx === -1 || !dbAttendance[idx]._docId) { showToast('❌ ไม่พบรหัสอ้างอิงคลาวด์', 'error'); return; }

    const timeStr = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
    const docId   = dbAttendance[idx]._docId;

    showToast('📍 กำลังดึงพิกัดตำแหน่ง...', 'info', 1500);
    const location = await getGPSLocation(); // 📍 ดึงพิกัด GPS ตอนออกงาน

    const cloudUpdate = {
        checkOut: timeStr,
        checkOutPhoto: currentCheckinPhoto,
        status: 'checked_out',
        checkOutLocation: location || null // 📍 เก็บพิกัดขาออก
    };
    if (currentRemark && !dbAttendance[idx].remark) cloudUpdate.remark = currentRemark;

    try {
        showToast('⏳ กำลังอัปเดตเวลาออกงาน...', 'info', 2000);
        await db.collection('attendance').doc(docId).update(cloudUpdate);
        
        dbAttendance[idx].checkOut      = timeStr;
        dbAttendance[idx].checkOutPhoto = currentCheckinPhoto;
        dbAttendance[idx].status        = 'checked_out';
        dbAttendance[idx].checkOutLocation = location || null;
        if (cloudUpdate.remark) dbAttendance[idx].remark = currentRemark;

        localStorage.setItem('attendanceRecords', JSON.stringify(dbAttendance));
        updateTodayStatusPill(currentLookedUpStudent.studentId);
        resetCheckinState();
        updateDashboard();
        filterAttendanceRecords();
        showToast(`🔵 บันทึกเวลาออกงานสำเร็จ ${timeStr} น.`, 'success', 4500);
        if (typeof autoSaveToExcel === 'function') autoSaveToExcel();
    } catch (err) {
        showToast('❌ ไม่สามารถอัปเดตข้อมูลได้', 'error');
    }
}

// ==========================================
// 🛠️ ส่วนจัดการข้อมูลแอดมินและรายงาน (Admin & Reports)
// ==========================================

async function deleteAttendance(id) {
    if (!confirm('⚠️ คุณแน่ใจไหม? รายการประวัติลงเวลานี้จะถูกลบบนระบบออนไลน์คลาวด์ถาวร!')) return;
    const recordToDelete = dbAttendance.find(r => r.id === id || (r.studentId + '_' + r.date) === id);
    if (recordToDelete && recordToDelete._docId) {
        try {
            showToast('⏳ กำลังลบข้อมูลบนคลาวด์...', 'info', 1500);
            await db.collection('attendance').doc(recordToDelete._docId).delete();
            dbAttendance = dbAttendance.filter(r => r.id !== id && (r.studentId + '_' + r.date) !== id);
            localStorage.setItem('attendanceRecords', JSON.stringify(dbAttendance));
            filterAttendanceRecords();
            updateDashboard();
            showToast('🗑️ ลบรายการบนคลาวด์เรียบร้อยแล้ว', 'warning');
        } catch (error) {
            showToast('❌ ไม่สามารถลบข้อมูลจากฐานข้อมูลคลาวด์ได้', 'error');
        }
    } else {
        dbAttendance = dbAttendance.filter(r => r.id !== id && (r.studentId + '_' + r.date) !== id);
        localStorage.setItem('attendanceRecords', JSON.stringify(dbAttendance));
        filterAttendanceRecords(); updateDashboard();
        showToast('ลบรายการในเครื่องเรียบร้อย', 'warning');
    }
}

async function clearAttendanceOnly() {
    if (!isAdminAuthenticated) { openPinModal(); return; }
    if (!confirm('⚠️ แอดมินแน่ใจไหม? ข้อมูลประวัติลงเวลาบนคลาวด์ทั้งหมดจะถูกลบถาวร!')) return;
    try {
        showToast('⏳ กำลังล้างประวัติการทำงานบนคลาวด์...', 'info', 2000);
        const snap = await db.collection('attendance').get();
        const batch = db.batch();
        snap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        dbAttendance = [];
        localStorage.removeItem('attendanceRecords');
        updateDashboard(); filterAttendanceRecords();
        showToast('🗑️ ล้างประวัติการทำงานบนคลาวด์เรียบร้อยแล้ว', 'success');
    } catch(e) {
        showToast('❌ ไม่สามารถเคลียร์ข้อมูลออนไลน์ได้', 'error');
    }
}

async function clearStudentsOnly() {
    if (!isAdminAuthenticated) { openPinModal(); return; }
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลนักศึกษาทั้งหมด?')) return;
    try {
        showToast('⏳ กำลังล้างข้อมูลนักศึกษาบนคลาวด์...', 'info', 2000);
        const snap = await db.collection('students').get();
        const batch = db.batch();
        snap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        dbStudents = [];
        localStorage.removeItem('students');
        updateRecordCount(); updateDashboard(); filterAttendanceRecords();
        showToast('🧹 ล้างข้อมูลนักศึกษาบนคลาวด์เรียบร้อยแล้ว', 'success');
    } catch(e) {
        showToast('❌ ไม่สามารถเคลียร์ข้อมูลนักศึกษาออนไลน์ได้', 'error');
    }
}

async function clearAllData() {
    if (!isAdminAuthenticated) { openPinModal(); return; }
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลทั้งหมดในระบบ?')) return;
    if (!confirm('🚨 ยืนยันคำรบที่สอง ข้อมูลนักศึกษาและประวัติทั้งหมดบนคลาวด์จะหายไปถาวร!')) return;
    try {
        showToast('⏳ กำลังล้างข้อมูลทั้งหมดบนคลาวด์...', 'info', 3000);
        const [aSnap, sSnap] = await Promise.all([
            db.collection('attendance').get(), db.collection('students').get()
        ]);
        const batch = db.batch();
        aSnap.docs.forEach(doc => batch.delete(doc.ref));
        sSnap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        dbStudents = []; dbAttendance = [];
        localStorage.removeItem('students'); localStorage.removeItem('attendanceRecords');
        updateRecordCount(); updateDashboard(); filterAttendanceRecords();
        showToast('💥 ล้างข้อมูลทั้งหมดในระบบคลาวด์เรียบร้อยแล้ว', 'success');
    } catch(e) {
        showToast('❌ ไม่สามารถเคลียร์ข้อมูลทั้งหมดออนไลน์ได้', 'error');
    }
}

function buildExcelData() {
    const header = ['ลำดับ', 'ชื่อ-นามสกุล', 'รหัสนักศึกษา', 'วันที่ปฏิบัติงาน', 'เวลาเข้างาน', 'เวลาออกงาน', 'สถานะการเข้างาน', 'เหตุผลการมาสาย / หมายเหตุ', 'ถ่ายรูปเข้างาน', 'ถ่ายรูปออกงาน'];
    const rows = dbAttendance.map((rec, i) => {
        let displayStatus = 'ตรงเวลา (On Time)';
        if (rec.status === 'checked_out' || rec.checkOut) displayStatus = 'ออกงานแล้ว (Checked Out)';
        else if (rec.status === 'verylate') displayStatus = 'สายมาก (Very Late)';
        else if (rec.status === 'late') displayStatus = 'มาสาย (Late)';
        return [
            i + 1, rec.name || rec.username || '—', rec.studentId, formatDisplayDate(rec.date),
            rec.checkIn || '—', rec.checkOut || '—', displayStatus, rec.remark || '—',
            rec.checkInPhoto ? 'มีรูปภาพ' : 'ไม่มีรูป', rec.checkOutPhoto ? 'มีรูปภาพ' : 'ไม่มีรูป'
        ];
    });
    return [header, ...rows];
}

function exportToExcel() {
    if (dbAttendance.length === 0) { showToast('⚠️ ไม่มีข้อมูลประวัติลงเวลา', 'warning'); return; }
    try {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(buildExcelData());
        ws['!cols'] = [{ wch: 6 }, { wch: 26 }, { wch: 15 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 30 }, { wch: 14 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(wb, ws, 'รายงานการลงเวลา JOBone');
        const now = new Date();
        const filename = `JOBone_Attendance_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}.xlsx`;
        XLSX.writeFile(wb, filename);
        showToast('📥 ดาวน์โหลดไฟล์ Excel สำเร็จแล้ว ✓', 'success');
    } catch (error) {
        showToast('❌ เกิดข้อผิดพลาดในการแปลงไฟล์สเปรดชีต', 'error');
    }
}

function autoSaveToExcel() {
    if (typeof XLSX === 'undefined') return;
    try {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(buildExcelData());
        ws['!cols'] = [{ wch: 6 }, { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 16 }, { wch: 24 }, { wch: 10 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, ws, 'รายงานการลงเวลา');
        const now = new Date();
        const filename = `attendance_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}.xlsx`;
        XLSX.writeFile(wb, filename);
        showToast('💾 บันทึกไฟล์ Excel อัตโนมัติแล้ว', 'info', 2500);
    } catch (e) {
        console.warn('Auto-save Excel failed:', e);
    }
}

function backupDataToJSON() {
    if (dbStudents.length === 0 && dbAttendance.length === 0) { showToast('⚠️ ไม่มีข้อมูลในระบบสำหรับสำรองข้อมูล', 'warning'); return; }
    const backupData = { version: "1.0", backupAt: new Date().toLocaleString('th-TH'), students: dbStudents, attendance: dbAttendance };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    const now = new Date();
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `attendance_backup_${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}.json`);
    document.body.appendChild(downloadAnchor); downloadAnchor.click(); downloadAnchor.remove();
    showToast('💾 สำรองข้อมูลเป็นไฟล์ JSON สำเร็จ ✓', 'success');
}

async function restoreDataFromJSON(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (!importedData.students || !importedData.attendance) { showToast('❌ รูปแบบไฟล์ไม่ถูกต้อง', 'error'); return; }
            if (!confirm('⚠️ การกู้คืนจะเขียนทับข้อมูลทั้งหมด คุณต้องการดำเนินการต่อใช่หรือไม่?')) { event.target.value = ''; return; }
            showToast('⏳ กำลังกู้คืนข้อมูลขึ้นคลาวด์...', 'info', 4000);

            const [aSnap, sSnap] = await Promise.all([db.collection('attendance').get(), db.collection('students').get()]);
            const deleteBatch = db.batch();
            aSnap.docs.forEach(doc => deleteBatch.delete(doc.ref));
            sSnap.docs.forEach(doc => deleteBatch.delete(doc.ref));
            await deleteBatch.commit();

            const writeBatch = db.batch();
            importedData.students.forEach(student => { writeBatch.set(db.collection('students').doc(student.studentId), student); });
            importedData.attendance.forEach(record => {
                const { _docId, ...cleanRecord } = record;
                writeBatch.set(db.collection('attendance').doc(), cleanRecord);
            });
            await writeBatch.commit();

            await syncDataFromFirestore();
            updateRecordCount(); updateDashboard(); filterAttendanceRecords();
            showToast('🔄 กู้คืนข้อมูลระบบขึ้นคลาวด์เรียบร้อยแล้ว ✓', 'success');
        } catch (err) {
            showToast('❌ เกิดข้อผิดพลาดในการกู้คืนข้อมูล', 'error');
        }
        event.target.value = '';
    };
    reader.readAsText(file);
}

function getStudentStatsAndHistory(studentId) {
    const personalHistory = dbAttendance.filter(record => record.studentId === studentId);
    let countOnTime = 0, countLate = 0, countVeryLate = 0;
    personalHistory.forEach(record => {
        if (record.status === 'ontime') countOnTime++;
        else if (record.status === 'late') countLate++;
        else if (record.status === 'verylate') countVeryLate++;
    });
    return { studentId, totalRecords: personalHistory.length, stats: { onTime: countOnTime, late: countLate, veryLate: countVeryLate }, history: personalHistory };
}

function verifyAdminPIN(inputPIN) {
    const savedPIN = localStorage.getItem('admin_pin') || '1234';
    if (inputPIN === savedPIN) {
        isAdminAuthenticated = true;
        showToast('🔓 เข้าสู่ระบบแอดมินสำเร็จ', 'success');
        return true;
    } else {
        showToast('❌ รหัส PIN ไม่ถูกต้อง', 'error');
        return false;
    }
}

function changeAdminPIN(oldPIN, newPIN) {
    const savedPIN = localStorage.getItem('admin_pin') || '1234';
    if (oldPIN !== savedPIN) { showToast('❌ รหัสเดิมไม่ถูกต้อง', 'error'); return false; }
    if (!newPIN || newPIN.length < 4) { showToast('⚠️ รหัสใหม่ต้องมีอย่างน้อย 4 ตัว', 'warning'); return false; }
    db.collection('config').doc('settings').set({ admin_pin: newPIN }, { merge: true })
        .then(() => showToast('🔑 เปลี่ยนรหัส PIN แอดมินออนไลน์เรียบร้อยแล้ว ✓', 'success'))
        .catch(() => showToast('❌ บันทึกรหัสใหม่ลงคลาวด์ล้มเหลว', 'error'));
    localStorage.setItem('admin_pin', newPIN);
    return true;
}

async function migrateLocalDataToCloud() {
    const localStudents = JSON.parse(localStorage.getItem('students') || '[]');
    if (localStudents.length > 0 && dbStudents.length === 0) {
        showToast('🔄 ดันข้อมูลเก่าขึ้นคลาวด์...', 'info', 2500);
        for (const s of localStudents) { await db.collection('students').doc(s.studentId).set(s, { merge: true }); }
        const localAttendance = JSON.parse(localStorage.getItem('attendanceRecords') || '[]');
        for (const a of localAttendance) {
            const { _docId, ...data } = a;
            await db.collection('attendance').add(data);
        }
        await syncDataFromFirestore();
        showToast('✅ ย้ายข้อมูลเดิมขึ้นคลาวด์สำเร็จแล้ว', 'success');
    }
}

// 📐 คำนวณระยะทางระหว่าง 2 พิกัด GPS (Haversine Formula) → หน่วยเมตร
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000; // รัศมีโลกในหน่วยเมตร
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
