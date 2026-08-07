import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";

// Preenchidas via variáveis VITE_* (veja .env.example na raiz do projeto).
// A config do @lovable.dev/vite-tanstack-config já injeta VITE_* automaticamente
// (ver comentário em vite.config.ts), então basta criar o arquivo .env.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// getApps()[0] evita reinicializar o app durante o Hot Module Reload do
// Vite e durante a renderização no servidor (este projeto usa TanStack
// Start, que faz SSR por padrão).
export const firebaseApp: FirebaseApp = getApps()[0] ?? initializeApp(firebaseConfig);

export const db: Firestore = getFirestore(firebaseApp);

// getAuth() depende de IndexedDB/localStorage para persistência de sessão,
// que não existem no servidor. Os hooks e componentes só usam `auth`
// dentro de useEffect/handlers (código client-only), mas por segurança
// evitamos instanciá-lo durante o SSR.
export const auth: Auth | null = typeof window !== "undefined" ? getAuth(firebaseApp) : null;
