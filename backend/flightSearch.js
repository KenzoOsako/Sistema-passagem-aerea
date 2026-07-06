import { dbAll, dbRun } from './db.js';

// Mapeamento de cidades comuns para códigos IATA de aeroportos (SerpApi prefere aeroportos específicos)
const IATA_MAP = {
  "sao paulo": "GRU",
  "são paulo": "GRU",
  "guarulhos": "GRU",
  "congonhas": "CGH",
  "viracopos": "VCP",
  "rio de janeiro": "GIG",
  "rio": "GIG",
  "galeao": "GIG",
  "galeão": "GIG",
  "santos dumont": "SDU",
  "brasilia": "BSB",
  "brasília": "BSB",
  "belo horizonte": "CNF",
  "confins": "CNF",
  "pampulha": "PLU",
  "salvador": "SSA",
  "recife": "REC",
  "fortaleza": "FOR",
  "porto alegre": "POA",
  "curitiba": "CWB",
  "florianopolis": "FLN",
  "florianópolis": "FLN",
  "manaus": "MAO",
  "belem": "BEL",
  "belém": "BEL",
  "natal": "NAT",
  "goiania": "GYN",
  "goiânia": "GYN",
  "campinas": "VCP",
  "vitoria": "VIX",
  "vitória": "VIX",
  
  // Internacionais comuns
  "buenos aires": "EZE",
  "ezeiza": "EZE",
  "aeroparque": "AEP",
  "santiago": "SCL",
  "montevideo": "MVD",
  "montevidéu": "MVD",
  "lima": "LIM",
  "bogota": "BOG",
  "bogotá": "BOG",
  "miami": "MIA",
  "orlando": "MCO",
  "nova york": "JFK",
  "new york": "JFK",
  "jfk": "JFK",
  "lisboa": "LIS",
  "madri": "MAD",
  "madrid": "MAD",
  "paris": "CDG",
  "londres": "LHR",
  "london": "LHR",
  "roma": "FCO",
  "rome": "FCO",
  "tokyo": "NRT",
  "toquio": "NRT",
  "tóquio": "NRT"
};

// Companhias aéreas comuns e seus logos simbólicos (ou iniciais)
const AIRLINES = [
  { name: "LATAM Airlines", code: "LA", color: "#1b0088" },
  { name: "GOL Linhas Aéreas", code: "G3", color: "#ff5a00" },
  { name: "Azul Linhas Aéreas", code: "AD", color: "#002060" },
  { name: "TAP Air Portugal", code: "TP", color: "#00a850" },
  { name: "Copa Airlines", code: "CM", color: "#0d2c6c" },
  { name: "American Airlines", code: "AA", color: "#179ee0" },
  { name: "United Airlines", code: "UA", color: "#1964b4" },
  { name: "Delta Air Lines", code: "DL", color: "#e31937" }
];

/**
 * Resolve o nome de uma cidade para seu código IATA.
 * Se já for um código IATA válido (3 letras), retorna-o em maiúsculas.
 */
function resolveIATA(cityOrCode) {
  if (!cityOrCode) return "SAO";
  const clean = cityOrCode.trim().toLowerCase();
  
  // Se já for código IATA (3 letras)
  if (clean.length === 3 && /^[a-z]{3}$/.test(clean)) {
    return clean.toUpperCase();
  }
  
  // Busca no mapeamento
  if (IATA_MAP[clean]) {
    return IATA_MAP[clean];
  }
  
  // Tenta busca parcial
  for (const [city, code] of Object.entries(IATA_MAP)) {
    if (clean.includes(city) || city.includes(clean)) {
      return code;
    }
  }
  
  // Fallback seguro (retorna o texto original em maiúsculo ou GRU)
  return clean.toUpperCase().substring(0, 3);
}

/**
 * Cria os links de redirecionamento para os buscadores de passagens aéreas.
 */
