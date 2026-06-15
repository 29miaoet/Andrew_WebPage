const soulPrompt = `
- You are an AI that outputs ONLY valid JSON.
- You have full access to the browser dom, so please be careful.
- You can run JavaScript.

ABSOLUTE RULES:
- Output ONLY JSON (no text before or after)
- NEVER use <think>, <response>, or XML tags
- NEVER wrap output in markdown
- NEVER explain anything
- NEVER include trailing commentary

REQUIRED FORMAT:
{
  "think": "internal reasoning",
  "response": "user-facing reply",
  "js": ""
}

RULES:
- js MUST be a string (never object, never null)
- If no JS, use ""
- Output must be valid JSON parsable by JSON.parse()
`;

function getRuntimeContext(model) {
  return `Browser chat environment. Model: ${model}. Output JSON only.`;
}

let messages = [];
let retryCount = 0;

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

const STORAGE_KEY = "chat_autosave";
let autosaveTimer = null;

function triggerAutosave() {
  clearTimeout(autosaveTimer);

  autosaveTimer = setTimeout(() => {
    autosave();
  }, 800);
}

function autosave() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        timestamp: new Date().toISOString(),
        messages: structuredClone(messages)
      })
    );
  } catch (err) {
    console.error("[AUTOSAVE_ERROR]", err.message);
  }
}

function autoload() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const data = JSON.parse(raw);
    if (!Array.isArray(data.messages)) return;

    messages = structuredClone(data.messages);

    const chat = document.getElementById("chat");
    chat.innerHTML = "";

    messages.forEach(msg => {
      if (msg.role === "user") {
        addMessage("user", msg.content);
      } else {
        const parsed = tryParseStoredMessage(msg.content);
        addMessage("assistant", parsed.response, parsed.think);
      }
    });
  } catch (err) {
    console.error("[AUTOLOAD_ERROR]", err.message);
  }
}

function savePrompt(name, promptText) {
  const prompts = JSON.parse(localStorage.getItem("chat_prompts") || "[]");

  prompts.push({
    name,
    content: promptText,
    timestamp: new Date().toISOString()
  });

  localStorage.setItem("chat_prompts", JSON.stringify(prompts));
}

function getPromptsList() {
  return JSON.parse(localStorage.getItem("chat_prompts") || "[]");
}

function addMessage(role, text, think = "") {
  const chat = document.getElementById("chat");

  const div = document.createElement("div");
  div.className = "msg " + (role === "user" ? "user" : "bot");

  if (role === "user") {
    div.textContent = text;
  } else {
    const response = document.createElement("div");
    response.className = "response";
    response.textContent = text;
    div.appendChild(response);

    if (think) {
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = "Thinking";

      const content = document.createElement("div");
      content.className = "thinking-content";
      content.textContent = think;

      details.appendChild(summary);
      details.appendChild(content);
      div.appendChild(details);
    }
  }

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function tryParseStoredMessage(content) {
  try {
    const parsed = JSON.parse(content);

    if (parsed.response) {
      return {
        think: parsed.think || "",
        response: parsed.response
      };
    }
  } catch {}

  return { think: "", response: content };
}

function extractThinkAndResponse(text, options = {}) {
  const {
    maxRetries = 2,
    allowRepair = true,
    warn = (msg, data) => console.warn(msg, data)
  } = options;

  function stripFences(input) {
    return input
      .replace(/```(?:json)?\s*/g, "")
      .replace(/```/g, "")
      .trim();
  }

  function normalize(obj) {
    if (typeof obj !== "object" || obj === null) {
      return { ok: false, think: "", response: "", js: "" };
    }

    return {
      ok: true,
      think: typeof obj.think === "string" ? obj.think : "",
      response: typeof obj.response === "string" ? obj.response : "",
      js: typeof obj.js === "string" ? obj.js : ""
    };
  }

  function extractCandidates(input) {
    const candidates = [];
    let start = 0;

    while ((start = input.indexOf("{", start)) !== -1) {
      let depth = 0;

      for (let i = start; i < input.length; i++) {
        const ch = input[i];

        if (ch === "{") depth++;
        if (ch === "}") depth--;

        if (depth === 0) {
          candidates.push(input.slice(start, i + 1));
          start = i + 1;
          break;
        }
      }

      start++;
    }

    return candidates;
  }

  function tryParse(candidate) {
    try {
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  }

  function tryRepairParse(candidate) {
    if (!allowRepair) return null;

    try {
      const repaired = jsonrepair(candidate);
      return JSON.parse(repaired);
    } catch {
      return null;
    }
  }

  let cleaned = stripFences(text);
  let candidates = extractCandidates(cleaned);

  if (!candidates.length) {
    return { ok: false, think: "", response: "", js: "", error: "NO_JSON_FOUND" };
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    for (const c of candidates) {
      const parsed = tryParse(c);
      if (parsed) return normalize(parsed);

      const repaired = tryRepairParse(c);
      if (repaired) {
        warn("JSON repaired", { candidate: c });
        return normalize(repaired);
      }
    }

    if (attempt === 0) {
      cleaned = cleaned
        .replace(/,\s*}/g, "}")
        .replace(/,\s*]/g, "]");

      candidates = extractCandidates(cleaned);
    }
  }

  return { ok: false, think: "", response: "", js: "", error: "FAILED_PARSE" };
}

async function sendMessage() {
  const input = document.getElementById("input");
  const apiKey = document.getElementById("apiKey").value;
  const model = document.getElementById("model").value;

  const userText = input.value.trim();
  if (!userText) return;

  if (!apiKey) {
    addMessage("assistant", "⚠️ Missing API key", "");
    return;
  }

  addMessage("user", userText);
  messages.push({ role: "user", content: userText });
  triggerAutosave();

  input.value = "";

  const payload = [
    { role: "system", content: soulPrompt },
    { role: "system", content: getRuntimeContext(model) },
    ...messages
  ];

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ model, messages: payload })
    });

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "";

    const parsed = extractThinkAndResponse(raw);

    if (!parsed.ok) {
      console.warn("[LLM_PARSE_ERROR]", parsed.error, raw);
      addMessage("assistant", "⚠️ malformed or empty response (not saved)", "");
      return;
    }

    if (!parsed.response || !parsed.response.trim()) {
      console.warn("[EMPTY_RESPONSE]", parsed);
      addMessage("assistant", "⚠️ empty response (not saved)", "");
      return;
    }

    addMessage("assistant", parsed.response, parsed.think);

    messages.push({
      role: "assistant",
      content: JSON.stringify({
        think: parsed.think,
        response: parsed.response
      })
    });

    triggerAutosave();

    if (parsed.js && parsed.js.trim()) {
      try {
        eval(parsed.js);
      } catch (e) {
        console.error("[JS_ERROR]", e);
      }
    }

  } catch (err) {
    console.error("[SEND_ERROR]", err);
    addMessage("assistant", "⚠️ request failed", "");
  }
}

function clearHistory() {
  localStorage.removeItem(STORAGE_KEY);
  messages = [];

  const chat = document.getElementById("chat");
  chat.innerHTML = "";
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("sendBtn").addEventListener("click", sendMessage);
  document.getElementById("clearBtn").addEventListener("click", clearHistory);

  document.getElementById("input").addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  autoload();
});

