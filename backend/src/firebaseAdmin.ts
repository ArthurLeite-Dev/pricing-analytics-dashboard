import path from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Resolvido em relação ao diretório de onde o processo é iniciado
// (normalmente a pasta /backend, ao rodar `npm run dev` de dentro dela).
const credPath = path.resolve(
  process.cwd(),
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "../scraper/serviceAccountKey.json",
);

if (!getApps().length) {
  initializeApp({
    credential: cert(credPath),
  });
}

export const db = getFirestore();