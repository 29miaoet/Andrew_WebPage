const soulPrompt = `
- You are an AI that outputs ONLY VALID JSON.
- You have full access to the browser dom, so please be careful.
- You can run JavaScript.

ABSOLUTE RULES:
- Begin your response with {
- Output ONLY JSON (no text before or after)
- NEVER use <think>, <response>, or XML tags
- NEVER use HTML tags for styling
- NEVER explain anything
- NEVER include trailing commentary

STYLING:
- The JSON itself must not be wrapped in markdown fences.
- The "response" field MAY contain Markdown and LaTeX.
- Use Markdown formatting when useful.
- Use LaTeX delimiters:
  Inline: \\(x^2\\)
  Block: \\[x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}\\]
- Never use LaTeX comments with %
- Never use raw HTML outside fenced code blocks
- Code must always be inside Markdown fenced blocks

REQUIRED FORMAT:
{
  "think": "any internal reasoning, plans, or mental sandboxes",
  "response": "user-facing reply",
  "js": ""
}

RULES:
- Return short responses unless otherwise specified
- Ask for clarification if unsure
- js MUST be a string
- js must be executable if it is not empty
- Never use top-level return in js
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
const DEBUG = false;

function debugLog(...args) {
  if (DEBUG) {
    debugLog(...args);
  }
}

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
    console.error("[AUTOSAVE_ERROR]", err);
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
    console.error("[AUTOLOAD_ERROR]", err);
  }
}

function renderMarkdown(text) {
  try {
    if (
      typeof marked === "undefined" ||
      typeof katex === "undefined" ||
      typeof DOMPurify === "undefined"
    ) {
      console.error("[RENDER_ERROR] Missing markdown libraries");
      return text;
    }

    const mathBlocks = [];
    const codeBlocks = [];

    text = text.replace(
      /```[\s\S]*?```/g,
      match => {
        const id = codeBlocks.length;
        codeBlocks.push(match);
        return `@@CODE_${id}@@`;
      }
    );

    function saveMath(content, display) {
      const id = mathBlocks.length;

      try {
        mathBlocks.push(
          katex.renderToString(content.trim(), {
            displayMode: display,
            throwOnError: false,
            strict: false
          })
        );
      } catch (err) {
        console.error("[KATEX_ERROR]", {
          content,
          err
        });

        mathBlocks.push(content);
      }

      return `@@MATH_${id}@@`;
    }

    text = text.replace(
      /\\\[(.*?)\\\]/gs,
      (_, math) => saveMath(math, true)
    );

    text = text.replace(
      /\\\((.*?)\\\)/gs,
      (_, math) => saveMath(math, false)
    );

    text = text.replace(
      /\$\$([\s\S]*?)\$\$/g,
      (_, math) => saveMath(math, true)
    );

    text = text.replace(
      /\$([^\$\n]+?)\$/g,
      (_, math) => saveMath(math, false)
    );

    let html = marked.parse(text, {
      breaks: true,
      gfm: true
    });

    html = html.replace(
      /@@MATH_(\d+)@@/g,
      (_, id) => mathBlocks[id] || ""
    );

    html = html.replace(
      /@@CODE_(\d+)@@/g,
      (_, id) => codeBlocks[id] || ""
    );

    return DOMPurify.sanitize(html, {
      ADD_TAGS: [
        "pre",
        "code",
        "span"
      ],
      ADD_ATTR: [
        "class"
      ]
    });

  } catch (err) {
    console.error("[MARKDOWN_ERROR]", err);
    return text;
  }
}


// --- helper: create typing DOM node and return a handle ---
function showTypingIndicator() {
  const chat = document.getElementById("chat");

  const wrapper = document.createElement("div");
  wrapper.className = "msg bot typing-wrapper";

  const typing = document.createElement("div");
  typing.className = "typing";
  typing.setAttribute("aria-live", "polite");
  typing.setAttribute("role", "status");

  const dot1 = document.createElement("span");
  dot1.className = "dot";
  const dot2 = document.createElement("span");
  dot2.className = "dot";
  const dot3 = document.createElement("span");
  dot3.className = "dot";

  typing.appendChild(dot1);
  typing.appendChild(dot2);
  typing.appendChild(dot3);

  wrapper.appendChild(typing);
  chat.appendChild(wrapper);
  chat.scrollTop = chat.scrollHeight;

  return wrapper; // caller can remove or replace this node
}


async function retryWithRepair(originalUserMessage, brokenOutput) {
  console.warn("[JSON_REPAIR] Model returned malformed JSON. Retrying with repair prompt.");

  const apiKey = document.getElementById("apiKey").value;
  const model = document.getElementById("model").value;

  const repairPrompt = `
Your previous response was not valid JSON.
Fix it. Output ONLY valid JSON.
Here is your broken output:

