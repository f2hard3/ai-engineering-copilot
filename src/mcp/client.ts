import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const mcpClient = new Client({
  name: "ai-engineering-copilot-client",
  version: "1.0.0",
});

const transport = new StdioClientTransport({
  command: "npx",
  args: ["tsx", "src/mcp/server.ts"],
});

try {
  await mcpClient.connect(transport);

  const { tools } = await mcpClient.listTools();

  console.log("Available MCP tools:");
  console.log(JSON.stringify(tools, null, 2));

  const result = await mcpClient.callTool({
    name: "search_github_issues",
    arguments: {
      query: "7038",
    },
  });

  console.log("\nTool result:");
  console.log(JSON.stringify(result, null, 2));

  const ragResult = await mcpClient.callTool({
    name: "search_knowledge_base",
    arguments: {
      query: "Why does the request handler receive an empty payload?",
      topK: 3,
    },
  });
  
  console.log("\nRAG search result:");
  console.log(JSON.stringify(ragResult, null, 2));
} finally {
  await mcpClient.close();
}
