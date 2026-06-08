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
  "think": "short internal reasoning",
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
      details.className = "thinking";

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

function extractThinkAndResponse(text) {
  if (!text) return { think: "", response: "", js: "" };

  text = text.replace(/```json|```/g, "").trim();

  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");

  if (jsonStart === -1 || jsonEnd === -1) {
    return { think: "", response: text, js: "" };
  }

  const jsonString = text.slice(jsonStart, jsonEnd + 1);

  try {
    const parsed = JSON.parse(jsonString);

    return {
      think: typeof parsed.think === "string" ? parsed.think : "",
      response: typeof parsed.response === "string" ? parsed.response : "",
      js: typeof parsed.js === "string" ? parsed.js : ""
    };
  } catch {
    return { think: "", response: text, js: "" };
  }
}

async function sendMessage() {
  const input = document.getElementById("input");
  const apiKey = document.getElementById("apiKey").value;
  const model = document.getElementById("model").value;

  const userText = input.value.trim();
  if (!userText) return;

  addMessage("user", userText);
  messages.push({ role: "user", content: userText });
  input.value = "";

  const payloadMessages = [
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
      body: JSON.stringify({
        model,
        messages: payloadMessages
      })
    });

    const data = await res.json();
    const rawReply = data.choices?.[0]?.message?.content || "";

    const parsed = extractThinkAndResponse(rawReply);

    addMessage("assistant", parsed.response, parsed.think);

    messages.push({ role: "assistant", content: parsed.response });

    if (typeof parsed.js === "string" && parsed.js.trim() !== "") {
      try {
        eval(parsed.js);
      } catch (e) {
        console.error("JS execution error:", e);
      }
    }

  } catch (err) {
    addMessage("assistant", "Error: " + err.message);
  }
}
