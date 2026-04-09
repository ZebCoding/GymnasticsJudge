const video = document.getElementById('video');
const statusBadge = document.querySelector('.status-badge');

let poseDetected = false;
let currentStep = 0;
let stepTimer = 0;

// Gymnastics Judging Sequence Steps
const JUDGING_STEPS = [
  { name: "Start Salute", description: "Stand still with salute", legRule: "legs straight together" },
  { name: "Legs Spread", description: "Spread legs for momentum", legRule: "legs spread apart" },
  { name: "Spin Start", description: "Bring legs together for spin", legRule: "legs straight together" },
  { name: "3 Circles", description: "Complete 3 full spins", legRule: "legs straight together" },
  { name: "Landing", description: "Bend knees to land", legRule: "legs bent" },
  { name: "Finish Salute", description: "Stand straight with salute", legRule: "legs straight together" }
];

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

// DEBUG MODE: Use video file instead of live camera
// Replace 'test-video.mp4' with your video file path
video.src = 'test-video.mp4';

video.onloadedmetadata = () => {
  resizeVideo();
  
  // Process video frames continuously
  const processFrame = async () => {
    if (!video.paused && !video.ended) {
      await pose.send({ image: video });
      requestAnimationFrame(processFrame);
    }
  };
  
  video.addEventListener('play', () => {
    processFrame();
  });
  
  video.play();
};

/*
// LIVE CAMERA MODE (uncomment later)
navigator.mediaDevices.getUserMedia({ video: true, audio: false })
  .then(stream => {
    video.srcObject = stream;
    
    video.onloadedmetadata = () => {
      resizeVideo();
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
*/

// Handle pose detection results
function onPoseResults(results) {
  if (results.poseLandmarks) {
    poseDetected = true;
    
    // POSE LANDMARKS:
    // 11 = left shoulder, 12 = right shoulder
    // 15 = left wrist, 16 = right wrist
    // 23 = left hip, 24 = right hip
    // 25 = left knee, 26 = right knee
    // 27 = left ankle, 28 = right ankle
    
    const leftShoulder = results.poseLandmarks[11];
    const rightShoulder = results.poseLandmarks[12];
    const leftWrist = results.poseLandmarks[15];
    const rightWrist = results.poseLandmarks[16];
    const leftHip = results.poseLandmarks[23];
    const rightHip = results.poseLandmarks[24];
    const leftKnee = results.poseLandmarks[25];
    const rightKnee = results.poseLandmarks[26];
    const leftAnkle = results.poseLandmarks[27];
    const rightAnkle = results.poseLandmarks[28];
    
    // Gymnast Salute detection
    const leftArmRaised = (leftWrist.y < leftShoulder.y - 0.22);
    const rightArmRaised = (rightWrist.y < rightShoulder.y - 0.22);
    const leftArmStraight = Math.abs(leftWrist.x - leftShoulder.x) < 0.15;
    const rightArmStraight = Math.abs(rightWrist.x - rightShoulder.x) < 0.15;
    const saluteDetected = (leftArmRaised && leftArmStraight) || (rightArmRaised && rightArmStraight);
    
    // LEG DETECTION
    // Check if legs are spread apart (distance between ankles)
    const legSpreadDistance = Math.abs(leftAnkle.x - rightAnkle.x);
    const legsSpread = legSpreadDistance > 0.20;
    
    // Check if legs are bent (knee position below hip-ankle line)
    const leftKneeBend = (leftKnee.y > Math.max(leftHip.y, leftAnkle.y) + 0.04);
    const rightKneeBend = (rightKnee.y > Math.max(rightHip.y, rightAnkle.y) + 0.04);
    const legsBent = leftKneeBend || rightKneeBend;
    
const legsStraight = !legsBent && legSpreadDistance < 0.15;

// STEP JUDGING LOGIC
processJudgingStep(saluteDetected, legsSpread, legsBent, legsStraight);

updateStatus(saluteDetected, legsSpread, legsBent, legsStraight);
  } else {
    poseDetected = false;
    saluteDetected = false;
    updateStatus();
  }
}

function processJudgingStep(salute, spread, bent, straight) {
  const step = JUDGING_STEPS[currentStep];
  
  let stepPassed = false;
  
  switch(currentStep) {
    case 0: // Start Salute
      stepPassed = salute && straight;
      break;
    case 1: // Legs Spread
      stepPassed = spread && !bent;
      break;
    case 2: // Spin Start
      stepPassed = straight && !salute;
      break;
    case 3: // 3 Circles
      stepPassed = straight;
      break;
    case 4: // Landing
      stepPassed = bent && !spread;
      break;
    case 5: // Finish Salute
      stepPassed = salute && straight;
      break;
  }
  
  if (stepPassed) {
    stepTimer++;
    // Require consistent detection for 10 frames
    if (stepTimer > 10) {
      currentStep = Math.min(currentStep + 1, JUDGING_STEPS.length);
      stepTimer = 0;
    }
  }
}

function updateStatus(salute, spread, bent, straight) {
  if (!poseDetected) {
    statusBadge.textContent = "Looking for you...";
    statusBadge.style.backgroundColor = '#ef4444';
    currentStep = 0;
    stepTimer = 0;
  } else if (currentStep >= JUDGING_STEPS.length) {
    statusBadge.textContent = "✅ PERFECT! ROUTINE COMPLETED!";
    statusBadge.style.backgroundColor = '#22c55e';
    statusBadge.style.transform = 'translateX(-50%) scale(1.1)';
  } else {
    const step = JUDGING_STEPS[currentStep];
    statusBadge.textContent = `[${currentStep+1}/6] ${step.description}`;
    statusBadge.style.backgroundColor = '#8b5cf6';
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