const video = document.getElementById('video');

navigator.mediaDevices.getUserMedia({ video: true, audio: false })
  .then(stream => {
    video.srcObject = stream;

    // Adjust size once metadata is loaded
    video.onloadedmetadata = () => {
      resizeVideo();
    };
  })
  .catch(err => {
    console.error("Camera access error:", err);
    alert("Unable to access your camera. Please allow camera permissions.");
  });

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