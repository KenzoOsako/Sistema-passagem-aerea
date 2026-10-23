import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { searchFlights } from "./flightSearch.js";
import { dbAll, dbRun } from "./db.js";
import { startCron } from "./cron.js";
import { addClient } from "./sse.js";
import { authenticateToken, generateToken } from "./auth.js";
import { pathToFileURL } from "node:url";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Habilita CORS para desenvolvimento
app.use(cors());
app.use(express.json());

// Rota de Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date() });
});

// Rota para verificar se existe chave configurada no .env do servidor
app.get("/api/config", (req, res) => {
  res.json({
    hasApiKey: !!process.env.GEMINI_API_KEY
  });
});

// Rota do Chatbot com Integração Gemini
app.post("/api/chat", async (req, res) => {
  const { message, apiKey, model: clientModel, history } = req.body;

  if (!message) {
    return res.status(400).json({ error: "A mensagem do usuário é obrigatória." });
  }

  // Define a chave de API (usa a enviada pelo cliente ou uma padrão do backend .env)
  const geminiKey = apiKey || process.env.GEMINI_API_KEY;

  if (!geminiKey) {
    return res.status(401).json({
      error: "Chave de API do Gemini não fornecida. Insira-a nas configurações da aplicação."
    });
  }

  try {
    const genAI = new GoogleGenerativeAI(geminiKey);
    const modelName = clientModel || "gemini-2.5-flash";

    // Definição da ferramenta (Tool) para busca de voos
    const searchFlightsTool = {
      functionDeclarations: [
        {
          name: "search_flights",
          description: "Pesquisa opções de voos e passagens aéreas de uma cidade/aeroporto de origem para um destino em datas específicas.",
          parameters: {
            type: "OBJECT",
            properties: {
              origin: {
                type: "STRING",
                description: "OBRIGATÓRIO: O código IATA exato de 3 letras do AEROPORTO ESPECÍFICO principal da cidade de origem (ex: GRU para São Paulo, JFK para Nova York, EZE para Buenos Aires, LHR para Londres). NÃO use códigos genéricos de área metropolitana como SAO, NYC, BUE, LON, PAR."
              },
              destination: {
                type: "STRING",
                description: "OBRIGATÓRIO: O código IATA exato de 3 letras do AEROPORTO ESPECÍFICO principal da cidade de destino (ex: GRU, JFK, EZE, LHR). NÃO use códigos genéricos de área metropolitana."
              },
              departure_date: {
                type: "STRING",
                description: "Data de partida no formato AAAA-MM-DD (ex: 2026-10-15)"
              },
              end_date_for_range: {
                type: "STRING",
                description: "OPCIONAL: Data final no formato AAAA-MM-DD para busca em intervalo flexível de dias. Use se o usuário pedir 'entre o dia X e Y' ou 'de dia X até dia Y'."
              },
              return_date: {
                type: "STRING",
                description: "Data de retorno no formato AAAA-MM-DD (opcional)"
              }
            },
            required: ["origin", "destination", "departure_date"]
          }
        }
      ]
    };

    // Inicializa o modelo com as ferramentas
    const model = genAI.getGenerativeModel({
      model: modelName,
      tools: [searchFlightsTool],
      systemInstruction: `Você é um assistente especialista em passagens aéreas e viagens.
Sua missão é ajudar o usuário a planejar sua viagem e encontrar voos adequados.
INFORMAÇÃO IMPORTANTE DE CONTEXTO: A data de hoje é ${new Date().toLocaleDateString('pt-BR')}.
REGRA CRÍTICA PARA AEROPORTOS: Ao chamar a ferramenta 'search_flights', você DEVE traduzir o nome da cidade para o código IATA exato de 3 letras do seu aeroporto principal (ex: Guarulhos/São Paulo = GRU, Nova York = JFK, Buenos Aires = EZE, Londres = LHR). NUNCA envie o nome da cidade por extenso e NUNCA envie códigos de área metropolitana (SAO, NYC, BUE, LON).
Se o usuário pedir uma passagem informando apenas o dia (ex: "dia 10", "amanhã", "próximo sábado"), VOCÊ DEVE deduzir automaticamente o mês e o ano com base na data de hoje. NÃO pergunte o mês ou o ano para o usuário, apenas preencha a data futura mais próxima na ferramenta.
Quando o usuário informar a partida, destino e data (explícita ou deduzida), você DEVE acionar a ferramenta 'search_flights' para buscar passagens. Se o usuário pedir um intervalo flexível (ex: "entre dia 10 e 15"), use 'departure_date' para o início e 'end_date_for_range' para o fim. Se pedir ida e volta (ex: "ida dia 10 e volta dia 15"), use 'departure_date' e 'return_date'.
Após receber os resultados da busca, forneça um resumo amigável em português, destacando preços, escalas e companhias.
Informe ao usuário que ele pode comprar as passagens acessando os botões fornecidos.`
    });

    // Formata o histórico do chat para o formato do SDK do Gemini
    // Remove qualquer estrutura de mensagem complexa (como dados de voo) mantendo apenas texto limpo
    const formattedHistory = (history || [])
      .filter(msg => (msg.role === "user" || msg.role === "model") && msg.text && msg.text.trim() !== "")
      .map(msg => ({
        role: msg.role === "model" ? "model" : "user",
        parts: [{ text: msg.text }]
      }));

    // Inicia o chat com o histórico
    const chat = model.startChat({
      history: formattedHistory
    });

    // Envia a mensagem do usuário
    let result = await chat.sendMessage(message);
    const response = result.response;
    
    // O SDK atual falha em extrair o functionCalls automaticamente no modelo 2.5
    // por causa das assinaturas de pensamento (thoughtSignature). Extraímos manualmente:
    const parts = response.candidates?.[0]?.content?.parts || [];
    const functionCalls = parts.map(p => p.functionCall).filter(Boolean);

    console.log("=== RESPOSTA DO GEMINI ===");
    console.log("Text:", response.text());
    console.log("Function Calls:", JSON.stringify(functionCalls, null, 2));
    console.log("Candidates:", JSON.stringify(response.candidates, null, 2));
    console.log("==========================");

    // Se o modelo solicitou chamada de função
    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];

      if (call.name === "search_flights") {
        const { origin, destination, departure_date, return_date, end_date_for_range } = call.args;

        console.log(`[Tool Call Executed] search_flights de ${origin} para ${destination} em ${departure_date} ${end_date_for_range ? 'até '+end_date_for_range : ''}`);

        // Executa a busca REAL na SerpApi e gera links diretos
        let searchResult;
        try {
          searchResult = await searchFlights(origin, destination, departure_date, return_date, end_date_for_range);
        } catch (err) {
          console.error("Erro na busca de passagens:", err);
          return res.json({
            text: "Desculpe, ocorreu um erro ao buscar passagens reais nas companhias aéreas neste momento. Por favor, verifique se a chave da API (SERPAPI_KEY) está configurada e tente novamente.",
            flightsData: null
          });
        }

        // Envia o resultado da função de volta ao Gemini para que ele elabore a resposta final
        const functionResponsePart = {
          functionResponse: {
            name: "search_flights",
            response: { result: searchResult }
          }
        };

        const secondResult = await chat.sendMessage([functionResponsePart]);
        const finalResponseText = secondResult.response.text();

        console.log("Final Response Text:", finalResponseText);

        return res.json({
          text: finalResponseText,
          flightsData: searchResult
        });
      } else {
        console.warn("Modelo tentou chamar uma função desconhecida:", call.name);
      }
    }

    // Caso contrário, apenas retorna a resposta de texto direta
    res.json({
      text: response.text(),
      flightsData: null
    });

  } catch (error) {
    console.error("Erro ao processar chamada no backend:", error);
    res.status(500).json({
      error: "Ocorreu um erro ao processar sua solicitação no servidor de IA.",
      details: error.message
    });
  }
});

