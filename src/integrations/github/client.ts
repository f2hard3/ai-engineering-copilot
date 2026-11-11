import { z } from "zod";
import { logInfo, logError } from "../../lib/logger.js";

const GitHubSearchSchema = z.object({
  query: z.string().min(1),
});

const GitHubFileSchema = z.object({
  path: z.string().min(1),
});

export const GitHubFileToolResultSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    repository: z.string(),
    path: z.string(),
    url: z.url(),
    content: z.string(),
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
  }),
]);

export type GitHubFileToolResult = z.infer<
  typeof GitHubFileToolResultSchema
>;

const GitHubCodeResultSchema = z.object({
  file: z.string(),
  url: z.url(),
  repository: z.string(),
  snippets: z.array(z.string()),
});

export const GitHubCodeToolResultSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    repository: z.string(),
    query: z.string(),
    totalCount: z.number(),
    incompleteResults: z.boolean(),
    results: z.array(GitHubCodeResultSchema),
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
  }),
]);

export type GitHubCodeToolResult = z.infer<
  typeof GitHubCodeToolResultSchema
>;

const GitHubIssueSchema = z.object({
  number: z.number(),
  title: z.string(),
  url: z.url(),
  state: z.string(),
  body: z.string(),
});

export const GitHubIssuesToolResultSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    repository: z.string(),
    query: z.string(),
    totalCount: z.number(),
    incompleteResults: z.boolean(),
    issues: z.array(GitHubIssueSchema),
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
  }),
]);

export type GitHubIssuesToolResult = z.infer<
  typeof GitHubIssuesToolResultSchema
>;

const GitHubPullRequestSchema = z.object({
  number: z.number(),
  title: z.string(),
  url: z.url(),
  state: z.string(),
  body: z.string(),
  draft: z.boolean(),
  mergedAt: z.string().nullable(),
});

export const GitHubPullRequestsToolResultSchema = z.discriminatedUnion(
  "success",
  [
    z.object({
      success: z.literal(true),
      repository: z.string(),
      query: z.string(),
      totalCount: z.number(),
      incompleteResults: z.boolean(),
      pullRequests: z.array(GitHubPullRequestSchema),
    }),
    z.object({
      success: z.literal(false),
      error: z.string(),
    }),
  ],
);

export type GitHubPullRequestsToolResult = z.infer<
  typeof GitHubPullRequestsToolResultSchema
>;

export async function searchGitHubCode(
  rawArguments: string,
): Promise<unknown> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawArguments);
  } catch {
    return {
      success: false,
      error: "Invalid JSON arguments.",
    };
  }

  const validation = GitHubSearchSchema.safeParse(parsed);

  if (!validation.success) {
    return {
      success: false,
      error: "Invalid GitHub search arguments.",
    };
  }

  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPO || "fastify/fastify";

  if (!token) {
    return {
      success: false,
      error: "Missing GITHUB_TOKEN environment variable.",
    };
  }

  const query = validation.data.query;
  const searchQuery = `${query} repo:${repository}`;

  logInfo("GitHub code search started", {
    repository,
  });

  const url = new URL("https://api.github.com/search/code");
  url.searchParams.set("q", searchQuery);
  url.searchParams.set("per_page", "5");

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github.text-match+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      logError(
        "GitHub code search returned HTTP error",
        `GitHub API returned HTTP ${response.status}`,
        {
          repository,
          statusCode: response.status,
        },
      );

      return {
        success: false,
        error: `GitHub API request failed with status ${response.status}.`,
      };
    }

    const data: unknown = await response.json();

    const SearchResponseSchema = z.object({
      total_count: z.number(),
      incomplete_results: z.boolean(),
      items: z.array(
        z.object({
          name: z.string(),
          path: z.string(),
          html_url: z.url(),
          repository: z.object({
            full_name: z.string(),
            html_url: z.url(),
          }),
          text_matches: z
            .array(
              z.object({
                fragment: z.string(),
              }),
            )
            .optional(),
        }),
      ),
    });

    const result = SearchResponseSchema.safeParse(data);

    if (!result.success) {
      return {
        success: false,
        error: "Unexpected GitHub API response format.",
      };
    }

    logInfo("GitHub code search returned results", {
      repository,
      totalCount: result.data.total_count,
      returnedCount: result.data.items.length,
    });

    return {
      success: true,
      repository,
      query,
      totalCount: result.data.total_count,
      incompleteResults: result.data.incomplete_results,
      results: result.data.items.map((item) => ({
        file: item.path,
        url: item.html_url,
        repository: item.repository.full_name,
        snippets:
          item.text_matches?.map(
            (match) => match.fragment,
          ) ?? [],
      })),
    };
  } catch (error) {
    logError("GitHub code search failed", error, {
      repository,
    });

    return {
      success: false,
      error: "Network error while contacting GitHub API.",
    };
  }
}

