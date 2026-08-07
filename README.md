# pricing-analytics-dashboard

Dashboard de análise de preços e monitoramento de mídia.

- **Front-end**: React 19, TanStack Start (Router + Vite), TypeScript, Tailwind CSS, shadcn/ui, Recharts.
- **Dados em tempo real**: Firebase (Firestore + Auth) via `onSnapshot`.
- **Coleta de preços**: script Python (`/scraper`) com BeautifulSoup + Pandas + Firebase Admin SDK.
- **API**: Node.js + Express + TypeScript (`/backend`), intermediária entre o front-end e o scraper.

