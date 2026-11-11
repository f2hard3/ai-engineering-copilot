import { createServer } from "node:http";

import { handleBugRoute } from "../routes/bug.js";
import { logInfo } from "../lib/logger.js";

const server = createServer(async (req, res) => {
  if (req.url === "/bugs/investigate") {
    await handleBugRoute(req, res);
    return;
  }

  logInfo("Route not found", {
    method: req.method,
    path: req.url,
    statusCode: 404,
  });

  res.writeHead(404, {
    "Content-Type": "application/json",
  });

  res.end(
    JSON.stringify({
      error: "Not found",
    }),
  );
});

const port = Number(process.env.PORT || 3000);

server.listen(port, () => {
  logInfo("Server started", {
    port,
    environment: process.env.NODE_ENV || "development",
  });
});