// ==========================================
// ⚙️ config.js - ตัวแปร Global และการตั้งค่า
// ==========================================

// ตัวแปรข้อมูล
let dbStudents    = [];
let dbAttendance  = [];

// ตัวแปรสถานะและรูปภาพ
let currentPhotoBase64      = null;  
let currentCheckinPhoto     = null;  
let streamInstance          = null;
let cameraContext           = 'register'; 

let currentRemark           = '';
let currentLookedUpStudent  = null;
let devModeActive           = false;
let clockInterval           = null;
let devPanelClickCount      = 0;
let isAdminAuthenticated    = false; 
let currentStudentAuth      = null;
let pendingLateLeaveAttachment = '';
let lastGeolocationError = '';

function getStoredStudentAuth() {
    try {
        const data = localStorage.getItem('jobone_student_auth');
        return data ? JSON.parse(data) : null;
    } catch(e) {
        return null;
    }
}

function setStoredStudentAuth(authData) {
    currentStudentAuth = authData;
    localStorage.setItem('jobone_student_auth', JSON.stringify(authData));
}

function clearStoredStudentAuth() {
    currentStudentAuth = null;
    localStorage.removeItem('jobone_student_auth');
}

// ตัวแปรเก็บค่าเดดไลน์ออกงาน
let timeConfig = {
    checkoutDeadline: '18:00'
};

// 🌐 ชุดรหัสกุญแจเชื่อมต่อคลาวด์ Firebase Firestore 
const firebaseConfig = {
    apiKey: "AIzaSyDDn9I3C6fNY8Ogch2DmpoPv_Kj32S3CqQ",
    authDomain: "jobone-207da.firebaseapp.com",
    projectId: "jobone-207da",
    storageBucket: "jobone-207da.firebasestorage.app",
    messagingSenderId: "1091330070684",
    appId: "1:1091330070684:web:106008074683cb04b77559",
    measurementId: "G-17KDDZJ490"
};

// กำหนดค่า Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore(); 

// 📍 พิกัดศูนย์กลางตึกคณะและรัศมี Geofence
const facultyLocation = {
    lat: 13.0733216,
    lng: 99.9780291
};
const GEOFENCE_RADIUS_METERS = 100; // รัศมีอนุญาต 100 เมตร
