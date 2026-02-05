import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import { randomUUID } from "crypto";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

let docHtml = "";
const clients = new Map();

function broadcast(data, exceptId = null) {
  const payload = JSON.stringify(data);
  for (const [id, ws] of clients.entries()) {
    if (id === exceptId) continue;
    if (ws.readyState === ws.OPEN) {
      ws.send(payload);
    }
  }
}

wss.on("connection", (ws) => {
  const id = randomUUID();
  clients.set(id, ws);

  ws.send(
    JSON.stringify({
      type: "init",
      id,
      html: docHtml,
      cursors: [],
    })
  );

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === "join") {
      ws.userName = String(msg.name || "Anonymous").slice(0, 40);
      broadcast({
        type: "presence",
        id,
        name: ws.userName,
      }, id);
      return;
    }

    if (msg.type === "update") {
      if (typeof msg.html === "string") {
        docHtml = msg.html;
        broadcast({ type: "update", html: docHtml }, id);
      }
      return;
    }

    if (msg.type === "cursor") {
      if (typeof msg.offset === "number") {
        broadcast(
          {
            type: "cursor",
            id,
            name: ws.userName || "Anonymous",
            offset: msg.offset,
          },
          id
        );
      }
      return;
    }
  });

  ws.on("close", () => {
    clients.delete(id);
    broadcast({ type: "leave", id });
  });
});

server.listen(PORT, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`Server running at http://localhost:${PORT}`);
});
