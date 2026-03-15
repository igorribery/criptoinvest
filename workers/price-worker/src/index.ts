import "dotenv/config";
import cron from "node-cron";

// Job de exemplo: executar a cada minuto em desenvolvimento
// Em produção: configurar para intervalo desejado (ex: a cada 5 min)
cron.schedule("* * * * *", async () => {
  console.log("[Price Worker] Job executado em", new Date().toISOString());
  // TODO: buscar preços, atualizar DB, enviar para SQS
});
