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