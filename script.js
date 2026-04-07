// Create labels
const bentLabel = document.createElement("div");
bentLabel.className = "action_label";
bentLabel.innerText = "Bent Legs";
document.body.appendChild(bentLabel);

const apartLabel = document.createElement("div");
apartLabel.className = "action_label";
apartLabel.innerText = "Legs Apart";
document.body.appendChild(apartLabel);

const saluteLabel = document.createElement("div");
saluteLabel.className = "action_label";
saluteLabel.innerText = "Salute";
document.body.appendChild(saluteLabel);

function onResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

  if (results.poseLandmarks) {
    drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#00FF00', lineWidth: 6});
    drawLandmarks(canvasCtx, results.poseLandmarks, {color: '#FF0000', lineWidth: 6, radius: 6});

    const lm = results.poseLandmarks;

    // Key points
    const leftHip = lm[23], leftKnee = lm[25], leftAnkle = lm[27];
    const rightHip = lm[24], rightKnee = lm[26], rightAnkle = lm[28];
    const leftShoulder = lm[11], rightShoulder = lm[12];
    const leftWrist = lm[15], rightWrist = lm[16];

    // Convert normalized coordinates to pixels
    function toPx(point) {
      return {x: point.x * window.innerWidth, y: point.y * window.innerHeight};
    }

    // Bent legs
    let leftAngle = getAngle(leftHip, leftKnee, leftAnkle);
    let rightAngle = getAngle(rightHip, rightKnee, rightAnkle);
    if (leftAngle < 160 || rightAngle < 160) {
      bentLabel.style.display = "block";
      const kneePx = toPx(leftKnee);
      bentLabel.style.left = kneePx.x + "px";
      bentLabel.style.top = (kneePx.y - 50) + "px";
    } else {
      bentLabel.style.display = "none";
    }

    // Legs apart
    let ankleDist = Math.abs(leftAnkle.x - rightAnkle.x);
    if (ankleDist > 0.2) {
      apartLabel.style.display = "block";
      const hipPx = toPx(leftHip);
      apartLabel.style.left = hipPx.x + "px";
      apartLabel.style.top = (hipPx.y - 50) + "px";
    } else {
      apartLabel.style.display = "none";
    }

    // Salute
    if (leftWrist.y < leftShoulder.y && rightWrist.y < rightShoulder.y) {
      saluteLabel.style.display = "block";
      const shoulderPx = toPx(leftShoulder);
      saluteLabel.style.left = shoulderPx.x + "px";
      saluteLabel.style.top = (shoulderPx.y - 80) + "px";
    } else {
      saluteLabel.style.display = "none";
    }
  }

  canvasCtx.restore();
}