${brokenOutput}
`;

  const payload = [
    { role: "system", content: soulPrompt },
    { role: "system", content: getRuntimeContext(model) },
    { role: "user", content: originalUserMessage },
    { role: "user", content: repairPrompt }
  ];

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

  const extracted = extractThinkTags(raw);
  const parsed = extractThinkAndResponse(extracted.text);

  if (!parsed.ok) {
    console.error("[JSON_REPAIR_FAILED] Model still returned invalid JSON after retry.");
    addMessage("assistant", "⚠️ JSON malformed, could not repair automatically.", "");
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
    try { Function(parsed.js)(); } catch (err) { console.error("[JS_ERROR]", err); }
  }
}

async function sendMessage() {
  const input = document.getElementById("input");
  const apiKey = document.getElementById("apiKey").value;
  const model = document.getElementById("model").value;
  const sendBtn = document.getElementById("sendBtn");

  const userText = input.value.trim();
  if (!userText) return;

  if (!apiKey) {
    addMessage("assistant", "⚠️ Missing API key", "");
    return;
  }

  addMessage("user", userText);
  const originalUserMessage = userText;
  messages.push({ role: "user", content: userText });
  triggerAutosave();
  input.value = "";

  // show typing indicator and disable send
  const typingNode = showTypingIndicator();
  sendBtn.disabled = true;

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

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "";

    const extracted = extractThinkTags(raw);
    const parsed = extractThinkAndResponse(extracted.text);
    if (extracted.think) parsed.think = extracted.think;

    if (!parsed.ok) {
      if (typingNode && typingNode.remove) typingNode.remove();

      console.warn("Malformed JSON, retrying with repair prompt");

      return await retryWithRepair(originalUserMessage, raw);
    }

    if (!parsed.response.trim()) {
      if (typingNode && typeof typingNode.remove === "function") typingNode.remove();
      addMessage("assistant", "⚠️ empty response", "");
      return;
    }

    // success: remove typing and show assistant message
    if (typingNode && typeof typingNode.remove === "function") typingNode.remove();
    addMessage("assistant", parsed.response, parsed.think);

    messages.push({
      role: "assistant",
      content: JSON.stringify({ think: parsed.think, response: parsed.response })
    });

    triggerAutosave();

    if (parsed.js && parsed.js.trim()) {
      try { Function(parsed.js)(); } catch (err) { console.error("[JS_ERROR]", err); }
    }

  } catch (err) {
    console.error("[SEND_ERROR]", err);
    if (typingNode && typeof typingNode.remove === "function") typingNode.remove();
    addMessage("assistant", "⚠️ request failed", "");
  } finally {
    sendBtn.disabled = false;
  }
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

    response.innerHTML = renderMarkdown(text);

    if (typeof hljs !== "undefined") {
      response.querySelectorAll("pre code").forEach(block => {
        try {
          hljs.highlightElement(block);
        } catch (err) {
          debugLog("[HLJS_ERROR]", err);
        }
      });
    }

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

  return {
    think: "",
    response: content
  };
}

function extractThinkTags(text) {
  let think = "";

  if (typeof text !== "string") {
    return {
      text,
      think
    };
  }

  text = text.replace(
    /<think>([\s\S]*?)<\/think>/gi,
    (_, content) => {
      think += content.trim() + "\n";
      return "";
    }
  );

  return {
    text: text.trim(),
    think: think.trim()
  };
}


function extractThinkAndResponse(text, options = {}) {
  const {
    maxRetries = 2,
    allowRepair = true,
    warn = (msg, data) => debugLog(msg, data)
  } = options;

  function stripFences(input) {
    if (typeof input !== "string") {
      return input;
    }

    return input
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }

  function normalize(obj) {
    if (typeof obj !== "object" || obj === null) {
      return {
        ok: false,
        think: "",
        response: "",
        js: ""
      };
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

    let start = -1;
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = 0; i < input.length; i++) {
      const ch = input[i];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === "\\") {
          escaped = true;
        } else if (ch === '"') {
          inString = false;
        }

        continue;
      }

      if (ch === '"') {
        inString = true;
        continue;
      }

      if (ch === "{") {
        if (depth === 0) {
          start = i;
        }

        depth++;
      }

      if (ch === "}") {
        depth--;

        if (depth === 0 && start !== -1) {
          candidates.push(
            input.slice(start, i + 1)
          );

          start = -1;
        }
      }
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

    if (typeof jsonrepair !== "function") {
      return null;
    }

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
    return {
      ok: false,
      think: "",
      response: "",
      js: "",
      error: "NO_JSON_FOUND"
    };
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    for (const candidate of candidates) {
      const parsed = tryParse(candidate);

      if (parsed) {
        return normalize(parsed);
      }

      const repaired = tryRepairParse(candidate);

      if (repaired) {
        warn("JSON repaired", {
          candidate
        });

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

  return {
    ok: false,
    think: "",
    response: "",
    js: "",
    error: "FAILED_PARSE"
  };
}

function clearHistory() {
  localStorage.removeItem(
    STORAGE_KEY
  );

  messages = [];

  const chat = document.getElementById("chat");

  chat.innerHTML = "";
}

document.addEventListener(
  "DOMContentLoaded",
  () => {
    document
      .getElementById("sendBtn")
      .addEventListener(
        "click",
        sendMessage
      );

    document
      .getElementById("clearBtn")
      .addEventListener(
        "click",
        clearHistory
      );

    document
      .getElementById("input")
      .addEventListener(
        "keydown",
        e => {
          if (
            e.key === "Enter" &&
            !e.shiftKey
          ) {
            e.preventDefault();
            sendMessage();
          }
        }
      );

    autoload();
  }
);
