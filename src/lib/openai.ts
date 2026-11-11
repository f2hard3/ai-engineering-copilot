import "dotenv/config";
import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const model =
  process.env.OPENAI_MODEL || "gpt-4.1-mini";