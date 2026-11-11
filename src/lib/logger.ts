export function logInfo(
  message: string,
  context: Record<string, unknown> = {},
): void {
  console.log(
    JSON.stringify({
      level: "info",
      timestamp: new Date().toISOString(),
      message,
      ...context,
    }),
  );
}

export function logError(
  message: string,
  error: unknown,
  context: Record<string, unknown> = {},
): void {
  console.error(
    JSON.stringify({
      level: "error",
      timestamp: new Date().toISOString(),
      message,
      error:
        error instanceof Error
          ? {
              name: error.name,
              stack: error.stack,
            }
          : {
              name: "UnknownError",
            },
      ...context,
    }),
  );
}