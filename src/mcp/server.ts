
import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { retrieveFromChroma } from "../rag/chroma-retrieval.js";

const server = new McpServer({
  name: "ai-engineering-copilot",
  version: "1.0.0",
});

server.registerTool(
  "get_project_info",
  {
    description: "Return basic information about the AI Engineering Copilot project.",
    inputSchema: {
      includeGoals: z.boolean().default(true),
    },
  },
  async ({ includeGoals }) => {
    const project = {
      name: "AI Engineering Copilot",
      purpose: "Investigate software bugs and assist with engineering workflows.",
      goals: includeGoals
        ? [
            "Search GitHub issues, code, and pull requests",
            "Prepare Jira ticket proposals",
            "Integrate external tools through MCP",
          ]
        : undefined,
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(project, null, 2),
        },
      ],
    };
  },
);

server.registerTool(
  "search_github_issues",
  {
    description:
      "Search GitHub issues for bug reports and related problems in the configured repository.",
    inputSchema: {
      query: z.string().min(1).describe("Keywords describing the bug or problem."),
    },
  },
  async ({ query }) => {
    const token = process.env.GITHUB_TOKEN;
    const repository = process.env.GITHUB_REPO || "fastify/fastify";

    if (!token) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: "Missing GITHUB_TOKEN environment variable.",
            }),
          },
        ],
        isError: true,
      };
    }

    const searchQuery = `${query} repo:${repository} is:issue`;
    const url = new URL("https://api.github.com/search/issues");
    url.searchParams.set("q", searchQuery);
    url.searchParams.set("per_page", "5");

    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });

      if (!response.ok) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: `GitHub Issues API request failed with status ${response.status}.`,
              }),
            },
          ],
          isError: true,
        };
      }

      const data: unknown = await response.json();

      const schema = z.object({
        total_count: z.number(),
        incomplete_results: z.boolean(),
        items: z.array(
          z.object({
            number: z.number(),
            title: z.string(),
            html_url: z.url(),
            state: z.string(),
            body: z.string().nullable(),
          }),
        ),
      });

      const parsed = schema.safeParse(data);

      if (!parsed.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: "Unexpected GitHub Issues API response format.",
              }),
            },
          ],
          isError: true,
        };
      }

      const result = {
        success: true,
        repository,
        query,
        totalCount: parsed.data.total_count,
        incompleteResults: parsed.data.incomplete_results,
        issues: parsed.data.items.map((issue) => ({
          number: issue.number,
          title: issue.title,
          url: issue.html_url,
          state: issue.state,
          body: issue.body?.slice(0, 3000) ?? "",
        })),
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: "Network error while contacting GitHub Issues API.",
            }),
          },
        ],
        isError: true,
      };
    }
  },
);

server.registerTool(
  "search_knowledge_base",
  {
    description:
      "Search the project's knowledge base for relevant technical information using semantic vector search.",
    inputSchema: {
      query: z
        .string()
        .min(1)
        .describe("The technical question or problem to search for."),
      topK: z
        .number()
        .int()
        .min(1)
        .max(10)
        .default(3)
        .describe("Maximum number of relevant chunks to retrieve."),
    },
  },
  async ({ query, topK }) => {
    try {
      const results = await retrieveFromChroma(query, topK);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                query,
                resultCount: results.length,
                results: results.map((result) => ({
                  id: result.id,
                  source: result.source,
                  score: result.score,
                  content: result.content,
                })),
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error:
                "Failed to search the knowledge base. Check that Chroma is running and the collection is available.",
            }),
          },
        ],
        isError: true,
      };
    }
  },
);

const transport = new StdioServerTransport();

await server.connect(transport);
