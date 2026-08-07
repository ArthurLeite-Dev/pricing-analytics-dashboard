import path from "node:path";
import admin from "firebase-admin";

// Resolvido em relação ao diretório de onde o processo é iniciado
// (normalmente a pasta /backend, ao rodar `npm run dev` de dentro dela).
const credPath = path.resolve(
  process.cwd(),
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "../scraper/serviceAccountKey.json",
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(credPath),
  });
}

export const db = admin.firestore();
export default admin;
