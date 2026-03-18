import type { Metadata } from "next";
import { AuthControls } from "@/components/auth-controls";
import { HomeNav } from "@/components/home-nav";
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
      <body className="bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),_transparent_30%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] text-slate-100">
        <AuthControls />
        {children}
        <HomeNav />
      </body>
    </html>
  );
}