function generateDeepLinks(origin, destination, departureDate, returnDate) {
  const origIATA = resolveIATA(origin);
  const destIATA = resolveIATA(destination);
  
  // Formato da data para URLs (YYYY-MM-DD)
  const depDateStr = departureDate; // ex: 2026-10-15
  const retDateStr = returnDate || "";
  
  // Google Flights
  // A query direta ajuda a evitar contaminação por cache do shareable token
  let googleFlightsUrl = `https://www.google.com/travel/flights?q=Flights%20to%20${destIATA}%20from%20${origIATA}%20on%20${depDateStr}`;
  if (retDateStr) {
    googleFlightsUrl += `%20through%20${retDateStr}`;
  }
  
  // Skyscanner
  // Formato: /transporte/passagens-aereas/{origem}/{destino}/{data-partida-yymmdd}/{data-volta-yymmdd}/
  const skyscannerDepDate = depDateStr.replace(/-/g, "").substring(2, 8); // YYMMDD
  const skyscannerRetDate = retDateStr ? retDateStr.replace(/-/g, "").substring(2, 8) : "";
  let skyscannerUrl = `https://www.skyscanner.com.br/transporte/passagens-aereas/${origIATA.toLowerCase()}/${destIATA.toLowerCase()}/${skyscannerDepDate}/`;
  if (retDateStr) {
    skyscannerUrl = `https://www.skyscanner.com.br/transporte/passagens-aereas/${origIATA.toLowerCase()}/${destIATA.toLowerCase()}/${skyscannerDepDate}/${skyscannerRetDate}/`;
  }
  
  // Kayak
  // Formato: /flights/{origem}-{destino}/{data-partida}/{data-volta}
  let kayakUrl = `https://www.kayak.com.br/flights/${origIATA}-${destIATA}/${depDateStr}`;
  if (retDateStr) {
    kayakUrl += `/${retDateStr}`;
  }

  // Decolar
  // Formato: /passagens-aereas/{origem}/{destino}
  const decolarUrl = `https://www.decolar.com/passagens-aereas/${origIATA.toLowerCase()}/${destIATA.toLowerCase()}`;
  
  return {
    googleFlights: googleFlightsUrl,
    skyscanner: skyscannerUrl,
    kayak: kayakUrl,
    decolar: decolarUrl
  };
}

/**
 * Busca voos reais usando a SerpApi (Google Flights).
 */
async function fetchRealFlights(origin, destination, departureDate, returnDate) {
  const origIATA = resolveIATA(origin);
  const destIATA = resolveIATA(destination);
  const apiKey = process.env.SERPAPI_KEY;

  if (!apiKey) {
    throw new Error("SERPAPI_KEY não está configurada no .env");
  }

  // URL da SerpApi (Engine: Google Flights)
  let url = `https://serpapi.com/search.json?engine=google_flights&departure_id=${origIATA}&arrival_id=${destIATA}&outbound_date=${departureDate}&currency=BRL&hl=pt-BR&api_key=${apiKey}`;
  
  if (returnDate) {
    url += `&return_date=${returnDate}&type=1`; // type=1 para ida e volta
  } else {
    url += `&type=2`; // type=2 para apenas ida
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("Cota da SerpApi excedida (Rate Limit 429). Por favor, aguarde ou atualize seu plano.");
      }
      throw new Error(`Erro na API: ${response.status} - ${response.statusText}`);
    }
    const data = await response.json();
    
    // Processa os resultados (melhores voos e outros voos)
    const rawFlights = [];
    if (data.best_flights) rawFlights.push(...data.best_flights);
    if (data.other_flights) rawFlights.push(...data.other_flights);

    if (rawFlights.length === 0) {
      return []; // Nenhum voo encontrado
    }

    // Mapeia para o formato que a interface gráfica (Frontend) já espera
    return rawFlights.slice(0, 6).map((flight, index) => {
      // Pega o primeiro segmento do voo (ida)
      const flightInfo = flight.flights[0];
      const airlineName = flightInfo.airline || "Companhia Aérea";
      
      // Tenta achar a cor da companhia no nosso array local
      const knownAirline = AIRLINES.find(a => airlineName.toLowerCase().includes(a.name.toLowerCase().replace(" linhas aéreas", "").replace(" airlines", "")));
      const color = knownAirline ? knownAirline.color : "#666666";
      const code = knownAirline ? knownAirline.code : airlineName.substring(0, 2).toUpperCase();

      // Tempo de duração
      const durationMinutes = flight.total_duration || 0;
      const durHours = Math.floor(durationMinutes / 60);
      const durMins = durationMinutes % 60;
      const durationFormatted = `${durHours}h ${durMins}min`;

      // Escalas
      const stops = flight.layovers ? flight.layovers.length : 0;
      const connectionCity = stops > 0 ? flight.layovers[0].id : "";

      // Datas e horários
      const depTimeRaw = flightInfo.departure_airport?.time;
      const arrTimeRaw = flight.flights[flight.flights.length - 1].arrival_airport?.time;
      
      // Helper para formatar hora (SerpApi retorna "2026-07-10 11:30")
      const formatTime = (timeStr) => {
        if (!timeStr) return "00:00";
        if (timeStr.includes(" ")) return timeStr.split(" ")[1].substring(0, 5);
        return timeStr;
      };

      return {
        id: `FL-${code}-${departureDate}-${index + 100}`,
        airline: airlineName,
        code: code,
        color: color,
        departureDate: departureDate, // Adicionado para exibir a data no front
        departureTime: formatTime(depTimeRaw),
        arrivalTime: formatTime(arrTimeRaw),
        nextDay: false, // Simplificação por enquanto
        duration: durationFormatted,
        durationMinutes: durationMinutes,
        stops: stops,
        connectionCity: connectionCity,
        price: flight.price || 0,
        currency: "R$",
        flightLink: `https://www.kayak.com.br/flights/${origIATA}-${destIATA}/${departureDate}${returnDate ? `/${returnDate}` : ''}?sort=price_a`
      };
    });

  } catch (error) {
    console.error("Erro ao buscar voos na SerpApi:", error);
    throw error;
  }
}

