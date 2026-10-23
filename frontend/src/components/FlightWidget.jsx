import React, { useState } from "react";
import { Calendar, ExternalLink, ArrowRight } from "lucide-react";

export default function FlightWidget({ data }) {
  const [sortBy, setSortBy] = useState("price"); // 'price' | 'duration'

  if (!data || !data.options || data.options.length === 0) return null;

  const { searchParams, links, options } = data;

  // Ordenação dos voos com base no filtro selecionado
  const sortedOptions = [...options].sort((a, b) => {
    if (sortBy === "price") {
      return a.price - b.price;
    } else if (sortBy === "duration") {
      return a.durationMinutes - b.durationMinutes;
    }
    return 0;
  });

  // Formata a data para visualização (AAAA-MM-DD -> DD/MM/AAAA)
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  return (
    <div className="flight-widget-container">
      <div className="flight-widget-header">
        <div className="flight-route-info">
          <span className="flight-route-city">{searchParams.origin}</span>
          <span className="flight-route-code">{searchParams.originIATA}</span>
          <ArrowRight size={14} style={{ color: "var(--text-secondary)" }} />
          <span className="flight-route-city">{searchParams.destination}</span>
          <span className="flight-route-code">{searchParams.destinationIATA}</span>
        </div>
        <div className="flight-widget-date" style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <Calendar size={14} />
          <span>{formatDate(searchParams.departureDate)}</span>
          {searchParams.endDateForRange && (
            <>
              <span> até </span>
              <span>{formatDate(searchParams.endDateForRange)}</span>
            </>
          )}
          {searchParams.returnDate && (
            <>
              <span> (Volta: </span>
              <span>{formatDate(searchParams.returnDate)})</span>
            </>
          )}
        </div>
      </div>

      <div className="flight-filters">
        <button
          className={`filter-btn ${sortBy === "price" ? "active" : ""}`}
          onClick={() => setSortBy("price")}
        >
          Mais Barato
        </button>
        <button
          className={`filter-btn ${sortBy === "duration" ? "active" : ""}`}
          onClick={() => setSortBy("duration")}
        >
          Mais Rápido
        </button>
      </div>

      <div className="flight-options-list">
        {sortedOptions.map((flight) => (
          <div 
            className="flight-card" 
            key={flight.id}
            onClick={() => window.open(flight.flightLink || links.googleFlights, '_blank')}
            style={{ cursor: "pointer" }}
            title="Clique para ver no Kayak"
          >
            <div className="airline-badge" style={{ backgroundColor: flight.color }} />
            
            <div className="flight-company">
              <span className="airline-name">{flight.airline}</span>
              <span className="airline-code-pill">{flight.id}</span>
            </div>

            <div className="flight-times-row">
              <div className="flight-time-point">
                <div className="time-val" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span>{flight.departureTime}</span>
                  {flight.departureDate && (
                    <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "normal" }}>
                      {formatDate(flight.departureDate).substring(0, 5)}
                    </span>
                  )}
                </div>
                <div className="city-code">{searchParams.originIATA}</div>
              </div>

              <div className="flight-duration-bar">
                <span className="duration-val">{flight.duration}</span>
                <div className="duration-line">
                  <div className="duration-node start" />
                  {flight.stops > 0 && <div className="duration-node stop" />}
                  <div className="duration-node end" />
                </div>
                <span className={`stops-val ${flight.stops === 0 ? "direct" : "has-stops"}`}>
                  {flight.stops === 0 ? "Voo Direto" : `${flight.stops} escala (${flight.connectionCity})`}
                </span>
              </div>

              <div className="flight-time-point">
                <div className="time-val">
                  {flight.arrivalTime}
                  {flight.nextDay && <span style={{ fontSize: "0.7rem", color: "#ef4444", verticalAlign: "super" }}>+1d</span>}
                </div>
                <div className="city-code">{searchParams.destinationIATA}</div>
              </div>
            </div>

            <div className="flight-price-col">
              <span className="flight-price-currency">Valor Estimado</span>
              <span className="flight-price">{flight.currency} {flight.price.toLocaleString("pt-BR")}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="booking-links-section">
        <span className="booking-links-title">Buscar e Comprar nos Sites de Passagem:</span>
        <div className="booking-grid">
          <a href={links.googleFlights} target="_blank" rel="noopener noreferrer" className="booking-btn">
            <span>Google Flights</span>
            <ExternalLink size={12} />
          </a>
          <a href={links.skyscanner} target="_blank" rel="noopener noreferrer" className="booking-btn">
            <span>Skyscanner</span>
            <ExternalLink size={12} />
          </a>
          <a href={links.kayak} target="_blank" rel="noopener noreferrer" className="booking-btn">
            <span>Kayak</span>
            <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </div>
  );
}
