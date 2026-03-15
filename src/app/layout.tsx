import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CriptoInvest",
  description: "Plataforma de acompanhamento e análise de criptoativos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