// --- Rotas de Autenticação ---
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Preencha usuário e senha" });

  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    const result = await dbRun("INSERT INTO users (username, password_hash) VALUES (?, ?)", [username, hash]);
    
    const token = generateToken({ id: result.id, username });
    res.json({ message: "Usuário criado com sucesso", token });
  } catch (err) {
    if (err.message && err.message.includes("UNIQUE constraint failed")) {
      return res.status(400).json({ error: "Este usuário já existe" });
    }
    res.status(500).json({ error: "Erro interno no servidor" });
  }
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Preencha usuário e senha" });

  try {
    const users = await dbAll("SELECT * FROM users WHERE username = ?", [username]);
    if (users.length === 0) return res.status(401).json({ error: "Usuário ou senha inválidos" });

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ error: "Usuário ou senha inválidos" });

    const token = generateToken(user);
    res.json({ message: "Login realizado com sucesso", token, username: user.username });
  } catch (err) {
    res.status(500).json({ error: "Erro interno no servidor" });
  }
});

// --- Rotas de Alertas ---

app.get("/api/stream", authenticateToken, (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  
  // Adiciona a conexão ao gerenciador do SSE
  addClient(res, req.user);
});

app.get("/api/alerts", authenticateToken, async (req, res) => {
  try {
    const alerts = await dbAll("SELECT * FROM alerts WHERE user_id = ? ORDER BY id DESC", [req.user.id]);
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar alertas" });
  }
});

app.post("/api/alerts", authenticateToken, async (req, res) => {
  const { origin, destination, date, targetPrice, email, endDate } = req.body;
  if (!origin || !destination || !date || !targetPrice || !email) {
    return res.status(400).json({ error: "Preencha todos os campos obrigatórios do alerta" });
  }
  
  try {
    const result = await dbRun(
      "INSERT INTO alerts (email, origin, destination, date, target_price, end_date, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [email, origin, destination, date, targetPrice, endDate || null, req.user.id]
    );
    res.json({ id: result.id, message: "Alerta criado com sucesso" });
  } catch (err) {
    res.status(500).json({ error: "Erro ao criar alerta" });
  }
});

app.delete("/api/alerts/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    // Garante que o usuário só apaga seus próprios alertas
    await dbRun("DELETE FROM alerts WHERE id = ? AND user_id = ?", [id, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erro ao deletar alerta" });
  }
});

export { app };

// Importing routes for isolated checks must not start provider jobs or a listener.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startCron();
  app.listen(PORT, () => {
    console.log(`Servidor rodando com sucesso na porta ${PORT}`);
  });
}
