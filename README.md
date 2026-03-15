# CriptoInvest — Crypto Portfolio + Alert System

Sistema para registro de compras de criptomoedas, acompanhamento de preço médio, alertas automáticos e notificações por e-mail.

## Arquitetura

```
Frontend (Next.js / TypeScript)
        ↓
API (Node.js / Express)
        ↓
PostgreSQL (AWS RDS)
        ↓
Price Worker (cron job)
        ↓
SQS queue
        ↓
Alert Worker
        ↓
Email (SES)
```

## Estrutura do Projeto

```
criptoinvest/
├── src/                 # Frontend Next.js (App Router)
├── api/                 # API Node.js + Express
├── workers/
│   ├── price-worker/    # Cron job - busca preços, envia para SQS
│   └── alert-worker/    # Consome SQS, envia emails via SES
├── package.json
└── README.md
```

## Como rodar

### 1. Instalar dependências

```bash
# Root (frontend)
npm install

# API
cd api && npm install

# Price Worker
cd workers/price-worker && npm install

# Alert Worker
cd workers/alert-worker && npm install
```

### 2. Configurar variáveis de ambiente

Copie os `.env.example` de cada pasta para `.env` e preencha:

- `api/.env`
- `workers/price-worker/.env`
- `workers/alert-worker/.env`

### 3. Subir os serviços

```bash
# Frontend (porta 3000)
npm run dev

# API (porta 4000)
cd api && npm run dev

# Price Worker (cron)
cd workers/price-worker && npm run dev

# Alert Worker (SQS consumer)
cd workers/alert-worker && npm run dev
```

## Scripts úteis

| Pasta | Script | Descrição |
|-------|--------|-----------|
| Root | `npm run dev` | Frontend Next.js |
| api | `npm run dev` | API Express com hot reload |
| workers/price-worker | `npm run dev` | Worker de preços |
| workers/alert-worker | `npm run dev` | Worker de alertas |
