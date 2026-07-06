async function run() {
  const url = `https://serpapi.com/search.json?engine=google_flights&departure_id=GRU&arrival_id=EZE&outbound_date=2026-10-15&currency=BRL&hl=pt-BR&api_key=27cced8573b4d64aa747e7fb79ff0bbf5d5828d41a6a7038ab84f7bb2c9ea471&type=2`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log("best_flights:", data.best_flights ? data.best_flights.length : 0);
    console.log("other_flights:", data.other_flights ? data.other_flights.length : 0);
    if (!data.best_flights && !data.other_flights) {
      console.log(JSON.stringify(data, null, 2));
    }
  } catch(e) {
    console.error(e);
  }
}
run();
