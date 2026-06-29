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
let isCheckingInVeryLate    = false;
let isAdminAuthenticated    = false; 

// ตัวแปรเก็บค่าช่วงเวลาทำงาน
let timeConfig = {
    ciOpen: '07:00',
    ciOntime: '08:00',
    ciClose: '08:30',
    coOpen: '16:30',
    coClose: '17:00'
};

// 🌐 ชุดรหัสกุญแจเชื่อมต่อคลาวด์ Firebase Firestore 
const firebaseConfig = {
    apiKey: "AIzaSyDGRW_m1puYzumzE-qNYXO9n7IMwAgdV74",
    authDomain: "jobnoe-4d585.firebaseapp.com",
    projectId: "jobnoe-4d585",
    storageBucket: "jobnoe-4d585.firebasestorage.app",
    messagingSenderId: "599444815367",
    appId: "1:599444815367:web:bf7fb38e6f4751cb23b4a2",
    measurementId: "G-H47Z0EFHWC"
};

// กำหนดค่า Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore(); 

// 📍 พิกัดศูนย์กลางตึกคณะและรัศมี Geofence
const facultyLocation = {
    lat: 13.073356,
    lng: 99.977877
};
const GEOFENCE_RADIUS_METERS = 100; // รัศมีอนุญาต 100 เมตร
