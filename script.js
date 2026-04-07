const video = document.getElementById('video');

// Function to resize video to fit screen maximally without cropping
function resizeVideo() {
  if (!video.videoWidth || !video.videoHeight) return;

  const screenRatio = window.innerWidth / window.innerHeight;
  const videoRatio = video.videoWidth / video.videoHeight;

  if (videoRatio > screenRatio) {
    // Video is wider than screen → fit width
    video.style.width = '100%';
    video.style.height = 'auto';
  } else {
    // Video is taller than screen → fit height
    video.style.width = 'auto';
    video.style.height = '100%';
  }
}

// Access camera
navigator.mediaDevices.getUserMedia({ video: true, audio: false })
  .then(stream => {
    video.srcObject = stream;

    // Wait for video metadata to load so we know its size
    video.onloadedmetadata = () => {
      resizeVideo();
    };
  })
  .catch(err => {
    console.error("Error accessing camera:", err);
    alert("Unable to access your camera. Please allow camera permissions.");
  });

// Resize dynamically on window resize
window.addEventListener('resize', () => {
  resizeVideo();
});