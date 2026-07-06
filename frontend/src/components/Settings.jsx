import React, { useState } from "react";
import { Sun, Moon, Plane, Bell, Plus, Trash2, MapPin, Calendar, DollarSign, LogOut } from "lucide-react";

export default function Settings({ theme, toggleTheme, priceAlerts, onAddPriceAlert, onRemovePriceAlert, onLogout }) {
  const [email, setEmail] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [targetPrice, setTargetPrice] = useState("");

  const handleCreateAlert = (e) => {
    e.preventDefault();
    if (!email || !origin || !destination || !date || !targetPrice) return;
    
    onAddPriceAlert({
      email,
      origin: origin.toUpperCase(),
      destination: destination.toUpperCase(),
      date,
      endDate: endDate || null,
      targetPrice: parseFloat(targetPrice)
    });

    setEmail("");
    setOrigin("");
    setDestination("");
    setDate("");
    setEndDate("");
    setTargetPrice("");
  };

  return (
    <aside className="settings-sidebar">
      <div className="settings-header">
        <Plane size={24} style={{ transform: "rotate(45deg)", color: "var(--accent-color)" }} />
        <h2>FlyAI Config</h2>
      </div>

      <div className="alerts-section">
        <div className="alerts-title">
          <Bell size={16} />
          <h3>Alertas de Preço</h3>
        </div>
        
        <form className="alert-form" onSubmit={handleCreateAlert}>
          <div className="alert-input-group">
            <Bell size={14} className="input-icon" />
            <input type="email" placeholder="Seu E-mail" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="alert-input-group">
            <MapPin size={14} className="input-icon" />
            <input type="text" placeholder="Origem (ex: GRU)" value={origin} onChange={e => setOrigin(e.target.value)} maxLength={3} required />
          </div>
          <div className="alert-input-group">
            <MapPin size={14} className="input-icon" />
            <input type="text" placeholder="Destino (ex: EZE)" value={destination} onChange={e => setDestination(e.target.value)} maxLength={3} required />
          </div>
          <div className="alert-input-group">
            <Calendar size={14} className="input-icon" />
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
          </div>
          <div className="alert-input-group">
            <Calendar size={14} className="input-icon" />
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} placeholder="Data Final (opcional)" />
          </div>
          <div className="alert-input-group">
            <DollarSign size={14} className="input-icon" />
            <input type="number" placeholder="Preço Alvo (R$)" value={targetPrice} onChange={e => setTargetPrice(e.target.value)} required />
          </div>
          <button type="submit" className="btn-create-alert">
            <Plus size={16} />
            <span>Criar Alerta</span>
          </button>
        </form>

        <div className="alerts-list">
          {priceAlerts && priceAlerts.length > 0 ? (
            priceAlerts.map(alert => (
              <div key={alert.id} className="alert-card">
                <div className="alert-card-header">
                  <span className="alert-route">{alert.origin} → {alert.destination}</span>
                  <button type="button" className="btn-delete-alert" onClick={() => onRemovePriceAlert(alert.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="alert-card-details">
                  <span className="alert-date"><Calendar size={12}/> {alert.date} {alert.end_date && `até ${alert.end_date}`}</span>
                  <span className="alert-price">Alvo: R$ {alert.targetPrice ? alert.targetPrice.toFixed(2) : alert.target_price.toFixed(2)}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-alerts">
              <p>Nenhum alerta ativo.</p>
            </div>
          )}
        </div>
      </div>      <div className="settings-group" style={{ marginTop: "auto" }}>
        <button className="btn-theme" onClick={toggleTheme} style={{ marginBottom: "0.5rem" }}>
          {theme === "dark" ? (
            <>
              <Sun size={18} />
              <span>Modo Claro</span>
            </>
          ) : (
            <>
              <Moon size={18} />
              <span>Modo Escuro</span>
            </>
          )}
        </button>
        {onLogout && (
          <button className="btn-theme" style={{ borderColor: 'var(--text-muted)', color: 'var(--text-muted)' }} onClick={onLogout}>
            <LogOut size={18} />
            <span>Sair da Conta</span>
          </button>
        )}
      </div>
    </aside>
  );
}
