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
            const link2 = document.createElement("a");
            link2.href = "files/index.zip";
            link2.download = "";
            link2.click();
        }

    }, 120);

});

const button3 = document.getElementById("downloadBtn3");
const progressBar3 = document.getElementById("progressBar3");
const statusText3 = document.getElementById("statusText3");

button3.addEventListener("click", () => {

    let progress3 = 0;
    statusText3.textContent = "Downloading...";

    const interval3 = setInterval(() => {

        progress3 += 5;
        progressBar3.style.width = progress3 + "%";

        if (progress3 >= 100) {
            clearInterval(interval3);
            statusText2.textContent = "Download complete";
            const link3 = document.createElement("a");
            link3.href = "https://github.com/29miaoet/Andrew_WebPage/archive/refs/tags/v27.0.1.zip";
            link3.download = "";
            link3.click();
        }

    }, 120);

});

const button4 = document.getElementById("downloadBtn4");
const progressBar4 = document.getElementById("progressBar4");
const statusText4 = document.getElementById("statusText4");

button4.addEventListener("click", () => {

    let progress4 = 0;
    statusText4.textContent = "Downloading...";

    const interval4 = setInterval(() => {

        progress4 += 5;
        progressBar4.style.width = progress4 + "%";

        if (progress4 >= 100) {
            clearInterval(interval4);
            statusText2.textContent = "Download complete";
            const link4 = document.createElement("a");
            link4.href = "https://github.com/29miaoet/Andrew_WebPage/archive/refs/tags/v27.0.1.tar.gz";
            link4.download = "";
            link4.click();
        }

    }, 120);

});
