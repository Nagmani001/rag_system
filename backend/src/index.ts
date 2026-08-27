import { GoogleGenAI, FunctionCallingConfigMode } from "@google/genai";
import { config } from "dotenv";
config();
import express from "express";
import { z } from "zod";
import { chromaClient } from "./chroma";
import { SYSTEM_PROMPT, TOOLS } from "./inputsToLLM";
import { executeTool } from "./toolExecutor";

export { chromaClient };

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || ""
});

const app = express();
const port = process.env.PORT ?? 3000;

app.use(express.json());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

const ChatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "model", "assistant"]),
        content: z.string(),
      })
    )
    .min(1, "messages must be a non-empty array"),
});

function toGeminiContents(messages: any) {
  return messages.map((message: any) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/chat", async (req, res) => {
  const parsed = ChatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const messages = parsed.data.messages;

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const sendEvent = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUserMessage || !lastUserMessage.content.trim()) {
    sendEvent({ type: "error", error: "No user message provided" });
    res.end();
    return;
  }


  try {
    const systemInstruction = SYSTEM_PROMPT;
    let sources = [];

    let history = toGeminiContents(messages);
    let usedTool = false;

    for (let turn = 0; turn < 6; turn++) {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: history,
        config: {
          systemInstruction,
          tools: TOOLS,
          toolConfig: {
            functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO },
          },
        },
      });

      const calls = response.functionCalls;
      if (!calls || calls.length === 0) {
        if (!usedTool) history = toGeminiContents(messages);
        break;
      }

      usedTool = true;
      history.push({ role: "model", parts: calls.map((c) => ({ functionCall: c })) });

      const responseParts = [];
      for (const call of calls) {
        const result = await executeTool(call.name, call.args);
        responseParts.push({
          functionResponse: {
            name: call.name,
            id: call.id,
            response: { output: result.output },
          },
        });
        sources.push(...result.sources);
      }
      history.push({ role: "user", parts: responseParts });
    }

    const stream = await ai.models.generateContentStream({
      model: GEMINI_MODEL,
      contents: history,
      config: {
        ...(systemInstruction ? { systemInstruction } : {}),
      },
    });

    for await (const chunk of stream) {
      if (res.writableEnded) break;
      const text = chunk.text;
      if (text) {
        sendEvent({ type: "chunk", text });
      }
    }

    if (!res.writableEnded) {
      sendEvent({ type: "done", sources });
      res.end();
    }
  } catch (err) {
    console.error(err);
    if (!res.writableEnded) {
      sendEvent({ type: "error", error: "Failed to generate answer" });
      res.end();
    }
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
