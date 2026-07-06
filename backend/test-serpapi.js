
async function run() {
  const url = `https://serpapi.com/search.json?engine=google_flights&departure_id=GRU&arrival_id=FLN&outbound_date=2026-07-10&currency=BRL&hl=pt-BR&api_key=27cced8573b4d64aa747e7fb79ff0bbf5d5828d41a6a7038ab84f7bb2c9ea471&type=2`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    const withLayover = data.best_flights.find(f => f.layovers && f.layovers.length > 0) || data.other_flights.find(f => f.layovers && f.layovers.length > 0);
    console.log(JSON.stringify(withLayover?.layovers, null, 2));
  } catch(e) {
    console.error(e);
  }
}
run();
