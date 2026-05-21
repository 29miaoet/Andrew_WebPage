let count = 1000;
const doctoratesEl = document.getElementById("doctorates");
const doctoratesDisplay = document.getElementById("doctorates-display");

setInterval(() => {
  count++;
  doctoratesEl.textContent = count;
  doctoratesDisplay.textContent = count;
}, 0);

let countx = 5;
const transitsEl = document.getElementById("transits");
const transitsDisplay = document.getElementById("transits-display");

setInterval(() => {
  countx++;
  transitsEl.textContent = countx;
  transitsDisplay.textContent = countx;
}, 100);
