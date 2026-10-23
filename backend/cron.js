import cron from 'node-cron';
import nodemailer from 'nodemailer';
import { dbAll, dbRun } from './db.js';
import { searchFlights } from './flightSearch.js';
import { broadcastAlert } from './sse.js';

let globalTransporter = null;

// Configurar Nodemailer com Ethereal (Conta de Teste Gratuita)
async function getTransporter() {
  if (!globalTransporter) {
    console.log("Criando conta de teste Ethereal (isso ocorre apenas 1 vez)...");
    const testAccount = await nodemailer.createTestAccount();
    globalTransporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }
  return globalTransporter;
}

// Função principal de verificação de alertas
export async function checkPriceAlerts() {
  console.log("⏰ Iniciando verificação de Alertas de Preço...");
  
  try {
    // 🧹 Auto-Limpeza (Garbage Collector) de alertas vencidos
    const todayStr = new Date().toISOString().split('T')[0];
    const { changes: alertsChanges } = await dbRun("DELETE FROM alerts WHERE date < ? AND (end_date IS NULL OR end_date < ?)", [todayStr, todayStr]);
    if (alertsChanges > 0) {
      console.log(`🧹 Limpeza Automática: ${alertsChanges} alerta(s) vencido(s) removido(s) do banco de dados.`);
    }

    // 🧹 Auto-Limpeza (Garbage Collector) do Cache (Apaga buscas mais velhas que 24 horas)
    const { changes: cacheChanges } = await dbRun("DELETE FROM flight_cache WHERE created_at <= datetime('now', '-1 day')");
    if (cacheChanges > 0) {
      console.log(`🧹 Limpeza Automática: ${cacheChanges} registro(s) de cache antigo(s) removido(s) do banco de dados.`);
    }

    const alerts = await dbAll("SELECT * FROM alerts");
    
    if (alerts.length === 0) {
      console.log("Nenhum alerta configurado.");
      return;
    }

    const transporter = await getTransporter();

    for (const alert of alerts) {
      console.log(`🔎 Verificando alerta: ${alert.origin} -> ${alert.destination} (Alvo: R$ ${alert.target_price}) para ${alert.email}`);
      
      try {
        // Usa o mecanismo já existente no backend para buscar na SerpApi
        const result = await searchFlights(alert.origin, alert.destination, alert.date, null, alert.end_date);
        const flights = result.options || [];
        
        if (flights.length === 0) {
          console.log(`Nenhum voo encontrado para ${alert.origin}->${alert.destination}`);
          continue;
        }

        // Encontrar o menor preço entre as opções retornadas
        const lowestPrice = Math.min(...flights.map(f => f.price));
        const lowestPriceFlight = flights.find(f => f.price === lowestPrice);

        console.log(`Menor preço encontrado: R$ ${lowestPrice}. Alvo: R$ ${alert.target_price}`);

        if (lowestPrice <= alert.target_price && lowestPriceFlight) {
          // Disparar e-mail!
          console.log(`🎉 Preço atingido! Preparando e-mail para ${alert.email}...`);
          
          const dateStr = alert.end_date ? `entre ${alert.date} e ${alert.end_date}` : `na data ${alert.date}`;
          
          const info = await transporter.sendMail({
            from: '"FlyAI Alertas" <alertas@flyai.com>',
            to: alert.email,
            subject: `🚨 Preço Atingido! Passagem para ${alert.destination} por R$ ${lowestPrice}`,
            text: `Boas notícias!\n\nEncontramos passagens de ${alert.origin} para ${alert.destination} ${dateStr} por apenas R$ ${lowestPrice}!\n\nO seu preço alvo era R$ ${alert.target_price}.\n\nCorra para comprar: ${lowestPriceFlight.flightLink}`,
            html: `<h2>Boas notícias!</h2>
                   <p>Encontramos passagens de <strong>${alert.origin}</strong> para <strong>${alert.destination}</strong> ${dateStr} por apenas <strong>R$ ${lowestPrice}</strong>!</p>
                   <p>O seu preço alvo era R$ ${alert.target_price}.</p>
                   <p><a href="${lowestPriceFlight.flightLink}">Clique aqui para ver o Voo no site</a></p>`
          });

          console.log("✉️ E-mail enviado com sucesso!");
          const emailUrl = nodemailer.getTestMessageUrl(info);

          // Avisa o frontend em tempo real (SSE) via módulo sse.js
          broadcastAlert(alert.user_id, {
            type: 'ALERT',
            alertId: alert.id,
            origin: alert.origin,
            destination: alert.destination,
            date: alert.date,
            price: lowestPrice,
            targetPrice: alert.target_price,
            flightsData: result,
            emailUrl: emailUrl
          });

          // Remove o alerta após o envio para não enviar o mesmo e-mail repetidamente
          await dbRun("DELETE FROM alerts WHERE id = ?", [alert.id]);
          console.log(`🗑️ Alerta ID ${alert.id} removido após disparo.`);
        }
      } catch (err) {
        console.error(`Erro ao verificar alerta ID ${alert.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error("Erro geral na execução do Cron:", err);
  }
}

// Iniciar o agendamento
export function startCron() {
  const schedule = process.env.CRON_SCHEDULE || '* * * * *';
  
  cron.schedule(schedule, () => {
    checkPriceAlerts();
  });
  console.log(`⏱️ Cron Job de Alertas iniciado com a expressão: ${schedule}`);
}
