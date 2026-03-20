# CriptoInvest

Aplicação full stack para acompanhar mercado cripto, autenticar usuários, registrar aportes e disparar alertas automáticos de preço.

## Estado atual (atualizado)

O projeto está operando em arquitetura híbrida/produção com:

- frontend em Next.js hospedado no AWS Amplify
- API Node.js + Express hospedada no AWS Elastic Beanstalk
- PostgreSQL no Amazon RDS (sa-east-1)
- rotina de alertas em AWS Lambda + EventBridge + DynamoDB + Secrets Manager
- integrações com CoinGecko, Google OAuth, AWS SES e S3

## Arquitetura em produção

```text
Usuário
  |
  v
Amplify (Next.js Frontend)
  |
  v
Elastic Beanstalk (API Express)
  |
  v
RDS PostgreSQL (sa-east-1)

EventBridge (rate 5 min)
  |
  v
Lambda price-check
  |-- lê/atualiza RDS (alertas)
  |-- usa DynamoDB (estado/cooldown)
  |-- lê DATABASE_URL no Secrets Manager
  |-- envia notificações via SES (e SNS opcional para SMS)
```

## URLs de referência (produção)

- Frontend Amplify: `https://main.d3uogzqxruse62.amplifyapp.com`
- API Elastic Beanstalk: `https://criptoinvest.sa-east-1.elasticbeanstalk.com`
- Healthcheck da API: `https://criptoinvest.sa-east-1.elasticbeanstalk.com/health`

> Se esses domínios mudarem, atualize também `NEXT_PUBLIC_API_URL`, `FRONTEND_URL` e `GOOGLE_REDIRECT_URI`.

## Principais funcionalidades

- Home com top 10 criptomoedas via CoinGecko
- Autenticação com e-mail/senha e Google OAuth
- Recuperação de senha por e-mail
- Perfil do usuário com atualização de dados e avatar no S3
- Lançamentos de carteira e resumo de posição
- Alertas de preço (`TARGET_ONCE` e `PERIODIC`)
- Verificação automática de alertas via Lambda agendada

## Estrutura do monorepo

```text
criptoinvest/
|-- src/                      # Frontend Next.js (App Router)
|-- api/                      # API Express + TS
|   |-- src/
|   |-- sql/
|   |-- scripts/run-schema.ts
|   `-- Procfile              # usado no Elastic Beanstalk
|-- lambdas/
|   `-- price-check/          # Lambda de alertas
|-- workers/                  # workers legados/em evolução
|-- infra/                    # CDK stack para componentes de alertas
|-- amplify.yml               # build do Amplify
`-- README.md
```

## Endpoints principais da API

- `GET /health`
- `GET /me`
- Auth:
  - `POST /auth/register/start`
  - `POST /auth/register/confirm`
  - `POST /auth/register/resend`
  - `POST /auth/login`
  - `GET /auth/google/url`
  - `POST /auth/google/exchange`
  - `POST /auth/password/forgot`
  - `POST /auth/password/reset`
- Portfolio:
  - `POST /portfolio/entries`
  - `GET /portfolio/entries`
  - `GET /portfolio/summary`
  - `DELETE /portfolio/entries/:id`
- Alerts:
  - `POST /alerts`
  - `GET /alerts`
  - `PATCH /alerts/:id`
  - `DELETE /alerts/:id`

## Variáveis de ambiente

### Frontend (`.env.local` / Amplify)

```env
NEXT_PUBLIC_API_URL=https://criptoinvest.sa-east-1.elasticbeanstalk.com
```

### API (`api/.env` local ou variáveis no Elastic Beanstalk)

```env
PORT=8081
FRONTEND_URL=http://localhost:3000,https://main.d3uogzqxruse62.amplifyapp.com
DATABASE_URL=postgresql://USER:PASSWORD@database-1.xxxxx.sa-east-1.rds.amazonaws.com:5432/postgres
JWT_SECRET=your-long-random-secret
AWS_REGION=sa-east-1
SES_FROM_EMAIL=your-verified-email@example.com
S3_BUCKET_NAME=your-bucket
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://main.d3uogzqxruse62.amplifyapp.com/auth/google/callback
REGISTER_CODE_EXPIRES_MINUTES=15
REGISTER_CODE_MAX_ATTEMPTS=5
PASSWORD_RESET_EXPIRES_MINUTES=30
```

### Lambda `price-check` (ambiente AWS)

Obrigatórias:

- `DDB_TABLE_ALERT_STATE`
- `DATABASE_URL_SECRET_ID` (Secrets Manager)
- `SES_FROM_EMAIL`

Opcionais:

- `COINGECKO_API_BASE_URL`
- `SMS_ENABLED`
- `RDS_SSL_REJECT_UNAUTHORIZED`

## Banco de dados

O schema em `api/sql/schema.sql` cria:

- `users`
- `pending_users`
- `pending_email_changes`
- `pending_password_resets`
- `portfolio_entries`
- `price_alerts`

Para aplicar schema/migrations sem `psql`:

```bash
cd api
npm run run-schema
```

## Desenvolvimento local

### Pré-requisitos

- Node.js 20+
- npm
- acesso ao PostgreSQL (local ou RDS)

### Instalação

```bash
npm install
cd api && npm install
cd ../workers/price-worker && npm install
cd ../alert-worker && npm install
```

### Rodar local

Terminal 1 (API):

```bash
cd api
npm run dev
```

Terminal 2 (Frontend):

```bash
npm run dev
```

## Deploy

### API (Elastic Beanstalk)

1. Build da API:

```bash
cd api
npm run build
```

2. Gere `api-eb.zip` (sem artefatos sensíveis)
3. Upload no Beanstalk
4. Validar `GET /health`

### Frontend (Amplify)

1. Conectar branch no Amplify
2. Definir `NEXT_PUBLIC_API_URL`
3. Deploy com `amplify.yml`
4. Validar login/cadastro/rotas autenticadas

## Scripts úteis

### Raiz

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run type-check`

### API

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run type-check`
- `npm run run-schema`

## Segurança e boas práticas

- Nunca commitar `.env`, `.env.local`, chaves ou segredos
- Não versionar artefatos de deploy (`*.zip`)
- Usar Secrets Manager/SSM para segredos em produção
- Restringir Security Group do RDS para IPs/SGs necessários
- Rotacionar credenciais AWS/DB periodicamente

## Observações

- O endpoint `/` da API retorna `Cannot GET /` por design; use `/health` para verificação.
- Parte dos workers em `workers/` é legado/em evolução; o fluxo ativo de alertas está na Lambda `lambdas/price-check`.
