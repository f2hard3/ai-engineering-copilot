import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";

import { runBugWorkflow } from "../services/bug-workflow.js";
import { logError, logInfo } from "../lib/logger.js";

class InvalidJsonError extends Error {
  constructor() {
    super("Invalid JSON request body");
    this.name = "InvalidJsonError";
  }
}

async function readJsonBody(
  req: IncomingMessage,
): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }

  const body = Buffer.concat(chunks).toString("utf8");

  if (!body) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new InvalidJsonError();
  }
}

export async function handleBugRoute(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const requestId = randomUUID();
  const startedAt = Date.now();

  if (req.method !== "POST") {
    logInfo("Method not allowed", {
      requestId,
      method: req.method,
      path: req.url,
      statusCode: 405,
    });

    res.writeHead(405, {
      "Content-Type": "application/json",
    });

    res.end(
      JSON.stringify({
        error: "Method not allowed",
      }),
    );

    return;
  }

  try {
    const body = await readJsonBody(req);
  
    if (
      typeof body !== "object" ||
      body === null ||
      !("bugReport" in body) ||
      typeof body.bugReport !== "string" ||
      body.bugReport.trim().length === 0
    ) {
      logInfo("Invalid bug investigation request", {
        requestId,
        statusCode: 400,
        reason: "bugReport is missing or invalid",
      });

      res.writeHead(400, {
        "Content-Type": "application/json",
      });
  
      res.end(
        JSON.stringify({
          error: "bugReport is required",
        }),
      );
  
      return;
    }
  
    logInfo("Bug investigation started", {
      requestId,
    });
  
    const result = await runBugWorkflow(body.bugReport);
  
    logInfo("Bug investigation completed", {
      requestId,
      statusCode: 200,
      durationMs: Date.now() - startedAt,
    });
  
    res.writeHead(200, {
      "Content-Type": "application/json",
    });
  
    res.end(JSON.stringify(result));
  } catch (error) {
    if (error instanceof InvalidJsonError) {
      logInfo("Invalid JSON request body", {
        requestId,
        statusCode: 400,
        durationMs: Date.now() - startedAt,
      });
  
      res.writeHead(400, {
        "Content-Type": "application/json",
      });
  
      res.end(
        JSON.stringify({
          error: "Invalid JSON request body",
        }),
      );
  
      return;
    }
  
    logError("Bug workflow failed", error, {
      requestId,
      durationMs: Date.now() - startedAt,
    });
  
    res.writeHead(500, {
      "Content-Type": "application/json",
    });
  
    res.end(
      JSON.stringify({
        error: "Bug workflow failed",
      }),
    );
  }
}