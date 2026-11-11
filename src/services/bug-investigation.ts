import type OpenAI from "openai";

import { openai, model } from "../lib/openai.js";
import { logInfo } from "../lib/logger.js";
import { logError } from "../lib/logger.js";
import {
  searchGitHubCode,
  getGitHubFile,
  searchGitHubIssues,
  searchGitHubPullRequests,
  GitHubCodeToolResultSchema,
  GitHubFileToolResultSchema,
  GitHubIssuesToolResultSchema,
  GitHubPullRequestsToolResultSchema,
  type GitHubCodeToolResult,
  type GitHubFileToolResult,
  type GitHubIssuesToolResult,
  type GitHubPullRequestsToolResult,
} from "../integrations/github/client.js";

export type InvestigationEvidence = {
  tool:
    | "search_github_code"
    | "search_github_issues"
    | "search_github_pull_requests"
    | "get_github_file";
  arguments: string;
  result:
    | GitHubCodeToolResult
    | GitHubIssuesToolResult
    | GitHubPullRequestsToolResult
    | GitHubFileToolResult;
};

export type InvestigationResult = {
  summary: string;
  searchEvidence: InvestigationEvidence[];
};

const MAX_SEARCH_CALLS = 3;

const searchTool: OpenAI.Responses.Tool = {
  type: "function",
  name: "search_github_code",
  description:
    "Search repository code for information relevant to a software bug.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Keywords to search for in the code repository.",
      },
    },
    required: ["query"],
    additionalProperties: false,
  },
  strict: true,
};

const searchIssuesTool: OpenAI.Responses.Tool = {
  type: "function",
  name: "search_github_issues",
  description:
    "Search real GitHub issues for bug reports and related problems in the target repository.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Keywords describing the bug or problem.",
      },
    },
    required: ["query"],
    additionalProperties: false,
  },
  strict: true,
};

const searchPullRequestsTool = {
  type: "function" as const,
  name: "search_github_pull_requests",
  description:
    "Search GitHub pull requests in the configured repository. Use this to find related fixes, existing implementations, and merged or closed pull requests.",
  parameters: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description:
          "Search terms describing the bug, error message, related code, or possible fix.",
      },
    },
    required: ["query"],
    additionalProperties: false,
  },
  strict: true,
};

const getGitHubFileTool: OpenAI.Responses.Tool = {
  type: "function",
  name: "get_github_file",
  description:
    "Retrieve the contents of a file from the configured GitHub repository. Use a file path returned by GitHub code search whenever possible.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description:
          "Repository-relative file path, such as lib/handle-request.js.",
      },
    },
    required: ["path"],
    additionalProperties: false,
  },
  strict: true,
};

type ToolHandler = (rawArguments: string) => Promise<unknown>;

const toolRegistry: Record<string, ToolHandler> = {
  search_github_code: searchGitHubCode,
  search_github_issues: searchGitHubIssues,
  search_github_pull_requests: searchGitHubPullRequests,
  get_github_file: getGitHubFile,
};

async function executeTool(
  name: string,
  rawArguments: string,
): Promise<unknown> {
  const handler = toolRegistry[name];

  if (!handler) {
    return {
      success: false,
      error: `Unknown tool: ${name}`,
    };
  }

  return handler(rawArguments);
}

