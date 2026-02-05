const nameGate = document.getElementById("nameGate");
const nameInput = document.getElementById("nameInput");
const joinBtn = document.getElementById("joinBtn");
const editor = document.getElementById("editor");
const fontSize = document.getElementById("fontSize");
const toolButtons = document.querySelectorAll(".tool-btn");
const assistantText = document.getElementById("assistantText");

let ws;
let myId = null;
const remoteCursors = new Map();
let lastSentHtml = "";
let tipIndex = 0;

function connect(name) {
  ws = new WebSocket(`ws://${window.location.host}`);

  ws.addEventListener("open", () => {
    ws.send(JSON.stringify({ type: "join", name }));
  });

  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);

    if (msg.type === "init") {
      myId = msg.id;
      if (msg.html) {
        editor.innerHTML = msg.html;
      }
      lastSentHtml = getCleanHTML();
      renderRemoteCursors();
    }

    if (msg.type === "update") {
      if (msg.html !== getCleanHTML()) {
        editor.innerHTML = msg.html || "";
        lastSentHtml = getCleanHTML();
        renderRemoteCursors();
      }
    }

    if (msg.type === "cursor") {
      if (msg.id === myId) return;
      remoteCursors.set(msg.id, { name: msg.name, offset: msg.offset });
      renderRemoteCursors();
    }

    if (msg.type === "leave") {
      remoteCursors.delete(msg.id);
      renderRemoteCursors();
    }
  });
}

const tips = [
  "Tip: Enter your name so teammates can find you.",
  "Tip: Use Bold or Italic to emphasize text.",
  "Tip: Change font size to make headings stand out.",
  "Tip: Your cursor label shows teammates where you are.",
  "Tip: Open this page in another browser to collaborate.",
];

function rotateTips() {
  if (!assistantText) return;
  tipIndex = (tipIndex + 1) % tips.length;
  assistantText.textContent = tips[tipIndex];
}

function getCleanHTML() {
  const clone = editor.cloneNode(true);
  clone.querySelectorAll(".remote-cursor").forEach((el) => el.remove());
  return clone.innerHTML;
}

function sendUpdate() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const html = getCleanHTML();
  if (html === lastSentHtml) return;
  lastSentHtml = html;
  ws.send(JSON.stringify({ type: "update", html }));
}

function getSelectionOffset() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;
  const range = selection.getRangeAt(0);
  const preRange = range.cloneRange();
  preRange.selectNodeContents(editor);
  preRange.setEnd(range.endContainer, range.endOffset);
  return preRange.toString().length;
}

function getRangeAtOffset(root, offset) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  let remaining = offset;

  while (current) {
    const length = current.textContent.length;
    if (remaining <= length) {
      const range = document.createRange();
      range.setStart(current, remaining);
      range.collapse(true);
      return range;
    }
    remaining -= length;
    current = walker.nextNode();
  }

  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  return range;
}

function renderRemoteCursors() {
  editor.querySelectorAll(".remote-cursor").forEach((el) => el.remove());

  for (const { name, offset } of remoteCursors.values()) {
    const range = getRangeAtOffset(editor, offset);
    const marker = document.createElement("span");
    marker.className = "remote-cursor";

    const label = document.createElement("span");
    label.className = "label";
    label.textContent = name || "Guest";

    marker.appendChild(label);
    range.insertNode(marker);
  }
}

function sendCursor() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const offset = getSelectionOffset();
  ws.send(JSON.stringify({ type: "cursor", offset }));
}

function applyCommand(cmd) {
  document.execCommand(cmd, false, null);
  sendUpdate();
}

function applyFontSize(px) {
  document.execCommand("fontSize", false, "7");
  const fonts = editor.querySelectorAll("font[size='7']");
  fonts.forEach((font) => {
    font.removeAttribute("size");
    font.style.fontSize = `${px}px`;
  });
  sendUpdate();
}

joinBtn.addEventListener("click", () => {
  const name = nameInput.value.trim() || "Guest";
  nameGate.style.display = "none";
  connect(name);
  editor.focus();
});

nameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") joinBtn.click();
});

editor.addEventListener("input", () => {
  sendUpdate();
  sendCursor();
});

editor.addEventListener("keyup", () => {
  sendCursor();
});

editor.addEventListener("mouseup", () => {
  sendCursor();
});

fontSize.addEventListener("change", (event) => {
  applyFontSize(event.target.value);
});

toolButtons.forEach((button) => {
  button.addEventListener("click", () => {
    toolButtons.forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");
    applyCommand(button.dataset.cmd);
  });
});

window.addEventListener("beforeunload", () => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.close();
  }
});

setInterval(rotateTips, 5000);
