// Quote rotation section
const quoteElements = document.querySelectorAll("#quotes span");
const quotes = Array.from(quoteElements).map((q) => q.textContent);

let index = 0;
const display = document.getElementById("quote-display");

display.textContent = quotes[0];

function rotateQuote() {
  display.style.opacity = 0;

  setTimeout(() => {
    index = (index + 1) % quotes.length;
    display.textContent = quotes[index];
    display.style.opacity = 1;
  }, 400);
}

setInterval(rotateQuote, 4000);

// Dropdown menu section
const menu = document.getElementById("menu");
const icon = document.getElementById("toggle-menu");

icon.addEventListener("click", toggleMenu);

function toggleMenu() {
  const isOpen = menu.style.display === "block";
  menu.style.display = isOpen ? "none" : "block";
  icon.setAttribute("aria-expanded", !isOpen);
  icon.setAttribute("aria-label", !isOpen ? "Close menu" : "Open menu");

  if (!isOpen) {
    const firstLink = menu.querySelector("a");
    if (firstLink) firstLink.focus();
  }
}

window.addEventListener("click", function (event) {
  if (!menu.contains(event.target) && !icon.contains(event.target)) {
    menu.style.display = "none";
    icon.setAttribute("aria-expanded", "false");
    icon.setAttribute("aria-label", "Open menu");
  }
});

// Register service worker for offline app
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("js/service_worker.js");
}
