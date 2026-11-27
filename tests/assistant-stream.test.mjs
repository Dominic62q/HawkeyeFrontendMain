import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

// Load the production client with only its unrelated JSON API dependency replaced.
const source = (await readFile(new URL("../src/lib/assistant.ts", import.meta.url), "utf8"))
  .replace('import { api, ApiError } from "./api";', 'const api = () => {}; class ApiError extends Error { constructor(status, body) { super(`Request failed with status ${status}`); this.status = status; this.body = body; } }');
const js = stripTypeScriptTypes(source);
const { sendAssistantChat } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
globalThis.window = { location: { origin: "http://localhost" } };
globalThis.document = { cookie: "other=1; csrftoken=csrf-value" };

function response(chunks, status = 200) {
  return new Response(new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  }), { status, headers: { "Content-Type": "text/event-stream; charset=utf-8" } });
}
const encode = (text) => new TextEncoder().encode(text);
const frame = (event, data) => `event: ${event}\r\ndata: ${JSON.stringify(data)}\r\n\r\n`;
const done = { reply: "héllo 🌍", toolsUsed: ["search"], model: "model", sessionId: "session", threadId: "thread" };

test("decodes arbitrary UTF-8 and CRLF splits, status, text, reset and completion", async () => {
  const bytes = encode(frame("status", { message: "Searching" }) + frame("text", { text: "preamble" }) + frame("reset", {}) + frame("text", { text: done.reply }) + frame("done", done));
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return response(Array.from(bytes, (byte) => Uint8Array.of(byte)));
  };
  const events = [];
  const result = await sendAssistantChat("org", { messages: [] }, {
    onStatus: (s) => events.push(["status", s]),
    onText: (s) => events.push(["text", s]),
    onReset: () => events.push(["reset"]),
  });
  assert.deepEqual(result, done);
  assert.deepEqual(events, [["status", "Searching"], ["text", "preamble"], ["reset"], ["text", done.reply]]);
  assert.equal(request.url.pathname, "/api/0/organizations/org/assistant/chat/");
  assert.equal(request.options.credentials, "same-origin");
  assert.equal(request.options.headers.Accept, "text/event-stream");
  assert.equal(request.options.headers["X-CSRFToken"], "csrf-value");
});

test("rejects interrupted streams after delivering partial text", async () => {
  globalThis.fetch = async () => response([encode(frame("text", { text: "partial" }) + 'event: done\ndata: {')]);
  let partial = "";
  await assert.rejects(sendAssistantChat("org", { messages: [] }, { onText: (text) => { partial += text; } }), /interrupted/);
  assert.equal(partial, "partial");
});

test("rejects error events and malformed completion", async () => {
  globalThis.fetch = async () => response([encode(frame("error", { message: "provider failed" }))]);
  await assert.rejects(sendAssistantChat("org", { messages: [] }), /provider failed/);
  globalThis.fetch = async () => response([encode(frame("done", { reply: "incomplete" }))]);
  await assert.rejects(sendAssistantChat("org", { messages: [] }), /Invalid assistant completion/);
});

test("rejects unsuccessful HTTP responses with their API error body", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ detail: "Forbidden" }), { status: 403 });
  await assert.rejects(sendAssistantChat("org", { messages: [] }), (error) => error.status === 403 && error.body.detail === "Forbidden");
});