export async function getGitHubFile(
  rawArguments: string,
): Promise<unknown> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawArguments);
  } catch {
    return {
      success: false,
      error: "Invalid JSON arguments.",
    };
  }

  const validation = GitHubFileSchema.safeParse(parsed);

  if (!validation.success) {
    return {
      success: false,
      error: "Invalid GitHub file arguments.",
    };
  }

  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPO || "fastify/fastify";
  const path = validation.data.path.trim();

  if (!token) {
    return {
      success: false,
      error: "Missing GITHUB_TOKEN environment variable.",
    };
  }

  if (
    path.length === 0 ||
    path.startsWith("/") ||
    path.includes("\\") ||
    path.split("/").some(
      (segment) =>
        segment === "." ||
        segment === ".." ||
        segment.length === 0,
    )
  ) {
    return {
      success: false,
      error: "Invalid repository-relative file path.",
    };
  }

  const url = new URL(
    `https://api.github.com/repos/${repository}/contents/${path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`,
  );

  logInfo("GitHub file retrieval started", {
    repository,
    path,
  });

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
        success: false,
        error: `GitHub file request failed with status ${response.status}.`,
      };
    }

    const data: unknown = await response.json();

    if (
      typeof data !== "object" ||
      data === null ||
      !("type" in data) ||
      data.type !== "file" ||
      !("encoding" in data) ||
      data.encoding !== "base64" ||
      !("content" in data) ||
      typeof data.content !== "string" ||
      !("path" in data) ||
      typeof data.path !== "string" ||
      !("html_url" in data) ||
      typeof data.html_url !== "string"
    ) {
      return {
        success: false,
        error: "Unexpected GitHub file response format.",
      };
    }

    const content = Buffer.from(
      data.content,
      "base64",
    ).toString("utf8");

    const MAX_FILE_CHARS = 12_000;

    return {
      success: true,
      repository,
      path: data.path,
      url: data.html_url,
      content: content.slice(0, MAX_FILE_CHARS),
    };
  } catch (error) {
    logError("GitHub file retrieval failed", error, {
      repository,
      path,
    });

    return {
      success: false,
      error: "Failed to retrieve file from GitHub.",
    };
  }
}

export async function searchGitHubIssues(
  rawArguments: string,
): Promise<unknown> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawArguments);
  } catch {
    return {
      success: false,
      error: "Invalid JSON arguments.",
    };
  }

  const validation = GitHubSearchSchema.safeParse(parsed);

  if (!validation.success) {
    return {
      success: false,
      error: "Invalid GitHub issue search arguments.",
    };
  }

  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPO || "fastify/fastify";

  if (!token) {
    return {
      success: false,
      error: "Missing GITHUB_TOKEN environment variable.",
    };
  }

  const query = validation.data.query;
  const searchQuery = `${query} repo:${repository} is:issue`;

  logInfo("GitHub issue search started", {
    repository,
  });

  const url = new URL("https://api.github.com/search/issues");
  url.searchParams.set("q", searchQuery);
  url.searchParams.set("per_page", "5");

  try {
    const startedAt = Date.now();

    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    logInfo("GitHub issue search completed", {
      repository,
      statusCode: response.status,
      durationMs: Date.now() - startedAt,
    });

    if (!response.ok) {
      logError(
        "GitHub Issues API request failed",
        `GitHub API returned HTTP ${response.status}`,
        {
          repository,
          statusCode: response.status,
        },
      );

      return {
        success: false,
        error: `GitHub Issues API request failed with status ${response.status}.`,
      };
    }

    const data: unknown = await response.json();

    const IssuesResponseSchema = z.object({
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

    const result = IssuesResponseSchema.safeParse(data);

    if (!result.success) {
      return {
        success: false,
        error: "Unexpected GitHub Issues API response format.",
      };
    }

    logInfo("GitHub issue search returned results", {
      repository,
      totalCount: result.data.total_count,
    });

    return {
      success: true,
      repository,
      query,
      totalCount: result.data.total_count,
      incompleteResults: result.data.incomplete_results,
      issues: result.data.items.map((issue) => ({
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
        state: issue.state,
        body: issue.body?.slice(0, 3000) ?? "",
      })),
    };
  } catch (error) {
    logError("GitHub issue search failed", error, {
      repository,
    });

    return {
      success: false,
      error: "Network error while contacting GitHub Issues API.",
    };
  }
}

export async function searchGitHubPullRequests(
  rawArguments: string,
): Promise<GitHubPullRequestsToolResult> {
  const parsedArguments = GitHubSearchSchema.safeParse(
    JSON.parse(rawArguments),
  );

  if (!parsedArguments.success) {
    return {
      success: false,
      error: "Invalid search arguments",
    };
  }

  const { query } = parsedArguments.data;
  const repository = process.env.GITHUB_REPO;

  if (!repository) {
    return {
      success: false,
      error: "GITHUB_REPO is not configured",
    };
  }

  const searchQuery = `repo:${repository} is:pr ${query}`;
  const url = new URL("https://api.github.com/search/issues");
  url.searchParams.set("q", searchQuery);
  url.searchParams.set("per_page", "5");

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `GitHub API error: ${response.status} ${response.statusText}`,
      };
    }

    const data: unknown = await response.json();

    const responseSchema = z.object({
      total_count: z.number(),
      incomplete_results: z.boolean(),
      items: z.array(
        z.object({
          number: z.number(),
          title: z.string(),
          html_url: z.url(),
          state: z.string(),
          body: z.string().nullable(),
          pull_request: z.object({
            draft: z.boolean(),
            merged_at: z.string().nullable(),
          }),
        }),
      ),
    });

    const parsedResponse = responseSchema.safeParse(data);

    if (!parsedResponse.success) {
      return {
        success: false,
        error: "Unexpected GitHub pull request search response",
      };
    }

    const result: GitHubPullRequestsToolResult = {
      success: true,
      repository,
      query,
      totalCount: parsedResponse.data.total_count,
      incompleteResults: parsedResponse.data.incomplete_results,
      pullRequests: parsedResponse.data.items.map((item) => ({
        number: item.number,
        title: item.title,
        url: item.html_url,
        state: item.state,
        body: item.body ?? "",
        draft: item.pull_request.draft,
        mergedAt: item.pull_request.merged_at,
      })),
    };

    logInfo("GitHub pull request search returned results", {
      repository,
      totalCount: result.totalCount,
      returnedCount: result.pullRequests.length,
    });

    return result;
  } catch (error) {
    logError("GitHub pull request search failed", error, {
      repository,
    });

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error while searching GitHub pull requests",
    };
  }
}