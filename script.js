const videoElement = document.querySelector('.input_video');
const canvasElement = document.querySelector('.output_canvas');
const canvasCtx = canvasElement.getContext('2d');

// UI elements
const bentText = document.getElementById("bent");
const apartText = document.getElementById("apart");
const saluteText = document.getElementById("salute");

// Angle calculation
function getAngle(a, b, c) {
  const ab = [a.x - b.x, a.y - b.y];
  const cb = [c.x - b.x, c.y - b.y];

  const dot = ab[0]*cb[0] + ab[1]*cb[1];
  const magAB = Math.sqrt(ab[0]**2 + ab[1]**2);
  const magCB = Math.sqrt(cb[0]**2 + cb[1]**2);

  return Math.acos(dot / (magAB * magCB)) * (180 / Math.PI);
}

// Main results handler
function onResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  canvasCtx.drawImage(
    results.image, 0, 0,
    canvasElement.width, canvasElement.height
  );

  if (results.poseLandmarks) {
    drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS);
    drawLandmarks(canvasCtx, results.poseLandmarks);

    const lm = results.poseLandmarks;

    // Key points
    const leftHip = lm[23];
    const leftKnee = lm[25];
    const leftAnkle = lm[27];

    const rightHip = lm[24];
    const rightKnee = lm[26];
    const rightAnkle = lm[28];

    const leftShoulder = lm[11];
    const rightShoulder = lm[12];
    const leftWrist = lm[15];
    const rightWrist = lm[16];

    // ✅ Bent legs
    let leftAngle = getAngle(leftHip, leftKnee, leftAnkle);
    let rightAngle = getAngle(rightHip, rightKnee, rightAnkle);

    if (leftAngle < 160 || rightAngle < 160) {
      bentText.innerText = "Bent Legs: ✅";
    } else {
      bentText.innerText = "Bent Legs: ❌";
    }

    // ✅ Legs apart
    let ankleDist = Math.abs(leftAnkle.x - rightAnkle.x);

    if (ankleDist > 0.2) {
      apartText.innerText = "Legs Apart: ✅";
    } else {
      apartText.innerText = "Legs Apart: ❌";
    }

    // ✅ Salute
    if (
      leftWrist.y < leftShoulder.y &&
      rightWrist.y < rightShoulder.y
    ) {
      saluteText.innerText = "Salute: ✅";
    } else {
      saluteText.innerText = "Salute: ❌";
    }
  }

  canvasCtx.restore();
}

// Setup MediaPipe Pose
const pose = new Pose({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
  }
});

pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

pose.onResults(onResults);

// Camera setup
const camera = new Camera(videoElement, {
  onFrame: async () => {
    await pose.send({ image: videoElement });
  },
  width: 640,
  height: 480
});

camera.start();