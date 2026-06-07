// Download function for same-domain files, has a progress bar.
async function downloadWithProgress(url, progressBar, statusText) {
  try {
    progressBar.style.width = "0%";
    statusText.textContent = "Downloading...";
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    const contentLength = response.headers.get("Content-Length");
    const total = contentLength ? parseInt(contentLength, 10) : null;

    const reader = response.body.getReader();
    let received = 0;
    const chunks = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      received += value.length;

      if (total) {
        const percent = Math.round((received / total) * 100);
        progressBar.style.width = percent + "%";
      }
    }

    const blob = new Blob(chunks);
    const downloadUrl = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = url.split("/").pop();
    a.click();

    URL.revokeObjectURL(downloadUrl);

    statusText.textContent = "Download complete";
  } catch (err) {
    console.warn(err);
    statusText.textContent = "⚠️ JavaScript download failed, using fallback.";
    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("download", "");
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

// Simple download function for external files.
function downloadFile(url) {
  const a = document.createElement("a");
  a.href = url;
  a.setAttribute("download", "");
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// PWA install register
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("js/service_worker.js").catch((error) => {
    console.error("Service Worker registration failed:", error);
  });
}

let deferredPrompt;

// Capture the beforeinstallprompt event
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  console.log("Install prompt is ready");
});

// Handle install button click
const installBtn = document.getElementById("appInstallBtn");
if (installBtn) {
  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) {
      console.log("Install prompt not available");
      return;
    }

    try {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      console.log("User choice:", choiceResult.outcome);

      if (choiceResult.outcome === "accepted") {
        console.log("PWA installed");
      } else {
        console.log("PWA installation dismissed");
      }
    } catch (error) {
      console.error("Installation prompt failed:", error);
    } finally {
      deferredPrompt = null;
    }
  });
} else {
  console.warn("Install button not found");
}

// Offline Website download.
document.getElementById("downloadBtn").addEventListener("click", (e) => {
  e.preventDefault();
  downloadWithProgress(
    "files/Andrew_Webpage.zip",
    document.getElementById("progressBar"),
    document.getElementById("statusText"),
  );
});

// Desktop shortcut download.
document.getElementById("downloadBtn2").addEventListener("click", (e) => {
  e.preventDefault();
  downloadWithProgress(
    "files/index.zip",
    document.getElementById("progressBar2"),
    document.getElementById("statusText2"),
  );
});

// Source code download, zip archive.
document.getElementById("downloadBtn3").addEventListener("click", (e) => {
  downloadFile(
    "https://github.com/29miaoet/Andrew_WebPage/archive/refs/tags/v28.6.4.zip",
  );
});

// Source code download, tarball archive.
document.getElementById("downloadBtn4").addEventListener("click", (e) => {
  downloadFile(
    "https://github.com/29miaoet/Andrew_WebPage/archive/refs/tags/v28.6.4.tar.gz",
  );
});
