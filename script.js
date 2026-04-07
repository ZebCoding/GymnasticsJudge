import { Pose } from "https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js";
import { Camera } from "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js";

const video = document.getElementById('video');
const overlay = document.getElementById('overlay');

// Setup MediaPipe Pose
const pose = new Pose({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
});
pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  enableSegmentation: false,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

pose.onResults(onResults);

// Start camera
const camera = new Camera(video, {
  onFrame: async () => {
    await pose.send({image: video});
  },
  width: 1280,
  height: 720
});
camera.start();

// Helper: calculate angle between three points
function angleBetweenPoints(A, B, C) {
  const AB = {x: B.x - A.x, y: B.y - A.y};
  const BC = {x: C.x - B.x, y: C.y - B.y};
  const dot = AB.x * BC.x + AB.y * BC.y;
  const magAB = Math.sqrt(AB.x*AB.x + AB.y*AB.y);
  const magBC = Math.sqrt(BC.x*BC.x + BC.y*BC.y);
  return Math.acos(dot / (magAB * magBC)) * (180 / Math.PI);
}

// Main detection logic
function onResults(results) {
  if (!results.poseLandmarks) {
    overlay.textContent = "Waiting for Salute...";
    return;
  }

  const lm = results.poseLandmarks;

  // Body straightness: check shoulder -> hip -> knee -> ankle angles
  const leftLegAngle = angleBetweenPoints(lm[11], lm[23], lm[25]); // shoulder-hip-knee
  const rightLegAngle = angleBetweenPoints(lm[12], lm[24], lm[26]);
  const torsoAngle = angleBetweenPoints(lm[11], lm[23], lm[24]); // shoulders-hips alignment

  const bodyStraight = 
    leftLegAngle > 160 && leftLegAngle < 200 &&
    rightLegAngle > 160 && rightLegAngle < 200 &&
    torsoAngle > 160 && torsoAngle < 200;

  // Arm raised straight: shoulder -> elbow -> wrist angle
  const rightArmAngle = angleBetweenPoints(lm[12], lm[14], lm[16]);
  const wristAboveHead = lm[16].y < lm[0].y; // wrist above nose

  const armStraightUp = rightArmAngle > 160 && rightArmAngle < 200 && wristAboveHead;

  if(bodyStraight && armStraightUp){
    overlay.textContent = "Salute Detected ✅";
  } else {
    overlay.textContent = "Waiting for Salute...";
  }
}