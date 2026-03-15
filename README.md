# CriptoInvest

Aplicação full stack para acompanhar mercado cripto, autenticar usuários, registrar aportes e preparar alertas automáticos de preço.

Hoje o projeto está organizado como uma monorepo simples com:

- frontend em Next.js
- API em Node.js + Express + TypeScript
- PostgreSQL como banco principal
- integrações com CoinGecko, Google OAuth e AWS
- workers separados para rotina de preços e alertas

## Visão geral

O estado atual do projeto é:

- a home pública já consome dados reais do CoinGecko e mostra o top 10 de criptomoedas
- a API já possui autenticação própria com e-mail/senha
- o cadastro usa confirmação por código enviado por e-mail
- existe login com Google
- existe recuperação de senha por e-mail
- o usuário autenticado já pode editar nome, trocar senha, trocar e-mail com confirmação e enviar avatar para S3
- a API já possui endpoints para lançamentos de carteira e alertas
- as páginas `minhas-criptos` e `lancamentos` ainda estão como base visual/preparação de integração
- os workers existem, mas ainda estão em modo inicial com `TODOs` no código

## Arquitetura atual

```text
Frontend (Next.js 16 / React 19 / TypeScript)
        |
        v
API (Express / TypeScript)
        |
        v
PostgreSQL

Integrações já presentes:
- CoinGecko -> preços de mercado
- Google OAuth -> login social
- AWS SES -> envio de código e recuperação de senha
- AWS S3 -> upload de avatar

Fluxo planejado dos workers:
- Price Worker -> rotina cron
- SQS -> fila de eventos de alerta
- Alert Worker -> consumo da fila e notificações
```

## Tecnologias usadas

### Frontend

- Next.js `16.1.6`
- React `19.2.4`
- TypeScript
- Tailwind CSS `3`
- App Router
- fetch nativo para integração com a API e CoinGecko
- componentes UI próprios em `src/components/ui`

### Backend

- Node.js
- Express `4`
- TypeScript
- `pg` para PostgreSQL
- `dotenv`
- autenticação via token JWT com implementação própria

### Integrações externas

- CoinGecko para preços e mercado
- Google OAuth 2.0 para login social
- AWS SES v2 para e-mails de confirmação e redefinição de senha
- AWS S3 para avatar do usuário
- AWS SQS já previsto nos workers

### Workers

- `node-cron` no worker de preços
- AWS SDK para SQS
- AWS SDK para SES no worker de alertas

## Estrutura do projeto

