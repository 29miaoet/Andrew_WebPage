let miniSearch;

const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const resultsContainer = document.getElementById("results");

async function init() {
  const res = await fetch("data/search_index.json");
  const data = await res.json();

  miniSearch = new MiniSearch({
    fields: ["title", "description", "image", "url"],
    storeFields: ["title", "description", "image", "url"]
  });

  miniSearch.addAll(data);
}

function renderResults(results) {
  resultsContainer.innerHTML = "";

  if (results.length === 0) {
    resultsContainer.innerHTML = "<div class='card'>No results found</div>";
    return;
  }

  results.forEach(item => {
    const a = document.createElement("a");
    a.className = "card";
    a.href = item.url;

    a.innerHTML = `
      <img src="${item.image}" class="result-img" alt="${item.title}">
      <div class="title">${item.title}</div>
      <div class="desc">${item.description}</div>
    `;

    resultsContainer.appendChild(a);
  });
}

function runSearch() {
  const query = searchInput.value.trim();
  if (!query) return;

  const results = miniSearch.search(query);
  renderResults(results);
}

searchBtn.addEventListener("click", runSearch);

searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault(); // prevents form-like behavior if embedded later
    runSearch();
  }
});

init();
