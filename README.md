# SportRecover — projet autonome

Ce dossier est une **vraie application web** (Vite + React + Tailwind), indépendante
de l'aperçu Claude. Elle fonctionne sur ton propre ordinateur, peut être mise en
ligne, installée comme une app sur téléphone (PWA), puis éventuellement
transformée en app native pour l'App Store et le Google Play.

## 1. Lancer le projet en local

Il te faut [Node.js](https://nodejs.org) (version 18 ou plus) installé sur ton
ordinateur. Ensuite, dans un terminal, dans ce dossier :

```bash
npm install
npm run dev
```

Ouvre l'adresse affichée (en général `http://localhost:5173`) dans ton
navigateur. L'app tourne exactement comme dans l'aperçu Claude, mais en vrai
projet que tu peux modifier, versionner (Git) et déployer.

## 2. Mettre l'app en ligne (nécessaire pour la suite)

Pour qu'elle soit installable sur téléphone et soumise aux stores, elle doit
être accessible en HTTPS sur une vraie adresse. Le plus simple et gratuit :

1. Crée un dépôt sur [GitHub](https://github.com) et pousse ce dossier dedans.
2. Va sur [Vercel](https://vercel.com) ou [Netlify](https://netlify.com),
   connecte ton compte GitHub, importe le dépôt.
3. Build command : `npm run build` — Output directory : `dist`.
4. En quelques minutes tu obtiens une URL du type `sportrecover.vercel.app`.

## 3. Installer l'app comme une PWA (déjà possible dès maintenant)

Une fois en ligne en HTTPS :

- **Android (Chrome)** : ouvre l'URL, un bandeau "Ajouter à l'écran d'accueil"
  apparaît (ou menu ⋮ > Installer l'application). L'app s'installe avec
  icône, plein écran, et fonctionne hors-ligne grâce au service worker généré
  automatiquement par `vite-plugin-pwa`.
- **iOS (Safari)** : ouvre l'URL, bouton Partager > "Sur l'écran d'accueil".

⚠️ Une PWA installée ainsi **n'apparaît pas dans l'App Store / Google Play** —
elle s'installe directement depuis le navigateur. C'est gratuit, rapide, et
suffisant si ton objectif est juste que les gens puissent l'utiliser comme une
app. Si tu veux vraiment être listé sur les stores, va à l'étape 4.

## 4. Passer aux vrais stores (Capacitor)

[Capacitor](https://capacitorjs.com) enveloppe ce même code web dans un vrai
projet iOS (Xcode) et Android (Android Studio), publiable sur les stores.

```bash
npm install @capacitor/core @capacitor/cli
npx cap init SportRecover com.tonnom.sportrecover
npm run build
npx cap add ios
npx cap add android
npx cap sync
```

Ensuite :
- **iOS** : `npx cap open ios` ouvre Xcode. Il te faut un Mac + un compte
  développeur Apple (99$/an) pour publier.
- **Android** : `npx cap open android` ouvre Android Studio. Compte développeur
  Google Play : 25$ (paiement unique).

Ce que Capacitor ajoute que la version web seule n'a pas :
- de vraies notifications push (`@capacitor/push-notifications` + Firebase
  Cloud Messaging pour Android / APNs pour iOS — nécessite un serveur pour
  déclencher les envois),
- accès natif à l'appareil (haptique, calendrier, etc. si besoin plus tard).

## 5. Sécurité — ce qui a été fait, et ce qu'il reste à faire

- Les mots de passe sont désormais **hachés (SHA-256 salé)** avant d'être
  stockés — jamais en clair.
- **Mais** tout reste stocké uniquement sur l'appareil de l'utilisateur
  (`localStorage`, pas de serveur). Ça veut dire :
  - pas de compte multi-appareils (se connecter depuis un autre téléphone ne
    retrouvera pas les données),
  - si l'utilisateur efface les données de son navigateur, tout est perdu,
  - ce n'est pas le niveau de sécurité attendu pour une vraie app avec de
    vrais utilisateurs, encore moins avec des données de santé.
- **Pour une vraie mise en production**, il faut un backend : une API (Node/
  Express, Supabase, Firebase...) avec une vraie base de données, un hachage
  de mot de passe côté serveur (bcrypt/argon2), et des tokens de session
  (JWT). C'est un chantier à part, souvent le plus gros du projet.

## 6. Ce que ce projet ne fait PAS encore (à prévoir)

- Backend / base de données / synchronisation multi-appareils
- Vraies notifications push programmées
- Récupération de mot de passe oublié (email de réinitialisation)
- Tests automatisés
- Mode hors-ligne avancé (le service worker met juste l'app en cache)

## 7. Structure du projet

```
sportrecover-app/
  index.html          point d'entrée HTML (balises PWA/iOS incluses)
  src/
    main.jsx           bootstrap React
    App.jsx             toute l'application (logique + interface)
    index.css           Tailwind
  public/
    manifest.json        pour Android / PWA
    icons/                icônes (192, 512, maskable, apple-touch-icon)
  vite.config.js         config Vite + génération du service worker PWA
  tailwind.config.js
```

Tout le code métier (calcul de récupération, nutrition, planning, blessures...)
est dans `src/App.jsx`, identique à la version testée dans Claude.
