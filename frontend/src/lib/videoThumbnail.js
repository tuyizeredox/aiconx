/**
 * Generate a poster-frame thumbnail (JPEG File) from a video file by
 * seeking to a frame shortly after the start and capturing it to a canvas.
 * @param {File} file - The source video file
 * @param {Object} options
 * @param {number} options.seekTo - Seconds to seek to before capturing (default 0.3)
 * @param {number} options.quality - JPEG quality 0-1 (default 0.85)
 * @returns {Promise<File>} A JPEG File suitable for upload
 */
export function generateVideoThumbnail(file, { seekTo = 0.3, quality = 0.85 } = {}) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = objectUrl;

    let settled = false;
    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute("src");
      video.load();
    };
    const fail = (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };
    const succeed = (result) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    video.addEventListener("error", () => fail(new Error("Failed to load video for thumbnail generation")));

    video.addEventListener("loadedmetadata", () => {
      const duration = video.duration || 0;
      const target = duration > 0 ? Math.min(seekTo, Math.max(0, duration - 0.05)) : 0;
      try {
        video.currentTime = target;
      } catch {
        fail(new Error("Failed to seek video"));
      }
    });

    video.addEventListener(
      "seeked",
      () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 360;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                fail(new Error("Failed to encode thumbnail"));
                return;
              }
              succeed(new File([blob], `thumb-${Date.now()}.jpg`, { type: "image/jpeg" }));
            },
            "image/jpeg",
            quality
          );
        } catch (err) {
          fail(err);
        }
      },
      { once: true }
    );

    video.load();
  });
}
