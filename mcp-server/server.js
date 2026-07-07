import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";

const server = new McpServer({
  name: "ollama-bridge",
  version: "1.0.0"
});

server.registerTool(
  "ask_local_model",
  {
    title: "Ask local Ollama model",
    description:
      "Delegate a sub-task to a local Ollama model instead of using Claude tokens. " +
      "Good for cheap, mechanical work: summarizing a chunk of text, boilerplate generation, " +
      "reformatting, extracting fields, simple Q&A over provided text. " +
      "Not a substitute for tasks needing careful multi-step reasoning or repo-wide context.",
    inputSchema: {
      prompt: z.string().describe("The task or question for the local model"),
      model: z.string().optional().describe(
        "Ollama model name, e.g. qwen2.5-coder:7b, qwen3.5:9b, gemma3:12b, llama3.1:latest. Defaults to qwen3.5:9b."
      ),
      system: z.string().optional().describe("Optional system prompt")
    }
  },
  async ({ prompt, model, system }) => {
    const body = {
      model: model || "qwen3.5:9b",
      prompt,
      stream: false
    };
    if (system) body.system = system;

    let res;
    try {
      res = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
    } catch (e) {
      return {
        content: [{ type: "text", text: `Could not reach Ollama at ${OLLAMA_URL}: ${e.message}` }],
        isError: true
      };
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      return {
        content: [{ type: "text", text: `Ollama returned ${res.status}: ${errText}` }],
        isError: true
      };
    }

    const data = await res.json();
    return { content: [{ type: "text", text: data.response || "" }] };
  }
);

server.registerTool(
  "list_local_models",
  {
    title: "List installed local Ollama models",
    description: "Returns the models currently installed and available on the local Ollama server.",
    inputSchema: {}
  },
  async () => {
    let res;
    try {
      res = await fetch(`${OLLAMA_URL}/api/tags`);
    } catch (e) {
      return {
        content: [{ type: "text", text: `Could not reach Ollama at ${OLLAMA_URL}: ${e.message}` }],
        isError: true
      };
    }
    const data = await res.json();
    const names = (data.models || []).map((m) => m.name);
    return { content: [{ type: "text", text: names.join("\n") || "No models installed." }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
