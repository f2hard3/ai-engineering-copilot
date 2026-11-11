export type JiraTicketInput = {
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "critical";
};

export async function createJiraTicket(
  input: JiraTicketInput,
) {
  const baseUrl = process.env.JIRA_BASE_URL;
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;
  const projectKey = process.env.JIRA_PROJECT_KEY;

  if (!baseUrl || !email || !apiToken || !projectKey) {
    throw new Error("Missing Jira environment variables.");
  }

  const credentials = Buffer.from(
    `${email}:${apiToken}`,
  ).toString("base64");

  const priorityMap: Record<JiraTicketInput["priority"], string> = {
    low: "Low",
    medium: "Medium",
    high: "High",
    critical: "Highest",
  };

  const descriptionParagraphs = input.description
    .split("\n")
    .map((line) => ({
      type: "paragraph",
      content: line
        ? [{ type: "text", text: line }]
        : [],
    }));

  const response = await fetch(`${baseUrl}/rest/api/3/issue`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: {
        project: {
          key: projectKey,
        },
        summary: input.title,
        description: {
          type: "doc",
          version: 1,
          content: descriptionParagraphs,
        },
        issuetype: {
          name: "Task",
        },
        priority: {
          name: priorityMap[input.priority],
        },
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();

    throw new Error(
      `Jira issue creation failed: ${response.status} ${response.statusText}\n${errorBody}`,
    );
  }

  const issue = (await response.json()) as {
    id: string;
    key: string;
    self: string;
  };

  return {
    success: true,
    ticketId: issue.key,
    url: `${baseUrl}/browse/${issue.key}`,
  };
}