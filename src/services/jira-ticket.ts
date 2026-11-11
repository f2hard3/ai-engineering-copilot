import type OpenAI from "openai";
import { z } from "zod";

import { openai, model } from "../lib/openai.js";

import type { JiraTicketInput } from "../integrations/jira/client.js";
import type { InvestigationResult } from "./bug-investigation.js";

const JiraTicketSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(["low", "medium", "high", "critical"]),
});

const TicketValidationFindingSchema = z.object({
  findingType: z.enum(["claim", "recommendation"]),
  claim: z.string(),
  status: z.enum(["supported", "unsupported", "needs_review"]),
  reason: z.string(),
  evidence: z.string(),
});

const TicketValidationSchema = z.object({
  findings: z.array(TicketValidationFindingSchema),
  summary: z.string(),
});

export type TicketValidationResult = z.infer<
  typeof TicketValidationSchema
>;

const proposeTicketTool: OpenAI.Responses.Tool = {
  type: "function",
  name: "propose_jira_ticket",
  description:
    "Create a proposed Jira ticket draft based on the bug report and investigation findings. This does not create a real ticket.",
  parameters: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "The Jira ticket title.",
      },
      description: {
        type: "string",
        description: "A detailed description of the bug.",
      },
      priority: {
        type: "string",
        enum: ["low", "medium", "high", "critical"],
        description: "The ticket priority.",
      },
    },
    required: ["title", "description", "priority"],
    additionalProperties: false,
  },
  strict: true,
};

const validateTicketTool: OpenAI.Responses.Tool = {
  type: "function",
  name: "validate_jira_ticket",
  description:
    "Validate claims in a proposed Jira ticket against the original bug report and actual investigation evidence.",
  parameters: {
    type: "object",
    properties: {
      findings: {
        type: "array",
        items: {
          type: "object",
          properties: {
            findingType: {
              type: "string",
              enum: ["claim", "recommendation"],
            },
            claim: { type: "string" },
            status: {
              type: "string",
              enum: ["supported", "unsupported", "needs_review"],
            },
            reason: { type: "string" },
            evidence: { type: "string" },
          },
          required: ["findingType", "claim", "status", "reason", "evidence"],
          additionalProperties: false,
        },
      },
      summary: { type: "string" },
    },
    required: ["findings", "summary"],
    additionalProperties: false,
  },
  strict: true,
};

export async function proposeJiraTicket(
  bugReport: string,
  investigation: string,
): Promise<JiraTicketInput> {
  const response = await openai.responses.create({
    model,
    instructions: `
      You are a software engineering assistant.
      Create a Jira ticket proposal based on the bug report and investigation summary.
      Do not invent confirmed root causes.
      Clearly distinguish observed symptoms from hypotheses.
      Return the proposed ticket using the propose_jira_ticket function.

      Evidence and uncertainty rules:

      * Include only facts explicitly reported by the user or supported by investigation evidence.
      * Do not imply that a deployment, dependency update, or configuration change occurred unless verified.
      * Clearly label unverified explanations as hypotheses.
      * Keep the investigation summary separate from proposed next steps.
      * Do not describe unrelated GitHub issues as evidence for the reported bug.
      * The ticket must remain useful even when no root cause has been identified.
    `,
    input: `
      Bug report:
      ${bugReport}

      Investigation summary:
      ${investigation}
    `,
    tools: [proposeTicketTool],
    tool_choice: {
      type: "function",
      name: "propose_jira_ticket",
    },
  });

  const functionCall = response.output.find(
    (item) =>
      item.type === "function_call" &&
      item.name === "propose_jira_ticket",
  );

  if (!functionCall || functionCall.type !== "function_call") {
    throw new Error("The model did not return a Jira ticket proposal.");
  }

  const parsed: unknown = JSON.parse(functionCall.arguments);
  return JiraTicketSchema.parse(parsed);
}

export async function validateJiraTicket(
  ticket: JiraTicketInput,
  bugReport: string,
  investigation: InvestigationResult,
): Promise<TicketValidationResult> {
  const response = await openai.responses.create({
    model,
    instructions: `
      You are a careful software engineering reviewer.

      Validate the claims in a proposed Jira ticket using
      the original bug report and the actual investigation evidence.

      Rules:
      - Treat the bug report as user-reported information,
        not independently verified fact.
      - Treat GitHub API results as evidence only for what
        those results actually show.
      - An unrelated GitHub issue does not support a claim
        about the reported bug.
      - Zero search results mean no matching results were found,
        not that the bug does not exist.
      - A failed search, API error, or HTTP 404 does not prove
        that a related pull request, file, or test does not exist.
      - A claim that no related pull requests or tests exist must be
        marked "needs_review" unless the investigation evidence
        provides sufficient coverage to justify that conclusion.
      - A claim that a file or test could not be retrieved may be
        supported by the corresponding failed retrieval result.
        However, a claim that the file or test does not exist is
        not supported by a failed retrieval alone.
      - Evaluate each claim against the actual tool result in
        investigation.searchEvidence, not merely the investigation summary.
      - If the evidence is insufficient to verify a claim, prefer
        "needs_review" over "supported".
      - Mark a claim "supported" only when its source supports it.
      - Mark a claim "unsupported" when the provided evidence
        does not support the claim.
      - Mark a claim "needs_review" when further investigation
        or human judgment is needed.
      - Treat root causes, deployments, and technical explanations
        as unverified unless evidence directly supports them.
      - Review the title, priority, and description.
      - Classify each finding as either "claim" or "recommendation".
      - Use "claim" for statements about observed behavior,
        investigation results, causes, and technical facts.
      - Use "recommendation" for proposed debugging steps,
        follow-up actions, and suggested investigations.
      - A recommendation is not a verified fact merely because
        it is a reasonable next step.
      - For recommendations, explain why the action is useful
        and cite the evidence or uncertainty motivating it.
      - Do not describe a recommendation as proof that a root cause
        exists or that a particular fix is necessary.
      - Include the source for each finding in the evidence field.
      - Do not invent evidence.
      - Return the result using validate_jira_ticket.
    `,
    input: JSON.stringify({
      bugReport,
      ticket,
      investigation,
    }),
    tools: [validateTicketTool],
    tool_choice: {
      type: "function",
      name: "validate_jira_ticket",
    },
  });

  const functionCall = response.output.find(
    (item) =>
      item.type === "function_call" &&
      item.name === "validate_jira_ticket",
  );

  if (!functionCall || functionCall.type !== "function_call") {
    throw new Error("The model did not return validation results.");
  }

  const parsed: unknown = JSON.parse(functionCall.arguments);

  return TicketValidationSchema.parse(parsed);
}