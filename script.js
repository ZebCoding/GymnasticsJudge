const video = document.getElementById('video');
const statusBadge = document.querySelector('.status-badge');

let poseDetected = false;
let saluteDetected = false;

// Initialize MediaPipe Pose
const pose = new Pose({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
  }
});

pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  enableSegmentation: false,
  smoothSegmentation: false,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

pose.onResults(onPoseResults);

// Start camera
navigator.mediaDevices.getUserMedia({ video: true, audio: false })
  .then(stream => {
    video.srcObject = stream;
    
    video.onloadedmetadata = () => {
      resizeVideo();
      // Attach camera to MediaPipe
      const camera = new Camera(video, {
        onFrame: async () => {
          await pose.send({ image: video });
        },
        width: 640,
        height: 480
      });
      camera.start();
    };
  })
  .catch(err => {
    console.error("Camera access error:", err);
    alert("Unable to access your camera. Please allow camera permissions.");
  });

// Handle pose detection results
function onPoseResults(results) {
  if (results.poseLandmarks) {
    poseDetected = true;
    
    // POSE LANDMARKS:
    // 11 = left shoulder, 12 = right shoulder
    // 15 = left wrist, 16 = right wrist
    
    const leftShoulder = results.poseLandmarks[11];
    const rightShoulder = results.poseLandmarks[12];
    const leftWrist = results.poseLandmarks[15];
    const rightWrist = results.poseLandmarks[16];
    
    // Gymnast Salute detection: Arm raised STRAIGHT UP above shoulder
    // Wrist should be significantly higher than shoulder, and vertically aligned
    const leftArmRaised = (leftWrist.y < leftShoulder.y - 0.22);
    const rightArmRaised = (rightWrist.y < rightShoulder.y - 0.22);
    
    // Check arm is straight vertically (x position close to shoulder)
    const leftArmStraight = Math.abs(leftWrist.x - leftShoulder.x) < 0.15;
    const rightArmStraight = Math.abs(rightWrist.x - rightShoulder.x) < 0.15;
    
    saluteDetected = (leftArmRaised && leftArmStraight) || (rightArmRaised && rightArmStraight);
    
    updateStatus();
  } else {
    poseDetected = false;
    saluteDetected = false;
    updateStatus();
  }
}

function updateStatus() {
  if (!poseDetected) {
    statusBadge.textContent = "Looking for you...";
    statusBadge.style.backgroundColor = '#ef4444';
  } else if (saluteDetected) {
    statusBadge.textContent = "✅ GYMNAST SALUTE DETECTED!";
    statusBadge.style.backgroundColor = '#22c55e';
    statusBadge.style.transform = 'translateX(-50%) scale(1.1)';
  } else {
    statusBadge.textContent = "✋ Raise arm straight up to salute";
    statusBadge.style.backgroundColor = '#3b82f6';
    statusBadge.style.transform = 'translateX(-50%) scale(1)';
  }
}

// Dynamically scale video to fill most of the screen without cropping
function resizeVideo() {
  const screenRatio = window.innerWidth / window.innerHeight;
  const videoRatio = video.videoWidth / video.videoHeight;

  if (videoRatio > screenRatio) {
    // Fit width
    video.style.width = '100%';
    video.style.height = 'auto';
  } else {
    // Fit height
    video.style.width = 'auto';
    video.style.height = '100%';
  }
}

// Update on window resize
window.addEventListener('resize', resizeVideo);