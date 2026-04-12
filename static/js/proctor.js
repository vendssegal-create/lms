class LMSProctor {
    constructor(config) {
        this.attemptId = config.attemptId;
        this.maxViolations = config.maxViolations || 3;
        this.proctoringEnabled = config.enabled || false;
        this.violations = 0;
        this.logUrl = '/lms/api/proctor-log/';
        this.faceIdRequired = config.faceIdRequired || false;
        this.studentImage = config.studentImage || '';
        this.referenceDescriptor = null;
        this.faceCheckInterval = null;
        this.consecutiveFaceFailures = 0;
        
        if (this.proctoringEnabled || this.faceIdRequired) {
            this.init();
        }
    }

    init() {
        console.log("Proctoring initialized");
        
        if (this.proctoringEnabled) {
            document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
            document.addEventListener('fullscreenchange', () => this.handleFullscreenChange());
            window.addEventListener('blur', () => this.handleVisibilityChange());
        }
        
        document.addEventListener('contextmenu', (e) => e.preventDefault());
        
        this.createHUD();
        this.createToastContainer();

        if (this.faceIdRequired) {
            this.initFaceProctoring();
        } else if (this.proctoringEnabled) {
            this.initCamera();
        }
    }

    createHUD() {
        const hud = document.createElement('div');
        hud.className = 'proctor-panel';
        hud.innerHTML = `
            <div class="proctor-panel-header">
                <i class="fa fa-shield text-primary"></i>
                Proctoring Active
            </div>
            <div class="proctor-video-wrapper">
                <video id="proctor-video" autoplay muted playsinline></video>
                <div id="proctor-ai-status" style="position:absolute; bottom:10px; left:10px; font-size:9px; color:#fff; font-weight:800; background:rgba(0,0,0,0.5); padding:2px 6px; border-radius:4px;">AI OFF</div>
            </div>
            <div id="violation-badge" class="proctor-violation-badge">
                Ogohlantirishlar: 0 / ${this.maxViolations}
            </div>
        `;
        document.body.appendChild(hud);
    }

    createToastContainer() {
        const container = document.createElement('div');
        container.className = 'toast-container';
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast-item toast-item-${type}`;
        
        let icon = 'info-circle';
        if (type === 'danger') icon = 'exclamation-triangle';
        if (type === 'warning') icon = 'warning';

        toast.innerHTML = `<i class="fa fa-${icon}"></i> <span>${message}</span>`;
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-20px)';
            setTimeout(() => toast.remove(), 400);
        }, 4000);

        this.speak(message);
    }

    async initFaceProctoring() {
        const statusEl = document.getElementById('proctor-ai-status');
        if (statusEl) statusEl.innerText = "LOADING AI...";

        try {
            const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
            await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
            await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
            await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);

            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = this.studentImage;
            
            img.onload = async () => {
                const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
                if (detection) {
                    this.referenceDescriptor = detection.descriptor;
                    await this.initCamera();
                    if (statusEl) {
                        statusEl.innerText = "AI ONLINE";
                        statusEl.style.color = "#2ecc71";
                    }
                    this.startFaceChecking();
                }
            };
        } catch(e) {
            console.error("Face API Error:", e);
        }
    }

    startFaceChecking() {
        this.faceCheckInterval = setInterval(async () => {
            const video = document.getElementById('proctor-video');
            if (!video || !this.referenceDescriptor) return;

            try {
                const detection = await faceapi.detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
                    .withFaceLandmarks().withFaceDescriptor();
                
                if (!detection) {
                    this.handleFaceFailure("Kamera sizni ko'rmayapti!");
                    return;
                }

                const distance = faceapi.euclideanDistance(this.referenceDescriptor, detection.descriptor);
                if (distance > 0.6) {
                    this.handleFaceFailure("Yuz mos kelmadi!");
                } else {
                    this.consecutiveFaceFailures = 0;
                }
            } catch(e) {}
        }, 5000);
    }

    handleFaceFailure(reason) {
        this.consecutiveFaceFailures++;
        if (this.consecutiveFaceFailures >= 2) {
            this.showToast(reason, 'warning');
            if (this.consecutiveFaceFailures >= 4) {
                this.violations++;
                this.updateUI();
                this.sendLog('face_mismatch', { reason: reason });
                this.consecutiveFaceFailures = 0;
            }
        }
    }

    speak(text) {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'uz-UZ';
        utterance.rate = 1;
        window.speechSynthesis.speak(utterance);
    }

    async initCamera() {
        const video = document.getElementById('proctor-video');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
            video.srcObject = stream;
        } catch (err) {
            this.showToast("Kamera ruxsati rad etildi!", "danger");
            this.sendLog('camera_denied', { error: err.message });
        }
    }

    handleVisibilityChange() {
        if (document.hidden || !document.hasFocus()) {
            this.violations++;
            this.updateUI();
            this.showToast("Ekranni almashtirish taqiqlangan!", "danger");
            this.sendLog('tab_switch', { count: this.violations });
        }
    }

    handleFullscreenChange() {
        if (!document.fullscreenElement) {
            this.violations++;
            this.updateUI();
            this.showToast("To'liq ekran rejimidan chiqmang!", "danger");
            this.sendLog('fullscreen_exit', { count: this.violations });
        }
    }

    updateUI() {
        const el = document.getElementById('violation-badge');
        if (el) {
            el.innerText = `Ogohlantirishlar: ${this.violations} / ${this.maxViolations}`;
            if (this.violations >= this.maxViolations) {
                el.style.background = 'var(--danger)';
                el.style.color = '#fff';
            }
        }
    }

    async sendLog(type, details) {
        try {
            const response = await fetch(this.logUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.getCsrfToken() },
                body: JSON.stringify({
                    attempt_id: this.attemptId,
                    event_type: type,
                    details: details
                })
            });
            const result = await response.json();
            if (result.auto_submit) {
                this.showToast("Test avtomatik yakunlanmoqda...", "danger");
                setTimeout(() => window.location.reload(), 2000);
            }
        } catch (err) {}
    }

    getCsrfToken() {
        return document.querySelector('input[name="csrfmiddlewaretoken"]')?.value || "";
    }
}

window.initProctor = (config) => {
    window.lmsProctor = new LMSProctor(config);
};
