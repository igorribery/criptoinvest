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

Copie os arquivos de exemplo para `.env` (ou `.env.local` no frontend) e preencha:

- `api/.env` (inclui `DATABASE_URL`, `JWT_SECRET`)
- `workers/price-worker/.env`
- `workers/alert-worker/.env`
- `.env.local` no frontend (ex.: `NEXT_PUBLIC_API_URL=http://localhost:4000`)

> Em produção, `DATABASE_URL` e `JWT_SECRET` são obrigatórios na API.

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

## CoinGecko (preços em BRL com cache de 24h)

No frontend (`.env.local` na raiz), configure:

```bash
COINGECKO_API_KEY=CG-...
COINGECKO_BASE_URL=https://pro-api.coingecko.com/api/v3
COINGECKO_API_KEY_HEADER=x-cg-pro-api-key
```

A home usa o endpoint `/simple/price` com `vs_currencies=brl` e `revalidate` de 24h (uma chamada por dia por página/rota em cache, reduzindo consumo da cota).

## Scripts úteis

| Pasta | Script | Descrição |
|-------|--------|-----------|
| Root | `npm run dev` | Frontend Next.js |
| api | `npm run dev` | API Express com hot reload |
| workers/price-worker | `npm run dev` | Worker de preços |
| workers/alert-worker | `npm run dev` | Worker de alertas |

## API (implementada)

A API em `api/` já possui os endpoints para:

- autenticação (`/auth/register`, `/auth/login`, `/me`)
- listagem do top 10 de cripto em BRL ou outra moeda (`/market/top-10`)
- carteira de ativos com cálculo de preço médio (`/portfolio/entries`, `/portfolio/summary`)
- alertas de preço (`/alerts`)

### Banco de dados

Execute o schema SQL:

```bash
psql "$DATABASE_URL" -f api/sql/schema.sql
```

### Exemplo rápido de fluxo

1. Criar usuário em `POST /auth/register`
2. Fazer login em `POST /auth/login`
3. Usar `Authorization: Bearer <token>`
4. Cadastrar compras em `POST /portfolio/entries`
5. Consultar preço médio em `GET /portfolio/summary`
6. Criar alertas em `POST /alerts`
