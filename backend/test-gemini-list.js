import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function run() {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY || ""}`);
    const json = await response.json();
    console.log(json.models.map(m => m.name).join("\n"));
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
