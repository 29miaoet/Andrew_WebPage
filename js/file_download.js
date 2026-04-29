// Download function for same-domain files, has a progress bar.
async function downloadWithProgress(url, progressBar, statusText) {
    try {
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
        console.error(err);
        statusText.textContent = "Error: " + err.message;
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

// Offline Website download.
document.getElementById("downloadBtn").addEventListener("click", () => {
    downloadWithProgress(
        "files/Andrew_Webpage.zip",
        document.getElementById("progressBar"),
        document.getElementById("statusText")
    );
});

// Desktop shortcut download.
document.getElementById("downloadBtn2").addEventListener("click", () => {
    downloadWithProgress(
        "files/index.zip",
        document.getElementById("progressBar2"),
        document.getElementById("statusText2")
    );
});

// Source code download, zip archive.
document.getElementById("downloadBtn3").addEventListener("click", () => {
    downloadFile("https://github.com/29miaoet/Andrew_WebPage/archive/refs/tags/v27.0.1.zip");
});

// Source code download, tarball archive.
document.getElementById("downloadBtn4").addEventListener("click", () => {
    downloadFile("https://github.com/29miaoet/Andrew_WebPage/archive/refs/tags/v27.0.1.tar.gz");
});