import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Empacotamento Android (Capacitor).
 *
 * `webDir` é a saída do build SPA (`npm run build:cap`), que gera
 * `dist-cap/client/index.html` + assets estáticos. O build web/Vercel não é
 * afetado: ele continua usando o Nitro (preset vercel) e `dist/`.
 */
const config: CapacitorConfig = {
  appId: "com.guilhermelramos.reta",
  appName: "Reta",
  webDir: "dist-cap/client",
  android: {
    // https://localhost no WebView: origem segura, coerente com o app web.
    androidScheme: "https",
  },
  plugins: {
    // Chamadas nativas à xAI (sem CORS e sem servidor) no APK.
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
