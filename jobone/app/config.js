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
    apiKey: "AIzaSyBLZpdxQywsdtVEip1Ups7iiHRGzSGqNfo",
    authDomain: "job-one-b3179.firebaseapp.com",
    projectId: "job-one-b3179",
    storageBucket: "job-one-b3179.firebasestorage.app",
    messagingSenderId: "501813633725",
    appId: "1:501813633725:web:95df7658485504ca670dd4",
    measurementId: "G-P9F1NRK7CH"
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