/**
 * Função principal assíncrona para buscar passagens.
 * Retorna as informações dos links profundos e as opções REAIS.
 * Se endDateForRange for fornecido, busca em todos os dias do intervalo (max 7 dias).
 */
export async function searchFlights(origin, destination, departureDate, returnDate = null, endDateForRange = null) {
  const origIATA = resolveIATA(origin);
  const destIATA = resolveIATA(destination);
  
  // Criação da chave de cache
  const cacheKey = `${origIATA}_${destIATA}_${departureDate}_${returnDate || ''}_${endDateForRange || ''}`;

  try {
    const cached = await dbAll("SELECT * FROM flight_cache WHERE cache_key = ?", [cacheKey]);
    if (cached.length > 0) {
      const cacheRow = cached[0];
      // Verifica se o cache tem menos de 3 horas
      const cacheTime = new Date(cacheRow.created_at + 'Z').getTime(); // CURRENT_TIMESTAMP no SQLite é UTC
      const now = new Date().getTime();
      const diffHours = (now - cacheTime) / (1000 * 60 * 60);
      
      if (diffHours < 3) {
        console.log(`[Cache Hit ⚡] Retornando voos do SQLite para: ${cacheKey}`);
        return JSON.parse(cacheRow.result_json);
      } else {
        await dbRun("DELETE FROM flight_cache WHERE cache_key = ?", [cacheKey]);
      }
    }
  } catch (err) {
    console.warn("Aviso: Falha ao ler cache:", err.message);
  }
  
  const links = generateDeepLinks(origin, destination, departureDate, returnDate);
  
  let allOptions = [];
  
  if (endDateForRange && endDateForRange !== departureDate) {
    // Busca em lote
    const datesToSearch = [];
    let current = new Date(departureDate + "T12:00:00Z"); // Fix tz issue
    const end = new Date(endDateForRange + "T12:00:00Z");
    let limit = 7; // Max 7 dias para não estourar a cota da SerpApi
    
    while (current <= end && limit > 0) {
      datesToSearch.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
      limit--;
    }
    
    console.log(`Buscando voos para a faixa de dias: ${datesToSearch.join(', ')}`);
    
    for (const date of datesToSearch) {
      try {
        const result = await fetchRealFlights(origin, destination, date, returnDate);
        allOptions.push(...result);
        // Delay de 500ms para evitar rate limit (429) da SerpApi
        if (datesToSearch.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (err) {
        console.error(`Erro ao buscar para a data ${date}:`, err.message);
      }
    }
    
    // Remove duplicados pelo ID (se houver) e ordena por preço, mantendo os 6 mais baratos de todo o período
    allOptions = allOptions.sort((a, b) => a.price - b.price).slice(0, 6);
    
  } else {
    // Busca única
    allOptions = await fetchRealFlights(origin, destination, departureDate, returnDate);
  }
  
  const finalResult = {
    searchParams: {
      origin,
      originIATA: origIATA,
      destination,
      destinationIATA: destIATA,
      departureDate,
      returnDate,
      endDateForRange
    },
    links,
    options: allOptions
  };

  try {
    await dbRun(
      "INSERT OR REPLACE INTO flight_cache (cache_key, result_json, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
      [cacheKey, JSON.stringify(finalResult)]
    );
  } catch (err) {
    console.warn("Aviso: Falha ao salvar no cache:", err.message);
  }

  return finalResult;
}
