import {
  pipeline,
  env,
} from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2";

env.allowLocalModels = false;
env.useBrowserCache = true;

//  Dom 
const chat = document.getElementById("chat");
const input = document.getElementById("input");
const button = document.getElementById("send");
const clearBtn = document.getElementById("clear");
const toggleCommandsBtn = document.getElementById("toggleCommands");
const toggleTrainingBtn = document.getElementById("toggleTraining");

//  Supabase config 
const SUPABASE_URL = "https://hwmjqtydgkdifsdzvhjx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ZJ-LLQAbta2ePXScQdj9Mg_OnNGy51i";

//  State 
const STORAGE_KEY = "andrewbot_chat_history";

let intents = [];
let commands = [];
let patternVectors = [];
let embedder = null;
let commandsEnabled = true;
let trainingEnabled = true;
let currentUserId = null;
let currentSessionId = null;

//  Storage helpers 
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

//  Ui 
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

//  Load chat history 
function loadChatHistory() {
  const history = getHistory();
  history.forEach(renderMessage);
}

//  Toggles 
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

//  Fingerprint 
function getFingerprint() {
  const raw = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ].join("|");

  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (Math.imul(31, hash) + raw.charCodeAt(i)) | 0;
  }

  return Math.abs(hash).toString(36);
}

//  Supabase helpers 
async function supabaseInsert(table, payload) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Prefer": "return=representation",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    return data?.[0] ?? null;
  } catch (err) {
    console.error(`Supabase insert into ${table} failed:`, err);
    return null;
  }
}

async function supabaseUpdate(table, match, payload) {
  try {
    const params = new URLSearchParams(match).toString();
    await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error(`Supabase update on ${table} failed:`, err);
  }
}

//  User + session init 
async function initUserAndSession() {
  const fingerprint = getFingerprint();

  // upsert user by fingerprint
  const user = await supabaseInsert("bot_users", {
    fingerprint,
    last_seen: new Date().toISOString(),
  });

  if (user) currentUserId = user.id;

  // create a new session
  const session = await supabaseInsert("bot_sessions", {
    user_id: currentUserId,
    started_at: new Date().toISOString(),
  });

  if (session) currentSessionId = session.id;
}

//  Log to supabase 
async function logToSupabase(userMessage, botResponse, matchedTag, matchMethod) {
  await supabaseInsert("bot_logs", {
    user_id: currentUserId,
    session_id: currentSessionId,
    user_message: userMessage,
    bot_response: botResponse,
    matched_tag: matchedTag,
    match_method: matchMethod,
    commands_enabled: commandsEnabled,
    training_enabled: trainingEnabled,
  });
}

//  Load intents + commands 
addMessage("Loading intents...", "bot", false);

const [intentsRes, commandsRes] = await Promise.all([
  fetch("data/intents.json"),
  fetch("data/commands.json"),
]);
const data = await intentsRes.json();
const commandData = await commandsRes.json();
intents = data.intents;
commands = commandData.commands;

//  Normalize 
function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

//  Levenshtein 
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

//  Regex match 
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

//  Execute command 
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

//  Load embeddings 
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

//  Cosine similarity 
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

//  Embedding match 
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

//  Bot logic 
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

//  Send message 
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

//  Enter key 
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    button.click();
  }
});

//  Clear history 
clearBtn.onclick = () => {
  clearHistory();
};

//  Init 
loadChatHistory();
initUserAndSession();
