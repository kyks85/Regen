import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Configuration Vite pour REGEN.
// Le service worker (public/sw.js) et le manifest (public/manifest.json)
// sont gérés manuellement — PAS de plugin PWA ici. Un plugin PWA génère et
// enregistre automatiquement SON PROPRE service worker (Workbox), qui
// écraserait silencieusement notre sw.js et empêcherait les notifications
// push de s'afficher (elles seraient bien envoyées, mais jamais affichées).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
