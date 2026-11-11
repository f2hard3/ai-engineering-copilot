export async function sendSlackMessage(
  message: string,
): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_CHANNEL_ID;

  if (!token || !channel) {
    throw new Error(
      "Missing SLACK_BOT_TOKEN or SLACK_CHANNEL_ID environment variable.",
    );
  }

  const response = await fetch(
    "https://slack.com/api/chat.postMessage",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        channel,
        text: message,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Slack API request failed: HTTP ${response.status}`,
    );
  }

  const result = (await response.json()) as {
    ok: boolean;
    error?: string;
    ts?: string;
  };

  if (!result.ok) {
    throw new Error(
      `Slack message failed: ${result.error ?? "Unknown error"}`,
    );
  }
}