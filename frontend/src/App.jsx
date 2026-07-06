import React, { useState, useEffect, useRef } from "react";
import Settings from "./components/Settings";
import ChatWindow from "./components/ChatWindow";
import Login from "./components/Login";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function App() {
  // Inicialização de estados a partir do localStorage
  const [token, setToken] = useState(() => localStorage.getItem("flyai_token") || "");
  const [username, setUsername] = useState(() => localStorage.getItem("flyai_username") || "");
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("flyai_api_key") || "");
  const [theme, setTheme] = useState(() => localStorage.getItem("flyai_theme") || "dark");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasBackendKey, setHasBackendKey] = useState(false);
  const [priceAlerts, setPriceAlerts] = useState([]);
  
  // Referência para garantir que a função sendMessage sempre veja os alertas mais recentes
  const priceAlertsRef = useRef(priceAlerts);
  useEffect(() => {
    priceAlertsRef.current = priceAlerts;
  }, [priceAlerts]);

  // Verifica se o backend possui chave configurada no .env e zera o scroll
  useEffect(() => {
    window.scrollTo(0, 0); // Força a página a voltar pro topo caso tenha bugado
    
    // Check config
    fetch(`${API_URL}/api/config`)
      .then((res) => res.json())
      .then((data) => {
        setHasBackendKey(data.hasApiKey);
      })
      .catch((err) => console.error("Erro ao verificar configuração do backend:", err));

    // Fetch initial alerts
    if (token) {
      fetch(`${API_URL}/api/alerts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then((res) => {
          if (!res.ok) throw new Error("Não autorizado");
          return res.json();
        })
        .then((data) => setPriceAlerts(data))
        .catch((err) => {
          console.error("Erro ao buscar alertas (Sessão pode ter expirado):", err);
          if (err.message === "Não autorizado") {
            setToken("");
            setUsername("");
          }
        });
    }

    // Listen for real-time SSE from Backend Cron
    const eventSource = new EventSource(`${API_URL}/api/stream`);
    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'ALERT') {
          const alertMsg = {
            role: "model",
            text: `🔔 ALERTA DE PREÇO ATINGIDO PELO SISTEMA (BACKEND)! 🎉\nO robô automático encontrou passagens de ${data.origin} para ${data.destination} em ${data.date.split('-').reverse().join('/')} por R$ ${data.price.toLocaleString("pt-BR")}. O seu alvo era R$ ${data.targetPrice.toLocaleString("pt-BR")}.\n\n[✉️ Clique aqui para ver a simulação do E-mail disparado](${data.emailUrl})\n\nVerifique as opções e compre no link abaixo!`,
            flightsData: data.flightsData // Passa os dados para renderizar o Widget!
          };
          setMessages(prev => [...prev, alertMsg]);
          
          // Remove do state já que foi excluído no DB
          setPriceAlerts(prev => prev.filter(a => !(a.origin === data.origin && a.destination === data.destination && a.targetPrice === data.targetPrice)));
        }
      } catch (err) {
        console.error("Erro ao processar SSE:", err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [token]); // Recarrega alertas quando o token muda

  // Sincroniza Auth
  useEffect(() => {
    localStorage.setItem("flyai_token", token);
    localStorage.setItem("flyai_username", username);
  }, [token, username]);
  // Sincroniza API Key com localStorage
  useEffect(() => {
    localStorage.setItem("flyai_api_key", apiKey);
  }, [apiKey]);

  // Carrega histórico de mensagens do usuário logado
  useEffect(() => {
    if (username) {
      const saved = localStorage.getItem(`flyai_messages_${username}`);
      if (saved) {
        setMessages(JSON.parse(saved));
      } else {
        setMessages([]); // Se for a primeira vez, reseta
      }
    } else {
      setMessages([]); // Sem usuário, limpa chat
    }
  }, [username]);

  // Salva histórico de mensagens atrelado ao usuário logado
  useEffect(() => {
    if (username) {
      localStorage.setItem(`flyai_messages_${username}`, JSON.stringify(messages));
    }
  }, [messages, username]);


  // Sincroniza e aplica o tema visual
  useEffect(() => {
    localStorage.setItem("flyai_theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);



  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const handleAddPriceAlert = async (alert) => {
    try {
      const response = await fetch(`${API_URL}/api/alerts`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(alert)
      });
      if (response.ok) {
        const data = await response.json();
        setPriceAlerts(prev => [{ ...alert, id: data.id }, ...prev]);
      }
    } catch (error) {
      console.error("Erro ao adicionar alerta:", error);
    }
  };

  const handleRemovePriceAlert = async (id) => {
    try {
      const response = await fetch(`${API_URL}/api/alerts/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        setPriceAlerts(prev => prev.filter(alert => alert.id !== id));
      }
    } catch (error) {
      console.error("Erro ao remover alerta:", error);
    }
  };

  // Trata cliques nos prompts sugeridos
  const handleSuggestedPromptClick = (promptText) => {
    setInput(promptText);
    sendMessage(promptText);
  };

  // Envia a mensagem ao backend
  const sendMessage = async (messageText) => {
    const textToSend = messageText || input;
    if (!textToSend.trim()) return;

    // Adiciona a mensagem do usuário na tela
    const newUserMessage = { role: "user", text: textToSend };
    setMessages((prev) => [...prev, newUserMessage]);
    setInput("");
    setIsLoading(true);

    let success = false;
    let attempt = 0;

    while (!success) {
      attempt++;
      try {
        // Faz o POST para o nosso servidor Express
        const response = await fetch(`${API_URL}/api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: textToSend,
            apiKey: apiKey, // Envia a chave inserida pelo usuário
            model: "gemini-2.5-flash", // Usando Flash por causa do limite de 2 RPM do Pro na conta gratuita
            history: [...messages, newUserMessage], // Passa o histórico da conversa
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          if (response.status === 429) {
            console.warn(`Limite de uso atingido (Tentativa ${attempt}). Aguardando 10s para tentar novamente...`);
            // Aguarda 10 segundos antes de tentar novamente para contornar limites (429)
            await new Promise(resolve => setTimeout(resolve, 10000));
            continue; // Repete o loop
          } else {
            // Tratamento de erros críticos sem causar loop (400, 401, 500)
            setMessages((prev) => [
              ...prev,
              { role: "model", text: `🚨 Ops! Algo deu errado: ${data?.error || 'Erro interno no servidor'}. Verifique suas configurações e tente novamente.` }
            ]);
            success = true; // Força a saída do loop
            break;
          }
        }

        // Adiciona a resposta da IA apenas se houver conteúdo
        if (data.text || data.flightsData) {
          // Usa a ref para pegar a lista atualizada de alertas mesmo após delay
          let currentAlerts = priceAlertsRef.current;

          const modelMsg = {
            role: "model",
            text: data.text || "Aqui estão as opções encontradas:",
            flightsData: data.flightsData, // Armazena dados estruturados para renderizar o Widget
          };
          
          let alertMsgs = [];
          if (data.flightsData && data.flightsData.searchParams && data.flightsData.options && currentAlerts.length > 0) {
            const { originIATA, destinationIATA, departureDate, endDateForRange } = data.flightsData.searchParams;
            
            currentAlerts.forEach(alert => {
              // Verifica datas finais (trata nulos como falsy/iguais)
              const alertEndDate = alert.end_date || alert.endDate || null;
              const searchEndDate = endDateForRange || null;

              if (
                alert.origin === originIATA &&
                alert.destination === destinationIATA &&
                alert.date === departureDate &&
                alertEndDate === searchEndDate
              ) {
                const cheapFlights = data.flightsData.options.filter(f => f.price <= alert.targetPrice);
                if (cheapFlights.length > 0) {
                  const minPrice = Math.min(...cheapFlights.map(f => f.price));
                  alertMsgs.push({
                    role: "model",
                    text: `🔔 ALERTA DE PREÇO ATINGIDO! 🎉\nEncontramos passagens de ${originIATA} para ${destinationIATA} em ${departureDate.split('-').reverse().join('/')} por R$ ${minPrice.toLocaleString("pt-BR")}. O valor está dentro do seu alvo de R$ ${alert.targetPrice.toLocaleString("pt-BR")}. Aproveite!`,
                  });
                }
              }
            });
          }

          setMessages((prev) => [...prev, modelMsg, ...alertMsgs]);
        }
        success = true; // Sucesso, finaliza o loop!
      } catch (error) {
        console.error(`Erro de conexão (Tentativa ${attempt}):`, error);
        // Aguarda 10 segundos caso a conexão caia ou backend reinicie
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }

    setIsLoading(false);
  };

  const handleLogout = () => {
    setToken("");
    setUsername("");
    setPriceAlerts([]);
    setMessages([]);
  };

  if (!token) {
    return (
      <Login 
        onLoginSuccess={(newToken, newUsername) => {
          setToken(newToken);
          setUsername(newUsername);
        }} 
      />
    );
  }

  return (
    <div className="app-container">
      {/* Elementos de decoração de fundo para o visual premium */}
      <div className="background-decoration"></div>
      <div className="background-decoration-2"></div>

      {/* Sidebar de Configurações */}
      <Settings
        apiKey={apiKey}
        setApiKey={setApiKey}
        theme={theme}
        toggleTheme={toggleTheme}
        hasBackendKey={hasBackendKey}
        priceAlerts={priceAlerts}
        onAddPriceAlert={handleAddPriceAlert}
        onRemovePriceAlert={handleRemovePriceAlert}
        onLogout={handleLogout}
      />

      {/* Janela de Conversa Principal */}
      <ChatWindow
        messages={messages}
        input={input}
        setInput={setInput}
        sendMessage={sendMessage}
        isLoading={isLoading}
        onSuggestedPromptClick={handleSuggestedPromptClick}
      />
    </div>
  );
}
