
import OpenAI from "openai";
import "dotenv/config";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const response = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: [
    "The request handler receives body undefined.",
    "Why does the handler receive an empty payload?",
  ],
});

for (const item of response.data) {
  console.log({
    index: item.index,
    dimensions: item.embedding.length,
    preview: item.embedding.slice(0, 5),
  });
}