export async function investigateBug(
  bugReport: string,
): Promise<InvestigationResult> {
  let searchCalls = 0;
  const searchEvidence: InvestigationResult["searchEvidence"] = [];

  const openaiStartedAt = Date.now();

  let response = await openai.responses.create({
    model,
    instructions: `
      You are a software investigation assistant.
      Use GitHub code search to investigate the reported bug.
      Avoid repeating searches that are unlikely to provide new information.
      Summarize findings using only the information returned by the tools.

      If GitHub search returns zero results, explicitly state
      that no matching code was found.
      Do not present unverified hypotheses as findings.
      Clearly separate evidence, hypotheses, and next steps.
      Do not claim that mock search results are verified repository findings.

      Use both GitHub code search and GitHub issue search when relevant.
      Search issues for related bug reports and prior discussions.
      Do not treat issue titles alone as proof of a root cause.
      Clearly distinguish repository evidence, issue evidence,
      user-reported facts, and hypotheses.

      Use GitHub pull request search when relevant.
      Search for pull requests related to the reported bug, including
      open, closed, and merged pull requests.
      Inspect pull request titles and bodies for relevance.
      Use merged pull requests as evidence of prior changes, but do not
      assume that a merged change fixed the reported bug without supporting evidence.
      If a relevant pull request is found, retrieve and inspect related code
      or tests when useful.

      A search returning zero results only means that no matches were
      found for that specific query. It does not prove that no related
      pull requests exist.

      When the initial pull request search returns zero results, consider
      a second, more specific query using the issue number or distinctive
      terms from the issue title, if the search budget allows.

      Never claim that no related pull requests exist unless the available
      search evidence justifies that conclusion.

      Search strategy:
      - Start with a concise query using the core technical terms.
      - Avoid repeating the same search with only minor wording changes.
      - If results are unrelated, try a different technical term or concept.
      - Evaluate relevance using the issue title and body, not just the issue number.
      - Treat unrelated search results as non-evidence.
      - Stop searching when the remaining search attempts are unlikely
        to provide new information.
      - When code search returns a potentially relevant file,
        use get_github_file to retrieve and inspect its actual contents.
      - Use the exact repository-relative path returned by code search.
      - Do not retrieve files when search results are unrelated to the reported bug.
      - Base code-level conclusions only on the retrieved file contents.
    `,
    input: bugReport,
    tools: [
      searchTool,
      searchIssuesTool,
      searchPullRequestsTool,
      getGitHubFileTool,
    ],
    tool_choice: "auto",
    parallel_tool_calls: false,
  });

  logInfo("OpenAI investigation call completed", {
    durationMs: Date.now() - openaiStartedAt,
  });

  while (true) {
    const functionCalls = response.output.filter(
      (item) => item.type === "function_call",
    );

    if (functionCalls.length === 0) {
      return {
        summary: response.output_text,
        searchEvidence,
      };
    }

    const toolOutputs: OpenAI.Responses.ResponseInputItem.FunctionCallOutput[] =
      [];
    
    for (const call of functionCalls) {
      if (
        call.name !== "search_github_code" &&
        call.name !== "search_github_issues" &&
        call.name !== "search_github_pull_requests" &&
        call.name !== "get_github_file"
      ) {
        toolOutputs.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify({
            success: false,
            error: `Unsupported search tool: ${call.name}`,
          }),
        });

        continue;
      }

      let result: unknown;

      const isSearchTool =
        call.name === "search_github_code" ||
        call.name === "search_github_issues" ||
        call.name === "search_github_pull_requests";

      if (isSearchTool && searchCalls >= MAX_SEARCH_CALLS) {
        result = {
          success: false,
          error: "Maximum GitHub search limit reached.",
        };
      } else {
        if (isSearchTool) {
          searchCalls += 1;
        }      

        try {
          result = await executeTool(call.name, call.arguments);
        } catch (error) {
          logError("GitHub tool execution failed", error, {
            toolName: call.name,
          });

          result = {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Unexpected tool error.",
          };
        }
      }

      const validation =
        call.name === "search_github_code"
          ? GitHubCodeToolResultSchema.safeParse(result)
          : call.name === "search_github_issues"
            ? GitHubIssuesToolResultSchema.safeParse(result)
            : call.name == "search_github_pull_requests"
              ? GitHubPullRequestsToolResultSchema.safeParse(result)
              : call.name === "get_github_file"
                ? GitHubFileToolResultSchema.safeParse(result)
                : null;

      if (validation === null) {
        throw new Error(`Unsupported tool: ${call.name}`);
      }

      if (!validation.success) {
        console.error(`Invalid result returned by ${call.name}`);

        toolOutputs.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify({
            success: false,
            error: "Tool returned an invalid result format.",
          }),
        });

        continue;
      }

      searchEvidence.push({
        tool: call.name,
        arguments: call.arguments,
        result: validation.data,
      });

      toolOutputs.push({
        type: "function_call_output",
        call_id: call.call_id,
        output: JSON.stringify(validation.data),
      });
    }

    const followUpStartedAt = Date.now();

    response = await openai.responses.create({
      model,
      instructions: `
        You are a software investigation assistant.
        Use search results to summarize the investigation.
        If the search limit has been reached, stop searching and summarize the available results.
        If GitHub search returns zero results, explicitly state
        that no matching code was found.
        Do not present unverified hypotheses as findings.
        Clearly separate evidence, hypotheses, and next steps.
        Do not claim that mock search results are verified repository findings.

        Use both GitHub code search and GitHub issue search when relevant.
        Search issues for related bug reports and prior discussions.
        Do not treat issue titles alone as proof of a root cause.
        Clearly distinguish repository evidence, issue evidence,
        user-reported facts, and hypotheses.

        Use GitHub pull request search results when evaluating prior fixes.
        Distinguish open, closed, and merged pull requests.
        Do not claim that a pull request fixed the reported bug unless
        the available evidence supports that conclusion.
        Mention relevant pull requests with their numbers and URLs.

        When reporting search results, describe exactly what was searched
        and what the search returned.

        Distinguish "no results found for this query" from
        "no related pull requests exist."

        Do not describe tests or files as missing merely because a file
        retrieval attempt returned 404. Verify the repository path before
        drawing conclusions about file availability.

        When summarizing:
        - Mention only issues that are relevant to the reported problem.
        - If all issue results are unrelated, explicitly say so.
        - Never infer that an issue is relevant merely because it was returned.
        - Do not claim a root cause without supporting evidence.
      `,
      previous_response_id: response.id,
      input: toolOutputs,
      tools: [
        searchTool,
        searchIssuesTool,
        searchPullRequestsTool,
        getGitHubFileTool,
      ],
      tool_choice: "auto",
      parallel_tool_calls: false,
    });

    logInfo("OpenAI follow-up call completed", {
      durationMs: Date.now() - followUpStartedAt,
    });
  }
}