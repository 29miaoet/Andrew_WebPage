const quoteElements = document.querySelectorAll("#quotes span");
const quotes = Array.from(quoteElements).map(q => q.textContent);

let index = 0;
const display = document.getElementById("quote-display");

display.textContent = quotes[0];

function rotateQuote(){

display.style.opacity = 0;

setTimeout(()=>{
index = (index + 1) % quotes.length;
display.textContent = quotes[index];
display.style.opacity = 1;
},400);

}

setInterval(rotateQuote,4000);

const menu = document.getElementById("menu");
const icon = document.querySelector(".menu-icon");

function toggleMenu() {
menu.style.display = (menu.style.display === "block") ? "none" : "block";
}

// Close dropdown when clicking outside
window.addEventListener("click", function(event) {
if (!menu.contains(event.target) && !icon.contains(event.target)) {
  menu.style.display = "none";
}
});
