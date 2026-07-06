import React, { useRef, useEffect } from "react";
import { Send, Plane, HelpCircle } from "lucide-react";
import FlightWidget from "./FlightWidget";

export default function ChatWindow({ messages, input, setInput, sendMessage, isLoading, onSuggestedPromptClick }) {
  const messagesEndRef = useRef(null);

  // Auto scroll para a última mensagem
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      sendMessage(input);
    }
  };

  const suggestions = [
    "Buscar passagem de São Paulo para Buenos Aires dia 15 de Outubro",
    "Passagens de Belo Horizonte para Lisboa em Novembro",
    "Voo ida e volta do Rio de Janeiro para Miami de 10 a 20 de Dezembro",
    "Melhor preço saindo de Brasília para Florianópolis semana que vem"
  ];

  return (
    <div className="chat-container">
      {/* Header do Chat */}
      <header className="chat-header">
        <div className="chat-logo">
          <div className="chat-logo-icon">
            <Plane size={20} style={{ transform: "rotate(45deg)" }} />
          </div>
          <div className="chat-title">
            <h1>FlyAI Chatbot</h1>
            <p>Seu assistente inteligente de passagens aéreas</p>
          </div>
        </div>
      </header>

      {/* Mensagens */}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="empty-chat">
            <div className="empty-chat-icon">
              <Plane size={32} style={{ transform: "rotate(45deg)" }} />
            </div>
            <h3>Olá! Para onde você deseja voar?</h3>
            <p>
              Digite sua origem, destino e data desejada. Eu irei pesquisar e te indicar os melhores caminhos e preços!
            </p>
            <div className="suggested-prompts">
              {suggestions.map((prompt, index) => (
                <button
                  key={index}
                  className="suggested-btn"
                  onClick={() => onSuggestedPromptClick(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className={`message-wrapper ${msg.role}`}>
              <div className="message-bubble">
                {msg.text}
              </div>
              
              {/* Se a mensagem do robô tiver informações de voo associadas, renderiza o Widget */}
              {msg.role === "model" && msg.flightsData && (
                <FlightWidget data={msg.flightsData} />
              )}
            </div>
          ))
        )}

        {/* Indicador de Digitação / Carregamento */}
        {isLoading && (
          <div className="message-wrapper model">
            <div className="skeleton-loader">
              <div className="skeleton-header"></div>
              <div className="skeleton-card"></div>
              <div className="skeleton-card"></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input de Mensagem */}
      <div className="chat-input-area">
        <form onSubmit={handleSubmit} className="chat-input-form">
          <input
            type="text"
            placeholder={isLoading ? "Buscando passagens..." : "Ex: Voo de São Paulo para Nova York dia 10 de Outubro..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
          />
          <button type="submit" className="send-btn" disabled={isLoading || !input.trim()}>
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
