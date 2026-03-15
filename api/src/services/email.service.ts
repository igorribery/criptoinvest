import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { env, isSesEnabled } from "../config/env.js";

const sesClient = new SESv2Client({ region: env.awsRegion });

export async function sendRegisterCodeEmail(email: string, name: string, code: string) {
  if (!isSesEnabled) {
    throw new Error("AWS SES não está configurado no servidor.");
  }

  const subject = "Seu código de confirmação - CriptoInvest";
  const greetingName = name.trim() || "investidor";
  const expiresInMinutes = env.registerCodeExpiresMinutes;

  const textBody = [
    `Olá, ${greetingName}!`,
    "",
    "Seu código de confirmação do CriptoInvest é:",
    code,
    "",
    `Esse código expira em ${expiresInMinutes} minutos.`,
    "Se você não iniciou este cadastro, ignore este e-mail.",
  ].join("\n");

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
      <h2 style="margin-bottom: 12px;">Confirme seu cadastro</h2>
      <p>Olá, ${greetingName}!</p>
      <p>Seu código de confirmação do <strong>CriptoInvest</strong> é:</p>
      <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; margin: 24px 0;">${code}</p>
      <p>Esse código expira em ${expiresInMinutes} minutos.</p>
      <p>Se você não iniciou este cadastro, ignore este e-mail.</p>
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

export async function sendPasswordResetEmail(email: string, name: string, resetLink: string) {
  if (!isSesEnabled) {
    throw new Error("AWS SES nÃ£o estÃ¡ configurado no servidor.");
  }

  const subject = "RecuperaÃ§Ã£o de senha - CriptoInvest";
  const greetingName = name.trim() || "investidor";
  const expiresInMinutes = env.passwordResetExpiresMinutes;

  const textBody = [
    `OlÃ¡, ${greetingName}!`,
    "",
    "Recebemos um pedido para redefinir sua senha no CriptoInvest.",
    `Use este link para criar uma nova senha: ${resetLink}`,
    "",
    `Esse link expira em ${expiresInMinutes} minutos.`,
    "Se vocÃª nÃ£o solicitou a redefiniÃ§Ã£o, ignore este e-mail.",
  ].join("\n");

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
      <h2 style="margin-bottom: 12px;">Recupere sua senha</h2>
      <p>OlÃ¡, ${greetingName}!</p>
      <p>Recebemos um pedido para redefinir sua senha no <strong>CriptoInvest</strong>.</p>
      <p style="margin: 24px 0;">
        <a
          href="${resetLink}"
          style="display: inline-block; border-radius: 10px; background: #06b6d4; color: #082f49; font-weight: bold; padding: 12px 18px; text-decoration: none;"
        >
          Redefinir senha
        </a>
      </p>
      <p>Se preferir, copie e cole este link no navegador:</p>
      <p style="word-break: break-all; color: #0f172a;">${resetLink}</p>
      <p>Esse link expira em ${expiresInMinutes} minutos.</p>
      <p>Se vocÃª nÃ£o solicitou a redefiniÃ§Ã£o, ignore este e-mail.</p>
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
