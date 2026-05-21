let medals = 500;
let nobel = 20;
let fields = 2;
let olympic = 12;

function updateAwards() {
  medals += Math.floor(Math.random() * 13) + 1;
  nobel += Math.floor(Math.random() * 2);
  fields += Math.floor(Math.random() * 2);
  olympic += Math.floor(Math.random() * 3);

  document.getElementById("medals").textContent = medals.toLocaleString();
  document.getElementById("nobel").textContent = nobel.toLocaleString();
  document.getElementById("fields").textContent = fields.toLocaleString();
  document.getElementById("olympic").textContent = olympic.toLocaleString();
}

setInterval(updateAwards, 0);
