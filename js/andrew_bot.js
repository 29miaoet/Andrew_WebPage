import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2";

env.allowLocalModels = false;
env.useBrowserCache = true;

// -------------------- DOM --------------------
const chat = document.getElementById("chat");
const input = document.getElementById("input");
const button = document.getElementById("send");
const clearBtn = document.getElementById("clear");

// -------------------- STATE --------------------
const STORAGE_KEY = "andrewbot_chat_history";

let intents = [];
let patternVectors = [];
let embedder = null;

// -------------------- STORAGE HELPERS --------------------
function getHistory() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}

function saveHistory(message) {
  const history = getHistory();
  history.push(message);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

function clearHistory() {
  localStorage.removeItem(STORAGE_KEY);
  chat.innerHTML = "";
}

// -------------------- UI --------------------
function addMessage(text, className, save = true) {
  const msg = {
    text,
    className,
    time: Date.now()
  };

  renderMessage(msg);

  if (save) saveHistory(msg);
}

function renderMessage(msg) {
  const div = document.createElement("div");
  div.className = "msg " + msg.className;
  div.textContent = msg.text;

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

// -------------------- LOAD CHAT HISTORY --------------------
function loadChatHistory() {
  const history = getHistory();
  history.forEach(renderMessage);
}

// -------------------- LOAD INTENTS --------------------
addMessage("Loading intents...", "bot", false);

const res = await fetch("data/intents.json");
const data = await res.json();
intents = data.intents;

// -------------------- NORMALIZE --------------------
function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

// -------------------- LEVENSHTEIN --------------------
function levenshtein(a, b) {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

function similarity(a, b) {
  const distance = levenshtein(a, b);
  return 1 - distance / Math.max(a.length, b.length);
}

// -------------------- REGEX MATCH --------------------
function regexMatch(input) {
  const text = normalize(input);

  for (let intent of intents) {
    if (!intent.regex) continue;

    for (let pattern of intent.regex) {
      const re = new RegExp(pattern, "i");
      if (re.test(text)) return intent;
    }
  }

  return null;
}

// -------------------- LOAD EMBEDDINGS --------------------
addMessage("Loading model...", "bot", false);

embedder = await pipeline(
  "feature-extraction",
  "Xenova/all-MiniLM-L6-v2"
);

addMessage("Building embeddings...", "bot", false);

for (let intent of intents) {
  for (let pattern of intent.patterns) {
    const output = await embedder(pattern);

    patternVectors.push({
      tag: intent.tag,
      embedding: output.data
    });
  }
}

addMessage("Bot ready!", "bot", false);

// -------------------- COSINE SIMILARITY --------------------
function cosine(a, b) {
  let dot = 0, normA = 0, normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// -------------------- EMBEDDING MATCH --------------------
async function embeddingMatch(text) {
  const output = await embedder(text);
  const userVec = output.data;

  let best = null;
  let bestScore = -1;

  for (let p of patternVectors) {
    const score = cosine(userVec, p.embedding);

    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }

  return { best, bestScore };
}

// -------------------- BOT LOGIC --------------------
function randomResponse(responses) {
  return responses[Math.floor(Math.random() * responses.length)];
}

async function getBotResponse(text) {
  const normalized = normalize(text);

  // 1. regex
  const regexIntent = regexMatch(text);
  if (regexIntent) {
    return randomResponse(regexIntent.responses);
  }

  // 2. levenshtein
  let bestMatch = null;
  let highestScore = 0;

  for (let intent of intents) {
    for (let pattern of intent.patterns) {
      const score = similarity(normalized, normalize(pattern));

      if (score > highestScore) {
        highestScore = score;
        bestMatch = intent;
      }
    }
  }

  if (bestMatch) {
    return randomResponse(bestMatch.responses);
  }

  // 3. embeddings
  const { best, bestScore } = await embeddingMatch(text);

  if (best) {
    const intent = intents.find(i => i.tag === best.tag);
    return randomResponse(intent.responses);
  }

  return "I don't understand yet.";
}

// -------------------- SEND MESSAGE --------------------
button.onclick = async () => {
  const text = input.value.trim();
  if (!text) return;

  addMessage("You: " + text, "user");
  input.value = "";

  const reply = await getBotResponse(text);
  addMessage("Bot: " + reply, "bot");
};

// -------------------- ENTER KEY --------------------
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    button.click();
  }
});

// ----------------- CLEAR HISTORY -----------------
clearBtn.onclick = () => {
  clearHistory();
};

// -------------------- INIT --------------------
loadChatHistory();
