/* Contextual chat: a panel that already knows what Joe is looking at.
   Calls the Claude API from the browser with a key stored only on this device. */
import Anthropic from "https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.128.0/+esm";

const FALLBACK_BETA = "server-side-fallback-2026-07-01";
const KEY_STORE = "pnd.anthropicKey";
const MODEL_STORE = "pnd.model";

const readStore = (k) => { try { return localStorage.getItem(k) || ""; } catch (_) { return ""; } };
const writeStore = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (_) { /* ignore */ } };

export const chatSettings = {
  get key() { return readStore(KEY_STORE); },
  set key(v) { writeStore(KEY_STORE, v.trim()); },
  get model() { return readStore(MODEL_STORE) || "claude-opus-5"; },
  set model(v) { writeStore(MODEL_STORE, v.trim()); },
};

const SYSTEM = `You are a thoughtful companion inside Joe's personal news and devotion digest. Joe is a financial planner and a Christian.
The digest's philosophy: favor durability, proportionality, and what Joe can act on; avoid hype and anxiety; treat what is working as newsworthy; avoid false balance.
The raw material comes first. Do not add commentary Joe did not ask for. Answer what he asks, plainly and briefly, and ask a good question back when it helps.
For news, separate what is known from what is disputed, and represent serious perspectives fairly. Use web search when you need current facts, and cite sources.
For prayer and scripture, be a quiet conversation partner, not a lecturer. Where it helps, you may draw on the wider Christian tradition, as one thoughtful voice.
The deeper aim is to help Joe show up better as a father, a coworker, and a citizen.`;

let dialog, log, form, input, titleEl, keyBox;
let messages = [];
let context = null;
let busy = false;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function build() {
  dialog = document.getElementById("chat");
  titleEl = dialog.querySelector(".chat-title");
  log = dialog.querySelector(".chat-log");
  form = dialog.querySelector(".chat-form");
  input = form.querySelector("textarea");
  keyBox = dialog.querySelector(".chat-key");
  dialog.querySelector(".chat-close").addEventListener("click", () => dialog.close());
  form.addEventListener("submit", (e) => { e.preventDefault(); send(input.value); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input.value); }
  });
  keyBox.querySelector("button").addEventListener("click", () => {
    chatSettings.key = keyBox.querySelector("input").value;
    renderKeyBox();
  });
}

function renderKeyBox() {
  const hasKey = !!chatSettings.key;
  keyBox.hidden = hasKey;
  form.hidden = !hasKey;
}

function bubble(role, text) {
  const b = el("div", `chat-msg ${role}`);
  b.textContent = text;
  log.append(b);
  log.scrollTop = log.scrollHeight;
  return b;
}

/**
 * Open the panel for a piece of content.
 * ctx = { kind: "news"|"prayer"|"reading"|"region"|"reflection", title, body, url? }
 * prompt = optional one-tap question to send immediately.
 */
export function openChat(ctx, prompt) {
  if (!dialog) build();
  if (!context || context.title !== ctx.title || context.kind !== ctx.kind) {
    messages = [];
    log.replaceChildren(el("p", "chat-context small muted", ctx.body ? `${ctx.title}\n\n${ctx.body}` : ctx.title));
  }
  context = ctx;
  titleEl.textContent = { news: "Talk about this story", prayer: "Talk about this prayer", reading: "Ask about this passage",
                          region: "Talk about this region", reflection: "Pray and reflect" }[ctx.kind] || "Talk it through";
  renderKeyBox();
  if (!dialog.open) dialog.showModal();
  if (prompt && chatSettings.key) send(prompt);
  else input.focus();
}

async function send(text) {
  text = (text || "").trim();
  if (!text || busy || !chatSettings.key) return;
  input.value = "";
  busy = true;
  form.classList.add("busy");
  bubble("user", text);
  const first = messages.length === 0;
  const content = first
    ? `Here is what I'm looking at (${context.kind}):\n${context.title}${context.url ? `\n${context.url}` : ""}\n\n${context.body || ""}\n\n${text}`
    : text;
  messages.push({ role: "user", content });
  const out = bubble("assistant", "");
  out.classList.add("pending");

  try {
    const client = new Anthropic({ apiKey: chatSettings.key, dangerouslyAllowBrowser: true });
    let final, paused = [];
    for (let i = 0; i < 4; i++) { // resume if a web search pauses the turn
      const stream = client.beta.messages.stream({
        model: chatSettings.model,
        max_tokens: 16000,
        betas: [FALLBACK_BETA],
        fallbacks: "default",
        thinking: { type: "adaptive" },
        system: SYSTEM,
        tools: context.kind === "news" || context.kind === "region"
          ? [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }] : undefined,
        messages: paused.length ? [...messages, { role: "assistant", content: paused }] : messages,
      });
      stream.on("text", (t) => { out.classList.remove("pending"); out.textContent += t; log.scrollTop = log.scrollHeight; });
      final = await stream.finalMessage();
      if (final.stop_reason !== "pause_turn") break;
      paused = [...paused, ...final.content];
    }
    if (final.stop_reason === "refusal") {
      out.textContent = "Claude declined to answer this one.";
    }
    messages.push({ role: "assistant", content: [...paused, ...final.content] });
  } catch (err) {
    out.classList.add("error");
    out.textContent = err instanceof Anthropic.AuthenticationError
      ? "That API key was rejected. Update it in Settings."
      : err instanceof Anthropic.RateLimitError
        ? "Rate limited. Try again in a minute."
        : `Something went wrong: ${err.message || err}`;
    messages.pop(); // let Joe retry the same question
  } finally {
    out.classList.remove("pending");
    busy = false;
    form.classList.remove("busy");
    input.focus();
  }
}

window.openChat = openChat;
window.chatSettings = chatSettings;
window.dispatchEvent(new Event("chat-ready"));
