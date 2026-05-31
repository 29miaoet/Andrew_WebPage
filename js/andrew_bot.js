import {
  pipeline,
  env,
} from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2";

env.allowLocalModels = false;
env.useBrowserCache = true;

// -------------------- SUPABASE CONFIG --------------------
const SUPABASE_URL = "https://hwmjqtydgkdifsdzvhjx.supabase.co";
const SUPABASE_KEY = "sb_publishable_ZJ-LLQAbta2ePXScQdj9Mg_OnNGy51i";

class SupabaseClient {
  constructor(url, key) {
    this.url = url;
    this.key = key;
  }

  async request(method, path, body = null, extraHeaders = {}) {
    const fullUrl = `${this.url}/rest/v1${path}`;
    const headers = {
      "Content-Type": "application/json",
      apikey: this.key,
      Authorization: `Bearer ${this.key}`,
      ...extraHeaders,
    };

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    try {
      const response = await fetch(fullUrl, options);
      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(`Supabase Error (${response.status}): ${responseText}`);
      }

      return responseText ? JSON.parse(responseText) : null;
    } catch (error) {
      console.error("API Error:", error);
      throw error;
    }
  }

  async insert(table, data) {
    return this.request("POST", `/${table}`, data, {
      "Prefer": "return=representation",
    });
  }


}

const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_KEY);

// -------------------- DOM --------------------
const chat = document.getElementById("chat");
const input = document.getElementById("input");
const button = document.getElementById("send");
const clearBtn = document.getElementById("clear");
const toggleCommandsBtn = document.getElementById("toggleCommands");
const toggleTrainingBtn = document.getElementById("toggleTraining");

// -------------------- STATE --------------------
const STORAGE_KEY = "andrewbot_chat_history";

let intents = [];
let commands = [];
let patternVectors = [];
let embedder = null;
let commandsEnabled = true;
let trainingEnabled = true;

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
    time: Date.now(),
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

// -------------------- TOGGLES --------------------
toggleCommandsBtn.onclick = () => {
  commandsEnabled = !commandsEnabled;
  toggleCommandsBtn.textContent = `Commands: ${commandsEnabled ? "ON" : "OFF"}`;
  toggleCommandsBtn.classList.toggle("active", commandsEnabled);
};

toggleTrainingBtn.onclick = () => {
  trainingEnabled = !trainingEnabled;
  toggleTrainingBtn.textContent = `Training: ${trainingEnabled ? "ON" : "OFF"}`;
  toggleTrainingBtn.classList.toggle("active", trainingEnabled);
};

// -------------------- LOG TO SUPABASE --------------------
async function logToSupabase(userMessage, botResponse, matchedTag, matchMethod) {
  try {
    await supabase.insert("chat_logs", {
      user_message: userMessage,
      bot_response: botResponse,
      matched_tag: matchedTag,
      match_method: matchMethod,
    });
  } catch (error) {
    console.error("logToSupabase failed:", error);
  }
}

// -------------------- LOAD INTENTS + COMMANDS --------------------
addMessage("Loading intents...", "bot", false);

const [intentsRes, commandsRes] = await Promise.all([
  fetch("data/intents.json"),
  fetch("data/commands.json"),
]);
const data = await intentsRes.json();
const commandData = await commandsRes.json();
intents = data.intents;
commands = commandData.commands;

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
          matrix[i - 1][j] + 1,
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

// -------------------- EXECUTE COMMAND --------------------
function executeCommand(command) {
  try {
    const commandStr = Array.isArray(command)
      ? command.join("\n")
      : command;
    new Function(commandStr)();
  } catch (err) {
    console.error("Command execution failed:", err);
  }
}

// -------------------- LOAD EMBEDDINGS --------------------
addMessage("Loading model...", "bot", false);

embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");

addMessage("Building embeddings...", "bot", false);

for (let intent of intents) {
  for (let pattern of intent.patterns) {
    const output = await embedder(pattern);

    patternVectors.push({
      tag: intent.tag,
      embedding: output.data,
    });
  }
}

for (let command of commands) {
  for (let pattern of command.patterns) {
    const output = await embedder(pattern);

    patternVectors.push({
      tag: command.tag,
      embedding: output.data,
      isCommand: true,
    });
  }
}

addMessage("Bot ready!", "bot", false);

// -------------------- COSINE SIMILARITY --------------------
function cosine(a, b) {
  let dot = 0,
    normA = 0,
    normB = 0;

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
    return { response: randomResponse(regexIntent.responses), tag: regexIntent.tag, method: "regex" };
  }

  // 2. levenshtein
  let bestMatch = null;
  let highestScore = 0;
  let bestIsCommand = false;

  for (let intent of intents) {
    for (let pattern of intent.patterns) {
      const score = similarity(normalized, normalize(pattern));
      if (score > highestScore) {
        highestScore = score;
        bestMatch = intent;
        bestIsCommand = false;
      }
    }
  }

  if (commandsEnabled) {
    for (let command of commands) {
      for (let pattern of command.patterns) {
        const score = similarity(normalized, normalize(pattern));
        if (score > highestScore) {
          highestScore = score;
          bestMatch = command;
          bestIsCommand = true;
        }
      }
    }
  }

  if (bestMatch) {
    if (commandsEnabled && bestIsCommand && bestMatch.command) executeCommand(bestMatch.command);
    return { response: randomResponse(bestMatch.responses), tag: bestMatch.tag, method: "levenshtein" };
  }

  // 3. embeddings
  const { best, bestScore } = await embeddingMatch(text);

  if (best) {
    if (best.isCommand) {
      if (commandsEnabled) {
        const command = commands.find((c) => c.tag === best.tag);
        if (command.command) executeCommand(command.command);
        return { response: randomResponse(command.responses), tag: command.tag, method: "embedding" };
      } else {
        return { response: "Commands are currently disabled.", tag: null, method: "none" };
      }
    }

    const intent = intents.find((i) => i.tag === best.tag);
    return { response: randomResponse(intent.responses), tag: intent.tag, method: "embedding" };
  }

  return { response: "I don't understand yet.", tag: null, method: "none" };
}

// -------------------- SEND MESSAGE --------------------
button.onclick = async () => {
  const text = input.value.trim();
  if (!text) return;

  addMessage("You: " + text, "user");
  input.value = "";

  const { response, tag, method } = await getBotResponse(text);
  addMessage("Bot: " + response, "bot");

  if (trainingEnabled) {
    logToSupabase(text, response, tag, method);
  }
};

// -------------------- ENTER KEY --------------------
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    button.click();
  }
});

// -------------------- CLEAR HISTORY --------------------
clearBtn.onclick = () => {
  clearHistory();
};

// -------------------- INIT --------------------
loadChatHistory();

