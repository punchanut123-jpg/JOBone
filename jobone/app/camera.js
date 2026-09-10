// ==========================================
// 📸 camera.js - จัดการกล้องและรูปภาพ
// ==========================================

// Helper to get DOM elements dynamically to avoid any load sequence issues
function getCameraDOM() {
    return {
        cameraModal: document.getElementById('camera-modal'),
        fallbackUpload: document.getElementById('fallback-upload'),
        webcamEl: document.getElementById('webcam'),
        btnCapture: document.getElementById('btn-capture'),
        photoCanvas: document.getElementById('photo-canvas'),
        photoPreviewImg: document.getElementById('photo-preview'),
        photoPreviewContainer: document.getElementById('photo-preview-container'),
        btnCameraTrigger: document.getElementById('btn-camera-trigger'),
        checkinPhotoPreview: document.getElementById('checkin-photo-preview'),
        checkinPhotoPreviewCon: document.getElementById('checkin-photo-preview-container'),
        btnCheckinCamera: document.getElementById('btn-checkin-camera'),
        btnCheckout: document.getElementById('btn-checkout')
    };
}

async function openCameraModal(context = 'register') {
    const dom = getCameraDOM();
    cameraContext = context;
    if (document.getElementById('camera-modal-title')) {
        document.getElementById('camera-modal-title').textContent =
            context === 'register' ? 'ถ่ายภาพเพื่อลงทะเบียน' : 'ถ่ายภาพยืนยันตัวตน';
    }

    if (dom.cameraModal) dom.cameraModal.classList.add('active');
    if (dom.fallbackUpload) dom.fallbackUpload.classList.add('hidden');
    if (dom.webcamEl) dom.webcamEl.classList.remove('hidden');
    if (dom.btnCapture) dom.btnCapture.classList.remove('hidden');

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: 640, height: 480 }, audio: false
        });
        streamInstance = stream;
        if (dom.webcamEl) {
            dom.webcamEl.setAttribute('playsinline', 'true');
            dom.webcamEl.setAttribute('webkit-playsinline', 'true');
            dom.webcamEl.srcObject = stream;
        }
    } catch (err) {
        console.warn('Camera error:', err);
        if (dom.webcamEl) dom.webcamEl.classList.add('hidden');
        if (dom.btnCapture) dom.btnCapture.classList.add('hidden');
        if (dom.fallbackUpload) dom.fallbackUpload.classList.remove('hidden');
    }
}

function closeCameraModal() {
    const dom = getCameraDOM();
    if (dom.cameraModal) dom.cameraModal.classList.remove('active');
    stopWebcamStream();
}

function stopWebcamStream() {
    const dom = getCameraDOM();
    if (streamInstance) {
        streamInstance.getTracks().forEach(t => t.stop());
        streamInstance = null;
    }
    if (dom.webcamEl) dom.webcamEl.srcObject = null;
}

function compressImage(src, maxKB = 80, maxSize = 480) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let { width, height } = img;

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
    const dom = getCameraDOM();
    if (!streamInstance || !dom.webcamEl || !dom.photoCanvas) return;
    const ctx = dom.photoCanvas.getContext('2d');
    dom.photoCanvas.width  = dom.webcamEl.videoWidth  || 640;
    dom.photoCanvas.height = dom.webcamEl.videoHeight || 480;
    ctx.drawImage(dom.webcamEl, 0, 0, dom.photoCanvas.width, dom.photoCanvas.height);
    const raw = dom.photoCanvas.toDataURL('image/jpeg', 0.92);
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
    const dom = getCameraDOM();
    if (context === 'register') {
        currentPhotoBase64 = src;
        if (dom.photoPreviewImg) {
            dom.photoPreviewImg.src = src;
            dom.photoPreviewImg.classList.remove('hidden');
        }
        if (dom.photoPreviewContainer) dom.photoPreviewContainer.classList.remove('hidden');
        if (dom.btnCameraTrigger) dom.btnCameraTrigger.textContent = 'แตะเพื่อถ่ายภาพใหม่';
        
        // Add class to camera widget
        const widget = document.querySelector('.camera-widget');
        if (widget) widget.classList.add('has-photo');
    } else if (context === 'home_checkin') {
        currentCheckinPhoto = src;
        if (typeof onHomeCheckinPhotoCaptured === 'function') {
            onHomeCheckinPhotoCaptured(src);
        }
    } else if (context === 'home_checkout') {
        currentCheckinPhoto = src;
        if (typeof onHomeCheckoutPhotoCaptured === 'function') {
            onHomeCheckoutPhotoCaptured(src);
        }
    } else {
        currentCheckinPhoto = src;
        if (dom.checkinPhotoPreview) {
            dom.checkinPhotoPreview.src = src;
            dom.checkinPhotoPreview.classList.remove('hidden');
        }
        if (dom.checkinPhotoPreviewCon) dom.checkinPhotoPreviewCon.classList.remove('hidden');
        if (dom.btnCheckinCamera) {
            dom.btnCheckinCamera.textContent = 'แตะเพื่อถ่ายภาพใหม่';
        }
        
        // Add class to checkin camera widget
        const widget = document.getElementById('checkin-photo-section');
        if (widget) widget.classList.add('has-photo');
        
        if (typeof updateActionButtons === 'function') {
            updateActionButtons();
        }
    }
}

function deletePhoto(context) {
    const dom = getCameraDOM();
    if (context === 'register') {
        currentPhotoBase64 = null;
        if (dom.photoPreviewContainer) dom.photoPreviewContainer.classList.add('hidden');
        if (dom.photoPreviewImg) {
            dom.photoPreviewImg.src = '';
            dom.photoPreviewImg.classList.add('hidden');
        }
        if (dom.btnCameraTrigger) dom.btnCameraTrigger.textContent = 'แตะเพื่อถ่ายภาพ';
        
        // Remove class from camera widget
        const widget = document.querySelector('.camera-widget');
        if (widget) widget.classList.remove('has-photo');
        showToast('ลบรูปภาพแล้ว', 'warning');
    } else {
        currentCheckinPhoto = null;
        if (dom.checkinPhotoPreviewCon) dom.checkinPhotoPreviewCon.classList.add('hidden');
        if (dom.checkinPhotoPreview) {
            dom.checkinPhotoPreview.src = '';
            dom.checkinPhotoPreview.classList.add('hidden');
        }
        if (dom.btnCheckinCamera) {
            dom.btnCheckinCamera.textContent = 'แตะเพื่อถ่ายภาพ';
        }
        
        // Remove class from checkin camera widget
        const widget = document.getElementById('checkin-photo-section');
        if (widget) widget.classList.remove('has-photo');
        
        showToast('ลบรูปภาพยืนยันแล้ว', 'warning');
        if (typeof updateActionButtons === 'function') {
            updateActionButtons();
        }
    }
}
