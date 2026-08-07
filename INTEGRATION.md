# Integração PriceWatch — Firebase + Scraper Python + API Node

Guia de referência para colocar no ar o ecossistema completo por trás do
dashboard (front-end gerado pelo Lovable).

## Arquitetura

```
┌─────────────────┐   onSnapshot (tempo real)   ┌───────────┐
│  Front-end React │◄───────────────────────────│ Firestore │
│  (esta pasta)     │                             └─────┬─────┘
└────────┬─────────┘                                   ▲
         │ POST /api/products                          │ grava produtos,
         │ (modal "Adicionar novo link")                │ priceHistory e alerts
         ▼                                              │ (Admin SDK)
┌──────────────────┐   dispara via child_process  ┌─────┴──────┐
│  API Node/Express │──────────────────────────────►│  scraper.py │
│  (/backend)        │                              │  (/scraper)  │
└──────────────────┘   agenda (node-cron)          └─────────────┘
```

- O **front-end** só lê do Firestore (via `firebase/firestore` + `onSnapshot`) e
  chama a **API Node** quando o usuário adiciona um link novo.
- A **API Node** cria o registro inicial do produto (status "pending", visível
  na hora graças ao `onSnapshot`) e dispara o **scraper Python** — na hora
  (link novo) ou agendado via cron (`SCRAPE_CRON`, padrão a cada 6h).
- O **scraper Python** é o único responsável por gravar preços, no Firestore,
  usando o Admin SDK — que ignora as Security Rules, então as regras do
  cliente (front-end) só liberam leitura + pequenos ajustes (ver abaixo).

## Coleções do Firestore

### `products/{id}`

| Campo | Tipo | Descrição |
|---|---|---|
| `name` | string | Nome do produto (extraído do `og:title` da página) |
| `url` | string | URL monitorada |
| `store` | string | Nome da loja (derivado do domínio) |
| `image` | string \| null | URL da imagem (`og:image`) |
| `currentPrice` | number \| null | Último preço coletado |
| `previousPrice` | number \| null | Preço anterior (para calcular a variação) |
| `targetPrice` | number \| null | Preço-alvo definido pelo usuário (dispara alerta) |
| `changePct` | number \| null | Variação % entre `previousPrice` e `currentPrice` |
| `status` | `"queda" \| "estavel" \| "aumento"` | Tendência de preço (para o `StatusBadge`) |
| `scrapeStatus` | `"pending" \| "ok" \| "error" \| "not_found"` | Status técnico da última coleta |
| `createdAt` / `lastUpdated` | Timestamp | Controle |

### `products/{id}/priceHistory/{entryId}` (subcoleção)

| Campo | Tipo |
|---|---|
| `price` | number |
| `scrapedAt` | Timestamp |

### `alerts/{id}`

| Campo | Tipo | Descrição |
|---|---|---|
| `productId` | string | Referência ao produto |
| `product`, `store` | string | Denormalizados para exibição direta na lista |
| `target`, `current` | number | Preços no momento do alerta |
| `type` | `"queda" \| "aumento"` | Direção do cruzamento do preço-alvo |
| `createdAt` | Timestamp | Usado com `date-fns` para o "há X horas" |
| `read` | boolean | O usuário pode marcar como lido |

Um alerta só é criado no momento em que o preço **cruza** o `targetPrice`
(não a cada coleta enquanto ele permanece do mesmo lado) — veja
`maybe_create_alert()` em `scraper/scraper.py`.

## Passo a passo

