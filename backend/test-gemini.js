import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ 
  model: "gemini-2.5-flash",
  tools: [{
    functionDeclarations: [{
      name: "search_flights",
      description: "Pesquisa voos",
      parameters: {
        type: "OBJECT",
        properties: {
          origin: { type: "STRING" },
          destination: { type: "STRING" },
          departure_date: { type: "STRING" }
        },
        required: ["origin", "destination", "departure_date"]
      }
    }]
  }],
  systemInstruction: "A data de hoje é 04/07/2026. Se o usuário pedir passagem informando apenas o dia, deduza o mês e ano. NUNCA faça perguntas de volta."
});

async function run() {
  try {
    const chat = model.startChat({});
    const result = await chat.sendMessage("passagem, dia 10, saida guarulhos destino florianopolis");
    console.log("Text:", result.response.text());
    console.log("Function Calls:", JSON.stringify(result.response.functionCalls, null, 2));
    console.log("Candidates:", JSON.stringify(result.response.candidates, null, 2));
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
