
import "dotenv/config";
import OpenAI from "openai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const mcpClient = new Client({
  name: "ai-engineering-copilot-agent",
  version: "1.0.0",
});

const transport = new StdioClientTransport({
  command: "npx",
  args: ["tsx", "src/mcp/server.ts"],
});

try {
  await mcpClient.connect(transport);

  // Step 1: Discover tools from the MCP server.
  const { tools: mcpTools } = await mcpClient.listTools();

  // Step 2: Convert MCP tools to OpenAI function tools.
  const openaiTools = mcpTools.map((tool) => ({
    type: "function" as const,
    name: tool.name,
    description: tool.description ?? "",
    parameters: tool.inputSchema,
    strict: false,
  }));

  console.log("Available tools:", mcpTools.map((tool) => tool.name));

  // Step 3: Ask the model to answer the user's request.
  const input: OpenAI.Responses.ResponseInputItem[] = [
    {
      role: "user",
      content:
        "Investigate Fastify issue #7038. First search GitHub issues for the original report. Then search the knowledge base for relevant technical details. Combine both sources to explain the reproduction conditions, actual behavior, and expected behavior. If the sources do not provide enough evidence, say so.",
    },
  ];

  let response = await openai.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    input,
    tools: openaiTools,
  });

  // Step 4: Execute tool calls and return their results to the model.
  for (let round = 0; round < 5; round++) {
    const toolCalls = response.output.filter(
      (item) => item.type === "function_call",
    );

    if (toolCalls.length === 0) {
      console.log("\nFinal answer:");
      console.log(response.output_text);
      break;
    }

    input.push(
      ...(response.output as OpenAI.Responses.ResponseInputItem[]),
    );

    for (const toolCall of toolCalls) {
      const args = JSON.parse(toolCall.arguments) as Record<string, unknown>;
    
      console.log(`\nCalling tool: ${toolCall.name}`);
    
      const result = await mcpClient.callTool({
        name: toolCall.name,
        arguments: args,
      });
    
      console.log(`Completed tool: ${toolCall.name}`);
    
      input.push({
        type: "function_call_output",
        call_id: toolCall.call_id,
        output: JSON.stringify(result),
      });
    }

    response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input,
      tools: openaiTools,
    });

    if (round === 4) {
      console.log("Stopped after reaching the tool-call limit.");
      console.log(response.output_text);
    }
  }
} finally {
  await mcpClient.close();
}
