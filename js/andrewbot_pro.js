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
- If code is included in the response field, encode it as JSON string content.
Example:
"response":"Here is code:\\n\\n\`\`\`js\\nconsole.log(1)\\n\`\`\`"

REQUIRED FORMAT:
{
  "think": "any internal reasoning, plans, or mental sandboxes",
  "response": "user-facing reply",
  "js": ""
}

RULES:
- Return short responses unless otherwise specified
- Ask for clarification if unsure
- If js is required, don't include it in the response field, only the js field
- js MUST be a string
- js must be executable if it is not empty
- Never use top-level return in js
- If no JS, use ""
- Output must be valid JSON parsable by JSON.parse()
`;

function getRuntimeContext(model) {
  return `Browser chat environment. Model: ${model}. Output JSON only.`;
}

// State Management
let messages = [];
let allChats = [];
let activeChatId = null;
let autosaveTimer = null;
let currentAttachments = []; // Holds pending files before sending
const DEBUG = false;

const STORAGE_KEY = "chat_autosave_multi";

function debugLog(...args) {
  if (DEBUG) {
    console.log("[DEBUG]", ...args); // Fixed infinite recursion bug
  }
}

// --- Chat History & Storage ---

function loadAllChatsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("[LOAD_CHATS_ERROR]", err);
    return [];
  }
}

function saveAllChatsToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allChats));
  } catch (err) {
    console.error("[SAVE_CHATS_ERROR]", err);
  }
}

function triggerAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    const chatIndex = allChats.findIndex(c => c.id === activeChatId);
    if (chatIndex !== -1) {
      allChats[chatIndex].messages = structuredClone(messages);
      allChats[chatIndex].timestamp = new Date().toISOString();
      
      // Auto-generate title from first user message
      if ((!allChats[chatIndex].title || allChats[chatIndex].title === "New Chat") && messages.length > 0) {
        const firstUserMsg = messages.find(m => m.role === 'user');
        if (firstUserMsg) {
          let titleText = "";
          if (typeof firstUserMsg.content === "string") {
            titleText = firstUserMsg.content;
          } else if (Array.isArray(firstUserMsg.content)) {
            const textPart = firstUserMsg.content.find(p => p.type === "text" && !p.text.startsWith("File:"));
            titleText = textPart ? textPart.text : "Attachment Chat";
          }
          allChats[chatIndex].title = titleText.substring(0, 30) + (titleText.length > 30 ? "..." : "");
        }
      }
      
      saveAllChatsToStorage();
      renderSidebar();
    }
  }, 800);
}

function startNewChat() {
  const newChat = {
    id: "chat_" + Date.now(),
    title: "New Chat",
    timestamp: new Date().toISOString(),
    messages: []
  };
  allChats.push(newChat);
  activeChatId = newChat.id;
  messages = [];

  const chat = document.getElementById("chat");
  chat.innerHTML = "";

  saveAllChatsToStorage();
  renderSidebar();
}

function loadChat(chatId) {
  const chat = allChats.find(c => c.id === chatId);
  if (!chat) return;

  activeChatId = chatId;
  messages = structuredClone(chat.messages);

  const chatEl = document.getElementById("chat");
  chatEl.innerHTML = "";

  messages.forEach(msg => {
    if (msg.role === "user") {
      addMessage("user", msg.content);
    } else {
      const parsed = tryParseStoredMessage(msg.content);
      addMessage("assistant", parsed.response, parsed.think);
    }
  });

  renderSidebar();
}

function deleteChat(chatId, event) {
  event.stopPropagation();
  allChats = allChats.filter(c => c.id !== chatId);
  
  if (activeChatId === chatId) {
    if (allChats.length > 0) {
      loadChat(allChats[allChats.length - 1].id);
    } else {
      startNewChat(); // Always have at least one chat
    }
  }
  saveAllChatsToStorage();
  renderSidebar();
}

function renderSidebar() {
  const historyEl = document.getElementById("chatHistory");
  if (!historyEl) return;

  historyEl.innerHTML = "";

  // Sort by most recent
  const sortedChats = [...allChats].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  sortedChats.forEach(chat => {
    const item = document.createElement("div");
    item.className = "chat-history-item" + (chat.id === activeChatId ? " active" : "");
    item.addEventListener("click", () => loadChat(chat.id));

    const title = document.createElement("div");
    title.className = "title";
    title.textContent = chat.title || "New Chat";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.innerHTML = "&times;";
    deleteBtn.addEventListener("click", (e) => deleteChat(chat.id, e));

    item.appendChild(title);
    item.appendChild(deleteBtn);
    historyEl.appendChild(item);
  });
}

// --- Attachments & File Handling ---
function setupAttachButton(btn) {
  // Create dropdown menu
  const menu = document.createElement("div");
  menu.id = "attach-menu";
  menu.style.borderRadius = "10px";
  menu.style.position = "absolute";
  menu.style.bottom = "100%"; // Open upwards instead of downwards
  menu.style.left = "0";
  menu.style.marginBottom = "4px"; // Small gap between menu and input
  menu.style.display = "none";
  menu.style.background = "#fff";
  menu.style.border = "1px solid #ccc";
  menu.style.boxShadow = "0 2px 10px rgba(0,0,0,0.1)";
  menu.style.zIndex = "1000";
  menu.style.flexDirection = "column";
  menu.style.padding = "5px 0";
  menu.style.width = "180px"; // Give it a fixed width so it looks uniform

  const imgBtn = document.createElement("button");
  imgBtn.textContent = "🖼️ Attach Image";
  imgBtn.style.color = "var(--color-text)";
  imgBtn.style.background = "none";
  imgBtn.style.border = "none";
  imgBtn.style.padding = "8px 16px";
  imgBtn.style.textAlign = "left";
  imgBtn.style.cursor = "pointer";
  imgBtn.style.width = "100%";
  imgBtn.onmouseover = () => imgBtn.style.background = "#f0f0f0";
  imgBtn.onmouseout = () => imgBtn.style.background = "none";
  imgBtn.onclick = () => {
    triggerFileInput("image/*");
    menu.style.display = "none"; // Close menu after clicking
  };

  const fileBtn = document.createElement("button");
  fileBtn.textContent = "📄 Attach File";
  fileBtn.style.color = "var(--color-text)";
  fileBtn.style.background = "none";
  fileBtn.style.border = "none";
  fileBtn.style.padding = "8px 16px";
  fileBtn.style.textAlign = "left";
  fileBtn.style.cursor = "pointer";
  fileBtn.style.width = "100%";
  fileBtn.onmouseover = () => fileBtn.style.background = "#f0f0f0";
  fileBtn.onmouseout = () => fileBtn.style.background = "none";
  fileBtn.onclick = () => {
    triggerFileInput("*/*");
    menu.style.display = "none"; // Close menu after clicking
  };

  menu.appendChild(imgBtn);
  menu.appendChild(fileBtn);
  
  // 1. Append to the button's parent (.input-row) instead of document.body
  const container = btn.parentElement;
  
  // 2. Ensure the parent has position: relative so absolute positioning anchors correctly
  if (window.getComputedStyle(container).position === "static") {
    container.style.position = "relative";
  }
  container.appendChild(menu);

  // 3. Remove getBoundingClientRect math. Just toggle the display.
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    menu.style.display = menu.style.display === "none" ? "flex" : "none";
  });

  // Close menu when clicking outside
  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target) && e.target !== btn) {
      menu.style.display = "none";
    }
  });
}

let hiddenInput; // Reusable file input
let expectedType; // 'image' or 'file'

function triggerFileInput(accept) {
  if (!hiddenInput) {
    hiddenInput = document.createElement("input");
    hiddenInput.type = "file";
    hiddenInput.style.display = "none";
    document.body.appendChild(hiddenInput);
    hiddenInput.addEventListener("change", handleFileSelect);
  }
  hiddenInput.accept = accept;
  expectedType = accept.includes("image") ? "image" : "file";
  hiddenInput.click();
  document.getElementById("attach-menu").style.display = "none";
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  
  if (file.type.startsWith("image/")) {
    reader.onload = () => {
      currentAttachments.push({
        type: "image",
        name: file.name,
        base64: reader.result
      });
      renderAttachments();
    };
    reader.readAsDataURL(file);
  } else {
    reader.onload = () => {
      currentAttachments.push({
        type: "file",
        name: file.name,
        content: reader.result
      });
      renderAttachments();
    };
    reader.readAsText(file);
  }
  
  // Reset input value to allow selecting the same file again
  e.target.value = "";
}

function renderAttachments() {
  let container = document.getElementById("attachmentPreview");
  const input = document.getElementById("input");
  
  if (!container) {
    container = document.createElement("div");
    container.id = "attachmentPreview";
    container.style.display = "flex";
    container.style.gap = "8px";
    container.style.padding = "8px";
    container.style.flexWrap = "wrap";
    container.style.borderTop = "1px solid #eee";
    input.parentNode.insertBefore(container, input);
  }
  
  container.innerHTML = "";
  
  currentAttachments.forEach((att, idx) => {
    const chip = document.createElement("div");
    chip.style.display = "flex";
    chip.style.alignItems = "center";
    chip.style.gap = "4px";
    chip.style.padding = "4px 8px";
    chip.style.background = "#f0f0f0";
    chip.style.borderRadius = "4px";
    chip.style.fontSize = "12px";

    if (att.type === "image") {
      const img = document.createElement("img");
      img.src = att.base64;
      img.style.height = "24px";
      img.style.width = "24px";
      img.style.objectFit = "cover";
      img.style.borderRadius = "2px";
      chip.appendChild(img);
      
      const nameSpan = document.createElement("span");
      nameSpan.textContent = att.name.length > 15 ? att.name.substring(0, 12) + "..." : att.name;
      chip.appendChild(nameSpan);
    } else {
      chip.textContent = "📄 " + (att.name.length > 15 ? att.name.substring(0, 12) + "..." : att.name);
    }

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "×";
    removeBtn.style.background = "none";
    removeBtn.style.border = "none";
    removeBtn.style.cursor = "pointer";
    removeBtn.style.fontWeight = "bold";
    removeBtn.style.color = "#666";
    removeBtn.onclick = () => {
      currentAttachments.splice(idx, 1);
      renderAttachments();
    };
    chip.appendChild(removeBtn);

    container.appendChild(chip);
  });
}

// --- Markdown & Rendering ---

function renderMarkdown(text) {
  try {
    if (
      typeof marked === "undefined" ||
      typeof katex === "undefined" ||
      typeof DOMPurify === "undefined"
    ) {
      return text;
    }

    const mathBlocks = [];
    const codeBlocks = [];

    // 1. Protect fenced code blocks from KaTeX
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

      mathBlocks.push(
        katex.renderToString(content.trim(), {
          displayMode: display,
          throwOnError: false,
          strict: false
        })
      );

      return `@@MATH_${id}@@`;
    }


    // 2. Process math only outside code
    text = text.replace(
      /\\\[([\s\S]*?)\\\]/g,
      (_, m) => saveMath(m, true)
    );

    text = text.replace(
      /\\\(([\s\S]*?)\\\)/g,
      (_, m) => saveMath(m, false)
    );

    text = text.replace(
      /\$\$([\s\S]*?)\$\$/g,
      (_, m) => saveMath(m, true)
    );

    text = text.replace(
      /\$([^$\n]+?)\$/g,
      (_, m) => saveMath(m, false)
    );


    // 3. Restore code BEFORE markdown parsing
    text = text.replace(
      /@@CODE_(\d+)@@/g,
      (_, id) => codeBlocks[id]
    );


    // 4. Let marked handle code fences
    let html = marked.parse(text, {
      breaks: true,
      gfm: true
    });


    // 5. Restore KaTeX HTML
    html = html.replace(
      /@@MATH_(\d+)@@/g,
      (_, id) => mathBlocks[id]
    );


    return DOMPurify.sanitize(html, {
      ADD_TAGS: ["pre", "code", "span"],
      ADD_ATTR: ["class"]
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
  if (!userText && currentAttachments.length === 0) return;

  if (!apiKey) {
    addMessage("assistant", "⚠️ Missing API key", "");
    return;
  }

  // Build user message content (String or Array for OpenAI compatibility)
  let userContent;
  if (currentAttachments.length > 0) {
    userContent = [];
    if (userText) {
      userContent.push({ type: "text", text: userText });
    }
    currentAttachments.forEach(att => {
      if (att.type === "image") {
        userContent.push({
          type: "image_url",
          image_url: { url: att.base64 }
        });
      } else {
        userContent.push({
          type: "text",
          text: `File: ${att.name}\nContent:\n${att.content}`
        });
      }
    });
  } else {
    userContent = userText;
  }

  addMessage("user", userContent);
  const originalUserMessage = userText || "[Attachment sent]";
  messages.push({ role: "user", content: userContent });
  triggerAutosave();
  
  input.value = "";
  currentAttachments = [];
  renderAttachments();

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
    if (typeof text === "string") {
      div.textContent = text;
    } else if (Array.isArray(text)) {
      // Render multimodal content
      const textPart = text.find(t => t.type === "text" && !t.text.startsWith("File:"));
      if (textPart) {
        const p = document.createElement("div");
        p.textContent = textPart.text;
        div.appendChild(p);
      }

      const attachmentsDiv = document.createElement("div");
      attachmentsDiv.style.display = "flex";
      attachmentsDiv.style.gap = "8px";
      attachmentsDiv.style.marginTop = "8px";
      attachmentsDiv.style.flexWrap = "wrap";

      text.forEach(part => {
        if (part.type === "image_url") {
          const img = document.createElement("img");
          img.src = part.image_url.url;
          img.style.maxWidth = "100%";
          img.style.maxHeight = "200px";
          img.style.borderRadius = "8px";
          img.style.cursor = "pointer";
          img.onclick = () => window.open(part.image_url.url, "_blank");
          attachmentsDiv.appendChild(img);
        } else if (part.type === "text" && part.text.startsWith("File:")) {
          const chip = document.createElement("div");
          chip.textContent = "📄 " + part.text.split("\n")[0].replace("File: ", "");
          chip.style.fontSize = "12px";
          chip.style.border = "1px solid #ccc";
          chip.style.padding = "4px 8px";
          chip.style.borderRadius = "4px";
          attachmentsDiv.appendChild(chip);
        }
      });

      if (attachmentsDiv.children.length > 0) {
        div.appendChild(attachmentsDiv);
      }
    }
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
  if (!confirm("Are you sure you want to delete ALL chats? This cannot be undone.")) return;
  localStorage.removeItem(STORAGE_KEY);
  allChats = [];
  startNewChat();
}

// --- Initialization ---

document.addEventListener("DOMContentLoaded", () => {
  allChats = loadAllChatsFromStorage();
  if (allChats.length === 0) {
    startNewChat();
  } else {
    allChats.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
    loadChat(allChats[0].id);
  }
  renderSidebar();

  document.getElementById("sendBtn").addEventListener("click", sendMessage);
  document.getElementById("clearBtn").addEventListener("click", clearHistory);
  document.getElementById("newChatBtn").addEventListener("click", startNewChat);
  
  // Setup attach button
  const attachBtn = document.getElementById("attach");
  if (attachBtn) {
    setupAttachButton(attachBtn);
  }

  document.getElementById("input").addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
});
