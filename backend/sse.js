export const clients = [];

export function addClient(res) {
  clients.push(res);
  
  res.req.on("close", () => {
    const index = clients.indexOf(res);
    if (index !== -1) clients.splice(index, 1);
  });
}

export function broadcastAlert(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  clients.forEach(client => {
    client.write(payload);
  });
}

// Mantém a conexão viva enviando um ping a cada 30 segundos
setInterval(() => {
  clients.forEach(client => {
    client.write(': keepalive\n\n');
  });
}, 30000);
