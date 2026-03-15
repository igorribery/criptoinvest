import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { env, isSesEnabled } from "../config/env.js";

const sesClient = new SESv2Client({ region: env.awsRegion });

export async function sendRegisterCodeEmail(email: string, name: string, code: string) {
  if (!isSesEnabled) {
    throw new Error("AWS SES nao esta configurado no servidor.");
  }

  const subject = "Seu codigo de confirmacao - CriptoInvest";
  const greetingName = name.trim() || "investidor";
  const expiresInMinutes = env.registerCodeExpiresMinutes;

  const textBody = [
    `Ola, ${greetingName}!`,
    "",
    "Seu codigo de confirmacao do CriptoInvest e:",
    code,
    "",
    `Esse codigo expira em ${expiresInMinutes} minutos.`,
    "Se voce nao iniciou este cadastro, ignore este email.",
  ].join("\n");

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
      <h2 style="margin-bottom: 12px;">Confirme seu cadastro</h2>
      <p>Ola, ${greetingName}!</p>
      <p>Seu codigo de confirmacao do <strong>CriptoInvest</strong> e:</p>
      <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; margin: 24px 0;">${code}</p>
      <p>Esse codigo expira em ${expiresInMinutes} minutos.</p>
      <p>Se voce nao iniciou este cadastro, ignore este email.</p>
    </div>
  `;

  await sesClient.send(
    new SendEmailCommand({
      FromEmailAddress: env.sesFromEmail,
      Destination: {
        ToAddresses: [email],
      },
      Content: {
        Simple: {
          Subject: {
            Charset: "UTF-8",
            Data: subject,
          },
          Body: {
            Text: {
              Charset: "UTF-8",
              Data: textBody,
            },
            Html: {
              Charset: "UTF-8",
              Data: htmlBody,
            },
          },
        },
      },
    }),
  );
}
