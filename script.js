// ======== Elements ========
const videoElement = document.querySelector('.input_video');
const canvasElement = document.querySelector('.output_canvas');
const canvasCtx = canvasElement.getContext('2d');

// ======== Create Labels ========
function createLabel(text) {
  const label = document.createElement('div');
  label.className = 'action_label';
  label.innerText = text;
  document.body.appendChild(label);
  return label;
}

const bentLabel = createLabel('Bent Legs');
const apartLabel = createLabel('Legs Apart');
const saluteLabel = createLabel('Salute');

// ======== Helper: Angle between 3 points ========
function getAngle(A, B, C) {
  const AB = {x: A.x - B.x, y: A.y - B.y};
  const CB = {x: C.x - B.x, y: C.y - B.y};
  const dot = AB.x * CB.x + AB.y * CB.y;
  const magAB = Math.sqrt(AB.x ** 2 + AB.y ** 2);
  const magCB = Math.sqrt(CB.x ** 2 + CB.y ** 2);
  const cosAngle = dot / (magAB * magCB);
  return Math.acos(Math.min(Math.max(cosAngle, -1), 1)) * (180 / Math.PI);
}

// ======== Convert normalized to pixels ========
function toPx(point) {
  return {x: point.x * window.innerWidth, y: point.y * window.innerHeight};
}

// ======== Handle Pose Results ========
function onResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

  if (results.poseLandmarks) {
    drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#00FF00', lineWidth: 6});
    drawLandmarks(canvasCtx, results.poseLandmarks, {color: '#FF0000', lineWidth: 6, radius: 6});

    const lm = results.poseLandmarks;

    const leftHip = lm[23], leftKnee = lm[25], leftAnkle = lm[27];
    const rightHip = lm[24], rightKnee = lm[26], rightAnkle = lm[28];
    const leftShoulder = lm[11], rightShoulder = lm[12];
    const leftWrist = lm[15], rightWrist = lm[16];

    // Bent legs
    const leftAngle = getAngle(leftHip, leftKnee, leftAnkle);
    const rightAngle = getAngle(rightHip, rightKnee, rightAnkle);
    if (leftAngle < 160 || rightAngle < 160) {
      bentLabel.style.display = 'block';
      const kneePx = toPx(leftKnee);
      bentLabel.style.left = kneePx.x + 'px';
      bentLabel.style.top = (kneePx.y - 50) + 'px';
    } else bentLabel.style.display = 'none';

    // Legs apart
    const ankleDist = Math.abs(leftAnkle.x - rightAnkle.x);
    if (ankleDist > 0.2) {
      apartLabel.style.display = 'block';
      const hipPx = toPx(leftHip);
      apartLabel.style.left = hipPx.x + 'px';
      apartLabel.style.top = (hipPx.y - 50) + 'px';
    } else apartLabel.style.display = 'none';

    // Salute
    if (leftWrist.y < leftShoulder.y && rightWrist.y < rightShoulder.y) {
      saluteLabel.style.display = 'block';
      const shoulderPx = toPx(leftShoulder);
      saluteLabel.style.left = shoulderPx.x + 'px';
      saluteLabel.style.top = (shoulderPx.y - 80) + 'px';
    } else saluteLabel.style.display = 'none';
  }

  canvasCtx.restore();
}

// ======== Initialize MediaPipe Pose ========
const pose = new Pose({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`});
pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});
pose.onResults(onResults);

// ======== Start Webcam ========
const camera = new Camera(videoElement, {
  onFrame: async () => await pose.send({image: videoElement}),
  width: window.innerWidth,
  height: window.innerHeight
});
camera.start();

// ======== Resize canvas on window resize ========
window.addEventListener('resize', () => {
  canvasElement.width = window.innerWidth;
  canvasElement.height = window.innerHeight;
});
canvasElement.width = window.innerWidth;
canvasElement.height = window.innerHeight;