```text
criptoinvest/
|-- src/                     # Frontend Next.js
|   |-- app/                 # Rotas App Router
|   |-- components/          # Componentes visuais e de autenticação
|   |-- lib/                 # Cliente da API, auth local, CoinGecko
|   `-- utils/               # Helpers de formatação
|
|-- api/
|   |-- src/
|   |   |-- config/          # Variáveis de ambiente
|   |   |-- db/              # Pool do PostgreSQL
|   |   |-- middleware/      # Auth middleware
|   |   |-- routes/          # Auth, market, portfolio e alerts
|   |   |-- services/        # E-mail, storage e market
|   |   `-- utils/           # Crypto e validações
|   `-- sql/schema.sql       # Schema inicial do banco
|
|-- workers/
|   |-- price-worker/        # Worker cron de preços
|   `-- alert-worker/        # Worker de alertas
|
|-- package.json             # Frontend
`-- README.md
```

## Funcionalidades atuais

### Frontend

- página inicial com top 10 moedas por market cap
- preço em BRL
- variação de preço e sparkline
- autenticação persistida no `localStorage`
- rota protegida para área autenticada
- tela de configurações com:
  - edição de nome
  - troca de senha
  - troca de e-mail com código
  - upload de avatar
- callback de login com Google
- página de redefinição de senha

### API

- `GET /health`
- `GET /me`
- autenticação:
  - `POST /auth/register/start`
  - `POST /auth/register/confirm`
  - `POST /auth/register/resend`
  - `POST /auth/login`
  - `GET /auth/google/url`
  - `POST /auth/google/exchange`
  - `PATCH /auth/profile`
  - `POST /auth/profile/avatar`
  - `POST /auth/password/change`
  - `POST /auth/password/forgot`
  - `POST /auth/password/reset`
  - `POST /auth/email-change/start`
  - `POST /auth/email-change/resend`
  - `POST /auth/email-change/confirm`
- mercado:
  - `GET /market/top-10`
- carteira:
  - `POST /portfolio/entries`
  - `GET /portfolio/entries`
  - `GET /portfolio/summary`
  - `DELETE /portfolio/entries/:id`
- alertas:
  - `POST /alerts`
  - `GET /alerts`
  - `PATCH /alerts/:id`
  - `DELETE /alerts/:id`

## Banco de dados

O schema atual em [api/sql/schema.sql] cria:

- `users`
- `pending_users`
- `pending_email_changes`
- `pending_password_resets`
- `portfolio_entries`
- `price_alerts`
- enums para tipo de ativo e direção do alerta

Tipos de ativo aceitos hoje:

- `CRYPTO`
- `STOCK`
- `ETF`

## Como rodar o projeto

### 1. Pré-requisitos

Tenha instalado:

- Node.js 20+ recomendado
- npm
- PostgreSQL

Para fluxos opcionais/completos, também será necessário:

- conta AWS com SES configurado
- bucket S3
- credenciais AWS disponíveis no ambiente
- credenciais OAuth do Google

### 2. Instalar dependências

Instale em cada pacote:

```bash
npm install
cd api
npm install
cd ..\workers\price-worker
npm install
cd ..\alert-worker
npm install
```

### 3. Configurar variáveis de ambiente

#### Frontend

Use o arquivo da raiz como base:

```bash
cp .env.example .env.local
```

Variável usada hoje:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

#### API

Use `api/.env.example` como base para `api/.env`.

Variáveis principais:

```env
PORT=4000
FRONTEND_URL=http://localhost:3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/criptoinvest
JWT_SECRET=change-me-to-a-long-random-secret
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
AWS_REGION=us-east-1
SES_FROM_EMAIL=no-reply@example.com
S3_BUCKET_NAME=your-s3-bucket-name
REGISTER_CODE_EXPIRES_MINUTES=15
REGISTER_CODE_MAX_ATTEMPTS=5
PASSWORD_RESET_EXPIRES_MINUTES=30
```

Importante:

- `DATABASE_URL` e `JWT_SECRET` são obrigatórias para a API subir
- sem `SES_FROM_EMAIL`, os fluxos que enviam e-mail vão falhar
- sem `S3_BUCKET_NAME`, upload de avatar vai falhar
- sem `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`, login com Google fica desabilitado

#### Workers

`workers/price-worker/.env`

```env
DATABASE_URL=postgresql://user:password@host:5432/criptoinvest
SQS_QUEUE_URL=https://sqs.region.amazonaws.com/account/price-alerts
AWS_REGION=us-east-1
```

`workers/alert-worker/.env`

```env
SQS_QUEUE_URL=https://sqs.region.amazonaws.com/account/price-alerts
AWS_REGION=us-east-1
SES_FROM_EMAIL=noreply@seudominio.com
```

### 4. Criar o banco

Crie o banco no PostgreSQL e execute:

```bash
psql "postgresql://postgres:postgres@localhost:5432/criptoinvest" -f api/sql/schema.sql
```

Ou, se já estiver usando `DATABASE_URL` no ambiente:

```bash
psql "%DATABASE_URL%" -f api/sql/schema.sql
```

### 5. Subir os serviços

#### Frontend

```bash
npm run dev
```

Aplicação em `http://localhost:3000`

#### API

```bash
cd api
npm run dev
```

API em `http://localhost:4000`

#### Worker de preços

```bash
cd workers/price-worker
npm run dev
```

Existe também:

```bash
npm run run:cron
```

#### Worker de alertas

```bash
cd workers/alert-worker
npm run dev
```

## Fluxo mínimo para desenvolvimento local

Se você quer apenas testar a aplicação web e a API:

1. suba o PostgreSQL
2. execute o schema SQL
3. configure `api/.env`
4. configure `.env.local` na raiz
5. rode a API
6. rode o frontend

Nesse cenário:

- a home pública funciona com CoinGecko
- cadastro/login local funciona se o SES estiver configurado
- login com Google depende das credenciais OAuth
- avatar depende do S3
- workers não são necessários para navegar pela maior parte da aplicação atual

## Scripts disponíveis

### Raiz

- `npm run dev` -> inicia o frontend Next.js
- `npm run build` -> build de produção do frontend
- `npm run start` -> sobe o frontend em modo produção
- `npm run lint` -> lint do frontend
- `npm run type-check` -> checagem de tipos do frontend

### API

- `npm run dev` -> API com `tsx watch`
- `npm run build` -> compila TypeScript
- `npm run start` -> executa `dist/index.js`
- `npm run type-check` -> checagem de tipos

### Price Worker

- `npm run dev` -> watch mode
- `npm run build` -> compila TypeScript
- `npm run start` -> executa build compilada
- `npm run run:cron` -> executa a rotina uma vez pelo entrypoint atual

### Alert Worker

- `npm run dev` -> watch mode
- `npm run build` -> compila TypeScript
- `npm run start` -> executa build compilada

## Observações importantes sobre o estado atual

- os workers ainda não executam a lógica final de busca de preço, envio para fila e disparo de alertas
- as páginas `minhas-criptos` e `lancamentos` ainda estão em fase de integração com os dados reais
- o backend já suporta lançamentos e alertas via API, mesmo com parte da UI ainda em evolução
- o envio de e-mails depende de configuração válida da AWS SES
- o upload de avatar depende de bucket S3 com permissões corretas

## Próximos pontos naturais de evolução

- conectar a UI de carteira aos endpoints `/portfolio`
- conectar a UI de alertas aos endpoints `/alerts`
- finalizar o `price-worker`
- finalizar o `alert-worker`
- adicionar migrations versionadas
- adicionar testes automatizados