### 1. Criar o projeto no Firebase
No [Console do Firebase](https://console.firebase.google.com/), crie um
projeto → ative o **Firestore Database** (modo produção) → ative
**Authentication** (o método que fizer sentido, ex. E-mail/senha ou Google).

### 2. Gerar a service account
**Configurações do projeto → Contas de serviço → Gerar nova chave privada.**
Salve o JSON baixado como `scraper/serviceAccountKey.json` (a API Node usa o
mesmo arquivo por padrão — veja `backend/.env.example`).
**Nunca** faça commit desse arquivo (adicione ao `.gitignore`).

### 3. Configurar o front-end
```bash
cp .env.example .env         # preencha com a config do app web (Config do SDK)
bun install                  # ou npm install
bun run dev
```

### 4. Configurar o scraper Python
```bash
cd scraper
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt --break-system-packages
# copie a service account para scraper/serviceAccountKey.json (passo 2)
python3 scraper.py            # roda uma coleta em lote manual, para testar
```

### 5. Configurar a API Node
```bash
cd backend
cp .env.example .env
npm install
npm run dev                   # http://localhost:3001
```

### 6. Testar o fluxo de ponta a ponta
1. Com `bun run dev` (front-end) e `npm run dev` (backend) rodando, abra o
   dashboard e clique em **"Adicionar novo link"** com uma URL de produto real.
2. O produto aparece imediatamente na tabela com status "coletando…" — a API
   já gravou o documento e disparou o `scraper.py` em segundo plano.
3. Em alguns segundos, o preço, nome e imagem reais aparecem **sem recarregar
   a página** (é o `onSnapshot` reagindo à escrita do scraper).
4. Rode `python3 scraper.py` de novo (ou espere o cron) para gerar um segundo
   ponto de preço e ver o gráfico de variação ganhar uma segunda amostra.

## O que mudou no código do front-end (gerado pelo Lovable)

- `src/lib/monitor-data.ts` — os arrays mockados (`products`, `priceHistory`,
  `storeComparison`, `alerts`) foram removidos; os tipos foram movidos para
  `src/lib/types.ts` e os helpers de exibição (`formatBRL`, `statusLabel`)
  continuam aqui.
- `src/lib/firebase.ts`, `src/lib/api.ts` — novos.
- `src/hooks/useProducts.ts`, `useAlerts.ts`, `useProductPriceHistory.ts` —
  novos hooks com `onSnapshot`.
- `PriceCharts.tsx`, `ProductTable.tsx`, `routes/alertas.tsx`,
  `routes/index.tsx`, `AddLinkDialog.tsx` — passaram a consumir os hooks acima
  em vez dos arrays mockados. `AddLinkDialog` agora chama a API Node de verdade.
- `StatusBadge.tsx`, `MetricCard.tsx`, `DashboardLayout.tsx`,
  `routes/produtos.tsx`, `routes/configuracoes.tsx` — **não precisaram mudar**
  (já eram componentes de apresentação, sem acoplamento aos dados mockados).

## Decisões de design (e possíveis próximos passos)

- **Comparativo entre lojas**: no mock original, o gráfico comparava o
  **mesmo produto** em 5 lojas diferentes. Como cada documento em `products`
  representa **uma URL/loja específica**, não existe hoje uma noção de "o
  mesmo item em lojas diferentes" — por isso o gráfico foi adaptado para
  mostrar o **preço médio atual por loja entre todos os produtos monitorados**.
  Se quiser o comparativo literal (mesmo item, várias lojas), o próximo passo
  seria adicionar um campo `groupId` para agrupar produtos equivalentes.
- **Seletores de preço no scraper** (`parse_price` em `scraper.py`) são um
  ponto de partida genérico (meta tags + classes comuns de e-commerce). Cada
  loja-alvo real provavelmente vai exigir ajuste fino nos seletores.
- **Listeners duplicados**: `PriceTrendChart`, `StoreComparisonChart` e
  `ProductTable` aceitam uma prop opcional `products` — quando informada
  (como faz `routes/index.tsx`), eles reaproveitam os dados em vez de abrir
  um novo `onSnapshot` próprio. Uma evolução futura seria um Context/Provider
  compartilhado para todo o app.
- **Agendamento em produção**: `node-cron` funciona bem localmente, mas em
  ambientes serverless (ex. Cloudflare, onde o Nitro do TanStack Start já
  builda por padrão) processos de longa duração não persistem — vale migrar
  o agendamento para Cloud Scheduler + Cloud Functions/Cloud Run chamando o
  scraper, se o deploy final for serverless.

## Limitações conhecidas

- As Security Rules (`firestore.rules`) liberam leitura para qualquer usuário
  autenticado — não há ainda um conceito de "dono" do produto (multi-tenant).
- O front-end usa `firebase/auth` apenas inicializado (`src/lib/firebase.ts`);
  a tela de login/cadastro em si não foi implementada — é o próximo passo
  natural antes de abrir o Firestore para mais de um usuário.
