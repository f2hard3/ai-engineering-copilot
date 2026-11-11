import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { runBugWorkflow } from "./services/bug-workflow.js";
import { createJiraTicket } from "./integrations/jira/client.js";
import { sendSlackMessage } from "./integrations/slack/client.js";

async function confirmAction(message: string): Promise<boolean> {
  const rl = createInterface({ input, output });

  try {
    const answer = await rl.question(`${message} (y/N): `);

    return answer.trim().toLowerCase() === "y";
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const bugReport = process.argv.slice(2).join(" ").trim();

  if (!bugReport) {
    console.error("Usage: npx tsx src/cli.ts <bug report>");
    process.exitCode = 1;
    return;
  }

  console.log("Step 1: Investigating the bug...");

  const workflow = await runBugWorkflow(bugReport);

  console.log(workflow.investigation.summary);

  const approved = await confirmAction("Create this Jira ticket?");

  if (!approved) {
    console.log("\nJira ticket creation cancelled.");
    return;
  }

  const result = await createJiraTicket(workflow.ticket);

  console.log("\nFinal result:");
  console.log(JSON.stringify(result, null, 2));

  await sendSlackMessage(
    [
      "Jira ticket created successfully",
      `Ticket: <${result.url}|${result.ticketId}>`,
      `Priority: ${workflow.ticket.priority}`,
      `Summary: ${workflow.ticket.title}`,
    ].join("\n"),
  );
}

main().catch((error) => {
  console.error("\nApplication error:");
  console.error(error);
  process.exitCode = 1;
});