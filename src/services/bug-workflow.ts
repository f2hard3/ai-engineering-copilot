import { investigateBug } from "./bug-investigation.js";
import {
  proposeJiraTicket,
  validateJiraTicket,
} from "./jira-ticket.js";
import { logInfo } from "../lib/logger.js";

export async function runBugWorkflow(bugReport: string) {
  const investigationStartedAt = Date.now();

  const investigation = await investigateBug(bugReport);

  logInfo("Bug investigation service completed", {
    durationMs: Date.now() - investigationStartedAt,
  });

  const ticketProposalStartedAt = Date.now();

  const ticket = await proposeJiraTicket(
    bugReport,
    JSON.stringify(investigation, null, 2),
  );

  logInfo("Jira ticket proposal completed", {
    durationMs: Date.now() - ticketProposalStartedAt,
  });

  const ticketValidationStartedAt = Date.now();

  const validation = await validateJiraTicket(
    ticket,
    bugReport,
    investigation,
  );

  logInfo("Jira ticket validation completed", {
    durationMs: Date.now() - ticketValidationStartedAt,
  });

  return {
    bugReport,
    investigation,
    ticket,
    validation,
  };
}