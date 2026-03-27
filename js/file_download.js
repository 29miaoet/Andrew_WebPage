const button = document.getElementById("downloadBtn");
const progressBar = document.getElementById("progressBar");
const statusText = document.getElementById("statusText");

button.addEventListener("click", () => {

    let progress = 0;
    statusText.textContent = "Downloading...";

    const interval = setInterval(() => {

        progress += 5;
        progressBar.style.width = progress + "%";

        if(progress >= 100){
            clearInterval(interval);
            statusText.textContent = "Download complete";

            // Replace with real file link
            const link = document.createElement("a");
            link.href = "files/Andrew_Webpage.zip";
            link.download = "";
            link.click();
        }

    }, 120);

});

const button2 = document.getElementById("downloadBtn2");
const progressBar2 = document.getElementById("progressBar2");
const statusText2 = document.getElementById("statusText2");

button2.addEventListener("click", () => {

    let progress2 = 0;
    statusText2.textContent = "Downloading...";

    const interval2 = setInterval(() => {

        progress2 += 20;
        progressBar2.style.width = progress2 + "%";

        if (progress2 >= 100) {
            clearInterval(interval2);
            statusText2.textContent = "Download complete";

            // Replace with real file link
            const link2 = document.createElement("a");
            link2.href = "files/index.zip";
            link2.download = "";
            link2.click();
        }

    }, 120);

});