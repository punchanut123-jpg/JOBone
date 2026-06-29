// ==========================================
// 📸 camera.js - จัดการกล้องและรูปภาพ
// ==========================================

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
