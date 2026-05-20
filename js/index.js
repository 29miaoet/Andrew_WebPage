// Quote rotation section
const quoteElements = document.querySelectorAll("#quotes span");
const quotes = Array.from(quoteElements, (q) => q.textContent).filter(Boolean);

const display = document.getElementById("quote-display");

if (display && quotes.length) {
  let index = 0;
  const FADE = 400;
  const INTERVAL = 4000;

  display.textContent = quotes[0];

  function rotate() {
    display.classList.add("fade");

    setTimeout(() => {
      index = (index + 1) % quotes.length;
      display.textContent = quotes[index];
      display.classList.remove("fade");
    }, FADE);
  }

  setInterval(rotate, INTERVAL);
}

// Dropdown menu section
const menu = document.getElementById("menu");
const icon = document.getElementById("toggle-menu");

function setMenu(open) {
  menu.classList.toggle("open", open);
  icon.setAttribute("aria-expanded", open);
  icon.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  icon.classList.toggle("active", open);

  if (open) menu.querySelector("a")?.focus();
}

icon?.addEventListener("click", () => {
  setMenu(!menu.classList.contains("open"));
});

document.addEventListener("click", (e) => {
  if (!menu.contains(e.target) && !icon.contains(e.target)) {
    setMenu(false);
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") setMenu(false);
});

// Service worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("js/service_worker.js");
}
