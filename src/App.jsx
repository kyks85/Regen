import React, { useState, useEffect, useMemo, useContext, createContext } from "react";
import {
  Activity, Home, Utensils, HeartPulse, CalendarDays, User, LogOut,
  ChevronLeft, ChevronRight, Droplet, Moon, Snowflake, Flame, ShoppingBag,
  AlertTriangle, Check, X, Plus, Trash2, Zap, Eye, EyeOff,
  Sparkles, Clock, TrendingUp, ChevronDown, Pencil, Flag, Coffee, Bell, Leaf, Stethoscope, ChevronRight as ChevronRightIcon, Globe, Lock, Crown, Infinity as InfinityIcon, Cloud, Zap as ZapIcon
} from "lucide-react";

/* ============================================================
   i18n — Français / English / Español / Português
   ============================================================ */
const LANGS = ["fr", "en", "es", "pt"];
const LANG_META = {
  fr: { flag: "🇫🇷", label: "Français" },
  en: { flag: "🇬🇧", label: "English" },
  es: { flag: "🇪🇸", label: "Español" },
  pt: { flag: "🇵🇹", label: "Português" },
};
function tr(lang, d) { return d[lang] || d.fr; }
const LangContext = createContext({ lang: "fr", setLang: () => {} });
const useLang = () => useContext(LangContext);

/* ============================================================
   REGEN Pro — statut d'abonnement, essai gratuit, renouvellement
   automatique simulé, annulation, historique de paiements.
   ============================================================ */
const TRIAL_DAYS = 7;
const FREE_EXCEPTIONS_PER_MONTH = 3;
const FREE_SPORTS_MAX = 1;
const FREE_SESSIONS_PER_DAY = 1;
const CYCLE_DAYS = { monthly: 30, yearly: 365 };
const CYCLE_PRICE = { monthly: 5.99, yearly: 39.99 };
const defaultPro = () => ({ status: "free", trialStart: null, cycle: null, subscribedAt: null, nextBillingDate: null, cancelled: false, history: [] });

// Calcule l'état "à jour" d'un abonnement : si la date d'un renouvellement
// est dépassée, simule le prélèvement automatique (ajoute une ligne à
// l'historique et avance la prochaine échéance), ou bien fait expirer
// l'abonnement si l'utilisateur avait annulé. Pure fonction — l'appelant
// décide de persister le résultat si `changed` est vrai.
function resolvePro(pro) {
  if (!pro || pro.status === "free") return { pro: pro || defaultPro(), changed: false };
  let p = { ...pro }; let history = [...(p.history || [])]; let changed = false;
  const cycle = p.cycle || "monthly";

  if (p.status === "trial" && p.trialStart) {
    const trialEnd = new Date(p.trialStart).getTime() + TRIAL_DAYS * 86400000;
    if (Date.now() >= trialEnd) {
      if (p.cancelled) { p = defaultPro(); changed = true; }
      else {
        history.push({ date: new Date(trialEnd).toISOString(), amount: CYCLE_PRICE[cycle], label: "REGEN Pro" });
        p = { ...p, status: "pro", subscribedAt: new Date(trialEnd).toISOString(), nextBillingDate: new Date(trialEnd + CYCLE_DAYS[cycle] * 86400000).toISOString(), history };
        changed = true;
      }
    }
  }
  if (p.status === "pro" && p.nextBillingDate) {
    let guard = 0;
    while (Date.now() >= new Date(p.nextBillingDate).getTime() && guard < 24) {
      guard++;
      if (p.cancelled) { p = defaultPro(); changed = true; break; }
      history.push({ date: p.nextBillingDate, amount: CYCLE_PRICE[p.cycle || "monthly"], label: "REGEN Pro" });
      const next = new Date(new Date(p.nextBillingDate).getTime() + CYCLE_DAYS[p.cycle || "monthly"] * 86400000).toISOString();
      p = { ...p, nextBillingDate: next, history };
      changed = true;
    }
  }
  return { pro: p, changed };
}
// Dérive les indicateurs d'affichage à partir d'un abonnement déjà à jour
// (toujours appelé après resolvePro côté App pour être sûr d'être à jour).
function computeProStatus(pro) {
  const p = pro || defaultPro();
  if (p.status === "pro") return { isPro: true, isTrial: false, trialDaysLeft: 0, cycle: p.cycle, cancelled: p.cancelled, renewalDate: p.nextBillingDate, subscribedAt: p.subscribedAt, history: p.history || [] };
  if (p.status === "trial" && p.trialStart) {
    const trialEnd = new Date(p.trialStart).getTime() + TRIAL_DAYS * 86400000;
    const elapsed = (Date.now() - new Date(p.trialStart).getTime()) / 86400000;
    return { isPro: true, isTrial: true, trialDaysLeft: Math.max(1, Math.ceil(TRIAL_DAYS - elapsed)), cycle: p.cycle, cancelled: p.cancelled, renewalDate: new Date(trialEnd).toISOString(), subscribedAt: null, history: p.history || [] };
  }
  return { isPro: false, isTrial: false, trialDaysLeft: 0, cycle: null, cancelled: false, renewalDate: null, subscribedAt: null, history: p.history || [] };
}
function countMonthlyExtras(exceptions) {
  const monthKey = new Date().toISOString().slice(0, 7);
  let count = 0;
  Object.entries(exceptions || {}).forEach(([date, ents]) => { if (date.startsWith(monthKey)) (ents || []).forEach((e) => { if (e.type !== "blessure") count++; }); });
  return count;
}
const ProContext = createContext({ isPro: false, isTrial: false, trialDaysLeft: 0, startTrial: () => {}, activateDemo: () => {}, setProDemo: () => {}, cancelSub: () => {}, resumeSub: () => {}, openPro: () => {} });
const usePro = () => useContext(ProContext);

// Enveloppe une carte/bloc : floute et verrouille le contenu si la
// fonctionnalité est réservée à Pro et que l'utilisateur ne l'a pas.
function ProLock({ active, children }) {
  const { openPro } = usePro();
  const { lang } = useLang();
  if (!active) return children;
  return (
    <div className="relative">
      <div style={{ filter: "blur(5px)", opacity: 0.5, pointerEvents: "none", userSelect: "none" }}>{children}</div>
      <button onClick={openPro} className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-[22px]" style={{ background: "rgba(7,14,13,0.55)" }}>
        <Lock size={18} style={{ color: C.primary }} />
        <span className="text-[11px] font-bold px-3 py-1.5 rounded-full" style={{ background: gradPrimary, color: "#052821" }}>{tr(lang, { fr: "Débloquer avec Pro", en: "Unlock with Pro", es: "Desbloquear con Pro", pt: "Desbloquear com Pro" })}</span>
      </button>
    </div>
  );
}
function ProBadge() {
  const { lang } = useLang();
  return <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: gradPrimary, color: "#052821" }}><Crown size={9} /> PRO</span>;
}



/* ============================================================
   DESIGN TOKENS
   ============================================================ */
const C = {
  bg: "#070E0D",
  mesh: "radial-gradient(ellipse 900px 650px at 8% -8%, rgba(73,227,196,0.20), transparent 58%), radial-gradient(ellipse 750px 750px at 108% 6%, rgba(124,109,255,0.17), transparent 55%), radial-gradient(ellipse 900px 550px at 45% 118%, rgba(255,111,165,0.12), transparent 55%), #070E0D",
  glass: "rgba(24,50,45,0.50)", glassStrong: "rgba(24,50,45,0.68)", glassSoft: "rgba(255,255,255,0.045)",
  glassBorder: "rgba(255,255,255,0.09)", glassHighlight: "rgba(255,255,255,0.07)",
  bgElevated: "rgba(255,255,255,0.045)", surface: "rgba(24,50,45,0.55)", surfaceAlt: "rgba(27,59,50,0.6)",
  border: "#20463B", borderSoft: "#193830",
  primary: "#49E3C4", primaryAlt: "#3DA9FF", primaryDim: "#2E8C77", primarySoft: "rgba(73,227,196,0.16)",
  warn: "#FF9366", warnSoft: "rgba(255,147,102,0.16)",
  danger: "#FF6161", dangerSoft: "rgba(255,97,97,0.14)",
  loisir: "#B98CFF", loisirSoft: "rgba(185,140,255,0.16)",
  reposActif: "#3D8A78", reposActifSoft: "rgba(61,138,120,0.22)",
  blessure: "#E27FA0", blessureSoft: "rgba(226,127,160,0.16)",
  rdv: "#6BA8FF", rdvSoft: "rgba(107,168,255,0.16)",
  text: "#EAF4F0", textMuted: "#8FAAA2", textFaint: "#547066",
};
const gradPrimary = `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryAlt} 100%)`;
const APP_LOGO = "data:image/png;base64,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";
const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=IBM+Plex+Mono:wght@500;600&display=swap');`;
const fontDisplay = { fontFamily: "'Inter', sans-serif", letterSpacing: "-0.02em" };
const fontBody = { fontFamily: "'Inter', sans-serif" };
const fontMono = { fontFamily: "'IBM Plex Mono', monospace" };

/* ============================================================
   DATA — sports, zones, équipement (clés neutres + libellés traduits)
   ============================================================ */
const SPORTS = {
  football: { icon: "⚽", fr: "Football", en: "Football", es: "Fútbol", pt: "Futebol", muscles: ["ischios", "quads", "mollets", "adducteurs", "chevilles"] },
  rugby: { icon: "🏉", fr: "Rugby", en: "Rugby", es: "Rugby", pt: "Rugby", muscles: ["ischios", "trapezes", "cervicales", "quads", "epaules"] },
  basket: { icon: "🏀", fr: "Basketball", en: "Basketball", es: "Baloncesto", pt: "Basquete", muscles: ["genoux", "chevilles", "mollets", "rotateurs_epaule"] },
  handball: { icon: "🤾", fr: "Handball", en: "Handball", es: "Balonmano", pt: "Handebol", muscles: ["rotateurs_epaule", "chevilles", "adducteurs", "poignet"] },
  volley: { icon: "🏐", fr: "Volleyball", en: "Volleyball", es: "Voleibol", pt: "Vôlei", muscles: ["rotateurs_epaule", "genoux", "mollets", "poignet"] },
  boxe: { icon: "🥊", fr: "Boxe", en: "Boxing", es: "Boxeo", pt: "Boxe", muscles: ["epaules", "trapezes", "coude", "cou", "lombaires"] },
  mma: { icon: "🤼", fr: "MMA / Grappling", en: "MMA / Grappling", es: "MMA / Grappling", pt: "MMA / Grappling", muscles: ["hanches", "trapezes", "coude", "cervicales", "genoux"] },
  tennis: { icon: "🎾", fr: "Tennis / Padel", en: "Tennis / Padel", es: "Tenis / Pádel", pt: "Tênis / Padel", muscles: ["rotateurs_epaule", "coude", "poignet", "lombaires"] },
  running: { icon: "🏃", fr: "Course à pied", en: "Running", es: "Running", pt: "Corrida", muscles: ["mollets", "ischios", "fascia_plantaire", "achille", "genoux"] },
  cyclisme: { icon: "🚴", fr: "Cyclisme", en: "Cycling", es: "Ciclismo", pt: "Ciclismo", muscles: ["quads", "lombaires", "cervicales", "genoux"] },
  natation: { icon: "🏊", fr: "Natation", en: "Swimming", es: "Natación", pt: "Natação", muscles: ["rotateurs_epaule", "dorsaux", "cervicales"] },
  muscu: { icon: "🏋️", fr: "Musculation", en: "Weight training", es: "Musculación", pt: "Musculação", muscles: ["dorsaux", "epaules", "quads", "lombaires", "poignet"] },
  autre: { icon: "🏅", fr: "Autre sport", en: "Other sport", es: "Otro deporte", pt: "Outro esporte", muscles: ["corps_entier"] },
};
const sportLabel = (k, lang) => (SPORTS[k] || SPORTS.autre)[lang] || (SPORTS[k] || SPORTS.autre).fr;
const sportIcon = (k) => (SPORTS[k] || SPORTS.autre).icon;
const SPORT_CATEGORY = { football: "team", rugby: "team", basket: "team", handball: "team", volley: "team", tennis: "racquet", boxe: "combat", mma: "combat", muscu: "combat", running: "endurance", cyclisme: "endurance", natation: "endurance", autre: "team" };

const NIVEAUX = [
  { key: "debutant", fr: "Débutant", en: "Beginner", es: "Principiante", pt: "Iniciante" },
  { key: "intermediaire", fr: "Intermédiaire", en: "Intermediate", es: "Intermedio", pt: "Intermediário" },
  { key: "avance", fr: "Avancé", en: "Advanced", es: "Avanzado", pt: "Avançado" },
  { key: "competition", fr: "Compétition", en: "Competitive", es: "Competición", pt: "Competição" },
];
const NIVEAU_MULT = { debutant: 1.15, intermediaire: 1, avance: 0.92, competition: 0.85 };
const niveauLabel = (k, lang) => tr(lang, NIVEAUX.find((n) => n.key === k) || NIVEAUX[1]);

const SEXES = [
  { key: "homme", fr: "Homme", en: "Male", es: "Hombre", pt: "Masculino" },
  { key: "femme", fr: "Femme", en: "Female", es: "Mujer", pt: "Feminino" },
  { key: "autre", fr: "Autre", en: "Other", es: "Otro", pt: "Outro" },
];

const EQUIPEMENTS = [
  { key: "foam_roller", fr: "Rouleau de massage (foam roller)", en: "Foam roller", es: "Rodillo de espuma (foam roller)", pt: "Rolo de espuma (foam roller)" },
  { key: "massage_gun", fr: "Pistolet de massage", en: "Massage gun", es: "Pistola de masaje", pt: "Pistola de massagem" },
  { key: "massage_ball", fr: "Balle de massage", en: "Massage ball", es: "Pelota de masaje", pt: "Bola de massagem" },
  { key: "elastic_bands", fr: "Bandes élastiques", en: "Resistance bands", es: "Bandas elásticas", pt: "Faixas elásticas" },
  { key: "heat_balm", fr: "Baume / crème chauffante", en: "Warming balm / cream", es: "Bálsamo / crema de calor", pt: "Bálsamo / creme térmico" },
  { key: "soothing_balm", fr: "Baume / crème apaisante (arnica, menthol...)", en: "Soothing balm / cream (arnica, menthol...)", es: "Bálsamo / crema calmante (árnica, mentol...)", pt: "Bálsamo / creme calmante (arnica, mentol...)" },
  { key: "ice_pack", fr: "Glace / pack de froid", en: "Ice / cold pack", es: "Hielo / bolsa fría", pt: "Gelo / bolsa térmica fria" },
  { key: "cold_bath", fr: "Bain froid ou douche froide", en: "Cold bath or cold shower", es: "Baño o ducha fría", pt: "Banho ou ducha fria" },
  { key: "sauna", fr: "Sauna / hammam", en: "Sauna / steam room", es: "Sauna / baño de vapor", pt: "Sauna / banho a vapor" },
  { key: "mat", fr: "Tapis de sol", en: "Floor mat", es: "Colchoneta", pt: "Tapete de solo" },
  { key: "none", fr: "Aucun matériel particulier", en: "No specific equipment", es: "Sin equipo específico", pt: "Nenhum equipamento específico" },
];
const equipLabel = (key, lang) => tr(lang, EQUIPEMENTS.find((e) => e.key === key) || {});

const PRATICIENS = [
  { key: "medecin_generaliste", fr: "Médecin généraliste", en: "General practitioner", es: "Médico general", pt: "Clínico geral" },
  { key: "medecin_sport", fr: "Médecin du sport", en: "Sports physician", es: "Médico deportivo", pt: "Médico do esporte" },
  { key: "kine", fr: "Kinésithérapeute", en: "Physiotherapist", es: "Fisioterapeuta", pt: "Fisioterapeuta" },
  { key: "osteo", fr: "Ostéopathe", en: "Osteopath", es: "Osteópata", pt: "Osteopata" },
  { key: "podologue", fr: "Podologue", en: "Podiatrist", es: "Podólogo", pt: "Podólogo" },
  { key: "nutritionniste", fr: "Nutritionniste", en: "Nutritionist", es: "Nutricionista", pt: "Nutricionista" },
  { key: "autre_praticien", fr: "Autre", en: "Other", es: "Otro", pt: "Outro" },
];
const praticienLabel = (key, lang) => tr(lang, PRATICIENS.find((p) => p.key === key) || PRATICIENS[2]);

const MUSCU_ZONES = {
  jambes: { icon: "🦵", fr: "Jambes", en: "Legs", es: "Piernas", pt: "Pernas", muscles: ["quads", "ischios", "mollets"] },
  dos: { icon: "🔙", fr: "Dos", en: "Back", es: "Espalda", pt: "Costas", muscles: ["dorsaux", "lombaires"] },
  pecs: { icon: "🎯", fr: "Pectoraux", en: "Chest", es: "Pecho", pt: "Peito", muscles: ["pectoraux"] },
  bras: { icon: "💪", fr: "Bras", en: "Arms", es: "Brazos", pt: "Braços", muscles: ["avant_bras", "coude"] },
  epaules: { icon: "🤸", fr: "Épaules", en: "Shoulders", es: "Hombros", pt: "Ombros", muscles: ["epaules", "rotateurs_epaule"] },
  abdos: { icon: "🔥", fr: "Abdos / Gainage", en: "Abs / Core", es: "Abdomen / Core", pt: "Abdômen / Core", muscles: ["lombaires"] },
  fullbody: { icon: "⚡", fr: "Full body", en: "Full body", es: "Cuerpo completo", pt: "Corpo inteiro", muscles: ["dorsaux", "epaules", "quads", "lombaires", "poignet"] },
};
const zoneLabel = (key, lang) => tr(lang, MUSCU_ZONES[key] || {});

const BODY_PARTS = [
  { key: "genou", fr: "Genou", en: "Knee", es: "Rodilla", pt: "Joelho" },
  { key: "cheville", fr: "Cheville", en: "Ankle", es: "Tobillo", pt: "Tornozelo" },
  { key: "epaule", fr: "Épaule", en: "Shoulder", es: "Hombro", pt: "Ombro" },
  { key: "coude", fr: "Coude", en: "Elbow", es: "Codo", pt: "Cotovelo" },
  { key: "poignet", fr: "Poignet", en: "Wrist", es: "Muñeca", pt: "Punho" },
  { key: "dos", fr: "Dos / Lombaires", en: "Back / Lower back", es: "Espalda / Lumbares", pt: "Costas / Lombar" },
  { key: "cervicales", fr: "Cervicales / Nuque", en: "Neck", es: "Cervicales / Cuello", pt: "Cervical / Pescoço" },
  { key: "cuisse", fr: "Cuisse", en: "Thigh", es: "Muslo", pt: "Coxa" },
  { key: "mollet", fr: "Mollet", en: "Calf", es: "Pantorrilla", pt: "Panturrilha" },
  { key: "pied", fr: "Pied / Voûte plantaire", en: "Foot / Arch", es: "Pie / Arco plantar", pt: "Pé / Arco plantar" },
  { key: "hanche", fr: "Hanche", en: "Hip", es: "Cadera", pt: "Quadril" },
  { key: "tete", fr: "Tête (choc)", en: "Head (impact)", es: "Cabeza (golpe)", pt: "Cabeça (impacto)" },
];
const bodyPartLabel = (key, lang) => tr(lang, BODY_PARTS.find((b) => b.key === key) || {});

const SYMPTOMS = [
  { key: "aigu", fr: "Douleur aiguë récente (< 48h)", en: "Recent acute pain (< 48h)", es: "Dolor agudo reciente (< 48h)", pt: "Dor aguda recente (< 48h)" },
  { key: "chronique", fr: "Douleur chronique (> 2 semaines)", en: "Chronic pain (> 2 weeks)", es: "Dolor crónico (> 2 semanas)", pt: "Dor crônica (> 2 semanas)" },
  { key: "raideur", fr: "Raideur / manque de mobilité", en: "Stiffness / limited mobility", es: "Rigidez / falta de movilidad", pt: "Rigidez / falta de mobilidade" },
  { key: "gonflement", fr: "Gonflement / inflammation visible", en: "Visible swelling / inflammation", es: "Hinchazón / inflamación visible", pt: "Inchaço / inflamação visível" },
  { key: "instabilite", fr: "Sensation d'instabilité / lâchage", en: "Feeling of instability / giving way", es: "Sensación de inestabilidad", pt: "Sensação de instabilidade" },
  { key: "fourmillements", fr: "Fourmillements / perte de sensation", en: "Tingling / loss of sensation", es: "Hormigueo / pérdida de sensibilidad", pt: "Formigamento / perda de sensibilidade" },
  { key: "choc", fr: "Douleur après un choc direct", en: "Pain after a direct impact", es: "Dolor tras un golpe directo", pt: "Dor após impacto direto" },
];
const symptomLabel = (key, lang) => tr(lang, SYMPTOMS.find((s) => s.key === key) || {});

const DAYS = {
  fr: ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  es: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"],
  pt: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"],
};
const MONTHS = {
  fr: ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  es: ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"],
  pt: ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"],
};
const LOCALES = { fr: "fr-FR", en: "en-US", es: "es-ES", pt: "pt-PT" };
const fmtDate = (iso, lang, opts) => new Date(iso).toLocaleDateString(LOCALES[lang], opts);

const EVENT_LABELS_DATA = {
  entrainement: { fr: "Entraînement", en: "Training", es: "Entrenamiento", pt: "Treino" },
  match: { fr: "Match / Combat", en: "Match / Fight", es: "Partido / Combate", pt: "Jogo / Luta" },
  loisir: { fr: "Session loisir", en: "Casual session", es: "Sesión libre", pt: "Sessão livre" },
  blessure: { fr: "Blessure (repos imposé)", en: "Injury (forced rest)", es: "Lesión (descanso forzado)", pt: "Lesão (descanso forçado)" },
  rdv: { fr: "RDV médical", en: "Medical appointment", es: "Cita médica", pt: "Consulta médica" },
};
const eventLabel = (type, lang) => tr(lang, EVENT_LABELS_DATA[type] || EVENT_LABELS_DATA.entrainement);
const EVENT_ICONS = { entrainement: Activity, match: Flag, loisir: Coffee, blessure: HeartPulse, rdv: Stethoscope };
const SPORT_TYPES = ["entrainement", "match", "loisir"];

/* ============================================================
   ÂGE — calculé depuis la date de naissance
   ============================================================ */
function computeAge(dateNaissance) {
  if (!dateNaissance) return 25;
  const today = new Date(); const bd = new Date(dateNaissance);
  let age = today.getFullYear() - bd.getFullYear();
  const m = today.getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;
  return age;
}

/* ============================================================
   ÉTIREMENTS — clés neutres, texte traduit
   ============================================================ */
const STRETCH_DB = {
  ischios: { fr: { label: "Ischio-jambiers", instr: "Jambe tendue posée sur un support à hauteur de hanche, buste penché en avant, dos droit, jusqu'au tirage à l'arrière de la cuisse.", duree: "30-45 sec x2 / jambe" }, en: { label: "Hamstrings", instr: "Straight leg resting on a hip-height support, lean forward with a flat back until you feel a stretch at the back of the thigh.", duree: "30-45 sec x2 / leg" }, es: { label: "Isquiotibiales", instr: "Pierna estirada apoyada a la altura de la cadera, inclina el torso hacia adelante con la espalda recta hasta sentir el tirón en la parte posterior del muslo.", duree: "30-45 seg x2 / pierna" }, pt: { label: "Isquiotibiais", instr: "Perna esticada apoiada na altura do quadril, incline o tronco à frente com as costas retas até sentir o alongamento atrás da coxa.", duree: "30-45 seg x2 / perna" } },
  quads: { fr: { label: "Quadriceps", instr: "Debout, attrape ta cheville derrière toi et rapproche le talon de la fesse, genoux alignés.", duree: "30 sec x2 / jambe" }, en: { label: "Quadriceps", instr: "Standing, grab your ankle behind you and bring your heel toward your glute, knees aligned.", duree: "30 sec x2 / leg" }, es: { label: "Cuádriceps", instr: "De pie, agarra tu tobillo detrás de ti y acerca el talón al glúteo, rodillas alineadas.", duree: "30 seg x2 / pierna" }, pt: { label: "Quadríceps", instr: "Em pé, segure o tornozelo atrás de você e aproxime o calcanhar do glúteo, joelhos alinhados.", duree: "30 seg x2 / perna" } },
  mollets: { fr: { label: "Mollets", instr: "Face à un mur, une jambe reculée tendue, talon au sol, penche-toi vers le mur.", duree: "30 sec x2 / jambe" }, en: { label: "Calves", instr: "Facing a wall, one leg back and straight, heel on the ground, lean toward the wall.", duree: "30 sec x2 / leg" }, es: { label: "Pantorrillas", instr: "Frente a una pared, una pierna atrás y estirada, talón en el suelo, inclínate hacia la pared.", duree: "30 seg x2 / pierna" }, pt: { label: "Panturrilhas", instr: "De frente para uma parede, uma perna atrás esticada, calcanhar no chão, incline-se em direção à parede.", duree: "30 seg x2 / perna" } },
  adducteurs: { fr: { label: "Adducteurs", instr: "Assis, plantes de pieds jointes, genoux vers le sol, pousse doucement avec les coudes.", duree: "40 sec" }, en: { label: "Adductors", instr: "Seated, soles of the feet together, knees toward the ground, gently push down with your elbows.", duree: "40 sec" }, es: { label: "Aductores", instr: "Sentado, plantas de los pies juntas, rodillas hacia el suelo, empuja suavemente con los codos.", duree: "40 seg" }, pt: { label: "Adutores", instr: "Sentado, solas dos pés juntas, joelhos em direção ao chão, empurre suavemente com os cotovelos.", duree: "40 seg" } },
  epaules: { fr: { label: "Épaules", instr: "Bras tendu devant la poitrine, ramène-le avec l'autre bras jusqu'au tirage à l'arrière de l'épaule.", duree: "30 sec x2 / bras" }, en: { label: "Shoulders", instr: "Arm straight across your chest, pull it in with the other arm until you feel a stretch at the back of the shoulder.", duree: "30 sec x2 / arm" }, es: { label: "Hombros", instr: "Brazo estirado frente al pecho, tíralo con el otro brazo hasta sentir el tirón en la parte posterior del hombro.", duree: "30 seg x2 / brazo" }, pt: { label: "Ombros", instr: "Braço esticado à frente do peito, puxe-o com o outro braço até sentir o alongamento atrás do ombro.", duree: "30 seg x2 / braço" } },
  rotateurs_epaule: { fr: { label: "Rotateurs de l'épaule", instr: "Coude au corps à 90°, avec ou sans élastique, rotation externe lente et contrôlée sans à-coup — cible la coiffe des rotateurs.", duree: "15 reps x2 / bras" }, en: { label: "Shoulder rotator cuff", instr: "Elbow at your side bent 90°, with or without a band, slow controlled external rotation without jerking — targets the rotator cuff.", duree: "15 reps x2 / arm" }, es: { label: "Rotadores del hombro", instr: "Codo pegado al cuerpo a 90°, con o sin banda elástica, rotación externa lenta y controlada — trabaja el manguito rotador.", duree: "15 reps x2 / brazo" }, pt: { label: "Rotadores do ombro", instr: "Cotovelo junto ao corpo a 90°, com ou sem elástico, rotação externa lenta e controlada — trabalha o manguito rotador.", duree: "15 reps x2 / braço" } },
  trapezes: { fr: { label: "Trapèzes", instr: "Incline doucement la tête d'un côté, main du même côté sur la tête pour accentuer légèrement.", duree: "20-30 sec / côté" }, en: { label: "Traps", instr: "Gently tilt your head to one side, hand on the same side on your head to lightly deepen the stretch.", duree: "20-30 sec / side" }, es: { label: "Trapecios", instr: "Inclina suavemente la cabeza hacia un lado, mano del mismo lado sobre la cabeza para acentuar ligeramente.", duree: "20-30 seg / lado" }, pt: { label: "Trapézios", instr: "Incline suavemente a cabeça para um lado, mão do mesmo lado sobre a cabeça para acentuar levemente.", duree: "20-30 seg / lado" } },
  avant_bras: { fr: { label: "Avant-bras", instr: "Bras tendu devant toi, poignet fléchi puis étendu, tire les doigts avec l'autre main.", duree: "20 sec x2 / position" }, en: { label: "Forearms", instr: "Arm out in front of you, wrist flexed then extended, pull the fingers back with the other hand.", duree: "20 sec x2 / position" }, es: { label: "Antebrazos", instr: "Brazo estirado frente a ti, muñeca flexionada y luego extendida, tira de los dedos con la otra mano.", duree: "20 seg x2 / posición" }, pt: { label: "Antebraços", instr: "Braço esticado à frente, punho flexionado e depois estendido, puxe os dedos com a outra mão.", duree: "20 seg x2 / posição" } },
  cou: { fr: { label: "Cou", instr: "Rotations lentes et inclinaisons douces de la tête, sans forcer.", duree: "1 min" }, en: { label: "Neck", instr: "Slow rotations and gentle head tilts, without forcing.", duree: "1 min" }, es: { label: "Cuello", instr: "Rotaciones lentas e inclinaciones suaves de la cabeza, sin forzar.", duree: "1 min" }, pt: { label: "Pescoço", instr: "Rotações lentas e inclinações suaves da cabeça, sem forçar.", duree: "1 min" } },
  poignet: { fr: { label: "Poignet", instr: "Bras tendu, poignet fléchi puis étendu, tire doucement les doigts avec l'autre main.", duree: "20 sec x2 / position" }, en: { label: "Wrist", instr: "Arm straight, wrist flexed then extended, gently pull the fingers with the other hand.", duree: "20 sec x2 / position" }, es: { label: "Muñeca", instr: "Brazo estirado, muñeca flexionada y luego extendida, tira suavemente de los dedos con la otra mano.", duree: "20 seg x2 / posición" }, pt: { label: "Punho", instr: "Braço esticado, punho flexionado e depois estendido, puxe suavemente os dedos com a outra mão.", duree: "20 seg x2 / posição" } },
  coude: { fr: { label: "Coude (épicondyle)", instr: "Bras tendu, poignet fléchi paume vers le bas, tire doucement la main vers le bas pour étirer l'épicondyle latéral — clé pour prévenir le tennis elbow.", duree: "20 sec x2 / bras" }, en: { label: "Elbow (epicondyle)", instr: "Arm straight, wrist flexed palm down, gently pull the hand down to stretch the lateral epicondyle — key for preventing tennis elbow.", duree: "20 sec x2 / arm" }, es: { label: "Codo (epicóndilo)", instr: "Brazo estirado, muñeca flexionada con la palma hacia abajo, tira suavemente de la mano hacia abajo para estirar el epicóndilo lateral.", duree: "20 seg x2 / brazo" }, pt: { label: "Cotovelo (epicôndilo)", instr: "Braço esticado, punho flexionado com a palma para baixo, puxe suavemente a mão para baixo para alongar o epicôndilo lateral.", duree: "20 seg x2 / braço" } },
  lombaires: { fr: { label: "Lombaires", instr: "Allongé sur le dos, ramène les deux genoux vers la poitrine, arrondis le bas du dos.", duree: "40 sec" }, en: { label: "Lower back", instr: "Lying on your back, bring both knees to your chest, rounding the lower back.", duree: "40 sec" }, es: { label: "Lumbares", instr: "Tumbado boca arriba, lleva ambas rodillas al pecho, redondeando la zona lumbar.", duree: "40 seg" }, pt: { label: "Lombar", instr: "Deitado de costas, leve os dois joelhos ao peito, arredondando a lombar.", duree: "40 seg" } },
  cervicales: { fr: { label: "Cervicales", instr: "Menton vers la poitrine puis rotations lentes, épaules basses et relâchées.", duree: "1 min" }, en: { label: "Neck (cervical)", instr: "Chin to chest then slow rotations, shoulders low and relaxed.", duree: "1 min" }, es: { label: "Cervicales", instr: "Barbilla hacia el pecho y luego rotaciones lentas, hombros bajos y relajados.", duree: "1 min" }, pt: { label: "Cervical", instr: "Queixo em direção ao peito e depois rotações lentas, ombros baixos e relaxados.", duree: "1 min" } },
  dorsaux: { fr: { label: "Dorsaux", instr: "Bras tendus devant toi, dos rond, recule les hanches (posture de l'enfant).", duree: "45 sec" }, en: { label: "Lats", instr: "Arms extended in front of you, rounded back, sit hips back (child's pose).", duree: "45 sec" }, es: { label: "Dorsales", instr: "Brazos extendidos al frente, espalda redondeada, lleva las caderas hacia atrás (postura del niño).", duree: "45 seg" }, pt: { label: "Dorsais", instr: "Braços estendidos à frente, costas arredondadas, quadril para trás (postura da criança).", duree: "45 seg" } },
  genoux: { fr: { label: "Genoux (tendon rotulien)", instr: "Mobilité douce uniquement, sans charge : flexions/extensions lentes, éventuellement glace locale si tension après impact/sauts répétés.", duree: "1 min" }, en: { label: "Knees (patellar tendon)", instr: "Gentle mobility only, no load: slow flexion/extension, optionally local ice if tight after impact/repeated jumps.", duree: "1 min" }, es: { label: "Rodillas (tendón rotuliano)", instr: "Solo movilidad suave, sin carga: flexiones/extensiones lentas, hielo local si hay tensión tras impactos o saltos repetidos.", duree: "1 min" }, pt: { label: "Joelhos (tendão patelar)", instr: "Apenas mobilidade suave, sem carga: flexões/extensões lentas, gelo local se houver tensão após impactos ou saltos repetidos.", duree: "1 min" } },
  chevilles: { fr: { label: "Chevilles", instr: "Cercles lents dans les deux sens, puis flexion/extension assis.", duree: "1 min / cheville" }, en: { label: "Ankles", instr: "Slow circles both directions, then seated flexion/extension.", duree: "1 min / ankle" }, es: { label: "Tobillos", instr: "Círculos lentos en ambos sentidos, luego flexión/extensión sentado.", duree: "1 min / tobillo" }, pt: { label: "Tornozelos", instr: "Círculos lentos em ambos os sentidos, depois flexão/extensão sentado.", duree: "1 min / tornozelo" } },
  fascia_plantaire: { fr: { label: "Fascia plantaire", instr: "Fais rouler une balle sous la voûte plantaire, pression modérée, du talon aux orteils.", duree: "1-2 min / pied" }, en: { label: "Plantar fascia", instr: "Roll a ball under the arch of your foot, moderate pressure, from heel to toes.", duree: "1-2 min / foot" }, es: { label: "Fascia plantar", instr: "Haz rodar una pelota bajo el arco del pie, presión moderada, del talón a los dedos.", duree: "1-2 min / pie" }, pt: { label: "Fáscia plantar", instr: "Role uma bola sob o arco do pé, pressão moderada, do calcanhar aos dedos.", duree: "1-2 min / pé" } },
  achille: { fr: { label: "Tendon d'Achille", instr: "Fente avant, jambe arrière tendue talon au sol, léger fléchissement du genou avant pour cibler le tendon plutôt que le mollet.", duree: "30 sec x2 / jambe" }, en: { label: "Achilles tendon", instr: "Forward lunge, back leg straight heel down, slightly bend the front knee to target the tendon rather than the calf.", duree: "30 sec x2 / leg" }, es: { label: "Tendón de Aquiles", instr: "Zancada al frente, pierna trasera estirada con el talón en el suelo, flexiona ligeramente la rodilla delantera para enfocar el tendón.", duree: "30 seg x2 / pierna" }, pt: { label: "Tendão de Aquiles", instr: "Avanço à frente, perna de trás esticada com o calcanhar no chão, flexione levemente o joelho da frente para focar no tendão.", duree: "30 seg x2 / perna" } },
  hanches: { fr: { label: "Hanches", instr: "Position du pigeon ou fente basse, bassin gainé, buste légèrement penché en avant.", duree: "40 sec x2 / côté" }, en: { label: "Hips", instr: "Pigeon pose or low lunge, core engaged, torso slightly leaned forward.", duree: "40 sec x2 / side" }, es: { label: "Caderas", instr: "Postura de la paloma o zancada baja, core activado, torso ligeramente inclinado hacia adelante.", duree: "40 seg x2 / lado" }, pt: { label: "Quadril", instr: "Postura do pombo ou avanço baixo, core ativado, tronco levemente inclinado à frente.", duree: "40 seg x2 / lado" } },
  pectoraux: { fr: { label: "Pectoraux", instr: "Bras tendu contre un montant de porte à hauteur d'épaule, tourne doucement le buste à l'opposé jusqu'au tirage sur le pectoral.", duree: "30 sec x2 / côté" }, en: { label: "Chest", instr: "Arm straight against a door frame at shoulder height, gently turn your torso away until you feel a stretch across the chest.", duree: "30 sec x2 / side" }, es: { label: "Pectorales", instr: "Brazo estirado contra el marco de una puerta a la altura del hombro, gira suavemente el torso al lado opuesto hasta sentir el tirón en el pecho.", duree: "30 seg x2 / lado" }, pt: { label: "Peitoral", instr: "Braço esticado contra o batente de uma porta na altura do ombro, gire suavemente o tronco para o lado oposto até sentir o alongamento no peito.", duree: "30 seg x2 / lado" } },
  corps_entier: { fr: { label: "Corps entier", instr: "Enchaîne une routine complète : chat-vache, fente basse, torsion du buste, flexion avant debout.", duree: "5-8 min au total" }, en: { label: "Full body", instr: "Flow through a full routine: cat-cow, low lunge, torso twist, standing forward fold.", duree: "5-8 min total" }, es: { label: "Cuerpo completo", instr: "Encadena una rutina completa: gato-vaca, zancada baja, torsión de torso, flexión de pie hacia adelante.", duree: "5-8 min en total" }, pt: { label: "Corpo inteiro", instr: "Faça uma rotina completa: gato-vaca, avanço baixo, torção de tronco, flexão em pé para a frente.", duree: "5-8 min no total" } },
};

// Échauffement dynamique — réutilise les mêmes clés de muscles que STRETCH_DB
// (donc automatiquement adapté au(x) sport(s) exactement comme les étirements),
// mais avec des mouvements dynamiques adaptés à l'AVANT-séance plutôt que des
// étirements statiques (à réserver à l'après-effort).
const WARMUP_DB = {
  ischios: { fr: { instr: "Balancés de jambe tendue vers l'avant/l'arrière, amplitude progressive.", duree: "10 reps x2 / jambe" }, en: { instr: "Straight-leg swings forward/back, gradually increasing range.", duree: "10 reps x2 / leg" }, es: { instr: "Balanceos de pierna estirada adelante/atrás, amplitud progresiva.", duree: "10 reps x2 / pierna" }, pt: { instr: "Balanços de perna esticada para frente/trás, amplitude progressiva.", duree: "10 reps x2 / perna" } },
  quads: { fr: { instr: "Montées de genoux sur place, rythme progressif.", duree: "20-30 sec" }, en: { instr: "High knees on the spot, progressively faster.", duree: "20-30 sec" }, es: { instr: "Rodillas altas en el sitio, ritmo progresivo.", duree: "20-30 seg" }, pt: { instr: "Elevação de joelhos no lugar, ritmo progressivo.", duree: "20-30 seg" } },
  mollets: { fr: { instr: "Petits bonds sur la pointe des pieds, chevilles toniques.", duree: "20 reps" }, en: { instr: "Small hops on your toes, snappy ankles.", duree: "20 reps" }, es: { instr: "Pequeños saltos de puntillas, tobillos tónicos.", duree: "20 reps" }, pt: { instr: "Pequenos saltos na ponta dos pés, tornozelos ativos.", duree: "20 reps" } },
  adducteurs: { fr: { instr: "Fentes latérales dynamiques, un côté puis l'autre.", duree: "8 reps / côté" }, en: { instr: "Dynamic lateral lunges, side to side.", duree: "8 reps / side" }, es: { instr: "Zancadas laterales dinámicas, un lado y luego el otro.", duree: "8 reps / lado" }, pt: { instr: "Avanços laterais dinâmicos, um lado e depois o outro.", duree: "8 reps / lado" } },
  epaules: { fr: { instr: "Grands cercles de bras, sens avant puis arrière.", duree: "15 reps / sens" }, en: { instr: "Big arm circles, forward then backward.", duree: "15 reps / direction" }, es: { instr: "Grandes círculos de brazos, hacia adelante y luego atrás.", duree: "15 reps / sentido" }, pt: { instr: "Grandes círculos de braços, para frente e depois para trás.", duree: "15 reps / sentido" } },
  rotateurs_epaule: { fr: { instr: "Rotation externe légère avec élastique léger ou à vide, activation progressive.", duree: "15 reps x2 / bras" }, en: { instr: "Light external rotation with a light band or bodyweight, progressive activation.", duree: "15 reps x2 / arm" }, es: { instr: "Rotación externa ligera con banda suave o en vacío, activación progresiva.", duree: "15 reps x2 / brazo" }, pt: { instr: "Rotação externa leve com elástico leve ou sem carga, ativação progressiva.", duree: "15 reps x2 / braço" } },
  trapezes: { fr: { instr: "Haussements d'épaules dynamiques + rotations lentes de la nuque.", duree: "15 reps" }, en: { instr: "Dynamic shoulder shrugs + slow neck rolls.", duree: "15 reps" }, es: { instr: "Encogimientos de hombros dinámicos + rotaciones lentas de cuello.", duree: "15 reps" }, pt: { instr: "Elevações de ombros dinâmicas + rotações lentas de pescoço.", duree: "15 reps" } },
  avant_bras: { fr: { instr: "Rotations de poignets + serrages de balle légers pour activer la préhension.", duree: "20 reps" }, en: { instr: "Wrist rotations + light grip squeezes to activate your grip.", duree: "20 reps" }, es: { instr: "Rotaciones de muñeca + apretones ligeros de pelota para activar el agarre.", duree: "20 reps" }, pt: { instr: "Rotações de punho + apertos leves de bola para ativar a preensão.", duree: "20 reps" } },
  cou: { fr: { instr: "Rotations lentes et douces de la tête, sans forcer.", duree: "30 sec" }, en: { instr: "Slow, gentle head rotations, without forcing.", duree: "30 sec" }, es: { instr: "Rotaciones lentas y suaves de la cabeza, sin forzar.", duree: "30 seg" }, pt: { instr: "Rotações lentas e suaves da cabeça, sem forçar.", duree: "30 seg" } },
  poignet: { fr: { instr: "Rotations de poignets dans les deux sens, amplitude croissante.", duree: "20 reps" }, en: { instr: "Wrist rotations both ways, increasing range.", duree: "20 reps" }, es: { instr: "Rotaciones de muñeca en ambos sentidos, amplitud creciente.", duree: "20 reps" }, pt: { instr: "Rotações de punho nos dois sentidos, amplitude crescente.", duree: "20 reps" } },
  coude: { fr: { instr: "Rotations légères de l'avant-bras + extensions/flexions douces du poignet.", duree: "15 reps" }, en: { instr: "Light forearm rotations + gentle wrist flexion/extension.", duree: "15 reps" }, es: { instr: "Rotaciones ligeras del antebrazo + flexión/extensión suave de muñeca.", duree: "15 reps" }, pt: { instr: "Rotações leves do antebraço + flexão/extensão suave de punho.", duree: "15 reps" } },
  lombaires: { fr: { instr: "Chat-vache dynamique + rotations douces du buste debout.", duree: "10 reps" }, en: { instr: "Dynamic cat-cow + gentle standing torso rotations.", duree: "10 reps" }, es: { instr: "Gato-vaca dinámico + rotaciones suaves de torso de pie.", duree: "10 reps" }, pt: { instr: "Gato-vaca dinâmico + rotações suaves de tronco em pé.", duree: "10 reps" } },
  cervicales: { fr: { instr: "Rotations et inclinaisons lentes de la tête, amplitude progressive.", duree: "30 sec" }, en: { instr: "Slow head rotations and tilts, progressive range.", duree: "30 sec" }, es: { instr: "Rotaciones e inclinaciones lentas de cabeza, amplitud progresiva.", duree: "30 seg" }, pt: { instr: "Rotações e inclinações lentas de cabeça, amplitude progressiva.", duree: "30 seg" } },
  dorsaux: { fr: { instr: "Grands balancés de bras croisés devant le corps.", duree: "15 reps" }, en: { instr: "Big arm swings crossing in front of your body.", duree: "15 reps" }, es: { instr: "Grandes balanceos de brazos cruzando delante del cuerpo.", duree: "15 reps" }, pt: { instr: "Grandes balanços de braços cruzando à frente do corpo.", duree: "15 reps" } },
  genoux: { fr: { instr: "Squats au poids du corps, amplitude progressive, puis quelques balancés de jambe.", duree: "10 reps" }, en: { instr: "Bodyweight squats, progressive range, then a few leg swings.", duree: "10 reps" }, es: { instr: "Sentadillas con peso corporal, amplitud progresiva, luego balanceos de pierna.", duree: "10 reps" }, pt: { instr: "Agachamentos com peso corporal, amplitude progressiva, depois balanços de perna.", duree: "10 reps" } },
  chevilles: { fr: { instr: "Cercles de cheville dans les deux sens + petits sautillés.", duree: "20 reps" }, en: { instr: "Ankle circles both ways + small hops.", duree: "20 reps" }, es: { instr: "Círculos de tobillo en ambos sentidos + pequeños saltos.", duree: "20 reps" }, pt: { instr: "Círculos de tornozelo nos dois sentidos + pequenos saltos.", duree: "20 reps" } },
  fascia_plantaire: { fr: { instr: "Marche sur pointes puis sur talons pour réveiller la voûte plantaire.", duree: "20 pas chaque" }, en: { instr: "Walk on your toes then your heels to wake up the arch of your foot.", duree: "20 steps each" }, es: { instr: "Camina de puntillas y luego de talones para activar el arco plantar.", duree: "20 pasos cada uno" }, pt: { instr: "Caminhe na ponta dos pés e depois nos calcanhares para ativar o arco plantar.", duree: "20 passos cada" } },
  achille: { fr: { instr: "Petits bonds légers sur place, puis fentes avant dynamiques.", duree: "20 sec + 8 reps" }, en: { instr: "Small light hops on the spot, then dynamic forward lunges.", duree: "20 sec + 8 reps" }, es: { instr: "Pequeños saltos ligeros en el sitio, luego zancadas dinámicas al frente.", duree: "20 seg + 8 reps" }, pt: { instr: "Pequenos saltos leves no lugar, depois avanços dinâmicos à frente.", duree: "20 seg + 8 reps" } },
  hanches: { fr: { instr: "Balancés de jambe latéraux + cercles de hanche amples.", duree: "10 reps / côté" }, en: { instr: "Lateral leg swings + wide hip circles.", duree: "10 reps / side" }, es: { instr: "Balanceos laterales de pierna + círculos amplios de cadera.", duree: "10 reps / lado" }, pt: { instr: "Balanços laterais de perna + círculos amplos de quadril.", duree: "10 reps / lado" } },
  pectoraux: { fr: { instr: "Balancés de bras croisés + ouverture de la cage thoracique, rythme progressif.", duree: "15 reps" }, en: { instr: "Crossing arm swings + chest opener, progressively faster.", duree: "15 reps" }, es: { instr: "Balanceos de brazos cruzados + apertura torácica, ritmo progresivo.", duree: "15 reps" }, pt: { instr: "Balanços de braços cruzados + abertura torácica, ritmo progressivo.", duree: "15 reps" } },
  corps_entier: { fr: { instr: "Enchaîne 5 min : jogging léger sur place, talons-fesses, montées de genoux, jumping jacks.", duree: "5 min" }, en: { instr: "5 min flow: light jogging on the spot, butt kicks, high knees, jumping jacks.", duree: "5 min" }, es: { instr: "Encadena 5 min: trote suave en el sitio, talones al glúteo, rodillas altas, jumping jacks.", duree: "5 min" }, pt: { instr: "Sequência de 5 min: trote leve no lugar, calcanhar no glúteo, joelhos altos, polichinelos.", duree: "5 min" } },
};
function buildWarmup(muscleKeys, lang) {
  const pulseRaise = { key: "_pulse", label: tr(lang, { fr: "Mise en route générale", en: "General pulse raise", es: "Activación general", pt: "Ativação geral" }), instr: tr(lang, { fr: "3-5 min de jogging léger, corde à sauter ou vélo facile, pour élever doucement le rythme cardiaque avant les mouvements spécifiques.", en: "3-5 min of light jogging, jump rope or easy cycling, to gently raise your heart rate before sport-specific movements.", es: "3-5 min de trote suave, cuerda o bici fácil, para elevar suavemente el ritmo cardíaco antes de los movimientos específicos.", pt: "3-5 min de trote leve, corda ou bike fácil, para elevar suavemente o ritmo cardíaco antes dos movimentos específicos." }), duree: tr(lang, { fr: "3-5 min", en: "3-5 min", es: "3-5 min", pt: "3-5 min" }) };
  const moves = muscleKeys.map((k) => {
    const base = STRETCH_DB[k] || STRETCH_DB.corps_entier;
    const dyn = WARMUP_DB[k] || WARMUP_DB.corps_entier;
    return { key: k, label: (base[lang] || base.fr).label, instr: (dyn[lang] || dyn.fr).instr, duree: (dyn[lang] || dyn.fr).duree };
  });
  return [pulseRaise, ...moves];
}

/* ============================================================
   NUTRITION
   ============================================================ */
const MEALS = {
  team: {
    train: {
      pre: { fr: ["Riz basmati + filet de poulet grillé + brocolis vapeur", "Pâtes complètes + dés de dinde + sauce tomate légère", "Porridge d'avoine + banane + une cuillère de miel", "Patate douce rôtie + œufs brouillés + épinards", "Pain complet + omelette + tranche de jambon blanc"], en: ["Basmati rice + grilled chicken breast + steamed broccoli", "Whole-wheat pasta + diced turkey + light tomato sauce", "Oat porridge + banana + a spoon of honey", "Roasted sweet potato + scrambled eggs + spinach", "Wholegrain bread + omelette + a slice of ham"], es: ["Arroz basmati + pechuga de pollo a la plancha + brócoli al vapor", "Pasta integral + dados de pavo + salsa de tomate ligera", "Porridge de avena + plátano + una cucharada de miel", "Boniato asado + huevos revueltos + espinacas", "Pan integral + tortilla + una loncha de jamón"], pt: ["Arroz basmati + peito de frango grelhado + brócolis no vapor", "Massa integral + peru em cubos + molho de tomate leve", "Mingau de aveia + banana + uma colher de mel", "Batata-doce assada + ovos mexidos + espinafre", "Pão integral + omelete + uma fatia de presunto"] },
      post: { fr: ["Yaourt grec + fruits rouges + une poignée d'amandes", "Bol de riz + saumon + légumes sautés", "Smoothie protéiné banane-lait + flocons d'avoine", "Œufs + toast complet + avocat", "Fromage blanc + miel + fruits secs"], en: ["Greek yogurt + berries + a handful of almonds", "Rice bowl + salmon + sautéed vegetables", "Banana-milk protein smoothie + oats", "Eggs + wholegrain toast + avocado", "Cottage cheese + honey + dried fruit"], es: ["Yogur griego + frutos rojos + un puñado de almendras", "Bowl de arroz + salmón + verduras salteadas", "Batido de proteína de plátano y leche + copos de avena", "Huevos + tostada integral + aguacate", "Queso fresco + miel + frutos secos"], pt: ["Iogurte grego + frutas vermelhas + um punhado de amêndoas", "Bowl de arroz + salmão + legumes salteados", "Vitamina proteica de banana com leite + aveia", "Ovos + torrada integral + abacate", "Queijo cottage + mel + frutas secas"] },
    },
    match: {
      pre: { fr: ["Pâtes blanches + blanc de poulet + carottes cuites", "Riz blanc + poisson blanc vapeur + courgettes", "Semoule + dinde grillée + légumes cuits sans peau", "Pain blanc + confiture + banane", "Bol de riz + œufs + un filet d'huile d'olive"], en: ["White pasta + chicken breast + cooked carrots", "White rice + steamed white fish + zucchini", "Couscous + grilled turkey + peeled cooked vegetables", "White bread + jam + banana", "Rice bowl + eggs + a drizzle of olive oil"], es: ["Pasta blanca + pechuga de pollo + zanahorias cocidas", "Arroz blanco + pescado blanco al vapor + calabacín", "Sémola + pavo a la plancha + verduras cocidas sin piel", "Pan blanco + mermelada + plátano", "Bowl de arroz + huevos + un chorrito de aceite de oliva"], pt: ["Massa branca + peito de frango + cenouras cozidas", "Arroz branco + peixe branco no vapor + abobrinha", "Cuscuz + peru grelhado + legumes cozidos sem pele", "Pão branco + geleia + banana", "Bowl de arroz + ovos + um fio de azeite"] },
      post: { fr: ["Shake protéiné + banane + une poignée de dattes", "Riz + poulet + légumes + jus d'orange pressé", "Yaourt grec + miel + fruits rouges (anti-inflammatoires)", "Pâtes + thon + tomates cerises + huile d'olive", "Purée de patate douce + œufs + saumon fumé"], en: ["Protein shake + banana + a handful of dates", "Rice + chicken + vegetables + fresh orange juice", "Greek yogurt + honey + berries (anti-inflammatory)", "Pasta + tuna + cherry tomatoes + olive oil", "Sweet potato mash + eggs + smoked salmon"], es: ["Batido de proteína + plátano + un puñado de dátiles", "Arroz + pollo + verduras + zumo de naranja natural", "Yogur griego + miel + frutos rojos (antiinflamatorios)", "Pasta + atún + tomates cherry + aceite de oliva", "Puré de boniato + huevos + salmón ahumado"], pt: ["Shake de proteína + banana + um punhado de tâmaras", "Arroz + frango + legumes + suco de laranja natural", "Iogurte grego + mel + frutas vermelhas (anti-inflamatórias)", "Massa + atum + tomate cereja + azeite", "Purê de batata-doce + ovos + salmão defumado"] },
    },
  },
  combat: {
    train: {
      pre: { fr: ["Riz + bœuf haché maigre + brocolis", "Quinoa + poulet + courgettes rôties", "Flocons d'avoine + whey + banane", "Patate douce + thon + épinards", "Pain complet + miel + banane"], en: ["Rice + lean ground beef + broccoli", "Quinoa + chicken + roasted zucchini", "Oats + whey protein + banana", "Sweet potato + tuna + spinach", "Wholegrain bread + honey + banana"], es: ["Arroz + carne picada magra + brócoli", "Quinoa + pollo + calabacín asado", "Avena + proteína whey + plátano", "Boniato + atún + espinacas", "Pan integral + miel + plátano"], pt: ["Arroz + carne moída magra + brócolis", "Quinoa + frango + abobrinha assada", "Aveia + whey protein + banana", "Batata-doce + atum + espinafre", "Pão integral + mel + banana"] },
      post: { fr: ["Whey + banane + lait", "Steak haché maigre + riz + légumes", "Œufs + fromage blanc + fruits", "Poulet + patate douce + haricots verts", "Skyr + granola + fruits rouges"], en: ["Whey protein + banana + milk", "Lean ground steak + rice + vegetables", "Eggs + cottage cheese + fruit", "Chicken + sweet potato + green beans", "Skyr + granola + berries"], es: ["Whey + plátano + leche", "Carne magra + arroz + verduras", "Huevos + queso fresco + fruta", "Pollo + boniato + judías verdes", "Skyr + granola + frutos rojos"], pt: ["Whey + banana + leite", "Carne magra moída + arroz + legumes", "Ovos + queijo cottage + frutas", "Frango + batata-doce + vagem", "Skyr + granola + frutas vermelhas"] },
    },
    match: {
      pre: { fr: ["Riz blanc + blanc de poulet + carottes", "Pâtes + dinde + filet d'huile d'olive", "Semoule + œufs + légumes cuits", "Pain blanc + miel + banane", "Riz + poisson blanc + courgettes"], en: ["White rice + chicken breast + carrots", "Pasta + turkey + a drizzle of olive oil", "Couscous + eggs + cooked vegetables", "White bread + honey + banana", "Rice + white fish + zucchini"], es: ["Arroz blanco + pechuga de pollo + zanahorias", "Pasta + pavo + un chorrito de aceite de oliva", "Sémola + huevos + verduras cocidas", "Pan blanco + miel + plátano", "Arroz + pescado blanco + calabacín"], pt: ["Arroz branco + peito de frango + cenouras", "Massa + peru + um fio de azeite", "Cuscuz + ovos + legumes cozidos", "Pão branco + mel + banana", "Arroz + peixe branco + abobrinha"] },
      post: { fr: ["Whey + dattes + banane", "Riz + bœuf maigre + légumes + jus d'orange", "Yaourt grec + miel + fruits rouges", "Pâtes + thon + tomates cerises", "Purée de patate douce + œufs + saumon fumé"], en: ["Whey protein + dates + banana", "Rice + lean beef + vegetables + orange juice", "Greek yogurt + honey + berries", "Pasta + tuna + cherry tomatoes", "Sweet potato mash + eggs + smoked salmon"], es: ["Whey + dátiles + plátano", "Arroz + ternera magra + verduras + zumo de naranja", "Yogur griego + miel + frutos rojos", "Pasta + atún + tomates cherry", "Puré de boniato + huevos + salmón ahumado"], pt: ["Whey + tâmaras + banana", "Arroz + carne magra + legumes + suco de laranja", "Iogurte grego + mel + frutas vermelhas", "Massa + atum + tomate cereja", "Purê de batata-doce + ovos + salmão defumado"] },
    },
  },
  racquet: {
    train: {
      pre: { fr: ["Riz + blanc de poulet + compote sans sucre ajouté", "Pain complet + miel + banane", "Porridge d'avoine + fruits rouges", "Pâtes + jambon blanc + légumes vapeur", "Smoothie banane-avoine-lait"], en: ["Rice + chicken breast + unsweetened apple sauce", "Wholegrain bread + honey + banana", "Oat porridge + berries", "Pasta + ham + steamed vegetables", "Banana-oat-milk smoothie"], es: ["Arroz + pechuga de pollo + compota sin azúcar añadido", "Pan integral + miel + plátano", "Porridge de avena + frutos rojos", "Pasta + jamón + verduras al vapor", "Batido de plátano, avena y leche"], pt: ["Arroz + peito de frango + compota sem açúcar", "Pão integral + mel + banana", "Mingau de aveia + frutas vermelhas", "Massa + presunto + legumes no vapor", "Vitamina de banana, aveia e leite"] },
      post: { fr: ["Yaourt grec + granola + fruits", "Riz + poisson + légumes", "Œufs + toast complet + fruits", "Poulet + patate douce + haricots verts", "Fromage blanc + miel + amandes"], en: ["Greek yogurt + granola + fruit", "Rice + fish + vegetables", "Eggs + wholegrain toast + fruit", "Chicken + sweet potato + green beans", "Cottage cheese + honey + almonds"], es: ["Yogur griego + granola + fruta", "Arroz + pescado + verduras", "Huevos + tostada integral + fruta", "Pollo + boniato + judías verdes", "Queso fresco + miel + almendras"], pt: ["Iogurte grego + granola + fruta", "Arroz + peixe + legumes", "Ovos + torrada integral + fruta", "Frango + batata-doce + vagem", "Queijo cottage + mel + amêndoas"] },
    },
    match: {
      pre: { fr: ["Pâtes blanches + blanc de poulet + filet d'huile d'olive", "Riz blanc + dinde + carottes cuites", "Pain blanc + miel + banane", "Semoule + œufs + légumes cuits sans peau", "Compote + biscuits énergétiques"], en: ["White pasta + chicken breast + a drizzle of olive oil", "White rice + turkey + cooked carrots", "White bread + honey + banana", "Couscous + eggs + peeled cooked vegetables", "Apple sauce + energy biscuits"], es: ["Pasta blanca + pechuga de pollo + un chorrito de aceite de oliva", "Arroz blanco + pavo + zanahorias cocidas", "Pan blanco + miel + plátano", "Sémola + huevos + verduras cocidas sin piel", "Compota + galletas energéticas"], pt: ["Massa branca + peito de frango + um fio de azeite", "Arroz branco + peru + cenouras cozidas", "Pão branco + mel + banana", "Cuscuz + ovos + legumes cozidos sem pele", "Compota + biscoitos energéticos"] },
      post: { fr: ["Boisson de récupération + banane", "Riz + poulet + légumes + jus d'orange", "Yaourt grec + miel + fruits rouges", "Pâtes + thon + tomates cerises", "Purée de patate douce + œufs"], en: ["Recovery drink + banana", "Rice + chicken + vegetables + orange juice", "Greek yogurt + honey + berries", "Pasta + tuna + cherry tomatoes", "Sweet potato mash + eggs"], es: ["Bebida de recuperación + plátano", "Arroz + pollo + verduras + zumo de naranja", "Yogur griego + miel + frutos rojos", "Pasta + atún + tomates cherry", "Puré de boniato + huevos"], pt: ["Bebida de recuperação + banana", "Arroz + frango + legumes + suco de laranja", "Iogurte grego + mel + frutas vermelhas", "Massa + atum + tomate cereja", "Purê de batata-doce + ovos"] },
    },
  },
  endurance: {
    train: {
      pre: { fr: ["Porridge d'avoine + banane + miel", "Pain complet + confiture + banane", "Riz + légumes + un peu de poulet", "Pâtes complètes + légumes rôtis", "Smoothie banane-avoine-lait"], en: ["Oat porridge + banana + honey", "Wholegrain bread + jam + banana", "Rice + vegetables + a little chicken", "Whole-wheat pasta + roasted vegetables", "Banana-oat-milk smoothie"], es: ["Porridge de avena + plátano + miel", "Pan integral + mermelada + plátano", "Arroz + verduras + un poco de pollo", "Pasta integral + verduras asadas", "Batido de plátano, avena y leche"], pt: ["Mingau de aveia + banana + mel", "Pão integral + geleia + banana", "Arroz + legumes + um pouco de frango", "Massa integral + legumes assados", "Vitamina de banana, aveia e leite"] },
      post: { fr: ["Riz + poisson + légumes", "Pâtes + thon + tomates cerises", "Yaourt + granola + fruits", "Patate douce + œufs", "Smoothie protéiné + fruits"], en: ["Rice + fish + vegetables", "Pasta + tuna + cherry tomatoes", "Yogurt + granola + fruit", "Sweet potato + eggs", "Protein smoothie + fruit"], es: ["Arroz + pescado + verduras", "Pasta + atún + tomates cherry", "Yogur + granola + fruta", "Boniato + huevos", "Batido de proteína + fruta"], pt: ["Arroz + peixe + legumes", "Massa + atum + tomate cereja", "Iogurte + granola + fruta", "Batata-doce + ovos", "Vitamina proteica + fruta"] },
    },
    match: {
      pre: { fr: ["Pâtes blanches, peu de fibres", "Riz blanc + banane", "Pain blanc + miel", "Semoule + compote", "Biscuits énergétiques + banane"], en: ["White pasta, low fibre", "White rice + banana", "White bread + honey", "Couscous + apple sauce", "Energy biscuits + banana"], es: ["Pasta blanca, baja en fibra", "Arroz blanco + plátano", "Pan blanco + miel", "Sémola + compota de manzana", "Galletas energéticas + plátano"], pt: ["Massa branca, baixa em fibra", "Arroz branco + banana", "Pão branco + mel", "Cuscuz + compota de maçã", "Biscoitos energéticos + banana"] },
      post: { fr: ["Boisson de récupération + banane", "Riz + poulet + légumes + jus d'orange", "Yaourt grec + miel + fruits", "Pâtes + jambon blanc", "Compote + fromage blanc + amandes"], en: ["Recovery drink + banana", "Rice + chicken + vegetables + orange juice", "Greek yogurt + honey + fruit", "Pasta + ham", "Apple sauce + cottage cheese + almonds"], es: ["Bebida de recuperación + plátano", "Arroz + pollo + verduras + zumo de naranja", "Yogur griego + miel + fruta", "Pasta + jamón", "Compota + queso fresco + almendras"], pt: ["Bebida de recuperação + banana", "Arroz + frango + legumes + suco de laranja", "Iogurte grego + mel + fruta", "Massa + presunto", "Compota de maçã + queijo cottage + amêndoas"] },
    },
  },
};
const REST_MEALS = {
  main: { fr: ["Riz complet + poulet + légumes de saison", "Pâtes complètes + œufs + légumes rôtis", "Quinoa + poisson + brocolis", "Patate douce + poulet + haricots verts", "Riz + tofu ou légumineuses + légumes sautés"], en: ["Whole rice + chicken + seasonal vegetables", "Wholegrain pasta + eggs + roasted vegetables", "Quinoa + fish + broccoli", "Sweet potato + chicken + green beans", "Rice + tofu or legumes + sautéed vegetables"], es: ["Arroz integral + pollo + verduras de temporada", "Pasta integral + huevos + verduras asadas", "Quinoa + pescado + brócoli", "Boniato + pollo + judías verdes", "Arroz + tofu o legumbres + verduras salteadas"], pt: ["Arroz integral + frango + legumes da estação", "Massa integral + ovos + legumes assados", "Quinoa + peixe + brócolis", "Batata-doce + frango + vagem", "Arroz + tofu ou leguminosas + legumes salteados"] },
  snack: { fr: ["Yaourt + fruits + une poignée d'oléagineux", "Fromage blanc + miel + fruits secs", "Fruit frais + une poignée d'amandes", "Tartine de pain complet + avocat", "Smoothie fruits + lait ou boisson végétale"], en: ["Yogurt + fruit + a handful of nuts", "Cottage cheese + honey + dried fruit", "Fresh fruit + a handful of almonds", "Wholegrain toast + avocado", "Fruit smoothie + milk or plant-based drink"], es: ["Yogur + fruta + un puñado de frutos secos", "Queso fresco + miel + frutos secos", "Fruta fresca + un puñado de almendras", "Tostada integral + aguacate", "Batido de frutas + leche o bebida vegetal"], pt: ["Iogurte + fruta + um punhado de oleaginosas", "Queijo cottage + mel + frutas secas", "Fruta fresca + um punhado de amêndoas", "Torrada integral + abacate", "Vitamina de frutas + leite ou bebida vegetal"] },
};
// Allergènes courants — chaque mot-clé est cherché dans le texte FRANÇAIS
// du repas (les tableaux sont alignés par index entre les langues, donc
// filtrer sur le français exclut le bon repas quelle que soit la langue
// affichée à l'utilisateur).
const ALLERGENS = [
  { key: "gluten", fr: "Gluten", en: "Gluten", es: "Gluten", pt: "Glúten", kw: ["pain", "pâtes", "pate", "semoule", "couscous", "biscuit", "toast", "granola"] },
  { key: "lactose", fr: "Lactose / produits laitiers", en: "Lactose / dairy", es: "Lactosa / lácteos", pt: "Lactose / laticínios", kw: ["lait", "fromage", "yaourt", "yogourt"] },
  { key: "oeufs", fr: "Œufs", en: "Eggs", es: "Huevos", pt: "Ovos", kw: ["oeuf", "œuf"] },
  { key: "fruits_coque", fr: "Fruits à coque", en: "Tree nuts", es: "Frutos secos", pt: "Oleaginosas", kw: ["amande", "noix", "oléagineux", "oleagineux"] },
  { key: "poisson", fr: "Poisson / fruits de mer", en: "Fish / seafood", es: "Pescado / marisco", pt: "Peixe / frutos do mar", kw: ["poisson", "thon", "saumon"] },
  { key: "soja", fr: "Soja", en: "Soy", es: "Soja", pt: "Soja", kw: ["soja", "tofu"] },
  { key: "porc", fr: "Porc", en: "Pork", es: "Cerdo", pt: "Porco", kw: ["jambon", "porc"] },
];
function excludedMealIndices(frArray, allergyKeys, dislikedWords) {
  const excluded = new Set();
  const words = (dislikedWords || []).map((w) => (w || "").toLowerCase().trim()).filter(Boolean);
  const allergenKws = (allergyKeys || []).flatMap((k) => ALLERGENS.find((a) => a.key === k)?.kw || []);
  frArray.forEach((text, i) => {
    const lower = text.toLowerCase();
    if (allergenKws.some((kw) => lower.includes(kw)) || words.some((w) => lower.includes(w))) excluded.add(i);
  });
  return excluded;
}
// Choisit un repas dans le pool en excluant allergies/aliments non aimés —
// si le filtre exclut TOUT le pool (cas extrême), on retombe sur le pool
// complet plutôt que de planter ou de ne rien proposer du tout.
function pickFromPoolSafe(langArray, frArray, seed, allergyKeys, dislikedWords) {
  const excluded = excludedMealIndices(frArray, allergyKeys, dislikedWords);
  const allowed = langArray.map((_, i) => i).filter((i) => !excluded.has(i));
  const indices = allowed.length > 0 ? allowed : langArray.map((_, i) => i);
  const idx = indices[hashStr(seed) % indices.length];
  return langArray[idx];
}
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return Math.abs(h); }
function pickFromPool(pool, seed) { return pool[hashStr(seed) % pool.length]; }
function buildMeals(eventType, intensity, sportKey, seed, lang, allergies, dislikedFoods) {
  const category = SPORT_CATEGORY[sportKey] || "team";
  const pool = (MEALS[category] || MEALS.team)[eventType === "match" ? "match" : "train"];
  // L'intensité influence le choix ET la portion : sur une séance chill, le
  // repas d'avant reste léger (première moitié du pool, pensée plus digeste) ;
  // sur une séance intense, on va chercher dans toute la liste sans restriction.
  const preList = pool.pre[lang] || pool.pre.fr;
  const preFr = pool.pre.fr;
  const prePool = (eventType !== "match" && intensity === "chill") ? preList.slice(0, Math.ceil(preList.length / 2)) : preList;
  const prePoolFr = (eventType !== "match" && intensity === "chill") ? preFr.slice(0, Math.ceil(preFr.length / 2)) : preFr;
  const portionNote = eventType !== "match" ? (intensity === "chill" ? tr(lang, { fr: " (portion modérée suffit)", en: " (a moderate portion is enough)", es: " (una porción moderada basta)", pt: " (uma porção moderada basta)" }) : intensity === "intense" ? tr(lang, { fr: " (portion complète, ne lésine pas sur les glucides)", en: " (full portion, don't skimp on carbs)", es: " (porción completa, no escatimes en carbohidratos)", pt: " (porção completa, não economize nos carboidratos)" }) : "") : "";
  return {
    pre: pickFromPoolSafe(prePool, prePoolFr, seed + "-pre", allergies, dislikedFoods) + portionNote,
    post: pickFromPoolSafe(pool.post[lang] || pool.post.fr, pool.post.fr, seed + "-post", allergies, dislikedFoods),
  };
}
function buildRestDayMeals(seed, lang, allergies, dislikedFoods) {
  return {
    pre: pickFromPoolSafe(REST_MEALS.main[lang] || REST_MEALS.main.fr, REST_MEALS.main.fr, seed + "-main", allergies, dislikedFoods),
    post: pickFromPoolSafe(REST_MEALS.snack[lang] || REST_MEALS.snack.fr, REST_MEALS.snack.fr, seed + "-snack", allergies, dislikedFoods),
  };
}
// Combien de temps avant/après l'effort prendre son repas pour qu'il soit
// digéré et efficace au bon moment.
function mealTiming(eventType, intensity, lang) {
  if (eventType === "match") {
    return {
      pre: tr(lang, { fr: "2 à 3h avant l'effort", en: "2 to 3h before the effort", es: "2 a 3h antes del esfuerzo", pt: "2 a 3h antes do esforço" }),
      post: tr(lang, { fr: "dans les 30-45 min après l'effort, puis un repas complet dans les 2h", en: "within 30-45 min after the effort, then a full meal within 2h", es: "en los 30-45 min tras el esfuerzo, luego una comida completa en 2h", pt: "em 30-45 min após o esforço, depois uma refeição completa em até 2h" }),
      preOffsetMin: 150,
    };
  }
  if (intensity === "intense") {
    return {
      pre: tr(lang, { fr: "1h30 à 2h avant l'effort", en: "1h30 to 2h before the effort", es: "1h30 a 2h antes del esfuerzo", pt: "1h30 a 2h antes do esforço" }),
      post: tr(lang, { fr: "dans les 30-45 min après l'effort", en: "within 30-45 min after the effort", es: "en los 30-45 min tras el esfuerzo", pt: "em 30-45 min após o esforço" }),
      preOffsetMin: 105,
    };
  }
  return {
    pre: tr(lang, { fr: "1h à 1h30 avant l'effort", en: "1h to 1h30 before the effort", es: "1h a 1h30 antes del esfuerzo", pt: "1h a 1h30 antes do esforço" }),
    post: tr(lang, { fr: "dans l'heure suivant l'effort", en: "within the hour after the effort", es: "en la hora siguiente al esfuerzo", pt: "na hora seguinte ao esforço" }),
    preOffsetMin: 75,
  };
}
function computeNutrientTargets(profile, eventType, intensity, sportKey) {
  const poids = Number(profile.poids) || 70, taille = Number(profile.taille) || 175;
  const age = computeAge(profile.dateNaissance), sexe = profile.sexe;
  let bmr = sexe === "homme" ? 10 * poids + 6.25 * taille - 5 * age + 5 : sexe === "femme" ? 10 * poids + 6.25 * taille - 5 * age - 161 : 10 * poids + 6.25 * taille - 5 * age - 78;
  let mult = eventType === "match" ? 1.9 : intensity === "intense" ? 1.75 : intensity === "moyen" ? 1.6 : 1.4;
  const kcal = Math.round(bmr * mult);
  const category = SPORT_CATEGORY[sportKey] || "team";
  const proteinPerKg = category === "combat" ? 2.0 : category === "endurance" ? 1.5 : category === "racquet" ? 1.6 : 1.7;
  const carbPerKg = eventType === "match" ? 7 : intensity === "intense" ? 6 : intensity === "moyen" ? 5 : 3.5;
  const protein = Math.round(proteinPerKg * poids), carbs = Math.round(carbPerKg * poids);
  let fat = Math.round((kcal - protein * 4 - carbs * 4) / 9);
  if (fat < Math.round(0.8 * poids)) fat = Math.round(0.8 * poids);
  return { kcal, protein, carbs, fat };
}

/* ============================================================
   PROGRAMME CHRONOLOGIQUE
   ============================================================ */
function addMinutes(hhmm, add, lang) {
  const [h, m] = hhmm.split(":").map(Number);
  let total = h * 60 + m + add;
  const overflow = Math.floor(total / 1440);
  total = ((total % 1440) + 1440) % 1440;
  const suffix = overflow > 0 ? tr(lang, { fr: " (+1j)", en: " (+1d)", es: " (+1d)", pt: " (+1d)" }) : overflow < 0 ? tr(lang, { fr: " (-1j)", en: " (-1d)", es: " (-1d)", pt: " (-1d)" }) : "";
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}${suffix}`;
}
function sessionDuration(eventType, intensity) {
  if (eventType === "match") return 105;
  if (eventType === "entrainement") return intensity === "intense" ? 90 : intensity === "moyen" ? 75 : 60;
  return 60;
}
function buildProgram(plan, lang) {
  const rightAfter = tr(lang, { fr: "Juste après l'effort", en: "Right after training", es: "Justo después del esfuerzo", pt: "Logo após o esforço" });
  const evening = tr(lang, { fr: "Le soir", en: "In the evening", es: "Por la noche", pt: "À noite" });
  const duringDay = tr(lang, { fr: "Dans la journée", en: "During the day", es: "Durante el día", pt: "Durante o dia" });

  if (plan.restDay) {
    const raw = [
      { timeLabel: duringDay, label: tr(lang, { fr: "Étirements doux corps entier", en: "Gentle full-body stretching", es: "Estiramientos suaves de cuerpo completo", pt: "Alongamentos suaves de corpo inteiro" }), Icon: Activity, tab: "etirements" },
      { timeLabel: duringDay, label: tr(lang, { fr: "Repas équilibré", en: "Balanced meal", es: "Comida equilibrada", pt: "Refeição equilibrada" }), Icon: Utensils, tab: "nutrition" },
      { timeLabel: duringDay, label: tr(lang, { fr: "Hydratation régulière", en: "Regular hydration", es: "Hidratación regular", pt: "Hidratação regular" }), Icon: Droplet, tab: "nutrition" },
      { timeLabel: duringDay, label: plan.massage.titre, Icon: HeartPulse, tab: "massage" },
      { timeLabel: evening, label: tr(lang, { fr: `Coucher — objectif ${plan.sommeil}h de sommeil`, en: `Bedtime — aim for ${plan.sommeil}h of sleep`, es: `Hora de acostarse — objetivo ${plan.sommeil}h de sueño`, pt: `Hora de dormir — meta de ${plan.sommeil}h de sono` }), Icon: Moon, tab: null },
    ];
    return raw;
  }

  const timing = mealTiming(plan.eventType, plan.intensity, lang);
  const dur = sessionDuration(plan.eventType, plan.intensity);
  const endTime = plan.heure ? addMinutes(plan.heure, dur, lang) : null;

  const preMealStep = { Icon: Utensils, label: tr(lang, { fr: "Repas avant l'effort", en: "Meal before training", es: "Comida antes del esfuerzo", pt: "Refeição antes do esforço" }), tab: "nutrition", timeLabel: plan.heure ? addMinutes(plan.heure, -timing.preOffsetMin, lang) : timing.pre };
  const warmupOffset = tr(lang, { fr: "15-20 min avant l'effort", en: "15-20 min before the effort", es: "15-20 min antes del esfuerzo", pt: "15-20 min antes do esforço" });
  const warmupStep = { Icon: Zap, label: tr(lang, { fr: "Échauffement dynamique", en: "Dynamic warm-up", es: "Calentamiento dinámico", pt: "Aquecimento dinâmico" }), tab: "avant", timeLabel: plan.heure ? addMinutes(plan.heure, -18, lang) : warmupOffset };

  const raw = [
    { offsetMin: 0, label: tr(lang, { fr: "Hydratation immédiate + retour au calme", en: "Immediate hydration + cool down", es: "Hidratación inmediata + vuelta a la calma", pt: "Hidratação imediata + volta à calma" }), Icon: Droplet, tab: "nutrition" },
    { offsetMin: 15, label: tr(lang, { fr: "Étirements ciblés", en: "Targeted stretching", es: "Estiramientos específicos", pt: "Alongamentos direcionados" }), Icon: Activity, tab: "etirements" },
    { offsetMin: 45, label: tr(lang, { fr: "Repas de récupération", en: "Recovery meal", es: "Comida de recuperación", pt: "Refeição de recuperação" }), Icon: Utensils, tab: "nutrition" },
    { offsetMin: 120, label: tr(lang, { fr: "Massage / auto-massage", en: "Massage / self-massage", es: "Masaje / automasaje", pt: "Massagem / automassagem" }), Icon: HeartPulse, tab: "massage" },
  ];
  if (plan.coldHeat?.[0]) raw.push({ offsetMin: 180, label: plan.coldHeat[0].titre, Icon: Snowflake, tab: "froid" });
  const timed = raw.map((s) => ({
    ...s,
    timeLabel: endTime ? addMinutes(endTime, s.offsetMin, lang) : (s.offsetMin === 0 ? rightAfter : s.offsetMin < 60 ? `+${s.offsetMin} min` : `+${Math.floor(s.offsetMin / 60)}h${s.offsetMin % 60 ? String(s.offsetMin % 60).padStart(2, "0") : ""}`),
  }));
  return [preMealStep, warmupStep, ...timed, { timeLabel: evening, label: tr(lang, { fr: `Coucher visé — objectif ${plan.sommeil}h de sommeil`, en: `Target bedtime — aim for ${plan.sommeil}h of sleep`, es: `Hora de acostarse — objetivo ${plan.sommeil}h de sueño`, pt: `Hora de dormir — meta de ${plan.sommeil}h de sono` }), Icon: Moon, tab: null }];
}

/* ============================================================
   RECOVERY LOGIC
   ============================================================ */
function computeScore({ eventType, intensity, fatigue, hoursToNext, age, niveau }) {
  let s = fatigue * 10;
  if (eventType === "match") s += 27;
  else if (intensity === "intense") s += 20;
  else if (intensity === "moyen") s += 10;
  else s += 2;
  if (hoursToNext <= 24) s += 15; else if (hoursToNext <= 48) s += 6; else if (hoursToNext >= 96) s -= 10;
  if (age >= 45) s += 15; else if (age >= 35) s += 8;
  s *= NIVEAU_MULT[niveau] || 1;
  return Math.max(5, Math.min(100, Math.round(s)));
}
const scoreColor = (score) => (score >= 70 ? C.danger : score >= 40 ? C.warn : C.primary);
function recoveryDurationLabel(score, lang) {
  if (score >= 75) return tr(lang, { fr: "48-72h de récup renforcée", en: "48-72h of intensive recovery", es: "48-72h de recuperación reforzada", pt: "48-72h de recuperação reforçada" });
  if (score >= 50) return tr(lang, { fr: "24-48h de récup active", en: "24-48h of active recovery", es: "24-48h de recuperación activa", pt: "24-48h de recuperação ativa" });
  if (score >= 25) return tr(lang, { fr: "12-24h, récup légère suffit", en: "12-24h, light recovery is enough", es: "12-24h, basta con recuperación ligera", pt: "12-24h, recuperação leve basta" });
  return tr(lang, { fr: "< 12h, récupération rapide", en: "< 12h, quick recovery", es: "< 12h, recuperación rápida", pt: "< 12h, recuperação rápida" });
}
function sleepHours(score, eventType) { let h = 7.5; if (eventType === "match") h += 1; if (score >= 70) h += 1; else if (score >= 45) h += 0.5; return Math.min(10, h); }
function hydrationLiters(poids, eventType, intensity) { let l = (poids || 70) * 0.033; if (eventType === "match") l += 0.5; else if (intensity === "intense") l += 0.3; else if (intensity === "moyen") l += 0.15; return Math.round(l * 10) / 10; }
function buildMassage(equipement, zoneLabel, lang) {
  const has = (x) => equipement?.includes(x);
  const on = zoneLabel ? tr(lang, { fr: ` — priorité à ${zoneLabel}`, en: ` — prioritize ${zoneLabel}`, es: ` — prioriza ${zoneLabel}`, pt: ` — priorize ${zoneLabel}` }) : "";
  if (has("massage_gun")) return { titre: tr(lang, { fr: "Pistolet de massage (percussion)", en: "Massage gun (percussion)", es: "Pistola de masaje (percusión)", pt: "Pistola de massagem (percussão)" }), texte: tr(lang, { fr: "Passe l'appareil 30 à 60 sec par zone sollicitée, vitesse faible à moyenne, jamais sur un os ou une articulation.", en: "Run the device 30-60 sec per worked area, low to medium speed, never directly on a bone or joint.", es: "Pasa el aparato 30-60 seg por zona trabajada, velocidad baja a media, nunca sobre un hueso o articulación.", pt: "Passe o aparelho 30-60 seg por área trabalhada, velocidade baixa a média, nunca sobre um osso ou articulação." }) + on };
  if (has("foam_roller")) return { titre: tr(lang, { fr: "Auto-massage au rouleau", en: "Foam rolling", es: "Automasaje con rodillo", pt: "Automassagem com rolo" }), texte: tr(lang, { fr: "Fais rouler lentement chaque groupe musculaire 1-2 min, pause 10-15 sec sur les points sensibles.", en: "Slowly roll each muscle group for 1-2 min, pausing 10-15 sec on tender spots.", es: "Rueda lentamente cada grupo muscular 1-2 min, pausa de 10-15 seg en puntos sensibles.", pt: "Role lentamente cada grupo muscular por 1-2 min, pausa de 10-15 seg nos pontos sensíveis." }) + on };
  if (has("massage_ball")) return { titre: tr(lang, { fr: "Auto-massage à la balle", en: "Massage ball self-release", es: "Automasaje con pelota", pt: "Automassagem com bola" }), texte: tr(lang, { fr: "Place la balle sous la zone tendue et applique une pression progressive en petits cercles, 1-2 min par zone.", en: "Place the ball under the tight area and apply progressive pressure in small circles, 1-2 min per area.", es: "Coloca la pelota bajo la zona tensa y aplica presión progresiva en pequeños círculos, 1-2 min por zona.", pt: "Coloque a bola sob a área tensa e aplique pressão progressiva em pequenos círculos, 1-2 min por área." }) + on };
  return { titre: tr(lang, { fr: "Auto-massage manuel", en: "Manual self-massage", es: "Automasaje manual", pt: "Automassagem manual" }), texte: tr(lang, { fr: "Pétrissage manuel des muscles sollicités par pressions circulaires en remontant vers le cœur, 1-2 min par zone.", en: "Manually knead the worked muscles with circular pressure moving toward the heart, 1-2 min per area.", es: "Amasado manual de los músculos trabajados con presiones circulares hacia el corazón, 1-2 min por zona.", pt: "Amasse manualmente os músculos trabalhados com pressões circulares em direção ao coração, 1-2 min por área." }) + on };
}
function buildColdHeat(equipement, score, zoneLabel, lang) {
  const has = (x) => equipement?.includes(x); const items = [];
  const on = zoneLabel ? tr(lang, { fr: ` (${zoneLabel} en priorité)`, en: ` (${zoneLabel} first)`, es: ` (${zoneLabel} primero)`, pt: ` (${zoneLabel} primeiro)` }) : "";
  if (has("cold_bath") && score >= 45) items.push({ type: "froid", titre: tr(lang, { fr: "Bain froid / douche froide", en: "Cold bath / cold shower", es: "Baño frío / ducha fría", pt: "Banho frio / ducha fria" }), texte: tr(lang, { fr: "10-15 min en eau à 10-15°C dans les 30-60 min après l'effort pour limiter l'inflammation.", en: "10-15 min in 10-15°C water within 30-60 min after training to limit inflammation.", es: "10-15 min en agua a 10-15°C dentro de los 30-60 min tras el esfuerzo para limitar la inflamación.", pt: "10-15 min em água a 10-15°C nos 30-60 min após o esforço para limitar a inflamação." }) });
  if (has("ice_pack")) items.push({ type: "froid", titre: tr(lang, { fr: "Glaçage localisé", en: "Localized icing", es: "Hielo localizado", pt: "Gelo localizado" }), texte: tr(lang, { fr: "15 min de froid sur les zones sollicitées ou ayant reçu des impacts, 2-3 fois dans la journée.", en: "15 min of cold on worked areas or areas that took impact, 2-3 times during the day.", es: "15 min de frío en las zonas trabajadas o golpeadas, 2-3 veces al día.", pt: "15 min de gelo nas áreas trabalhadas ou que sofreram impacto, 2-3 vezes ao dia." }) + on });
  if (has("sauna")) items.push({ type: "chaud", titre: tr(lang, { fr: "Sauna / hammam", en: "Sauna / steam room", es: "Sauna / baño de vapor", pt: "Sauna / banho a vapor" }), texte: tr(lang, { fr: "Idéal le lendemain d'un effort intense, favorise la circulation. Bien s'hydrater avant/après, 10-15 min.", en: "Ideal the day after intense training, boosts circulation. Hydrate well before/after, 10-15 min.", es: "Ideal al día siguiente de un esfuerzo intenso, favorece la circulación. Hidrátate bien antes/después, 10-15 min.", pt: "Ideal no dia seguinte a um esforço intenso, favorece a circulação. Hidrate-se bem antes/depois, 10-15 min." }) });
  if (items.length === 0) items.push({ type: "mixte", titre: tr(lang, { fr: "Douche écossaise", en: "Contrast shower", es: "Ducha de contraste", pt: "Ducha de contraste" }), texte: tr(lang, { fr: "Alterne 30 sec chaud puis 15 sec froid sur les zones sollicitées, 3-4 cycles, en terminant par le froid.", en: "Alternate 30 sec hot then 15 sec cold on worked areas, 3-4 cycles, ending on cold.", es: "Alterna 30 seg caliente y 15 seg frío en las zonas trabajadas, 3-4 ciclos, terminando en frío.", pt: "Alterne 30 seg quente e 15 seg frio nas áreas trabalhadas, 3-4 ciclos, terminando no frio." }) + on });
  return items;
}
function buildProducts(equipement, eventType, score, lang) {
  const has = (x) => equipement?.includes(x); const list = [];
  if (has("soothing_balm")) list.push(tr(lang, { fr: "Baume apaisant : masse en mouvements circulaires vers le cœur sur les zones douloureuses.", en: "Soothing balm: massage in circular motions toward the heart on sore areas.", es: "Bálsamo calmante: masajea en movimientos circulares hacia el corazón en las zonas doloridas.", pt: "Bálsamo calmante: massageie em movimentos circulares em direção ao coração nas áreas doloridas." }));
  if (has("heat_balm")) list.push(tr(lang, { fr: "Baume chauffant : réserve-le à l'échauffement, évite juste après un effort intense sur zone enflammée.", en: "Warming balm: use it for warm-up, avoid right after intense training on an inflamed area.", es: "Bálsamo de calor: úsalo en el calentamiento, evítalo justo después de un esfuerzo intenso en zona inflamada.", pt: "Bálsamo térmico: reserve para o aquecimento, evite logo após esforço intenso em área inflamada." }));
  if (eventType === "match" || score >= 55) list.push(tr(lang, { fr: "Électrolytes / boisson de récupération : utile si séance > 60-90 min ou grosse transpiration.", en: "Electrolytes / recovery drink: useful if the session lasted > 60-90 min or you sweated a lot.", es: "Electrolitos / bebida de recuperación: útil si la sesión duró > 60-90 min o hubo mucha transpiración.", pt: "Eletrólitos / bebida de recuperação: útil se a sessão durou > 60-90 min ou houve muita transpiração." }));
  if (score >= 60) list.push(tr(lang, { fr: "Magnésium : peut aider en cas de crampes fréquentes, à discuter avec un pharmacien.", en: "Magnesium: may help with frequent cramps, discuss with a pharmacist.", es: "Magnesio: puede ayudar con calambres frecuentes, coméntalo con un farmacéutico.", pt: "Magnésio: pode ajudar em caso de cãibras frequentes, converse com um farmacêutico." }));
  if (list.length === 0) list.push(tr(lang, { fr: "Pas de produit indispensable ici : hydratation et sommeil suffisant restent la priorité.", en: "No essential product here: hydration and enough sleep remain the priority.", es: "Ningún producto imprescindible aquí: la hidratación y dormir lo suficiente siguen siendo la prioridad.", pt: "Nenhum produto essencial aqui: hidratação e sono suficiente continuam sendo a prioridade." }));
  return list;
}
// Construit une courte liste de noms de zones (ex: "genoux, mollets") à
// partir des muscleKeys, pour rendre massage/froid-chaud spécifiques au sport
// au lieu d'un texte générique — les 2 premières zones suffisent, lisible.
function zonesLabel(muscleKeys, lang) {
  const names = muscleKeys.slice(0, 2).map((k) => { const d = STRETCH_DB[k] || STRETCH_DB.corps_entier; return ((d[lang] || d.fr).label || "").toLowerCase(); });
  return names.filter(Boolean).join(tr(lang, { fr: " et ", en: " and ", es: " y ", pt: " e " }));
}
function computeMuscleKeys(sportKey, muscuZones) {
  if (sportKey === "muscu" && muscuZones && muscuZones.length) {
    const set = new Set();
    muscuZones.forEach((z) => (MUSCU_ZONES[z]?.muscles || []).forEach((m) => set.add(m)));
    return Array.from(set);
  }
  return (SPORTS[sportKey] || SPORTS.autre).muscles;
}
function generatePlan(profile, input, lang) {
  const { eventType, intensity, fatigue, hoursToNext, sport, seed, heure, muscuZones, restDay } = input;
  const age = computeAge(profile.dateNaissance);
  const score = computeScore({ eventType, intensity, fatigue, hoursToNext, age, niveau: profile.niveau });
  const sportKey = sport || profile.sports?.[0] || "autre";
  const muscleKeys = computeMuscleKeys(sportKey, muscuZones);
  const stretches = muscleKeys.map((k) => { const d = STRETCH_DB[k] || STRETCH_DB.corps_entier; return { key: k, ...(d[lang] || d.fr) }; });
  const warmup = restDay ? [] : buildWarmup(muscleKeys, lang);
  const zones = zonesLabel(muscleKeys, lang);
  const mealSeed = seed || `${Date.now()}-${Math.random()}`;
  return {
    id: Date.now() + Math.random(), date: new Date().toISOString(), heure: heure || null,
    eventType, intensity, fatigue, hoursToNext, sport: sportKey, muscuZones: muscuZones || [], lang, restDay: !!restDay,
    score, duree: recoveryDurationLabel(score, lang), stretches, warmup,
    massage: buildMassage(profile.equipement, zones, lang), coldHeat: buildColdHeat(profile.equipement, score, zones, lang),
    sommeil: sleepHours(score, eventType), hydratation: hydrationLiters(Number(profile.poids), eventType, intensity),
    produits: buildProducts(profile.equipement, eventType, score, lang),
    meals: restDay ? buildRestDayMeals(mealSeed, lang, profile.allergies, profile.dislikedFoods) : buildMeals(eventType, intensity, sportKey, mealSeed, lang, profile.allergies, profile.dislikedFoods),
    nutrients: computeNutrientTargets(profile, eventType, intensity, sportKey),
  };
}

// Fusionne plusieurs séances sportives du même jour en UN seul programme de
// récup (au lieu d'un programme séparé par sport, jugé trop pénible à
// consulter). Le score retenu est le plus exigeant des séances, avec un
// bonus si plusieurs séances s'accumulent le même jour.
function mergeSportEntriesPlan(profile, sportEntries, date, lang) {
  const individual = sportEntries.map((e) => ({
    entry: e,
    plan: generatePlan(profile, { eventType: e.type, intensity: e.intensity || "moyen", fatigue: 3, hoursToNext: 48, sport: e.sport, heure: e.heure, muscuZones: e.muscuZones, seed: date + "-" + e.id }, lang),
  }));
  const maxScore = Math.max(...individual.map((p) => p.plan.score));
  const score = Math.min(100, maxScore + (individual.length - 1) * 8);
  const ref = individual.find((p) => p.plan.score === maxScore).plan;

  const seen = new Set(); const stretches = [];
  individual.forEach(({ plan }) => plan.stretches.forEach((s) => { if (!seen.has(s.key)) { seen.add(s.key); stretches.push(s); } }));
  const seenW = new Set(); const warmup = [];
  individual.forEach(({ plan }) => plan.warmup.forEach((s) => { if (!seenW.has(s.key)) { seenW.add(s.key); warmup.push(s); } }));

  const allMuscleKeys = [...new Set(sportEntries.flatMap((e) => computeMuscleKeys(e.sport, e.muscuZones)))];
  const zones = zonesLabel(allMuscleKeys, lang);

  const sommeil = Math.min(10, Math.max(...individual.map((p) => p.plan.sommeil)) + (individual.length > 1 ? 0.5 : 0));
  const hydratation = Math.round(individual.reduce((a, p) => a + p.plan.hydratation, 0) * 10) / 10;
  const factor = 1 + (individual.length - 1) * 0.12;
  const nutrients = {
    kcal: Math.round(ref.nutrients.kcal * factor), protein: Math.round(ref.nutrients.protein * factor),
    carbs: Math.round(ref.nutrients.carbs * factor), fat: Math.round(ref.nutrients.fat * factor),
  };
  const heures = sportEntries.map((e) => e.heure).filter(Boolean).sort();

  return {
    id: Date.now() + Math.random(), date: new Date().toISOString(), heure: heures[0] || null, restDay: false,
    eventType: ref.eventType, intensity: ref.intensity, sport: ref.sport, muscuZones: ref.muscuZones, lang,
    score, duree: recoveryDurationLabel(score, lang), stretches, warmup,
    massage: buildMassage(profile.equipement, zones, lang), coldHeat: buildColdHeat(profile.equipement, score, zones, lang),
    sommeil, hydratation, produits: buildProducts(profile.equipement, ref.eventType, score, lang), meals: ref.meals,
    nutrients, combined: individual.length > 1, sessionsCount: individual.length,
  };
}

// Plan détaillé pour un jour de repos (off simple, récup active ou repos
// complet) — même richesse d'infos qu'un jour de sport (étirements légers,
// massage, hydratation, nutrition), sans dial de score puisqu'il n'y a pas
// de séance à évaluer. Les repas ne sont pas cadrés "avant/après effort"
// puisqu'il n'y a pas d'effort ce jour-là.
function buildRestDayPlan(profile, lang) {
  return generatePlan(profile, { eventType: "entrainement", intensity: "chill", fatigue: 1, hoursToNext: 72, sport: profile.sports?.[0] || "autre", restDay: true }, lang);
}

/* ============================================================
   INJURY ADVISOR
   ============================================================ */
function getInjuryAdvice(partKey, symptomKey, lang) {
  let urgent = false, urgentMsg = "", specialistes = [], conseil = "";
  const S = (fr, en, es, pt) => tr(lang, { fr, en, es, pt });
  if (partKey === "tete") {
    urgent = true;
    urgentMsg = S("Arrête immédiatement l'activité. En cas de perte de connaissance, vomissements, confusion ou vision trouble, consulte les urgences sans délai.", "Stop the activity immediately. If you experience loss of consciousness, vomiting, confusion or blurred vision, go to the emergency room right away.", "Detén la actividad de inmediato. Si hay pérdida de conciencia, vómitos, confusión o visión borrosa, acude a urgencias sin demora.", "Pare a atividade imediatamente. Em caso de perda de consciência, vômitos, confusão ou visão turva, procure emergência sem demora.");
    specialistes = [S("Médecin", "Doctor", "Médico", "Médico"), S("Urgences si symptômes neurologiques", "ER if neurological symptoms", "Urgencias si hay síntomas neurológicos", "Emergência se houver sintomas neurológicos")];
    conseil = S("Repos complet, pas de reprise avant avis médical, même si les symptômes semblent légers.", "Complete rest, no return to activity before medical advice, even if symptoms seem mild.", "Reposo completo, no reanudar sin consejo médico, aunque los síntomas parezcan leves.", "Repouso completo, não retomar sem avaliação médica, mesmo que os sintomas pareçam leves.");
  } else if (symptomKey === "fourmillements") {
    urgent = true;
    urgentMsg = S("Des fourmillements ou une perte de sensation qui persistent doivent être évalués rapidement par un médecin.", "Persistent tingling or loss of sensation should be checked quickly by a doctor.", "El hormigueo o la pérdida de sensibilidad persistentes deben ser evaluados rápidamente por un médico.", "Formigamento ou perda de sensibilidade persistentes devem ser avaliados rapidamente por um médico.");
    specialistes = [S("Médecin généraliste", "General practitioner", "Médico general", "Clínico geral"), S("Neurologue si persistance", "Neurologist if it persists", "Neurólogo si persiste", "Neurologista se persistir")];
    conseil = S("Évite de solliciter la zone concernée en attendant la consultation.", "Avoid straining the affected area until you see a doctor.", "Evita forzar la zona afectada mientras esperas la consulta.", "Evite forçar a área afetada enquanto aguarda a consulta.");
  } else if (symptomKey === "choc") {
    specialistes = [S("Médecin (radiographie possible)", "Doctor (X-ray may be needed)", "Médico (posible radiografía)", "Médico (possível radiografia)")];
    conseil = S("Une imagerie peut être nécessaire pour écarter une fracture ou fissure. Glace et repos en attendant.", "Imaging may be needed to rule out a fracture. Ice and rest in the meantime.", "Puede ser necesaria una imagen para descartar una fractura. Hielo y reposo mientras tanto.", "Pode ser necessário exame de imagem para descartar fratura. Gelo e repouso enquanto isso.");
  } else if (symptomKey === "gonflement" && (partKey === "genou" || partKey === "cheville")) {
    specialistes = [S("Médecin du sport", "Sports physician", "Médico deportivo", "Médico do esporte"), S("Kinésithérapeute pour le suivi", "Physiotherapist for follow-up", "Fisioterapeuta para el seguimiento", "Fisioterapeuta para acompanhamento")];
    conseil = S("Applique le protocole GREC : Glace, Repos, Élévation, Contention légère, en attendant la consultation.", "Apply the RICE protocol: Rest, Ice, Compression, Elevation, until you see a doctor.", "Aplica el protocolo RICE: Reposo, Hielo, Compresión, Elevación, mientras esperas la consulta.", "Aplique o protocolo RICE: Repouso, Gelo, Compressão, Elevação, até a consulta.");
  } else if (symptomKey === "instabilite") {
    specialistes = [S("Médecin du sport", "Sports physician", "Médico deportivo", "Médico do esporte"), S("Kinésithérapeute", "Physiotherapist", "Fisioterapeuta", "Fisioterapeuta")];
    conseil = S("Une suspicion de lésion ligamentaire nécessite un bilan avant reprise du sport.", "A suspected ligament injury needs an assessment before returning to sport.", "Una sospecha de lesión ligamentosa requiere una evaluación antes de volver al deporte.", "Suspeita de lesão ligamentar exige avaliação antes de retomar o esporte.");
  } else if (symptomKey === "chronique") {
    specialistes = [S("Kinésithérapeute", "Physiotherapist", "Fisioterapeuta", "Fisioterapeuta"), S("Ostéopathe", "Osteopath", "Osteópata", "Osteopata")];
    conseil = S("Un bilan postural peut être utile si la douleur revient régulièrement.", "A postural assessment can help if the pain keeps coming back.", "Una evaluación postural puede ser útil si el dolor reaparece con frecuencia.", "Uma avaliação postural pode ajudar se a dor voltar com frequência.");
    if (partKey === "pied" || partKey === "genou" || partKey === "hanche") specialistes.push(S("Podologue", "Podiatrist", "Podólogo", "Podólogo"));
  } else if (symptomKey === "raideur") {
    specialistes = [S("Kinésithérapeute", "Physiotherapist", "Fisioterapeuta", "Fisioterapeuta"), S("Ostéopathe", "Osteopath", "Osteópata", "Osteopata")];
    conseil = S("Mobilité douce quotidienne et étirements progressifs, sans forcer sur une douleur vive.", "Gentle daily mobility work and progressive stretching, never forcing through sharp pain.", "Movilidad suave diaria y estiramientos progresivos, sin forzar ante un dolor agudo.", "Mobilidade suave diária e alongamentos progressivos, sem forçar diante de dor aguda.");
  } else {
    specialistes = [S("Kinésithérapeute pour un premier bilan", "Physiotherapist for an initial assessment", "Fisioterapeuta para una primera evaluación", "Fisioterapeuta para uma primeira avaliação")];
    conseil = S("Si la douleur est forte ou t'empêche de bouger normalement, consulte un médecin du sport rapidement.", "If the pain is severe or stops you moving normally, see a sports physician quickly.", "Si el dolor es fuerte o te impide moverte con normalidad, consulta pronto a un médico deportivo.", "Se a dor for forte ou impedir movimentos normais, procure rapidamente um médico do esporte.");
  }
  const osteo = S("Ostéopathe", "Osteopath", "Osteópata", "Osteopata");
  if ((partKey === "dos" || partKey === "cervicales") && !specialistes.includes(osteo)) specialistes.push(osteo);
  const podo = S("Podologue", "Podiatrist", "Podólogo", "Podólogo");
  if (partKey === "pied" && !specialistes.includes(podo)) specialistes.push(podo);
  return { urgent, urgentMsg, specialistes, conseil };
}

/* ============================================================
   PLANNING HELPERS
   ============================================================ */
const emptyWeekly = () => Array.from({ length: 7 }, () => []);
function newEntry(defaultSport) { return { id: Date.now() + Math.random(), type: "entrainement", sport: defaultSport, intensity: "moyen", label: "", heure: "", notify: false, notifyTime: "20:00", muscuZones: [] }; }
function newRdv() { return { praticien: "kine", motif: "", heure: "", notify: false, notifyTime: "20:00" }; }
function getDayEntries(weeklyDays, exceptions, dateIso) {
  const dow = (new Date(dateIso).getDay() + 6) % 7;
  const isException = Object.prototype.hasOwnProperty.call(exceptions, dateIso);
  return { entries: isException ? exceptions[dateIso] : (weeklyDays[dow] || []), isException, dow };
}
function autoRecovery(schedule, idx, profile) {
  const prev = schedule[idx - 1]; if (!prev) return null;
  const relevant = prev.entries.filter((e) => SPORT_TYPES.includes(e.type));
  if (relevant.length === 0) return null;
  const age = computeAge(profile.dateNaissance);
  let maxScore = 0;
  relevant.forEach((e) => { const s = computeScore({ eventType: e.type, intensity: e.intensity || "moyen", fatigue: 3, hoursToNext: 24, age, niveau: profile.niveau }); if (s > maxScore) maxScore = s; });
  const prev2 = schedule[idx - 2];
  const prev2Relevant = prev2 ? prev2.entries.filter((e) => SPORT_TYPES.includes(e.type)) : [];
  if (maxScore >= 70 && prev2Relevant.length > 0) return { level: "repos_complet", maxScore };
  if (maxScore >= 45) return { level: "recup_active", maxScore };
  return null;
}
function buildYearSchedule(weeklyDays, exceptions, year, profile) {
  const base = []; const start = new Date(year, 0, 1); const end = new Date(year, 11, 31);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    const { entries, isException, dow } = getDayEntries(weeklyDays, exceptions, iso);
    base.push({ date: iso, dow, entries, isException });
  }
  return base.map((d, idx, arr) => (d.entries.length === 0 && !d.isException) ? { ...d, auto: autoRecovery(arr, idx, profile) } : d);
}
function entryColor(e) {
  if (e.type === "blessure") return C.blessure;
  if (e.type === "rdv") return C.rdv;
  if (e.type === "match") return C.danger;
  if (e.type === "loisir") return C.loisir;
  if (e.type === "entrainement") return e.intensity === "intense" ? C.warn : e.intensity === "chill" ? C.primaryDim : C.primary;
  return C.primary;
}
function dayColor(day) {
  const entries = day.entries || [];
  if (entries.length === 0) return day.auto?.level === "recup_active" ? C.reposActif : C.border;
  if (entries.some((e) => e.type === "blessure")) return C.blessure;
  if (entries.some((e) => e.type === "match")) return C.danger;
  const trainInt = entries.filter((e) => e.type === "entrainement").map((e) => e.intensity);
  if (trainInt.includes("intense")) return C.warn;
  if (trainInt.includes("moyen")) return C.primary;
  if (trainInt.includes("chill")) return C.primaryDim;
  if (entries.some((e) => e.type === "loisir")) return C.loisir;
  if (entries.every((e) => e.type === "rdv")) return C.rdv;
  return C.primary;
}
function addBlessureRange(exceptions, injury, lang) {
  if (!(injury.arret && injury.dateDebut && injury.dateRetour)) return exceptions;
  const start = new Date(injury.dateDebut), end = new Date(injury.dateRetour);
  const diff = (end - start) / 86400000;
  if (diff < 0 || diff > 180) return exceptions;
  const next = { ...exceptions };
  const label = `${tr(lang, { fr: "Blessure", en: "Injury", es: "Lesión", pt: "Lesão" })} : ${bodyPartLabel(injury.part, lang)}`;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    next[d.toISOString().slice(0, 10)] = [{ id: Date.now() + Math.random(), type: "blessure", label, injuryId: injury.id }];
  }
  return next;
}
function removeInjuryExceptions(exceptions, injuryId) {
  const next = { ...exceptions };
  Object.keys(next).forEach((date) => { const filtered = next[date].filter((e) => e.injuryId !== injuryId); if (filtered.length === 0) delete next[date]; else next[date] = filtered; });
  return next;
}

/* ============================================================
   SUPABASE — connexion à la vraie base de données
   ============================================================
   Ces valeurs viennent de ton projet Supabase (Project Settings > API).
   La clé "anon public" n'est PAS secrète : elle est faite pour être
   visible côté client, la vraie protection vient des règles RLS créées
   sur chaque table (chacun ne voit que ses propres données). */
const SUPABASE_URL = "https://iixosqfclayddtzipinb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpeG9zcWZjbGF5ZGR0emlwaW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1ODk3NjIsImV4cCI6MjEwMzE2NTc2Mn0.YhZAdUorbu4i41ysyKWCUJ5qVk1_p5CtQ3YWWlhlL3Q";
// Clé publique VAPID pour les notifications push (Web Push). Sa "sœur" privée
// n'est JAMAIS dans ce code — elle vit uniquement côté serveur (Edge Function).
const VAPID_PUBLIC_KEY = "BN41rwyUPoazbNikWSY8eo4QiQ2Tg32IYfoREdgXYYdG05hZAs38GBv7jGzo17VOjul7U_zmqu3LaI7FXmMoVXU";
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
// Demande la permission et s'abonne au bon système de notifications :
// - App native (Capacitor, vraie app installée depuis les stores) → vrai
//   système natif via Firebase.
// - Navigateur / PWA classique → web push (service worker), comme avant.
async function subscribeToPush(userId, accessToken) {
  if (typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.()) {
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      const perm = await PushNotifications.requestPermissions();
      if (perm.receive !== "granted") return { ok: false, reason: "denied" };
      await PushNotifications.register();
      return await new Promise((resolve) => {
        PushNotifications.addListener("registration", async (token) => {
          await sbUpsert("push_tokens_native", { user_id: userId, token: token.value, platform: window.Capacitor.getPlatform() }, accessToken);
          resolve({ ok: true });
        });
        PushNotifications.addListener("registrationError", () => resolve({ ok: false, reason: "error" }));
      });
    } catch {
      return { ok: false, reason: "error" };
    }
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return { ok: false, reason: "unsupported" };
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "denied" };
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
  const json = sub.toJSON();
  await sbUpsert("push_subscriptions", { user_id: userId, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }, accessToken);
  return { ok: true };
}
async function unsubscribeFromPush(userId, accessToken) {
  if (typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.()) {
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      await sbDelete("push_tokens_native", `user_id=eq.${userId}`, accessToken);
      await PushNotifications.removeAllListeners();
    } catch {}
    return;
  }
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && (await reg.pushManager.getSubscription());
  if (sub) { await sbDelete("push_subscriptions", `endpoint=eq.${encodeURIComponent(sub.endpoint)}`, accessToken); await sub.unsubscribe(); }
}

async function sbAuth(path, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.msg || json.error_description || json.error || "Erreur d'authentification.");
  return json;
}
async function sbSignOut(accessToken) {
  try { await fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: "POST", headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` } }); } catch {}
}
async function sbRecoverPassword(email) {
  // On indique explicitement où revenir après le clic dans l'email — sans ça,
  // Supabase utilise une adresse par défaut qui se périme dès que le nom de
  // domaine de l'app change (ce qui est déjà arrivé plusieurs fois ici).
  const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, { method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY }, body: JSON.stringify({ email, ...(redirectTo ? { redirect_to: redirectTo } : {}) }) });
  if (!res.ok) { const json = await res.json().catch(() => ({})); throw new Error(json.msg || json.error_description || "Erreur lors de l'envoi de l'email."); }
}
async function sbSetNewPassword(accessToken, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { method: "PUT", headers: sbHeaders(accessToken), body: JSON.stringify({ password }) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.msg || json.error_description || "Erreur lors de la mise à jour du mot de passe.");
  return json;
}
// Déclenche l'envoi du mail "Confirme ta nouvelle adresse" — le changement
// ne devient effectif qu'une fois que la personne clique le lien reçu.
async function sbUpdateEmail(accessToken, newEmail) {
  const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user${redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : ""}`, { method: "PUT", headers: sbHeaders(accessToken), body: JSON.stringify({ email: newEmail }) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.msg || json.error_description || "Erreur lors du changement d'email.");
  return json;
}
function sbHeaders(accessToken, extra) {
  return { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...extra };
}
async function sbSelect(table, query, accessToken) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: sbHeaders(accessToken) });
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}
async function sbUpsert(table, row, accessToken) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, { method: "POST", headers: sbHeaders(accessToken, { Prefer: "resolution=merge-duplicates,return=representation" }), body: JSON.stringify(row) });
    const json = await res.json().catch(() => []);
    return Array.isArray(json) ? json[0] : json;
  } catch { return null; }
}
async function sbInsert(table, row, accessToken) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, { method: "POST", headers: sbHeaders(accessToken, { Prefer: "return=representation" }), body: JSON.stringify(row) });
    const json = await res.json().catch(() => []);
    return Array.isArray(json) ? json[0] : json;
  } catch { return null; }
}
async function sbUpdate(table, matchQuery, patch, accessToken) {
  try { await fetch(`${SUPABASE_URL}/rest/v1/${table}?${matchQuery}`, { method: "PATCH", headers: sbHeaders(accessToken), body: JSON.stringify(patch) }); } catch {}
}
async function sbDelete(table, matchQuery, accessToken) {
  try { await fetch(`${SUPABASE_URL}/rest/v1/${table}?${matchQuery}`, { method: "DELETE", headers: sbHeaders(accessToken) }); } catch {}
}

// Rassemble les 5 tables en un seul objet, dans la même forme que le reste
// de l'app attend déjà (profile / sessionsLog / plannerConfig / injuries / pro).
async function loadUserData(userId, accessToken, meta) {
  const [profileRows, sessionRows, plannerRows, injuryRows, proRows] = await Promise.all([
    sbSelect("profiles", `id=eq.${userId}&select=*`, accessToken),
    sbSelect("sessions_log", `user_id=eq.${userId}&select=*&order=created_at`, accessToken),
    sbSelect("planner_config", `user_id=eq.${userId}&select=*`, accessToken),
    sbSelect("injuries", `user_id=eq.${userId}&select=*&order=created_at`, accessToken),
    sbSelect("subscriptions", `user_id=eq.${userId}&select=*`, accessToken),
  ]);
  const profileRow = profileRows[0];
  const profile = profileRow ? {
    name: profileRow.prenom, sexe: profileRow.sexe, dateNaissance: profileRow.date_naissance || "",
    taille: profileRow.taille, poids: profileRow.poids, sports: profileRow.sports || [],
    niveau: profileRow.niveau, equipement: profileRow.equipement || [],
    allergies: profileRow.allergies || [], dislikedFoods: profileRow.disliked_foods || [],
  } : null;
  const sessionsLog = (sessionRows || []).map((r) => ({ ...r.data, id: r.id }));
  const plannerRow = plannerRows[0];
  const plannerConfig = plannerRow ? { weeklyDays: plannerRow.weekly_days, exceptions: plannerRow.exceptions } : null;
  const injuries = (injuryRows || []).map((r) => ({ ...r.data, id: r.id }));
  const proRow = proRows[0];
  const pro = proRow ? { status: proRow.status, cycle: proRow.cycle, trialStart: proRow.trial_start, subscribedAt: proRow.subscribed_at, nextBillingDate: proRow.next_billing_date, cancelled: proRow.cancelled, history: proRow.history || [] } : defaultPro();
  return {
    nom: profileRow?.nom || meta?.nom || "", prenom: profileRow?.prenom || meta?.prenom || "", username: profileRow?.username || meta?.username || "",
    profile, sessionsLog, plannerConfig, injuries, pro,
  };
}

/* ============================================================
   PERSISTENCE LOCALE — uniquement pour la préférence de langue
   (non sensible ; tout le reste des données passe par Supabase)
   ============================================================ */
// Stockage local RÉEL du navigateur (localStorage) — contrairement à
// window.storage (qui n'existe que dans l'aperçu Claude et ne fait RIEN sur
// un vrai site déployé), localStorage persiste vraiment sur l'appareil, y
// compris après fermeture complète de l'app. Utilisé pour la langue et pour
// la session de connexion ("Rester connecté").
const LS_PREFIX = "regen:";
async function storageGet(key) {
  try { const raw = localStorage.getItem(LS_PREFIX + key); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
async function storageSet(key, value) {
  try { localStorage.setItem(LS_PREFIX + key, JSON.stringify(value)); return true; } catch { return false; }
}
async function storageDelete(key) {
  try { localStorage.removeItem(LS_PREFIX + key); } catch {}
}

/* ============================================================
   UI PRIMITIVES
   ============================================================ */
function Btn({ children, onClick, variant = "primary", full, disabled, type = "button", icon: Icon, small }) {
  const styles = {
    primary: { background: gradPrimary, color: "#052821", boxShadow: `0 8px 20px -8px ${C.primary}66` },
    ghost: { background: "transparent", color: C.primary, border: "none" },
    danger: { background: "rgba(255,97,97,0.14)", color: C.danger, border: "1px solid rgba(255,97,97,0.28)", backdropFilter: "blur(12px)" },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`flex items-center justify-center gap-2 rounded-2xl font-semibold transition-transform active:scale-[0.97] ${full ? "w-full" : ""} ${small ? "px-3 py-2 text-xs" : "px-4 py-3.5 text-[15px]"}`} style={{ ...styles[variant], ...fontBody, opacity: disabled ? 0.45 : 1 }}>
      {Icon && <Icon size={small ? 13 : 17} />}{children}
    </button>
  );
}
function Field({ label, children }) { return <div className="mb-4"><label className="block text-[11px] font-semibold mb-1.5 tracking-wide uppercase" style={{ color: C.textMuted, ...fontBody }}>{label}</label>{children}</div>; }
const inputStyle = { background: C.glassSoft, border: `1px solid ${C.glassBorder}`, color: C.text, backdropFilter: "blur(10px)", ...fontBody };
function TextInput(props) { return <input {...props} className="w-full rounded-xl px-3 py-2.5 outline-none" style={{ ...inputStyle, fontSize: 16, ...props.style }} />; }
function Select({ value, onChange, options, placeholder }) {
  return (
    <div className="relative">
      <select value={value} onChange={onChange} className="w-full rounded-xl px-3 py-2.5 text-sm outline-none appearance-none" style={inputStyle}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
      </select>
      <ChevronDown size={16} className="absolute right-3 top-3 pointer-events-none" style={{ color: C.textMuted }} />
    </div>
  );
}
function Card({ children, style, className = "" }) {
  return <div className={`rounded-[22px] p-4 ${className}`} style={{ background: C.glass, backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)", border: `1px solid ${C.glassBorder}`, boxShadow: `inset 0 1px 0 ${C.glassHighlight}, 0 20px 36px -22px rgba(0,0,0,0.65)`, ...style }}>{children}</div>;
}
function HeroCard({ children, accent, style, className = "" }) {
  const a = accent || C.primary;
  return <div className={`rounded-[26px] p-5 relative overflow-hidden ${className}`} style={{ background: `linear-gradient(155deg, ${a}3D 0%, ${C.glassStrong} 55%, ${C.glass} 100%)`, backdropFilter: "blur(26px)", WebkitBackdropFilter: "blur(26px)", border: `1px solid ${C.glassBorder}`, boxShadow: `inset 0 1px 0 ${C.glassHighlight}, 0 24px 48px -22px ${a}33`, ...style }}>{children}</div>;
}
function Pill({ children, active, onClick, color, small }) {
  return <button onClick={onClick} className={`rounded-full font-semibold transition-colors ${small ? "px-2.5 py-1.5 text-[10px]" : "px-3 py-2 text-xs"}`} style={{ background: active ? (color || C.primary) : C.glassSoft, color: active ? "#052821" : C.textMuted, border: `1px solid ${active ? (color || C.primary) : C.glassBorder}`, backdropFilter: "blur(10px)", ...fontBody }}>{children}</button>;
}
function SegmentedControl({ options, value, onChange, small, colorMap }) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const activeColor = (colorMap && colorMap[value]) || C.primary;
  return (
    <div className={`relative flex rounded-2xl ${small ? "p-0.5" : "p-1"}`} style={{ background: C.glassSoft, border: `1px solid ${C.glassBorder}`, backdropFilter: "blur(10px)" }}>
      <div className="absolute top-0.5 bottom-0.5 rounded-xl transition-all duration-300 ease-out" style={{ left: `calc(${100 / options.length}% * ${idx} + 2px)`, width: `calc(${100 / options.length}% - 4px)`, background: activeColor === C.primary ? gradPrimary : activeColor, boxShadow: `0 4px 12px -4px ${activeColor}77` }} />
      {options.map((opt) => (
        <button key={opt.value} type="button" onClick={() => onChange(opt.value)} className={`relative z-10 flex-1 font-semibold rounded-xl transition-colors ${small ? "py-1.5 text-[10px]" : "py-2.5 text-xs"}`} style={{ color: value === opt.value ? "#052821" : C.textMuted, ...fontBody }}>{opt.label}</button>
      ))}
    </div>
  );
}
function SectionTitle({ icon: Icon, children, action }) { return <div className="flex items-center justify-between mb-3"><div className="flex items-center gap-2">{Icon && <Icon size={16} style={{ color: C.primary }} />}<h3 className="text-sm font-bold tracking-tight" style={{ color: C.text, ...fontDisplay }}>{children}</h3></div>{action}</div>; }
function Badge({ children, color }) { return <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: color + "22", color, backdropFilter: "blur(6px)", ...fontBody }}>{children}</span>; }
function LargeHeader({ title, subtitle, right }) {
  return (
    <div className="flex items-end justify-between mb-6 mt-1">
      <div>
        {subtitle && <p className="text-[13px] mb-0.5" style={{ color: C.textMuted, ...fontBody }}>{subtitle}</p>}
        <h1 className="text-[30px] font-extrabold tracking-tight leading-none" style={{ color: C.text, ...fontDisplay }}>{title}</h1>
      </div>
      {right}
    </div>
  );
}
function GroupedList({ children }) { return <div className="rounded-[22px] overflow-hidden" style={{ background: C.glass, backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)", border: `1px solid ${C.glassBorder}`, boxShadow: `inset 0 1px 0 ${C.glassHighlight}, 0 20px 36px -22px rgba(0,0,0,0.65)` }}>{children}</div>; }
function ListRow({ onClick, left, title, subtitle, right, last, chevron }) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3 text-left" style={{ borderBottom: last ? "none" : `1px solid ${C.glassBorder}` }}>
      {left}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: C.text, ...fontBody }}>{title}</p>
        {subtitle && <p className="text-[11px] truncate" style={{ color: C.textFaint, ...fontBody }}>{subtitle}</p>}
      </div>
      {right}
      {chevron && <ChevronRightIcon size={15} style={{ color: C.textFaint }} />}
    </Comp>
  );
}
function IconTile({ icon: Icon, label, onClick, color }) {
  const c = color || C.primary;
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 shrink-0" style={{ width: 76 }}>
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: `linear-gradient(155deg, ${c}33 0%, ${c}14 100%)`, border: `1px solid ${c}40`, backdropFilter: "blur(12px)", boxShadow: `0 8px 16px -8px ${c}55` }}><Icon size={22} style={{ color: c }} /></div>
      <span className="text-[10px] font-semibold text-center leading-tight" style={{ color: C.textMuted, ...fontBody }}>{label}</span>
    </button>
  );
}
function LanguageSwitcher({ compact }) {
  const { lang, setLang } = useLang();
  return (
    <div className={`flex gap-1.5 ${compact ? "" : "flex-wrap"}`}>
      {LANGS.map((l) => (
        <button key={l} onClick={() => setLang(l)} className="px-2.5 py-1.5 rounded-full text-[11px] font-semibold flex items-center gap-1" style={{ background: lang === l ? C.primary : C.glassSoft, color: lang === l ? "#052821" : C.textMuted, border: `1px solid ${lang === l ? C.primary : C.glassBorder}`, backdropFilter: "blur(8px)", ...fontBody }}>
          <span>{LANG_META[l].flag}</span>{compact ? l.toUpperCase() : LANG_META[l].label}
        </button>
      ))}
    </div>
  );
}

function RecoveryDial({ score, label, sub, size = 200 }) {
  const r = 80, circ = 2 * Math.PI * r, offset = circ * (1 - score / 100), col = scoreColor(score);
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 200 200" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="100" cy="100" r={r} fill="none" stroke={C.border} strokeWidth="14" />
        <circle cx="100" cy="100" r={r} fill="none" stroke={col} strokeWidth="14" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.8s ease, stroke 0.8s ease", filter: `drop-shadow(0 0 18px ${col}99)` }} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span style={{ ...fontMono, color: col, fontSize: 40, fontWeight: 600, lineHeight: 1 }}>{score}</span>
        <span className="text-[10px] uppercase tracking-widest mt-1 text-center px-4" style={{ color: C.textMuted, ...fontBody }}>{label}</span>
        {sub && <span className="text-[11px] mt-1 font-semibold text-center" style={{ color: col, ...fontBody }}>{sub}</span>}
      </div>
    </div>
  );
}

/* ============================================================
   RDV FORM
   ============================================================ */
function RdvForm({ value, onChange }) {
  const { lang } = useLang();
  const T = {
    praticien: tr(lang, { fr: "Praticien", en: "Practitioner", es: "Profesional", pt: "Profissional" }),
    motif: tr(lang, { fr: "Motif", en: "Reason", es: "Motivo", pt: "Motivo" }),
    motifPh: tr(lang, { fr: "ex : contrôle de routine", en: "e.g. routine check-up", es: "ej: control de rutina", pt: "ex: consulta de rotina" }),
    heure: tr(lang, { fr: "Heure (optionnel)", en: "Time (optional)", es: "Hora (opcional)", pt: "Horário (opcional)" }),
    notify: tr(lang, { fr: "Me notifier la veille", en: "Remind me the day before", es: "Avisarme el día anterior", pt: "Avisar-me na véspera" }),
  };
  return (
    <div>
      <Field label={T.praticien}><Select value={value.praticien} onChange={(e) => onChange({ ...value, praticien: e.target.value })} options={PRATICIENS.map((p) => ({ value: p.key, label: tr(lang, p) }))} /></Field>
      <Field label={T.motif}><TextInput value={value.motif} onChange={(e) => onChange({ ...value, motif: e.target.value })} placeholder={T.motifPh} /></Field>
      <Field label={T.heure}><TextInput type="time" value={value.heure} onChange={(e) => onChange({ ...value, heure: e.target.value })} /></Field>
      <button onClick={() => onChange({ ...value, notify: !value.notify })} className="flex items-center gap-2 mb-3">
        <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: value.notify ? C.rdv : "transparent", border: `1px solid ${value.notify ? C.rdv : C.border}` }}>{value.notify && <Check size={11} color="#052821" />}</div>
        <span className="text-[11px]" style={{ color: C.text, ...fontBody }}>{T.notify}</span>
      </button>
      {value.notify && <div className="mb-1"><TextInput type="time" value={value.notifyTime} onChange={(e) => onChange({ ...value, notifyTime: e.target.value })} /></div>}
    </div>
  );
}

/* ============================================================
   PLAN TABS
   ============================================================ */
function PlanTabs({ plan }) {
  const { lang } = useLang();
  const { isPro, openPro } = usePro();
  const [tab, setTab] = useState("programme");
  const tabs = [
    ["programme", tr(lang, { fr: "Programme", en: "Program", es: "Programa", pt: "Programa" }), Clock],
    ...(plan.restDay ? [] : [["avant", tr(lang, { fr: "Avant", en: "Before", es: "Antes", pt: "Antes" }), Zap]]),
    ["etirements", tr(lang, { fr: "Étirements", en: "Stretching", es: "Estiramientos", pt: "Alongamentos" }), Activity],
    ["massage", tr(lang, { fr: "Massage", en: "Massage", es: "Masaje", pt: "Massagem" }), HeartPulse],
    ["froid", tr(lang, { fr: "Froid / Chaud", en: "Cold / Heat", es: "Frío / Calor", pt: "Frio / Calor" }), Snowflake],
    ["nutrition", tr(lang, { fr: "Nutrition", en: "Nutrition", es: "Nutrición", pt: "Nutrição" }), Utensils],
    ["produits", tr(lang, { fr: "Produits", en: "Products", es: "Productos", pt: "Produtos" }), ShoppingBag],
  ];
  const T = {
    noHeureHint: tr(lang, { fr: "Renseigne l'heure de la séance pour des horaires précis — sinon voici l'ordre à suivre avec des délais indicatifs.", en: "Enter the session time for precise timing — otherwise here's the order to follow with rough delays.", es: "Indica la hora de la sesión para horarios precisos — si no, aquí tienes el orden a seguir con tiempos indicativos.", pt: "Informe o horário da sessão para horários precisos — caso contrário, aqui está a ordem a seguir com tempos indicativos." }),
    proTimingHint: tr(lang, { fr: "Horaires exacts calculés automatiquement avec REGEN Pro.", en: "Exact times calculated automatically with REGEN Pro.", es: "Horarios exactos calculados automáticamente con REGEN Pro.", pt: "Horários exatos calculados automaticamente com o REGEN Pro." }),
    needsToday: tr(lang, { fr: "Besoins estimés du jour", en: "Estimated needs for the day", es: "Necesidades estimadas del día", pt: "Necessidades estimadas do dia" }),
    kcal: "kcal", protein: tr(lang, { fr: "Protéines", en: "Protein", es: "Proteínas", pt: "Proteínas" }), carbs: tr(lang, { fr: "Glucides", en: "Carbs", es: "Carbohidratos", pt: "Carboidratos" }), fat: tr(lang, { fr: "Lipides", en: "Fat", es: "Grasas", pt: "Gorduras" }),
    estimateNote: tr(lang, { fr: "Estimation selon ton profil (taille, poids, sexe, âge) et l'intensité de la séance — indicatif, pas un avis nutritionnel professionnel.", en: "Estimate based on your profile (height, weight, sex, age) and session intensity — indicative only, not professional nutritional advice.", es: "Estimación según tu perfil (altura, peso, sexo, edad) y la intensidad de la sesión — orientativo, no es un consejo nutricional profesional.", pt: "Estimativa com base no seu perfil (altura, peso, sexo, idade) e na intensidade da sessão — indicativo, não é aconselhamento nutricional profissional." }),
    mealBefore: tr(lang, { fr: "Repas avant l'effort", en: "Meal before training", es: "Comida antes del esfuerzo", pt: "Refeição antes do esforço" }),
    mealAfter: tr(lang, { fr: "Repas après l'effort", en: "Meal after training", es: "Comida después del esfuerzo", pt: "Refeição depois do esforço" }),
    mealMain: tr(lang, { fr: "Repas conseillé", en: "Suggested meal", es: "Comida sugerida", pt: "Refeição sugerida" }),
    mealSnack: tr(lang, { fr: "Autre repas / collation", en: "Other meal / snack", es: "Otra comida / tentempié", pt: "Outra refeição / lanche" }),
    toEatAt: (t) => tr(lang, { fr: `À prendre ${t}`, en: `Eat it ${t}`, es: `Tómalo ${t}`, pt: `Coma ${t}` }),
    spreadDay: tr(lang, { fr: "À répartir sur la journée, sans besoin d'excès calorique.", en: "Spread across the day, no need for excess calories.", es: "A repartir a lo largo del día, sin necesidad de exceso calórico.", pt: "A distribuir ao longo do dia, sem necessidade de excesso calórico." }),
    hydration: tr(lang, { fr: "Hydratation", en: "Hydration", es: "Hidratación", pt: "Hidratação" }),
    recommendedDay: tr(lang, { fr: "recommandés sur la journée", en: "recommended for the day", es: "recomendados para el día", pt: "recomendados para o dia" }),
    warmupIntro: tr(lang, { fr: "5 à 8 minutes suffisent pour préparer le corps et réduire le risque de blessure — enchaîne ces mouvements juste avant ta séance.", en: "5 to 8 minutes are enough to prepare your body and reduce injury risk — run through these right before your session.", es: "5 a 8 minutos bastan para preparar el cuerpo y reducir el riesgo de lesión — hazlos justo antes de tu sesión.", pt: "5 a 8 minutos bastam para preparar o corpo e reduzir o risco de lesão — faça-os logo antes da sua sessão." }),
  };
  const timing = !plan.restDay ? mealTiming(plan.eventType, plan.intensity, lang) : null;
  const programPlan = isPro ? plan : { ...plan, heure: null };
  return (
    <div>
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {tabs.map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)} className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold" style={{ background: tab === k ? C.primary : C.surface, color: tab === k ? "#052821" : C.textMuted, border: `1px solid ${tab === k ? C.primary : C.borderSoft}66` }}><Icon size={13} /> {label}</button>
        ))}
      </div>
      {tab === "programme" && (
        <div className="flex flex-col gap-2">
          {buildProgram(programPlan, lang).map((s, i) => {
            const clickable = !!s.tab;
            const Comp = clickable ? "button" : "div";
            return (
              <Comp key={i} onClick={clickable ? () => setTab(s.tab) : undefined} className="flex items-center gap-3 px-3 py-2.5 rounded-2xl w-full text-left" style={{ background: C.glassSoft, backdropFilter: "blur(14px)", border: `1px solid ${C.glassBorder}` }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: C.primarySoft }}><s.Icon size={15} style={{ color: C.primary }} /></div>
                <p className="flex-1 text-xs font-semibold" style={{ color: C.text, ...fontBody }}>{s.label}</p>
                <span style={{ ...fontMono, color: C.primary, fontSize: 11 }}>{s.timeLabel}</span>
                {clickable && <ChevronRightIcon size={14} style={{ color: C.textFaint }} />}
              </Comp>
            );
          })}
          {!plan.restDay && !programPlan.heure && (
            <button onClick={!isPro ? openPro : undefined} className="flex items-center gap-1.5 mt-1 px-1 text-left">
              {!isPro && <Lock size={11} style={{ color: C.textFaint }} />}
              <p className="text-[10px]" style={{ color: C.textFaint, ...fontBody }}>{isPro ? T.noHeureHint : T.proTimingHint}</p>
            </button>
          )}
        </div>
      )}
      {tab === "avant" && !plan.restDay && (
        <div className="flex flex-col gap-3">
          <p className="text-[11px] px-1 -mt-1 mb-1" style={{ color: C.textFaint, ...fontBody }}>{T.warmupIntro}</p>
          {plan.warmup.map((s, i) => <Card key={i}><div className="flex justify-between items-start mb-1"><p className="font-semibold text-sm" style={{ color: C.text, ...fontBody }}>{s.label}</p><span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: C.primarySoft, color: C.primary, ...fontMono }}>{s.duree}</span></div><p className="text-xs leading-relaxed" style={{ color: C.textMuted, ...fontBody }}>{s.instr}</p></Card>)}
        </div>
      )}
      {tab === "etirements" && <div className="flex flex-col gap-3">{plan.stretches.map((s, i) => <Card key={i}><div className="flex justify-between items-start mb-1"><p className="font-semibold text-sm" style={{ color: C.text, ...fontBody }}>{s.label}</p><span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: C.primarySoft, color: C.primary, ...fontMono }}>{s.duree}</span></div><p className="text-xs leading-relaxed" style={{ color: C.textMuted, ...fontBody }}>{s.instr}</p></Card>)}</div>}
      {tab === "massage" && <Card><SectionTitle icon={HeartPulse}>{plan.massage.titre}</SectionTitle><p className="text-xs leading-relaxed" style={{ color: C.textMuted, ...fontBody }}>{plan.massage.texte}</p></Card>}
      {tab === "froid" && <div className="flex flex-col gap-3">{plan.coldHeat.map((c, i) => <Card key={i}><div className="flex items-center gap-2 mb-1">{c.type === "froid" ? <Snowflake size={14} style={{ color: "#6BC6FF" }} /> : c.type === "chaud" ? <Flame size={14} style={{ color: C.warn }} /> : <Zap size={14} style={{ color: C.primary }} />}<p className="font-semibold text-sm" style={{ color: C.text, ...fontBody }}>{c.titre}</p></div><p className="text-xs leading-relaxed" style={{ color: C.textMuted, ...fontBody }}>{c.texte}</p></Card>)}</div>}
      {tab === "nutrition" && (
        <div className="flex flex-col gap-3">
          <ProLock active={!isPro}>
            <Card>
              <SectionTitle icon={Flame} action={<ProBadge />}>{T.needsToday}</SectionTitle>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div><p style={{ ...fontMono, color: C.primary, fontSize: 17 }}>{plan.nutrients.kcal}</p><p className="text-[9px] uppercase" style={{ color: C.textFaint }}>{T.kcal}</p></div>
                <div><p style={{ ...fontMono, color: C.text, fontSize: 17 }}>{plan.nutrients.protein}g</p><p className="text-[9px] uppercase" style={{ color: C.textFaint }}>{T.protein}</p></div>
                <div><p style={{ ...fontMono, color: C.text, fontSize: 17 }}>{plan.nutrients.carbs}g</p><p className="text-[9px] uppercase" style={{ color: C.textFaint }}>{T.carbs}</p></div>
                <div><p style={{ ...fontMono, color: C.text, fontSize: 17 }}>{plan.nutrients.fat}g</p><p className="text-[9px] uppercase" style={{ color: C.textFaint }}>{T.fat}</p></div>
              </div>
              <p className="text-[10px] mt-2" style={{ color: C.textFaint, ...fontBody }}>{T.estimateNote}</p>
            </Card>
          </ProLock>
          {plan.restDay ? (
            <>
              <Card><SectionTitle icon={Clock}>{T.mealMain}</SectionTitle><p className="text-xs leading-relaxed" style={{ color: C.textMuted, ...fontBody }}>{plan.meals.pre}</p><p className="text-[10px] mt-2" style={{ color: C.textFaint, ...fontBody }}>{T.spreadDay}</p></Card>
              <Card><SectionTitle icon={TrendingUp}>{T.mealSnack}</SectionTitle><p className="text-xs leading-relaxed" style={{ color: C.textMuted, ...fontBody }}>{plan.meals.post}</p></Card>
            </>
          ) : (
            <>
              <Card><SectionTitle icon={Clock}>{T.mealBefore}</SectionTitle><p className="text-xs leading-relaxed mb-2" style={{ color: C.textMuted, ...fontBody }}>{plan.meals.pre}</p><p className="text-[10px] font-semibold" style={{ color: C.primary, ...fontBody }}>{T.toEatAt(timing.pre)}</p></Card>
              <Card><SectionTitle icon={TrendingUp}>{T.mealAfter}</SectionTitle><p className="text-xs leading-relaxed mb-2" style={{ color: C.textMuted, ...fontBody }}>{plan.meals.post}</p><p className="text-[10px] font-semibold" style={{ color: C.primary, ...fontBody }}>{T.toEatAt(timing.post)}</p></Card>
            </>
          )}
          <Card><SectionTitle icon={Droplet}>{T.hydration}</SectionTitle><div className="flex items-center gap-3"><span style={{ ...fontMono, color: C.primary, fontSize: 26 }}>{plan.hydratation}L</span><span className="text-xs" style={{ color: C.textMuted, ...fontBody }}>{T.recommendedDay}</span></div></Card>
        </div>
      )}
      {tab === "produits" && <div className="flex flex-col gap-3">{plan.produits.map((p, i) => <Card key={i}><p className="text-xs leading-relaxed" style={{ color: C.textMuted, ...fontBody }}>{p}</p></Card>)}</div>}
    </div>
  );
}

/* ============================================================
   AUTH
   ============================================================ */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;
function passwordRules(lang) {
  return [
    { test: (p) => p.length >= 8, label: tr(lang, { fr: "8 caractères minimum", en: "8 characters minimum", es: "8 caracteres mínimo", pt: "8 caracteres no mínimo" }) },
    { test: (p) => /[a-z]/.test(p), label: tr(lang, { fr: "Une minuscule", en: "One lowercase letter", es: "Una minúscula", pt: "Uma minúscula" }) },
    { test: (p) => /[A-Z]/.test(p), label: tr(lang, { fr: "Une majuscule", en: "One uppercase letter", es: "Una mayúscula", pt: "Uma maiúscula" }) },
    { test: (p) => /[0-9]/.test(p), label: tr(lang, { fr: "Un chiffre", en: "One number", es: "Un número", pt: "Um número" }) },
    { test: (p) => /[^A-Za-z0-9]/.test(p), label: tr(lang, { fr: "Un caractère spécial", en: "One special character", es: "Un carácter especial", pt: "Um caractere especial" }) },
  ];
}
const isPasswordValid = (p, lang) => passwordRules(lang).every((r) => r.test(p));

function ResetPasswordScreen({ token, onDone }) {
  const { lang } = useLang();
  const [password, setPassword] = useState(""); const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false); const [done, setDone] = useState(false);
  const T = {
    title: tr(lang, { fr: "Nouveau mot de passe", en: "New password", es: "Nueva contraseña", pt: "Nova senha" }),
    note: tr(lang, { fr: "Choisis un nouveau mot de passe pour ton compte.", en: "Choose a new password for your account.", es: "Elige una nueva contraseña para tu cuenta.", pt: "Escolha uma nova senha para sua conta." }),
    password: tr(lang, { fr: "Nouveau mot de passe", en: "New password", es: "Nueva contraseña", pt: "Nova senha" }),
    confirmPassword: tr(lang, { fr: "Confirmer le mot de passe", en: "Confirm password", es: "Confirmar contraseña", pt: "Confirmar senha" }),
    mismatch: tr(lang, { fr: "Les mots de passe ne correspondent pas.", en: "Passwords don't match.", es: "Las contraseñas no coinciden.", pt: "As senhas não coincidem." }),
    invalid: tr(lang, { fr: "Le mot de passe ne respecte pas tous les critères de sécurité ci-dessous.", en: "The password doesn't meet all the security criteria below.", es: "La contraseña no cumple todos los criterios de seguridad de abajo.", pt: "A senha não atende a todos os critérios de segurança abaixo." }),
    submit: tr(lang, { fr: "Valider le nouveau mot de passe", en: "Confirm new password", es: "Confirmar nueva contraseña", pt: "Confirmar nova senha" }),
    doneMsg: tr(lang, { fr: "Mot de passe mis à jour ✅ Tu peux maintenant te connecter avec.", en: "Password updated ✅ You can now log in with it.", es: "Contraseña actualizada ✅ Ya puedes iniciar sesión con ella.", pt: "Senha atualizada ✅ Você já pode entrar com ela." }),
    continueBtn: tr(lang, { fr: "Aller à la connexion", en: "Go to login", es: "Ir a iniciar sesión", pt: "Ir para o login" }),
  };
  const submit = async () => {
    setError("");
    if (!isPasswordValid(password, lang)) { setError(T.invalid); return; }
    if (password !== confirmPassword) { setError(T.mismatch); return; }
    setLoading(true);
    try { await sbSetNewPassword(token, password); setDone(true); }
    catch (err) { setError(String(err.message || err)); }
    setLoading(false);
  };
  return (
    <div className="flex-1 min-h-0 overflow-y-auto flex flex-col justify-center px-6 py-10">
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 rounded-[20px] flex items-center justify-center mb-4" style={{ background: `linear-gradient(155deg, ${C.primary}33, ${C.primaryAlt}1A)`, border: `1px solid ${C.primary}40`, backdropFilter: "blur(12px)" }}><Lock size={26} style={{ color: C.primary }} /></div>
        <h1 className="text-[22px] font-extrabold tracking-tight text-center" style={{ color: C.text, ...fontDisplay }}>{T.title}</h1>
        {!done && <p className="text-xs mt-1 text-center" style={{ color: C.textMuted, ...fontBody }}>{T.note}</p>}
      </div>
      {done ? (
        <>
          <p className="text-sm text-center mb-6" style={{ color: C.primary, ...fontBody }}>{T.doneMsg}</p>
          <Btn full onClick={onDone}>{T.continueBtn}</Btn>
        </>
      ) : (
        <>
          <Field label={T.password}>
            <div className="relative">
              <TextInput type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-2.5" type="button">{showPw ? <EyeOff size={16} style={{ color: C.textMuted }} /> : <Eye size={16} style={{ color: C.textMuted }} />}</button>
            </div>
          </Field>
          <div className="mb-4 -mt-2 px-3 py-2.5 rounded-2xl" style={{ background: C.bgElevated, backdropFilter: "blur(14px)", border: `1px solid ${C.glassBorder}` }}>
            {passwordRules(lang).map((r, i) => {
              const ok = r.test(password);
              return (
                <div key={i} className="flex items-center gap-2 py-0.5">
                  <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0" style={{ background: ok ? C.primary : "transparent", border: `1px solid ${ok ? C.primary : C.border}` }}>{ok && <Check size={9} color="#052821" />}</div>
                  <span className="text-[11px]" style={{ color: ok ? C.text : C.textFaint, ...fontBody }}>{r.label}</span>
                </div>
              );
            })}
          </div>
          <Field label={T.confirmPassword}><TextInput type={showPw ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" /></Field>
          {error && <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl text-xs" style={{ background: C.dangerSoft, color: C.danger, backdropFilter: "blur(10px)", ...fontBody }}><AlertTriangle size={14} /> {error}</div>}
          <Btn full onClick={submit} disabled={loading}>{loading ? "..." : T.submit}</Btn>
        </>
      )}
    </div>
  );
}

function AuthScreen({ onAuth }) {
  const { lang } = useLang();
  const [mode, setMode] = useState("login");
  const [nom, setNom] = useState(""); const [prenom, setPrenom] = useState(""); const [username, setUsername] = useState("");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false); const [showPw2, setShowPw2] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [staySignedIn, setStaySignedIn] = useState(false);

  const T = {
    tagline: tr(lang, { fr: "Ta récupération, pilotée précisément.", en: "Your recovery, precisely guided.", es: "Tu recuperación, guiada con precisión.", pt: "Sua recuperação, guiada com precisão." }),
    login: tr(lang, { fr: "Connexion", en: "Log in", es: "Iniciar sesión", pt: "Entrar" }),
    signup: tr(lang, { fr: "Inscription", en: "Sign up", es: "Registrarse", pt: "Cadastrar" }),
    firstName: tr(lang, { fr: "Prénom", en: "First name", es: "Nombre", pt: "Nome" }),
    firstNamePh: tr(lang, { fr: "Ton prénom", en: "Your first name", es: "Tu nombre", pt: "Seu nome" }),
    lastName: tr(lang, { fr: "Nom", en: "Last name", es: "Apellido", pt: "Sobrenome" }),
    lastNamePh: tr(lang, { fr: "Ton nom", en: "Your last name", es: "Tu apellido", pt: "Seu sobrenome" }),
    username: tr(lang, { fr: "Nom d'utilisateur", en: "Username", es: "Nombre de usuario", pt: "Nome de usuário" }),
    usernameHint: tr(lang, { fr: "Utilisé pour t'identifier dans l'app. Unique, 3-20 caractères (lettres, chiffres, _).", en: "Used to identify you in the app. Unique, 3-20 characters (letters, numbers, _).", es: "Se usa para identificarte en la app. Único, 3-20 caracteres (letras, números, _).", pt: "Usado para te identificar no app. Único, 3-20 caracteres (letras, números, _)." }),
    email: tr(lang, { fr: "Email", en: "Email", es: "Correo electrónico", pt: "Email" }),
    password: tr(lang, { fr: "Mot de passe", en: "Password", es: "Contraseña", pt: "Senha" }),
    confirmPassword: tr(lang, { fr: "Confirmer le mot de passe", en: "Confirm password", es: "Confirmar contraseña", pt: "Confirmar senha" }),
    mismatch: tr(lang, { fr: "Les mots de passe ne correspondent pas.", en: "Passwords don't match.", es: "Las contraseñas no coinciden.", pt: "As senhas não coincidem." }),
    submitLogin: tr(lang, { fr: "Se connecter", en: "Log in", es: "Iniciar sesión", pt: "Entrar" }),
    submitSignup: tr(lang, { fr: "Créer mon compte", en: "Create my account", es: "Crear mi cuenta", pt: "Criar minha conta" }),
    disclaimer: tr(lang, { fr: "Connecté à ta base de données — ton compte est accessible depuis n'importe quel appareil.", en: "Connected to your database — your account is accessible from any device.", es: "Conectado a tu base de datos — tu cuenta es accesible desde cualquier dispositivo.", pt: "Conectado ao seu banco de dados — sua conta é acessível de qualquer dispositivo." }),
    legalTerms: tr(lang, { fr: "Conditions d'utilisation", en: "Terms of use", es: "Condiciones de uso", pt: "Termos de uso" }),
    legalPrivacy: tr(lang, { fr: "Confidentialité", en: "Privacy", es: "Privacidad", pt: "Privacidade" }),
    forgotLink: tr(lang, { fr: "Mot de passe oublié ?", en: "Forgot your password?", es: "¿Olvidaste tu contraseña?", pt: "Esqueceu sua senha?" }),
    staySignedIn: tr(lang, { fr: "Rester connecté", en: "Stay signed in", es: "Mantener sesión iniciada", pt: "Manter conectado" }),
    forgotTitle: tr(lang, { fr: "Réinitialiser le mot de passe", en: "Reset your password", es: "Restablecer contraseña", pt: "Redefinir senha" }),
    forgotNote: tr(lang, { fr: "Renseigne ton email ci-dessus, on t'envoie un lien pour choisir un nouveau mot de passe.", en: "Enter your email above, we'll send you a link to set a new password.", es: "Indica tu correo arriba, te enviaremos un enlace para elegir una nueva contraseña.", pt: "Informe seu email acima, enviaremos um link para escolher uma nova senha." }),
    forgotSend: tr(lang, { fr: "Envoyer le lien", en: "Send the link", es: "Enviar el enlace", pt: "Enviar o link" }),
    forgotSentMsg: tr(lang, { fr: "Email envoyé (si un compte existe avec cette adresse) — vérifie ta boîte mail.", en: "Email sent (if an account exists with this address) — check your inbox.", es: "Correo enviado (si existe una cuenta con esta dirección) — revisa tu bandeja.", pt: "Email enviado (se existir uma conta com este endereço) — verifique sua caixa de entrada." }),
    forgotNeedEmail: tr(lang, { fr: "Renseigne d'abord ton email ci-dessus.", en: "Enter your email above first.", es: "Indica primero tu correo arriba.", pt: "Informe seu email acima primeiro." }),
    close: tr(lang, { fr: "Fermer", en: "Close", es: "Cerrar", pt: "Fechar" }),
  };

  const sendForgot = async () => {
    if (!EMAIL_REGEX.test(email)) { setError(T.forgotNeedEmail); return; }
    setError(""); setForgotLoading(true);
    try { await sbRecoverPassword(email.toLowerCase().trim()); setForgotSent(true); }
    catch { setForgotSent(true); } // on affiche toujours le même message, pour ne pas révéler si un compte existe avec cet email
    setForgotLoading(false);
  };

  const submit = async () => {
    setError("");
    if (mode === "signup") {
      if (!nom || !prenom || !username || !email || !password || !confirmPassword) { setError(tr(lang, { fr: "Merci de remplir tous les champs.", en: "Please fill in all fields.", es: "Por favor completa todos los campos.", pt: "Por favor, preencha todos os campos." })); return; }
      if (!USERNAME_REGEX.test(username)) { setError(tr(lang, { fr: "Le nom d'utilisateur doit faire 3 à 20 caractères : lettres, chiffres, underscore uniquement.", en: "Username must be 3-20 characters: letters, numbers, underscore only.", es: "El nombre de usuario debe tener 3-20 caracteres: solo letras, números y guion bajo.", pt: "O nome de usuário deve ter 3-20 caracteres: apenas letras, números e underscore." })); return; }
      if (!EMAIL_REGEX.test(email)) { setError(tr(lang, { fr: "Adresse email invalide. Vérifie le format (ex : toi@exemple.com).", en: "Invalid email address. Check the format (e.g. you@example.com).", es: "Correo electrónico no válido. Verifica el formato (ej: tu@ejemplo.com).", pt: "Email inválido. Verifique o formato (ex: voce@exemplo.com)." })); return; }
      if (!isPasswordValid(password, lang)) { setError(tr(lang, { fr: "Le mot de passe ne respecte pas tous les critères de sécurité ci-dessous.", en: "The password doesn't meet all the security criteria below.", es: "La contraseña no cumple todos los criterios de seguridad de abajo.", pt: "A senha não atende a todos os critérios de segurança abaixo." })); return; }
      if (password !== confirmPassword) { setError(tr(lang, { fr: "Les deux mots de passe ne correspondent pas.", en: "The two passwords don't match.", es: "Las dos contraseñas no coinciden.", pt: "As duas senhas não coincidem." })); return; }
    } else if (!email || !password) { setError(tr(lang, { fr: "Merci de remplir tous les champs.", en: "Please fill in all fields.", es: "Por favor completa todos los campos.", pt: "Por favor, preencha todos os campos." })); return; }

    setLoading(true);
    try {
      // Comme l'app ne recharge jamais réellement la page (SPA), Safari ne
      // détecte pas toujours tout seul qu'une connexion vient de réussir.
      // On lui demande explicitement de proposer d'enregistrer le mot de
      // passe, via l'API dédiée d'Apple — sans effet si non supportée.
      const offerToSavePassword = async () => {
        try {
          if (window.PasswordCredential && navigator.credentials?.store) {
            await navigator.credentials.store(new window.PasswordCredential({ id: email.toLowerCase().trim(), password, name: prenom || email }));
          }
        } catch {}
      };
      if (mode === "signup") {
        const result = await sbAuth("signup", { email: email.toLowerCase().trim(), password, data: { nom, prenom, username } });
        if (!result.access_token) {
          // Confirmation email activée côté Supabase : pas de session immédiate.
          setLoading(false);
          setError(tr(lang, { fr: "Compte créé — vérifie ta boîte mail pour confirmer avant de te connecter.", en: "Account created — check your inbox to confirm before logging in.", es: "Cuenta creada — revisa tu correo para confirmar antes de iniciar sesión.", pt: "Conta criada — verifique seu email para confirmar antes de entrar." }));
          setMode("login");
          return;
        }
        const data = await loadUserData(result.user.id, result.access_token, { nom, prenom, username });
        await offerToSavePassword();
        setLoading(false);
        onAuth(result.user, result.access_token, data, result.refresh_token, staySignedIn);
      } else {
        const result = await sbAuth("token?grant_type=password", { email: email.toLowerCase().trim(), password });
        const data = await loadUserData(result.user.id, result.access_token, result.user.user_metadata);
        await offerToSavePassword();
        setLoading(false);
        onAuth(result.user, result.access_token, data, result.refresh_token, staySignedIn);
      }
    } catch (err) {
      setLoading(false);
      const msg = String(err.message || "");
      if (msg.includes("already registered") || msg.includes("already exists")) setError(tr(lang, { fr: "Un compte existe déjà avec cet email.", en: "An account already exists with this email.", es: "Ya existe una cuenta con este correo.", pt: "Já existe uma conta com este email." }));
      else if (msg.includes("Invalid login") || msg.includes("Invalid")) setError(tr(lang, { fr: "Email ou mot de passe incorrect.", en: "Incorrect email or password.", es: "Correo o contraseña incorrectos.", pt: "Email ou senha incorretos." }));
      else setError(msg || tr(lang, { fr: "Une erreur est survenue, réessaie.", en: "Something went wrong, try again.", es: "Ocurrió un error, inténtalo de nuevo.", pt: "Ocorreu um erro, tente novamente." }));
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto flex flex-col justify-center px-6 py-10">
      <div className="flex justify-center mb-4"><LanguageSwitcher compact /></div>
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 rounded-[20px] flex items-center justify-center mb-4 overflow-hidden" style={{ background: `linear-gradient(155deg, ${C.primary}33, ${C.primaryAlt}1A)`, border: `1px solid ${C.primary}40`, backdropFilter: "blur(12px)" }}><img src={APP_LOGO} alt="REGEN" className="w-full h-full object-cover" /></div>
        <h1 className="text-[26px] font-extrabold tracking-tight" style={{ color: C.text, ...fontDisplay }}>REGEN</h1>
        <p className="text-xs mt-1" style={{ color: C.textMuted, ...fontBody }}>{T.tagline}</p>
      </div>
      <div className="flex rounded-2xl mb-6 p-1.5" style={{ background: C.bgElevated, backdropFilter: "blur(14px)", border: `1px solid ${C.glassBorder}`, minHeight: 60 }}>
        <button type="button" onClick={() => { setMode("login"); setError(""); }} className="flex-1 rounded-xl text-base font-bold transition-colors" style={{ minHeight: 48, background: mode === "login" ? C.surface : "transparent", color: mode === "login" ? C.primary : C.textMuted, ...fontBody }}>{T.login}</button>
        <button type="button" onClick={() => { setMode("signup"); setError(""); }} className="flex-1 rounded-xl text-base font-bold transition-colors" style={{ minHeight: 48, background: mode === "signup" ? C.surface : "transparent", color: mode === "signup" ? C.primary : C.textMuted, ...fontBody }}>{T.signup}</button>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
      {mode === "signup" && (
        <>
          <div className="flex gap-2">
            <div className="flex-1"><Field label={T.firstName}><TextInput value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder={T.firstNamePh} autoComplete="given-name" name="given-name" /></Field></div>
            <div className="flex-1"><Field label={T.lastName}><TextInput value={nom} onChange={(e) => setNom(e.target.value)} placeholder={T.lastNamePh} autoComplete="family-name" name="family-name" /></Field></div>
          </div>
          <Field label={T.username}>
            <TextInput value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ex: alex_92" autoComplete="username" name="username" />
            <p className="text-[10px] mt-1.5" style={{ color: C.textFaint, ...fontBody }}>{T.usernameHint}</p>
          </Field>
        </>
      )}
      <Field label={T.email}><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="toi@exemple.com" autoComplete="email" name="email" id="email" /></Field>
      <Field label={T.password}>
        <div className="relative">
          <TextInput type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} onFocus={() => setPwFocused(true)} placeholder="••••••••" autoComplete={mode === "signup" ? "new-password" : "current-password"} name="password" id="password" />
          <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-2.5" type="button">{showPw ? <EyeOff size={16} style={{ color: C.textMuted }} /> : <Eye size={16} style={{ color: C.textMuted }} />}</button>
        </div>
      </Field>

      {mode === "signup" && (pwFocused || password) && (
        <div className="mb-4 -mt-2 px-3 py-2.5 rounded-2xl" style={{ background: C.bgElevated, backdropFilter: "blur(14px)", border: `1px solid ${C.glassBorder}` }}>
          {passwordRules(lang).map((r, i) => {
            const ok = r.test(password);
            return (
              <div key={i} className="flex items-center gap-2 py-0.5">
                <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0" style={{ background: ok ? C.primary : "transparent", border: `1px solid ${ok ? C.primary : C.border}` }}>{ok && <Check size={9} color="#052821" />}</div>
                <span className="text-[11px]" style={{ color: ok ? C.text : C.textFaint, ...fontBody }}>{r.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {mode === "signup" && (
        <Field label={T.confirmPassword}>
          <div className="relative">
            <TextInput type={showPw2 ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" name="confirm-password" />
            <button onClick={() => setShowPw2(!showPw2)} className="absolute right-3 top-2.5" type="button">{showPw2 ? <EyeOff size={16} style={{ color: C.textMuted }} /> : <Eye size={16} style={{ color: C.textMuted }} />}</button>
          </div>
          {confirmPassword && confirmPassword !== password && <p className="text-[10px] mt-1.5" style={{ color: C.danger, ...fontBody }}>{T.mismatch}</p>}
        </Field>
      )}

      {mode === "login" && (
        <button type="button" onClick={() => setStaySignedIn(!staySignedIn)} className="flex items-center gap-2.5 mb-4 -mt-1">
          <div className="w-4 h-4 rounded-md flex items-center justify-center shrink-0" style={{ background: staySignedIn ? C.primary : "transparent", border: `1px solid ${staySignedIn ? C.primary : C.border}` }}>{staySignedIn && <Check size={11} color="#052821" />}</div>
          <span className="text-xs" style={{ color: C.textMuted, ...fontBody }}>{T.staySignedIn}</span>
        </button>
      )}

      {error && <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl text-xs" style={{ background: C.dangerSoft, color: C.danger, backdropFilter: "blur(10px)", ...fontBody }}><AlertTriangle size={14} /> {error}</div>}
      <Btn type="submit" full disabled={loading}>{loading ? "..." : mode === "login" ? T.submitLogin : T.submitSignup}</Btn>
      {mode === "login" && (
        <button type="button" onClick={() => { setForgotOpen(true); setForgotSent(false); }} className="w-full text-center mt-4 text-[11px]" style={{ color: C.primary, ...fontBody }}>{T.forgotLink}</button>
      )}
      </form>
      <p className="text-[10px] text-center mt-6" style={{ color: C.textFaint, ...fontBody }}>{T.disclaimer}</p>
      <p className="text-[10px] text-center mt-2" style={{ color: C.textFaint, ...fontBody }}>
        <a href="/conditions.html" target="_blank" rel="noopener noreferrer" style={{ color: C.textMuted, textDecoration: "underline" }}>{T.legalTerms}</a>
        {" · "}
        <a href="/confidentialite.html" target="_blank" rel="noopener noreferrer" style={{ color: C.textMuted, textDecoration: "underline" }}>{T.legalPrivacy}</a>
      </p>

      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={() => setForgotOpen(false)}>
          <div className="w-full rounded-t-[28px] p-5" style={{ background: "rgba(15,33,28,0.92)", backdropFilter: "blur(32px)", border: `1px solid ${C.glassBorder}`, paddingBottom: "max(24px, env(safe-area-inset-bottom))" }} onClick={(e) => e.stopPropagation()}>
            <div className="w-9 h-1 rounded-full mx-auto mb-4" style={{ background: C.border }} />
            <h3 className="font-bold text-base mb-2" style={{ color: C.text, ...fontDisplay }}>{T.forgotTitle}</h3>
            {forgotSent ? (
              <p className="text-xs leading-relaxed mb-4" style={{ color: C.primary, ...fontBody }}>{T.forgotSentMsg}</p>
            ) : (
              <p className="text-xs leading-relaxed mb-4" style={{ color: C.textMuted, ...fontBody }}>{T.forgotNote}</p>
            )}
            <div className="flex gap-2">
              {!forgotSent && <Btn full onClick={sendForgot} disabled={forgotLoading}>{forgotLoading ? "..." : T.forgotSend}</Btn>}
              <Btn full variant="ghost" onClick={() => setForgotOpen(false)}>{T.close}</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   MULTI-SPORT / ZONE PICKERS
   ============================================================ */
function SportGrid({ selected, onToggle }) {
  const { lang } = useLang();
  return (
    <div className="grid grid-cols-3 gap-2">
      {Object.entries(SPORTS).filter(([k]) => k !== "autre").map(([key, s]) => (
        <button key={key} onClick={() => onToggle(key)} className="rounded-2xl p-3 flex flex-col items-center gap-1" style={{ background: selected.includes(key) ? C.primarySoft : C.surface, border: `1px solid ${selected.includes(key) ? C.primary : C.borderSoft}66` }}>
          <span className="text-xl">{s.icon}</span><span className="text-[10px] text-center" style={{ color: selected.includes(key) ? C.primary : C.textMuted, ...fontBody }}>{sportLabel(key, lang)}</span>
          {selected.includes(key) && <Check size={11} style={{ color: C.primary }} />}
        </button>
      ))}
    </div>
  );
}
function MuscuZonePicker({ selected, onToggle }) {
  const { lang } = useLang();
  return (
    <div className="flex flex-wrap gap-1.5">
      {Object.keys(MUSCU_ZONES).map((k) => (
        <button key={k} onClick={() => onToggle(k)} className="px-2.5 py-1.5 rounded-full text-[11px] font-semibold" style={{ background: selected.includes(k) ? C.primary : C.glassSoft, color: selected.includes(k) ? "#052821" : C.textMuted, border: `1px solid ${selected.includes(k) ? C.primary : C.glassBorder}`, backdropFilter: "blur(8px)", ...fontBody }}>{MUSCU_ZONES[k].icon} {zoneLabel(k, lang)}</button>
      ))}
    </div>
  );
}

/* ============================================================
   ONBOARDING
   ============================================================ */
function Onboarding({ onComplete }) {
  const { lang } = useLang();
  const { isPro, isTrial, startTrial } = usePro();
  const [step, setStep] = useState(0);
  const [p, setP] = useState({ sexe: "homme", dateNaissance: "", taille: "", poids: "", sports: [], niveau: "intermediaire", equipement: [], allergies: [], dislikedFoods: [] });
  const toggleSport = (k) => {
    setP((prev) => {
      const already = prev.sports.includes(k);
      if (already) return { ...prev, sports: prev.sports.filter((x) => x !== k) };
      if (!isPro && prev.sports.length >= 1) return prev;
      return { ...prev, sports: [...prev.sports, k] };
    });
  };
  const toggleEquip = (e) => setP((prev) => ({ ...prev, equipement: prev.equipement.includes(e) ? prev.equipement.filter((x) => x !== e) : [...prev.equipement, e] }));
  const toggleAllergy = (k) => setP((prev) => ({ ...prev, allergies: prev.allergies.includes(k) ? prev.allergies.filter((x) => x !== k) : [...prev.allergies, k] }));
  const [dislikedInput, setDislikedInput] = useState("");
  const addDisliked = () => {
    const val = dislikedInput.trim();
    if (!val) return;
    setP((prev) => ({ ...prev, dislikedFoods: [...prev.dislikedFoods, val] }));
    setDislikedInput("");
  };
  const removeDisliked = (i) => setP((prev) => ({ ...prev, dislikedFoods: prev.dislikedFoods.filter((_, idx) => idx !== i) }));
  const steps = [tr(lang, { fr: "Toi", en: "You", es: "Tú", pt: "Você" }), tr(lang, { fr: "Ton offre", en: "Your plan", es: "Tu plan", pt: "Seu plano" }), tr(lang, { fr: "Tes sports", en: "Your sports", es: "Tus deportes", pt: "Seus esportes" }), tr(lang, { fr: "Ton matériel", en: "Your equipment", es: "Tu equipo", pt: "Seu equipamento" }), tr(lang, { fr: "Alimentation", en: "Food", es: "Alimentación", pt: "Alimentação" })];
  const canNext = step === 0 ? p.dateNaissance && p.taille && p.poids : step === 2 ? p.sports.length > 0 : true;
  const T = {
    step: tr(lang, { fr: "Étape", en: "Step", es: "Paso", pt: "Etapa" }),
    sexe: tr(lang, { fr: "Sexe", en: "Sex", es: "Sexo", pt: "Sexo" }),
    birth: tr(lang, { fr: "Date de naissance", en: "Date of birth", es: "Fecha de nacimiento", pt: "Data de nascimento" }),
    ageHint: (age) => tr(lang, { fr: `→ ${age} ans. Ton âge se recalculera automatiquement avec le temps.`, en: `→ ${age} years old. Your age will update automatically over time.`, es: `→ ${age} años. Tu edad se recalculará automáticamente con el tiempo.`, pt: `→ ${age} anos. Sua idade será recalculada automaticamente com o tempo.` }),
    height: tr(lang, { fr: "Taille (cm)", en: "Height (cm)", es: "Altura (cm)", pt: "Altura (cm)" }),
    weight: tr(lang, { fr: "Poids (kg)", en: "Weight (kg)", es: "Peso (kg)", pt: "Peso (kg)" }),
    sportsLabel: tr(lang, { fr: "Sport(s) pratiqué(s)", en: "Sport(s) practiced", es: "Deporte(s) practicado(s)", pt: "Esporte(s) praticado(s)" }),
    sportsFreeHint: tr(lang, { fr: "Compte gratuit : 1 sport (Pro permet d'en ajouter plusieurs, plus tard depuis ton profil).", en: "Free plan: 1 sport (Pro lets you add several, later from your profile).", es: "Plan gratuito: 1 deporte (Pro permite añadir varios, luego desde tu perfil).", pt: "Plano grátis: 1 esporte (o Pro permite adicionar vários, depois pelo seu perfil)." }),
    niveauLabel: tr(lang, { fr: "Niveau de pratique général", en: "General skill level", es: "Nivel de práctica general", pt: "Nível de prática geral" }),
    equipLabel: tr(lang, { fr: "Matériel disponible chez toi", en: "Equipment you have at home", es: "Equipo disponible en casa", pt: "Equipamento disponível em casa" }),
    allergiesLabel: tr(lang, { fr: "Allergies alimentaires", en: "Food allergies", es: "Alergias alimentarias", pt: "Alergias alimentares" }),
    allergiesHint: tr(lang, { fr: "Optionnel — modifiable à tout moment depuis ton profil.", en: "Optional — editable anytime from your profile.", es: "Opcional — editable en cualquier momento desde tu perfil.", pt: "Opcional — editável a qualquer momento pelo seu perfil." }),
    dislikedLabel: tr(lang, { fr: "Aliments à éviter", en: "Foods to avoid", es: "Alimentos a evitar", pt: "Alimentos a evitar" }),
    dislikedHint: tr(lang, { fr: "Ces aliments ne seront plus jamais proposés dans tes repas conseillés.", en: "These foods will never be suggested in your recommended meals again.", es: "Estos alimentos ya no se sugerirán en tus comidas recomendadas.", pt: "Esses alimentos não serão mais sugeridos nas suas refeições recomendadas." }),
    dislikedPh: tr(lang, { fr: "ex : brocolis, thon...", en: "e.g. broccoli, tuna...", es: "ej. brócoli, atún...", pt: "ex: brócolis, atum..." }),
    add: tr(lang, { fr: "Ajouter", en: "Add", es: "Añadir", pt: "Adicionar" }),
    back: tr(lang, { fr: "Retour", en: "Back", es: "Atrás", pt: "Voltar" }),
    next: tr(lang, { fr: "Continuer", en: "Continue", es: "Continuar", pt: "Continuar" }),
    create: tr(lang, { fr: "Créer mon profil", en: "Create my profile", es: "Crear mi perfil", pt: "Criar meu perfil" }),
    planQuestion: tr(lang, { fr: "Comment veux-tu commencer ?", en: "How do you want to start?", es: "¿Cómo quieres empezar?", pt: "Como você quer começar?" }),
    freeTitle: tr(lang, { fr: "Gratuit", en: "Free", es: "Gratis", pt: "Grátis" }),
    freeF1: tr(lang, { fr: "1 sport, 1 séance par jour", en: "1 sport, 1 session per day", es: "1 deporte, 1 sesión al día", pt: "1 esporte, 1 sessão por dia" }),
    freeF2: tr(lang, { fr: "Récup ponctuelle & conseils blessures", en: "One-off recovery & injury guidance", es: "Recuperación puntual y orientación de lesiones", pt: "Recuperação pontual e orientação de lesões" }),
    freeF3: tr(lang, { fr: `${FREE_EXCEPTIONS_PER_MONTH} RDV/exceptions par mois`, en: `${FREE_EXCEPTIONS_PER_MONTH} appointments/exceptions per month`, es: `${FREE_EXCEPTIONS_PER_MONTH} citas/excepciones al mes`, pt: `${FREE_EXCEPTIONS_PER_MONTH} consultas/exceções por mês` }),
    proTitle: tr(lang, { fr: "Pro — 7 jours gratuits", en: "Pro — 7 days free", es: "Pro — 7 días gratis", pt: "Pro — 7 dias grátis" }),
    proF1: tr(lang, { fr: "Sports & séances illimités", en: "Unlimited sports & sessions", es: "Deportes y sesiones ilimitados", pt: "Esportes e sessões ilimitados" }),
    proF2: tr(lang, { fr: "Nutrition avancée & récup intelligente", en: "Advanced nutrition & smart recovery", es: "Nutrición avanzada y recuperación inteligente", pt: "Nutrição avançada e recuperação inteligente" }),
    proF3: tr(lang, { fr: "RDV/exceptions illimités", en: "Unlimited appointments/exceptions", es: "Citas/excepciones ilimitadas", pt: "Consultas/exceções ilimitadas" }),
    proPrice: tr(lang, { fr: "Puis 5,99€/mois ou 39,99€/an. Résiliable à tout moment.", en: "Then $5.99/mo or $39.99/yr. Cancel anytime.", es: "Luego 5,99€/mes o 39,99€/año. Cancela cuando quieras.", pt: "Depois 5,99€/mês ou 39,99€/ano. Cancele quando quiser." }),
    choose: tr(lang, { fr: "Choisir", en: "Choose", es: "Elegir", pt: "Escolher" }),
    chosenFree: tr(lang, { fr: "Tu commences en gratuit — tu pourras passer à Pro à tout moment depuis ton profil.", en: "You're starting on the free plan — you can upgrade to Pro anytime from your profile.", es: "Empiezas con el plan gratuito — puedes pasar a Pro en cualquier momento desde tu perfil.", pt: "Você começa no plano grátis — pode virar Pro a qualquer momento pelo seu perfil." }),
    chosenPro: tr(lang, { fr: "Essai Pro activé — profite de tout en illimité pendant 7 jours ✨", en: "Pro trial activated — enjoy everything unlimited for 7 days ✨", es: "Prueba Pro activada — disfruta de todo ilimitado durante 7 días ✨", pt: "Teste Pro ativado — aproveite tudo ilimitado por 7 dias ✨" }),
  };
  const [planChoice, setPlanChoice] = useState(null);
  const choosePlan = (choice) => setPlanChoice(choice);
  const confirmPlan = () => { if (planChoice === "pro" && !isPro) startTrial(); setStep(step + 1); };
  return (
    <div className="flex-1 min-h-0 overflow-y-auto flex flex-col px-6 py-8">
      <div className="flex gap-1.5 mb-8">{steps.map((s, i) => <div key={s} className="flex-1 h-1 rounded-full" style={{ background: i <= step ? C.primary : C.border }} />)}</div>
      <p className="text-xs uppercase tracking-widest mb-1" style={{ color: C.textMuted, ...fontBody }}>{T.step} {step + 1} / {steps.length}</p>
      <h2 className="text-2xl font-extrabold mb-6 tracking-tight" style={{ color: C.text, ...fontDisplay }}>{steps[step]}</h2>
      <div className="flex-1 overflow-y-auto">
        {step === 0 && (<>
          <Field label={T.sexe}><SegmentedControl options={SEXES.map((s) => ({ value: s.key, label: tr(lang, s) }))} value={p.sexe} onChange={(v) => setP({ ...p, sexe: v })} /></Field>
          <Field label={T.birth}><TextInput type="date" value={p.dateNaissance} onChange={(e) => setP({ ...p, dateNaissance: e.target.value })} />{p.dateNaissance && <p className="text-[11px] mt-1.5" style={{ color: C.textFaint, ...fontBody }}>{T.ageHint(computeAge(p.dateNaissance))}</p>}</Field>
          <Field label={T.height}><TextInput type="number" value={p.taille} onChange={(e) => setP({ ...p, taille: e.target.value })} placeholder="178" /></Field>
          <Field label={T.weight}><TextInput type="number" value={p.poids} onChange={(e) => setP({ ...p, poids: e.target.value })} placeholder="72" /></Field>
        </>)}
        {step === 1 && (<>
          <p className="text-xs mb-4" style={{ color: C.textMuted, ...fontBody }}>{T.planQuestion}</p>
          <button onClick={() => choosePlan("free")} className="w-full text-left rounded-2xl p-4 mb-3" style={{ background: planChoice === "free" ? C.primarySoft : C.surface, border: `1px solid ${planChoice === "free" ? C.primary : C.borderSoft}66` }}>
            <div className="flex items-center justify-between mb-2"><p className="font-bold text-sm" style={{ color: C.text, ...fontDisplay }}>{T.freeTitle}</p>{planChoice === "free" && <Check size={16} style={{ color: C.primary }} />}</div>
            <ul className="text-[11px] leading-relaxed list-disc pl-4" style={{ color: C.textMuted, ...fontBody }}>
              <li>{T.freeF1}</li><li>{T.freeF2}</li><li>{T.freeF3}</li>
            </ul>
          </button>
          <button onClick={() => choosePlan("pro")} className="w-full text-left rounded-2xl p-4" style={{ background: planChoice === "pro" ? `linear-gradient(155deg, ${C.primary}26, ${C.surface})` : C.surface, border: `1px solid ${planChoice === "pro" ? C.primary : C.borderSoft}66` }}>
            <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-1.5"><Crown size={14} style={{ color: C.primary }} /><p className="font-bold text-sm" style={{ color: C.text, ...fontDisplay }}>{T.proTitle}</p></div>{planChoice === "pro" && <Check size={16} style={{ color: C.primary }} />}</div>
            <ul className="text-[11px] leading-relaxed list-disc pl-4 mb-2" style={{ color: C.textMuted, ...fontBody }}>
              <li>{T.proF1}</li><li>{T.proF2}</li><li>{T.proF3}</li>
            </ul>
            <p className="text-[10px]" style={{ color: C.textFaint, ...fontBody }}>{T.proPrice}</p>
          </button>
          {planChoice && <p className="text-[11px] mt-4 text-center" style={{ color: C.primary, ...fontBody }}>{planChoice === "pro" ? T.chosenPro : T.chosenFree}</p>}
        </>)}
        {step === 2 && (<>
          <Field label={T.sportsLabel}><SportGrid selected={p.sports} onToggle={toggleSport} />{!isPro && <p className="text-[10px] mt-2" style={{ color: C.textFaint, ...fontBody }}>{T.sportsFreeHint}</p>}</Field>
          <Field label={T.niveauLabel}><div className="flex flex-wrap gap-2">{NIVEAUX.map((n) => <Pill key={n.key} active={p.niveau === n.key} onClick={() => setP({ ...p, niveau: n.key })}>{tr(lang, n)}</Pill>)}</div></Field>
        </>)}
        {step === 3 && (
          <Field label={T.equipLabel}>
            <div className="flex flex-col gap-2">
              {EQUIPEMENTS.map((e) => (
                <button key={e.key} onClick={() => toggleEquip(e.key)} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left" style={{ background: p.equipement.includes(e.key) ? C.primarySoft : C.surface, border: `1px solid ${p.equipement.includes(e.key) ? C.primary : C.borderSoft}66` }}>
                  <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ background: p.equipement.includes(e.key) ? C.primary : "transparent", border: `1px solid ${p.equipement.includes(e.key) ? C.primary : C.border}` }}>{p.equipement.includes(e.key) && <Check size={11} color="#052821" />}</div>
                  <span className="text-xs" style={{ color: C.text, ...fontBody }}>{tr(lang, e)}</span>
                </button>
              ))}
            </div>
          </Field>
        )}
        {step === 4 && (<>
          <p className="text-[11px] mb-4" style={{ color: C.textFaint, ...fontBody }}>{T.allergiesHint}</p>
          <Field label={T.allergiesLabel}>
            <div className="flex flex-wrap gap-2">{ALLERGENS.map((a) => (<Pill key={a.key} active={p.allergies.includes(a.key)} onClick={() => toggleAllergy(a.key)}>{tr(lang, a)}</Pill>))}</div>
          </Field>
          <Field label={T.dislikedLabel}>
            <p className="text-[11px] mb-2" style={{ color: C.textFaint, ...fontBody }}>{T.dislikedHint}</p>
            <div className="flex gap-2 mb-2">
              <div className="flex-1"><TextInput value={dislikedInput} onChange={(e) => setDislikedInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDisliked(); } }} placeholder={T.dislikedPh} /></div>
              <Btn small onClick={addDisliked}>{T.add}</Btn>
            </div>
            {p.dislikedFoods.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {p.dislikedFoods.map((food, i) => (
                  <div key={i} className="flex items-center gap-1.5 rounded-full pl-3 pr-1.5 py-1" style={{ background: C.surface, border: `1px solid ${C.borderSoft}66` }}>
                    <span className="text-xs" style={{ color: C.text, ...fontBody }}>{food}</span>
                    <button onClick={() => removeDisliked(i)} className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: C.glassSoft }}><X size={10} style={{ color: C.textMuted }} /></button>
                  </div>
                ))}
              </div>
            )}
          </Field>
        </>)}
      </div>
      <div className="flex gap-2 mt-4">
        {step > 0 && <Btn variant="ghost" onClick={() => setStep(step - 1)}>{T.back}</Btn>}
        {step === 1 ? <Btn full onClick={() => planChoice && confirmPlan()} disabled={!planChoice}>{T.next}</Btn> : step < 4 ? <Btn full onClick={() => canNext && setStep(step + 1)} disabled={!canNext}>{T.next}</Btn> : <Btn full onClick={() => onComplete(p)} icon={Sparkles}>{T.create}</Btn>}
      </div>
    </div>
  );
}

/* ============================================================
   ENTRY EDITOR
   ============================================================ */
function EntryEditor({ entry, onChange, onRemove }) {
  const { lang } = useLang();
  const toggleZone = (k) => { const cur = entry.muscuZones || []; onChange({ muscuZones: cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k] }); };
  const T = {
    entrainement: tr(lang, { fr: "Entraînement", en: "Training", es: "Entrenamiento", pt: "Treino" }),
    match: tr(lang, { fr: "Match", en: "Match", es: "Partido", pt: "Jogo" }),
    loisir: tr(lang, { fr: "Loisir", en: "Casual", es: "Libre", pt: "Livre" }),
    zones: tr(lang, { fr: "Zone(s) travaillée(s) — plusieurs choix possibles", en: "Muscle zone(s) — multiple choices possible", es: "Zona(s) trabajada(s) — varias opciones posibles", pt: "Zona(s) trabalhada(s) — múltiplas opções possíveis" }),
    chill: tr(lang, { fr: "Chill", en: "Easy", es: "Suave", pt: "Leve" }),
    moyen: tr(lang, { fr: "Moyen", en: "Medium", es: "Medio", pt: "Médio" }),
    intense: tr(lang, { fr: "Intense", en: "Intense", es: "Intenso", pt: "Intenso" }),
    heure: tr(lang, { fr: "Heure", en: "Time", es: "Hora", pt: "Horário" }),
    label: tr(lang, { fr: "Libellé", en: "Label", es: "Etiqueta", pt: "Rótulo" }),
    optional: tr(lang, { fr: "optionnel", en: "optional", es: "opcional", pt: "opcional" }),
    notify: tr(lang, { fr: "Me notifier la veille", en: "Remind me the day before", es: "Avisarme el día anterior", pt: "Avisar-me na véspera" }),
    reminderTime: tr(lang, { fr: "Heure du rappel (veille)", en: "Reminder time (day before)", es: "Hora del aviso (día anterior)", pt: "Horário do lembrete (véspera)" }),
  };
  return (
    <div className="rounded-2xl p-3 mb-2" style={{ background: C.bgElevated, backdropFilter: "blur(14px)", border: `1px solid ${C.glassBorder}` }}>
      <div className="flex justify-between items-start mb-2 gap-2">
        <div className="flex-1"><SegmentedControl small options={[{ value: "entrainement", label: T.entrainement }, { value: "match", label: T.match }, { value: "loisir", label: T.loisir }]} value={entry.type} onChange={(v) => onChange({ type: v })} colorMap={{ entrainement: C.primary, match: C.danger, loisir: C.loisir }} /></div>
        <button onClick={onRemove} className="shrink-0 mt-1"><Trash2 size={13} style={{ color: C.textFaint }} /></button>
      </div>
      <select value={entry.sport} onChange={(e) => onChange({ sport: e.target.value })} className="text-[11px] rounded-xl px-2 py-1.5 w-full mb-2" style={inputStyle}>{Object.entries(SPORTS).map(([k]) => <option key={k} value={k}>{sportIcon(k)} {sportLabel(k, lang)}</option>)}</select>
      {entry.sport === "muscu" && (
        <div className="mb-2">
          <p className="text-[9px] mb-1.5" style={{ color: C.textFaint }}>{T.zones}</p>
          <MuscuZonePicker selected={entry.muscuZones || []} onToggle={toggleZone} />
        </div>
      )}
      {(entry.type === "entrainement" || entry.type === "loisir") && <div className="mb-2"><SegmentedControl small options={[{ value: "chill", label: T.chill }, { value: "moyen", label: T.moyen }, { value: "intense", label: T.intense }]} value={entry.intensity} onChange={(v) => onChange({ intensity: v })} colorMap={{ chill: C.primaryDim, moyen: C.primary, intense: C.warn }} /></div>}
      <div className="flex gap-2 mb-2">
        <div className="flex-1"><p className="text-[9px] mb-1" style={{ color: C.textFaint }}>{T.heure}</p><TextInput type="time" value={entry.heure || ""} onChange={(e) => onChange({ heure: e.target.value })} /></div>
        <div className="flex-1"><p className="text-[9px] mb-1" style={{ color: C.textFaint }}>{T.label}</p><TextInput value={entry.label || ""} onChange={(e) => onChange({ label: e.target.value })} placeholder={T.optional} /></div>
      </div>
      <button onClick={() => onChange({ notify: !entry.notify })} className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: entry.notify ? C.primary : "transparent", border: `1px solid ${entry.notify ? C.primary : C.border}` }}>{entry.notify && <Check size={11} color="#052821" />}</div>
        <span className="text-[11px]" style={{ color: C.text, ...fontBody }}>{T.notify}</span>
      </button>
      {entry.notify && <div className="mt-2"><p className="text-[9px] mb-1" style={{ color: C.textFaint }}>{T.reminderTime}</p><TextInput type="time" value={entry.notifyTime || "20:00"} onChange={(e) => onChange({ notifyTime: e.target.value })} /></div>}
    </div>
  );
}
function EntryListEditor({ entries, defaultSport, onChange }) {
  const { lang } = useLang();
  const { isPro, openPro } = usePro();
  const update = (id, patch) => onChange(entries.map((e) => e.id === id ? { ...e, ...patch } : e));
  const remove = (id) => onChange(entries.filter((e) => e.id !== id));
  const atLimit = !isPro && entries.length >= 1;
  const add = () => { if (atLimit) { openPro(); return; } onChange([...entries, newEntry(defaultSport)]); };
  const T = {
    none: tr(lang, { fr: "Aucune séance sportive ce jour-là.", en: "No sports session that day.", es: "Sin sesión deportiva ese día.", pt: "Nenhuma sessão esportiva nesse dia." }),
    add: tr(lang, { fr: "Ajouter une séance", en: "Add a session", es: "Añadir una sesión", pt: "Adicionar uma sessão" }),
    removeAll: tr(lang, { fr: "Tout retirer", en: "Remove all", es: "Quitar todo", pt: "Remover tudo" }),
    freeLimitHint: tr(lang, { fr: "Compte gratuit : 1 séance par jour. Passe à Pro pour plusieurs séances le même jour.", en: "Free plan: 1 session per day. Upgrade to Pro for several sessions the same day.", es: "Plan gratuito: 1 sesión al día. Pasa a Pro para varias sesiones el mismo día.", pt: "Plano grátis: 1 sessão por dia. Torne-se Pro para várias sessões no mesmo dia." }),
  };
  return (
    <div>
      {entries.length === 0 && <p className="text-xs mb-2" style={{ color: C.textFaint, ...fontBody }}>{T.none}</p>}
      {entries.map((e) => <EntryEditor key={e.id} entry={e} onChange={(patch) => update(e.id, patch)} onRemove={() => remove(e.id)} />)}
      <div className="flex gap-2 items-center flex-wrap">
        <Btn small onClick={add} icon={atLimit ? Lock : Plus}>{T.add}</Btn>
        {entries.length > 0 && <Btn small variant="ghost" onClick={() => onChange([])}>{T.removeAll}</Btn>}
      </div>
      {!isPro && <p className="text-[10px] mt-2" style={{ color: C.textFaint, ...fontBody }}>{T.freeLimitHint}</p>}
    </div>
  );
}

/* ============================================================
   RECUP PONCTUELLE
   ============================================================ */
function RecupTab({ profile, onGenerate }) {
  const { lang } = useLang();
  const [sport, setSport] = useState(profile.sports?.[0] || "autre");
  const [eventType, setEventType] = useState("entrainement");
  const [intensity, setIntensity] = useState("moyen");
  const [fatigue, setFatigue] = useState(3);
  const [hoursToNext, setHoursToNext] = useState(48);
  const [heure, setHeure] = useState("");
  const [muscuZones, setMuscuZones] = useState([]);
  const [result, setResult] = useState(null);

  const sportOptions = useMemo(() => {
    const declared = (profile.sports || []).map((k) => ({ value: k, label: `${sportIcon(k)} ${sportLabel(k, lang)}` }));
    const others = Object.keys(SPORTS).filter((k) => !(profile.sports || []).includes(k)).map((k) => ({ value: k, label: `${sportIcon(k)} ${sportLabel(k, lang)}` }));
    return [...declared, ...others];
  }, [profile.sports, lang]);

  const toggleZone = (k) => setMuscuZones((prev) => prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]);
  const submit = () => { const plan = generatePlan(profile, { eventType, intensity, fatigue, hoursToNext, sport, heure, muscuZones }, lang); setResult(plan); onGenerate(plan); };

  const T = {
    title: tr(lang, { fr: "Récup ponctuelle", en: "One-off recovery", es: "Recuperación puntual", pt: "Recuperação pontual" }),
    subtitle: tr(lang, { fr: "Pour une séance précise, hors planning", en: "For a specific session, outside your plan", es: "Para una sesión concreta, fuera del plan", pt: "Para uma sessão específica, fora do planejamento" }),
    how: tr(lang, { fr: "Comment ça marche", en: "How it works", es: "Cómo funciona", pt: "Como funciona" }),
    howText: tr(lang, { fr: "Génère une récup pour une séance précise — un de tes sports déclarés ou une activité faite juste pour le plaisir. Ce plan n'est pas ajouté à ton planning, il reste ici pour consultation.", en: "Generate recovery guidance for a specific session — one of your declared sports, or something done just for fun. This plan isn't added to your schedule, it stays here for reference.", es: "Genera una recuperación para una sesión concreta — uno de tus deportes declarados o una actividad hecha por diversión. Este plan no se añade a tu planificación, queda aquí para consultarlo.", pt: "Gere uma recuperação para uma sessão específica — um dos seus esportes declarados ou uma atividade feita por diversão. Este plano não é adicionado ao seu planejamento, fica aqui para consulta." }),
    sportLabel: tr(lang, { fr: "Sport de la séance", en: "Session sport", es: "Deporte de la sesión", pt: "Esporte da sessão" }),
    zonesLabel: tr(lang, { fr: "Zone(s) travaillée(s) — plusieurs choix possibles", en: "Muscle zone(s) — multiple choices possible", es: "Zona(s) trabajada(s) — varias opciones posibles", pt: "Zona(s) trabalhada(s) — múltiplas opções possíveis" }),
    typeLabel: tr(lang, { fr: "Type de séance", en: "Session type", es: "Tipo de sesión", pt: "Tipo de sessão" }),
    intensityLabel: tr(lang, { fr: "Intensité de la séance", en: "Session intensity", es: "Intensidad de la sesión", pt: "Intensidade da sessão" }),
    fatigueLabel: (f) => tr(lang, { fr: `Niveau de fatigue ressentie : ${f}/5`, en: `Perceived fatigue level: ${f}/5`, es: `Nivel de fatiga percibida: ${f}/5`, pt: `Nível de fadiga percebida: ${f}/5` }),
    hoursLabel: tr(lang, { fr: "Temps avant la prochaine séance / le prochain match", en: "Time before your next session / match", es: "Tiempo antes de la próxima sesión / partido", pt: "Tempo até a próxima sessão / jogo" }),
    heureLabel: tr(lang, { fr: "Heure de la séance (optionnel)", en: "Session time (optional)", es: "Hora de la sesión (opcional)", pt: "Horário da sessão (opcional)" }),
    generate: tr(lang, { fr: "Générer mon plan de récup", en: "Generate my recovery plan", es: "Generar mi plan de recuperación", pt: "Gerar meu plano de recuperação" }),
    newSession: tr(lang, { fr: "Nouvelle séance", en: "New session", es: "Nueva sesión", pt: "Nova sessão" }),
    recoveryNeed: tr(lang, { fr: "Besoin de récupération", en: "Recovery need", es: "Necesidad de recuperación", pt: "Necessidade de recuperação" }),
    sleep: tr(lang, { fr: "Sommeil", en: "Sleep", es: "Sueño", pt: "Sono" }),
    hydration: tr(lang, { fr: "Hydratation", en: "Hydration", es: "Hidratación", pt: "Hidratação" }),
    matchLabel: tr(lang, { fr: "Match/Combat", en: "Match/Fight", es: "Partido/Combate", pt: "Jogo/Luta" }),
    loisirLabel: tr(lang, { fr: "Loisir", en: "Casual", es: "Libre", pt: "Livre" }),
    entrainementLabel: tr(lang, { fr: "Entraînement", en: "Training", es: "Entrenamiento", pt: "Treino" }),
    chill: tr(lang, { fr: "Chill", en: "Easy", es: "Suave", pt: "Leve" }),
    moyen: tr(lang, { fr: "Moyen", en: "Medium", es: "Medio", pt: "Médio" }),
    intense: tr(lang, { fr: "Intense", en: "Intense", es: "Intenso", pt: "Intenso" }),
    lt12: tr(lang, { fr: "Moins de 12h", en: "Less than 12h", es: "Menos de 12h", pt: "Menos de 12h" }),
    h24: tr(lang, { fr: "24h", en: "24h", es: "24h", pt: "24h" }),
    h48: tr(lang, { fr: "48h", en: "48h", es: "48h", pt: "48h" }),
    h72: tr(lang, { fr: "72h", en: "72h", es: "72h", pt: "72h" }),
    gt4: tr(lang, { fr: "Plus de 4 jours", en: "More than 4 days", es: "Más de 4 días", pt: "Mais de 4 dias" }),
  };

  if (result) {
    return (
      <div className="px-5 pb-24 pt-4">
        <button onClick={() => setResult(null)} className="text-xs mb-4 flex items-center gap-1" style={{ color: C.primary }}><ChevronLeft size={14} /> {T.newSession}</button>
        <HeroCard accent={scoreColor(result.score)} className="flex flex-col items-center mb-4" style={{ paddingTop: 24, paddingBottom: 20 }}>
          <div className="flex items-center gap-1.5 mb-2 flex-wrap justify-center"><Badge color={C.textMuted}>{sportIcon(result.sport)} {sportLabel(result.sport, lang)}</Badge><Badge color={C.textMuted}>{result.eventType === "match" ? T.matchLabel : result.eventType === "loisir" ? T.loisirLabel : T.entrainementLabel}</Badge>{result.sport === "muscu" && result.muscuZones?.length > 0 && <Badge color={C.textMuted}>{result.muscuZones.map((z) => zoneLabel(z, lang)).join(" + ")}</Badge>}</div>
          <RecoveryDial score={result.score} label={T.recoveryNeed} sub={result.duree} size={190} />
          <div className="flex gap-4 mt-4 text-center">
            <div><Moon size={16} style={{ color: C.primary, margin: "0 auto" }} /><p style={{ ...fontMono, color: C.text, fontSize: 16 }}>{result.sommeil}h</p><p className="text-[10px]" style={{ color: C.textMuted }}>{T.sleep}</p></div>
            <div><Droplet size={16} style={{ color: C.primary, margin: "0 auto" }} /><p style={{ ...fontMono, color: C.text, fontSize: 16 }}>{result.hydratation}L</p><p className="text-[10px]" style={{ color: C.textMuted }}>{T.hydration}</p></div>
          </div>
        </HeroCard>
        <PlanTabs plan={result} />
      </div>
    );
  }

  return (
    <div className="px-5 pb-24 pt-4">
      <LargeHeader title={T.title} subtitle={T.subtitle} />
      <Card className="mb-5" style={{ background: C.primarySoft, border: `1px solid ${C.primary}33` }}>
        <div className="flex items-center gap-2 mb-1"><Sparkles size={15} style={{ color: C.primary }} /><p className="font-bold text-sm tracking-tight" style={{ color: C.primary, ...fontDisplay }}>{T.how}</p></div>
        <p className="text-[11px] leading-relaxed" style={{ color: C.primary, ...fontBody }}>{T.howText}</p>
      </Card>
      <Field label={T.sportLabel}><Select value={sport} onChange={(e) => setSport(e.target.value)} options={sportOptions} /></Field>
      {sport === "muscu" && <Field label={T.zonesLabel}><MuscuZonePicker selected={muscuZones} onToggle={toggleZone} /></Field>}
      <Field label={T.typeLabel}><SegmentedControl options={[{ value: "entrainement", label: T.entrainementLabel }, { value: "match", label: T.matchLabel }, { value: "loisir", label: T.loisirLabel }]} value={eventType} onChange={setEventType} colorMap={{ entrainement: C.primary, match: C.danger, loisir: C.loisir }} /></Field>
      {eventType !== "match" && <Field label={T.intensityLabel}><SegmentedControl options={[{ value: "chill", label: T.chill }, { value: "moyen", label: T.moyen }, { value: "intense", label: T.intense }]} value={intensity} onChange={setIntensity} colorMap={{ chill: C.primaryDim, moyen: C.primary, intense: C.warn }} /></Field>}
      <Field label={T.fatigueLabel(fatigue)}><input type="range" min={1} max={5} value={fatigue} onChange={(e) => setFatigue(Number(e.target.value))} className="w-full" style={{ accentColor: C.primary }} /></Field>
      <Field label={T.hoursLabel}><Select value={hoursToNext} onChange={(e) => setHoursToNext(Number(e.target.value))} options={[{ value: 12, label: T.lt12 }, { value: 24, label: T.h24 }, { value: 48, label: T.h48 }, { value: 72, label: T.h72 }, { value: 96, label: T.gt4 }]} /></Field>
      <Field label={T.heureLabel}><TextInput type="time" value={heure} onChange={(e) => setHeure(e.target.value)} /></Field>
      <Btn full onClick={submit} icon={Sparkles}>{T.generate}</Btn>
    </div>
  );
}

/* ============================================================
   NUTRITION TAB
   ============================================================ */
function NutritionTab({ lastPlan }) {
  const { lang } = useLang();
  const { isPro } = usePro();
  const T = {
    title: tr(lang, { fr: "Nutrition", en: "Nutrition", es: "Nutrición", pt: "Nutrição" }),
    empty: tr(lang, { fr: "Génère d'abord une récup ponctuelle pour obtenir des conseils repas et hydratation.", en: "Generate a one-off recovery first to get meal and hydration advice.", es: "Genera primero una recuperación puntual para obtener consejos de comida e hidratación.", pt: "Gere primeiro uma recuperação pontual para obter dicas de refeição e hidratação." }),
    lastSession: tr(lang, { fr: "dernière séance", en: "last session", es: "última sesión", pt: "última sessão" }),
    needs: tr(lang, { fr: "Besoins estimés", en: "Estimated needs", es: "Necesidades estimadas", pt: "Necessidades estimadas" }),
    kcal: "kcal", protein: tr(lang, { fr: "Protéines", en: "Protein", es: "Proteínas", pt: "Proteínas" }), carbs: tr(lang, { fr: "Glucides", en: "Carbs", es: "Carbohidratos", pt: "Carboidratos" }), fat: tr(lang, { fr: "Lipides", en: "Fat", es: "Grasas", pt: "Gorduras" }),
    mealBefore: tr(lang, { fr: "Repas avant l'effort", en: "Meal before training", es: "Comida antes del esfuerzo", pt: "Refeição antes do esforço" }),
    mealAfter: tr(lang, { fr: "Repas après l'effort", en: "Meal after training", es: "Comida después del esfuerzo", pt: "Refeição depois do esforço" }),
    toEatAt: (t) => tr(lang, { fr: `À prendre ${t}`, en: `Eat it ${t}`, es: `Tómalo ${t}`, pt: `Coma ${t}` }),
    hydration: tr(lang, { fr: "Hydratation", en: "Hydration", es: "Hidratación", pt: "Hidratação" }),
    recommendedDay: tr(lang, { fr: "recommandés sur la journée de récup", en: "recommended for your recovery day", es: "recomendados para el día de recuperación", pt: "recomendados para o dia de recuperação" }),
    footer: tr(lang, { fr: "Repas ciblés selon ton sport, et variés d'une séance à l'autre.", en: "Meals tailored to your sport, and varied from one session to the next.", es: "Comidas adaptadas a tu deporte, variadas de una sesión a otra.", pt: "Refeições adaptadas ao seu esporte, variadas de uma sessão para outra." }),
  };
  if (!lastPlan) return (<div className="px-5 pt-4 pb-24"><LargeHeader title={T.title} /><Card><p className="text-xs" style={{ color: C.textMuted, ...fontBody }}>{T.empty}</p></Card></div>);
  return (
    <div className="px-5 pt-4 pb-24">
      <LargeHeader title={T.title} subtitle={`${sportIcon(lastPlan.sport)} ${sportLabel(lastPlan.sport, lang)} · ${T.lastSession}`} />
      <ProLock active={!isPro}>
        <Card className="mb-3">
          <SectionTitle icon={Flame} action={<ProBadge />}>{T.needs}</SectionTitle>
          <div className="grid grid-cols-4 gap-2 text-center mb-1">
            <div><p style={{ ...fontMono, color: C.primary, fontSize: 18 }}>{lastPlan.nutrients.kcal}</p><p className="text-[9px] uppercase" style={{ color: C.textFaint }}>{T.kcal}</p></div>
            <div><p style={{ ...fontMono, color: C.text, fontSize: 18 }}>{lastPlan.nutrients.protein}g</p><p className="text-[9px] uppercase" style={{ color: C.textFaint }}>{T.protein}</p></div>
            <div><p style={{ ...fontMono, color: C.text, fontSize: 18 }}>{lastPlan.nutrients.carbs}g</p><p className="text-[9px] uppercase" style={{ color: C.textFaint }}>{T.carbs}</p></div>
            <div><p style={{ ...fontMono, color: C.text, fontSize: 18 }}>{lastPlan.nutrients.fat}g</p><p className="text-[9px] uppercase" style={{ color: C.textFaint }}>{T.fat}</p></div>
          </div>
        </Card>
      </ProLock>
      <Card className="mb-3"><SectionTitle icon={Clock}>{T.mealBefore}</SectionTitle><p className="text-xs leading-relaxed mb-2" style={{ color: C.textMuted, ...fontBody }}>{lastPlan.meals.pre}</p><p className="text-[10px] font-semibold" style={{ color: C.primary, ...fontBody }}>{T.toEatAt(mealTiming(lastPlan.eventType, lastPlan.intensity, lang).pre)}</p></Card>
      <Card className="mb-3"><SectionTitle icon={TrendingUp}>{T.mealAfter}</SectionTitle><p className="text-xs leading-relaxed mb-2" style={{ color: C.textMuted, ...fontBody }}>{lastPlan.meals.post}</p><p className="text-[10px] font-semibold" style={{ color: C.primary, ...fontBody }}>{T.toEatAt(mealTiming(lastPlan.eventType, lastPlan.intensity, lang).post)}</p></Card>
      <Card><SectionTitle icon={Droplet}>{T.hydration}</SectionTitle><div className="flex items-center gap-3 mb-2"><span style={{ ...fontMono, color: C.primary, fontSize: 28 }}>{lastPlan.hydratation}L</span><span className="text-xs" style={{ color: C.textMuted, ...fontBody }}>{T.recommendedDay}</span></div></Card>
      <p className="text-[10px] mt-3 text-center" style={{ color: C.textFaint, ...fontBody }}>{T.footer}</p>
    </div>
  );
}

/* ============================================================
   BLESSURES TAB
   ============================================================ */
function BlessuresTab({ injuries, onAddInjury, onUpdateInjury, onDeleteInjury, onAddRdv }) {
  const { lang } = useLang();
  const [part, setPart] = useState(""); const [symptom, setSymptom] = useState(""); const [advice, setAdvice] = useState(null);
  const submitAdvice = () => { if (!part || !symptom) return; setAdvice(getInjuryAdvice(part, symptom, lang)); };
  const saveConseil = () => { onAddInjury({ id: Date.now() + Math.random(), kind: "conseil", declaredDate: new Date().toISOString(), part, symptom, urgent: advice.urgent, specialistes: advice.specialistes, conseil: advice.conseil, arret: false, dateDebut: null, dateRetour: null }); setPart(""); setSymptom(""); setAdvice(null); };

  const [aPart, setAPart] = useState(""); const [aLabel, setALabel] = useState("");
  const [aDebut, setADebut] = useState(new Date().toISOString().slice(0, 10));
  const [aRetourConnu, setARetourConnu] = useState(false); const [aRetour, setARetour] = useState("");
  const saveArret = () => { if (!aPart || !aLabel) return; onAddInjury({ id: Date.now() + Math.random(), kind: "arret", declaredDate: new Date().toISOString(), part: aPart, symptom: aLabel, urgent: false, specialistes: [], conseil: "", arret: true, dateDebut: aDebut, dateRetour: aRetourConnu ? aRetour : null }); setAPart(""); setALabel(""); setADebut(new Date().toISOString().slice(0, 10)); setARetourConnu(false); setARetour(""); };

  const [editingReturn, setEditingReturn] = useState(null); const [editDate, setEditDate] = useState("");
  const saveReturnDate = (id) => { onUpdateInjury(id, { dateRetour: editDate || null }); setEditingReturn(null); setEditDate(""); };

  const [rdvFor, setRdvFor] = useState(null);
  const [rdvDate, setRdvDate] = useState(new Date().toISOString().slice(0, 10));
  const [rdvVal, setRdvVal] = useState(newRdv());
  const saveRdv = (inj) => { onAddRdv(rdvDate, { id: Date.now() + Math.random(), type: "rdv", ...rdvVal, motif: rdvVal.motif || `${tr(lang, { fr: "Suivi", en: "Follow-up", es: "Seguimiento", pt: "Acompanhamento" })} : ${bodyPartLabel(inj.part, lang)}`, injuryId: inj.id }); setRdvFor(null); setRdvVal(newRdv()); };

  const sorted = [...injuries].sort((a, b) => (b.dateDebut || b.declaredDate).localeCompare(a.dateDebut || a.declaredDate));

  const T = {
    title: tr(lang, { fr: "Blessures", en: "Injuries", es: "Lesiones", pt: "Lesões" }),
    subtitle: tr(lang, { fr: "Orientation et suivi d'arrêt", en: "Guidance and time-off tracking", es: "Orientación y seguimiento de bajas", pt: "Orientação e acompanhamento de afastamento" }),
    disclaimer: tr(lang, { fr: "Ces conseils sont informatifs et ne remplacent pas un avis médical. En cas de doute, consulte un professionnel de santé.", en: "This advice is informational and doesn't replace medical advice. If in doubt, see a healthcare professional.", es: "Estos consejos son informativos y no sustituyen un diagnóstico médico. En caso de duda, consulta a un profesional de la salud.", pt: "Estas orientações são informativas e não substituem um parecer médico. Em caso de dúvida, consulte um profissional de saúde." }),
    specialistAdvice: tr(lang, { fr: "Conseil d'un spécialiste", en: "Specialist advice", es: "Consejo de un especialista", pt: "Conselho de um especialista" }),
    zone: tr(lang, { fr: "Zone concernée", en: "Affected area", es: "Zona afectada", pt: "Área afetada" }),
    chooseZone: tr(lang, { fr: "Choisis une zone", en: "Choose an area", es: "Elige una zona", pt: "Escolha uma área" }),
    symptomType: tr(lang, { fr: "Type de gêne", en: "Type of discomfort", es: "Tipo de molestia", pt: "Tipo de desconforto" }),
    describeSymptom: tr(lang, { fr: "Décris la gêne", en: "Describe the discomfort", es: "Describe la molestia", pt: "Descreva o desconforto" }),
    getGuidance: tr(lang, { fr: "Obtenir une orientation", en: "Get guidance", es: "Obtener orientación", pt: "Obter orientação" }),
    attention: tr(lang, { fr: "Attention", en: "Attention", es: "Atención", pt: "Atenção" }),
    specialists: tr(lang, { fr: "Spécialiste(s) recommandé(s)", en: "Recommended specialist(s)", es: "Especialista(s) recomendado(s)", pt: "Especialista(s) recomendado(s)" }),
    inTheMeantime: tr(lang, { fr: "Conseil en attendant", en: "Advice in the meantime", es: "Consejo mientras tanto", pt: "Conselho enquanto isso" }),
    save: tr(lang, { fr: "Enregistrer cette gêne dans l'historique", en: "Save this to history", es: "Guardar en el historial", pt: "Salvar no histórico" }),
    declareStop: tr(lang, { fr: "Déclarer un arrêt", en: "Report time off", es: "Declarar una baja", pt: "Declarar um afastamento" }),
    declareStopHint: tr(lang, { fr: "Indépendant du conseil ci-dessus : à utiliser dès que tu es à l'arrêt, avec ou sans date de retour connue.", en: "Independent of the advice above: use this as soon as you're out, with or without a known return date.", es: "Independiente del consejo anterior: úsalo en cuanto estés de baja, con o sin fecha de vuelta conocida.", pt: "Independente do conselho acima: use assim que estiver afastado, com ou sem data de retorno conhecida." }),
    injuryType: tr(lang, { fr: "Type de blessure", en: "Type of injury", es: "Tipo de lesión", pt: "Tipo de lesão" }),
    injuryTypePh: tr(lang, { fr: "ex : Entorse cheville", en: "e.g. Ankle sprain", es: "ej: Esguince de tobillo", pt: "ex: Entorse no tornozelo" }),
    startDate: tr(lang, { fr: "Date de début de l'arrêt", en: "Start date of time off", es: "Fecha de inicio de la baja", pt: "Data de início do afastamento" }),
    knownReturn: tr(lang, { fr: "Date de retour déjà connue", en: "Return date already known", es: "Fecha de vuelta ya conocida", pt: "Data de retorno já conhecida" }),
    plannedReturn: tr(lang, { fr: "Date de retour prévue", en: "Planned return date", es: "Fecha de vuelta prevista", pt: "Data de retorno prevista" }),
    laterHint: tr(lang, { fr: "Pas de souci, tu pourras la renseigner plus tard depuis l'historique ci-dessous.", en: "No worries, you can fill it in later from the history below.", es: "No pasa nada, podrás indicarla más tarde desde el historial de abajo.", pt: "Sem problema, você pode informar depois pelo histórico abaixo." }),
    declareStopBtn: tr(lang, { fr: "Déclarer l'arrêt", en: "Report time off", es: "Declarar la baja", pt: "Declarar o afastamento" }),
    history: tr(lang, { fr: "Historique", en: "History", es: "Historial", pt: "Histórico" }),
    noEntry: tr(lang, { fr: "Aucune entrée pour le moment.", en: "No entries yet.", es: "Sin entradas por el momento.", pt: "Nenhum registro por enquanto." }),
    stop: tr(lang, { fr: "Arrêt", en: "Time off", es: "Baja", pt: "Afastamento" }),
    advice: tr(lang, { fr: "Conseil", en: "Advice", es: "Consejo", pt: "Conselho" }),
    urgent: tr(lang, { fr: "Urgent", en: "Urgent", es: "Urgente", pt: "Urgente" }),
    stoppedSince: (d) => tr(lang, { fr: `En arrêt depuis le ${d}`, en: `Off since ${d}`, es: `De baja desde el ${d}`, pt: `Afastado desde ${d}` }),
    returnLabel: (d) => tr(lang, { fr: `— retour ${d}`, en: `— return ${d}`, es: `— vuelta ${d}`, pt: `— retorno ${d}` }),
    onDate: (d) => tr(lang, { fr: `le ${d}`, en: `on ${d}`, es: `el ${d}`, pt: `em ${d}` }),
    tbd: tr(lang, { fr: "à définir", en: "to be determined", es: "por determinar", pt: "a definir" }),
    editReturn: tr(lang, { fr: "Modifier la date de retour", en: "Edit return date", es: "Editar fecha de vuelta", pt: "Editar data de retorno" }),
    setReturn: tr(lang, { fr: "Renseigner la date de retour", en: "Set return date", es: "Indicar fecha de vuelta", pt: "Definir data de retorno" }),
    ok: "OK",
    linkedRdv: tr(lang, { fr: "RDV médical — indépendant de la séance", en: "Medical appointment — independent of the session", es: "Cita médica — independiente de la sesión", pt: "Consulta médica — independente da sessão" }),
    rdvDate: tr(lang, { fr: "Date du RDV", en: "Appointment date", es: "Fecha de la cita", pt: "Data da consulta" }),
    saveRdv: tr(lang, { fr: "Enregistrer le RDV", en: "Save appointment", es: "Guardar la cita", pt: "Salvar consulta" }),
    cancel: tr(lang, { fr: "Annuler", en: "Cancel", es: "Cancelar", pt: "Cancelar" }),
    addRdv: tr(lang, { fr: "Ajouter un RDV lié", en: "Add a linked appointment", es: "Añadir una cita relacionada", pt: "Adicionar consulta vinculada" }),
    declaredOn: (d) => tr(lang, { fr: `Déclarée le ${d}`, en: `Reported on ${d}`, es: `Declarada el ${d}`, pt: `Declarado em ${d}` }),
  };

  return (
    <div className="px-5 pt-4 pb-24">
      <LargeHeader title={T.title} subtitle={T.subtitle} />
      <div className="flex items-start gap-2 mb-5 px-3 py-2.5 rounded-2xl" style={{ background: C.warnSoft, border: `1px solid ${C.warn}33` }}>
        <AlertTriangle size={14} style={{ color: C.warn, marginTop: 1, flexShrink: 0 }} />
        <p className="text-[11px] leading-relaxed" style={{ color: C.warn, ...fontBody }}>{T.disclaimer}</p>
      </div>

      <SectionTitle icon={User}>{T.specialistAdvice}</SectionTitle>
      <Field label={T.zone}><Select value={part} onChange={(e) => { setPart(e.target.value); setAdvice(null); }} options={BODY_PARTS.map((b) => ({ value: b.key, label: tr(lang, b) }))} placeholder={T.chooseZone} /></Field>
      <Field label={T.symptomType}><Select value={symptom} onChange={(e) => { setSymptom(e.target.value); setAdvice(null); }} options={SYMPTOMS.map((s) => ({ value: s.key, label: tr(lang, s) }))} placeholder={T.describeSymptom} /></Field>
      <Btn full onClick={submitAdvice} disabled={!part || !symptom}>{T.getGuidance}</Btn>
      {advice && (
        <div className="mt-4 flex flex-col gap-3">
          {advice.urgent && <Card style={{ background: C.dangerSoft, border: `1px solid ${C.danger}44` }}><div className="flex items-center gap-2 mb-1"><AlertTriangle size={15} style={{ color: C.danger }} /><p className="font-bold text-sm" style={{ color: C.danger, ...fontBody }}>{T.attention}</p></div><p className="text-xs leading-relaxed" style={{ color: C.danger, ...fontBody }}>{advice.urgentMsg}</p></Card>}
          <Card><SectionTitle icon={User}>{T.specialists}</SectionTitle><div className="flex flex-wrap gap-2">{advice.specialistes.map((s, i) => <span key={i} className="text-xs px-3 py-1.5 rounded-full font-semibold" style={{ background: C.primarySoft, color: C.primary, ...fontBody }}>{s}</span>)}</div></Card>
          <Card><SectionTitle icon={Sparkles}>{T.inTheMeantime}</SectionTitle><p className="text-xs leading-relaxed" style={{ color: C.textMuted, ...fontBody }}>{advice.conseil}</p></Card>
          <Btn full onClick={saveConseil} icon={Check}>{T.save}</Btn>
        </div>
      )}

      <div className="my-6" style={{ borderTop: `1px dashed ${C.border}` }} />

      <SectionTitle icon={Bell}>{T.declareStop}</SectionTitle>
      <p className="text-[11px] mb-3" style={{ color: C.textFaint, ...fontBody }}>{T.declareStopHint}</p>
      <Field label={T.zone}><Select value={aPart} onChange={(e) => setAPart(e.target.value)} options={BODY_PARTS.map((b) => ({ value: b.key, label: tr(lang, b) }))} placeholder={T.chooseZone} /></Field>
      <Field label={T.injuryType}><TextInput value={aLabel} onChange={(e) => setALabel(e.target.value)} placeholder={T.injuryTypePh} /></Field>
      <Field label={T.startDate}><TextInput type="date" value={aDebut} onChange={(e) => setADebut(e.target.value)} /></Field>
      <button onClick={() => setARetourConnu(!aRetourConnu)} className="flex items-center gap-3 mb-3">
        <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: aRetourConnu ? C.primary : "transparent", border: `1px solid ${aRetourConnu ? C.primary : C.border}` }}>{aRetourConnu && <Check size={11} color="#052821" />}</div>
        <span className="text-xs" style={{ color: C.text, ...fontBody }}>{T.knownReturn}</span>
      </button>
      {aRetourConnu ? <Field label={T.plannedReturn}><TextInput type="date" value={aRetour} onChange={(e) => setARetour(e.target.value)} /></Field> : <p className="text-[11px] mb-3" style={{ color: C.textFaint, ...fontBody }}>{T.laterHint}</p>}
      <Btn full onClick={saveArret} disabled={!aPart || !aLabel} icon={Check}>{T.declareStopBtn}</Btn>

      <div className="mt-7">
        <SectionTitle icon={Clock}>{T.history}</SectionTitle>
        {sorted.length === 0 ? <Card><p className="text-xs" style={{ color: C.textFaint, ...fontBody }}>{T.noEntry}</p></Card> : (
          <div className="flex flex-col gap-3">
            {sorted.map((inj) => (
              <Card key={inj.id}>
                <div className="flex justify-between items-start mb-1.5">
                  <div><p className="text-sm font-semibold" style={{ color: C.text, ...fontBody }}>{bodyPartLabel(inj.part, lang)}</p><p className="text-[11px]" style={{ color: C.textMuted, ...fontBody }}>{inj.kind === "conseil" ? symptomLabel(inj.symptom, lang) : inj.symptom}</p></div>
                  <div className="flex items-center gap-2">
                    <Badge color={inj.kind === "arret" ? C.danger : C.primary}>{inj.kind === "arret" ? T.stop : T.advice}</Badge>
                    {inj.urgent && <Badge color={C.danger}>{T.urgent}</Badge>}
                    <button onClick={() => onDeleteInjury(inj.id)}><Trash2 size={13} style={{ color: C.textFaint }} /></button>
                  </div>
                </div>
                {inj.kind === "arret" ? (
                  <div className="mt-2 px-3 py-2 rounded-xl" style={{ background: C.dangerSoft }}>
                    <p className="text-[11px]" style={{ color: C.danger, ...fontBody }}>{T.stoppedSince(fmtDate(inj.dateDebut, lang))} {T.returnLabel(inj.dateRetour ? T.onDate(fmtDate(inj.dateRetour, lang)) : T.tbd)}</p>
                    {editingReturn === inj.id ? (
                      <div className="flex gap-2 mt-2"><TextInput type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} style={{ flex: 1 }} /><Btn small onClick={() => saveReturnDate(inj.id)}>{T.ok}</Btn></div>
                    ) : (
                      <button onClick={() => { setEditingReturn(inj.id); setEditDate(inj.dateRetour || ""); }} className="flex items-center gap-1 mt-2 text-[11px]" style={{ color: C.danger, ...fontBody }}><Pencil size={11} /> {inj.dateRetour ? T.editReturn : T.setReturn}</button>
                    )}
                  </div>
                ) : (
                  <div className="mt-1 flex flex-wrap gap-1.5">{inj.specialistes.map((s, i) => <span key={i} className="text-[10px] px-2 py-1 rounded-full" style={{ background: C.primarySoft, color: C.primary }}>{s}</span>)}</div>
                )}

                <div className="mt-3 pt-3" style={{ borderTop: `1px dashed ${C.border}` }}>
                  {rdvFor === inj.id ? (
                    <>
                      <p className="text-[11px] font-semibold mb-2 flex items-center gap-1.5" style={{ color: C.rdv }}><Stethoscope size={12} /> {T.linkedRdv}</p>
                      <Field label={T.rdvDate}><TextInput type="date" value={rdvDate} onChange={(e) => setRdvDate(e.target.value)} /></Field>
                      <RdvForm value={rdvVal} onChange={setRdvVal} />
                      <div className="flex gap-2"><Btn small full onClick={() => saveRdv(inj)} icon={Check}>{T.saveRdv}</Btn><Btn small variant="ghost" onClick={() => setRdvFor(null)}>{T.cancel}</Btn></div>
                    </>
                  ) : (
                    <button onClick={() => { setRdvFor(inj.id); setRdvVal(newRdv()); }} className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: C.rdv }}><Stethoscope size={12} /> {T.addRdv}</button>
                  )}
                </div>
                <p className="text-[10px] mt-2" style={{ color: C.textFaint, ...fontBody }}>{T.declaredOn(fmtDate(inj.declaredDate, lang))}</p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   DAY DETAIL SHEET
   ============================================================ */
function DayDetailSheet({ date, entries, isException, auto, profile, onClose, onSaveException, onClearException, onAddEntry, onRemoveEntry, goTo }) {
  const { lang } = useLang();
  const { isPro, openPro } = usePro();
  const effectiveAuto = isPro ? auto : null;
  const [editingSport, setEditingSport] = useState(false);
  const [addingRdv, setAddingRdv] = useState(false);
  const [newRdvVal, setNewRdvVal] = useState(newRdv());
  const sportEntries = entries.filter((e) => SPORT_TYPES.includes(e.type));
  const otherEntries = entries.filter((e) => !SPORT_TYPES.includes(e.type));
  const [localSport, setLocalSport] = useState(sportEntries);
  useEffect(() => { setLocalSport(entries.filter((e) => SPORT_TYPES.includes(e.type))); setEditingSport(false); setAddingRdv(false); }, [date]);

  const saveSportEdit = () => { onSaveException(date, [...localSport, ...otherEntries]); setEditingSport(false); };
  const saveRdv = () => { onAddEntry(date, { id: Date.now() + Math.random(), type: "rdv", ...newRdvVal }); setAddingRdv(false); setNewRdvVal(newRdv()); };

  const T = {
    dayOff: tr(lang, { fr: "Journée off", en: "Day off", es: "Día libre", pt: "Dia de folga" }),
    itemsPlanned: (n) => tr(lang, { fr: `${n} élément${n > 1 ? "s" : ""} prévu${n > 1 ? "s" : ""}`, en: `${n} item${n > 1 ? "s" : ""} planned`, es: `${n} elemento${n > 1 ? "s" : ""} previsto${n > 1 ? "s" : ""}`, pt: `${n} item${n > 1 ? "s" : ""} previsto${n > 1 ? "s" : ""}` }),
    autoActive: tr(lang, { fr: "Récup active recommandée", en: "Active recovery recommended", es: "Recuperación activa recomendada", pt: "Recuperação ativa recomendada" }),
    autoActiveNote: tr(lang, { fr: "Décidé automatiquement par l'app suite à la charge de la veille.", en: "Decided automatically by the app based on yesterday's load.", es: "Decidido automáticamente por la app según la carga del día anterior.", pt: "Decidido automaticamente pelo app com base na carga do dia anterior." }),
    autoProHint: tr(lang, { fr: "REGEN Pro détecte automatiquement si tu as besoin de récup active ou de repos complet.", en: "REGEN Pro automatically detects if you need active recovery or full rest.", es: "REGEN Pro detecta automáticamente si necesitas recuperación activa o descanso completo.", pt: "O REGEN Pro detecta automaticamente se você precisa de recuperação ativa ou descanso completo." }),
    stretchList: tr(lang, { fr: "Étirements doux corps entier, 5-8 min", en: "Gentle full-body stretching, 5-8 min", es: "Estiramientos suaves de cuerpo completo, 5-8 min", pt: "Alongamentos suaves de corpo inteiro, 5-8 min" }),
    hydrationList: (l) => tr(lang, { fr: `Hydratation normale (~${l}L)`, en: `Normal hydration (~${l}L)`, es: `Hidratación normal (~${l}L)`, pt: `Hidratação normal (~${l}L)` }),
    sleepList: tr(lang, { fr: "Sommeil standard, ~8h", en: "Standard sleep, ~8h", es: "Sueño estándar, ~8h", pt: "Sono padrão, ~8h" }),
    foodList: tr(lang, { fr: "Alimentation équilibrée, riche en protéines et anti-inflammatoires naturels", en: "Balanced diet, rich in protein and natural anti-inflammatories", es: "Alimentación equilibrada, rica en proteínas y antiinflamatorios naturales", pt: "Alimentação equilibrada, rica em proteínas e anti-inflamatórios naturais" }),
    fullRest: tr(lang, { fr: "Repos complet recommandé", en: "Full rest recommended", es: "Descanso completo recomendado", pt: "Descanso completo recomendado" }),
    fullRestNote: tr(lang, { fr: "Deux jours de charge élevée d'affilée : l'app recommande de ne prévoir aucune activité supplémentaire aujourd'hui.", en: "Two days of high load in a row: the app recommends no additional activity today.", es: "Dos días seguidos de carga alta: la app recomienda no planear ninguna actividad adicional hoy.", pt: "Dois dias seguidos de carga alta: o app recomenda não planejar nenhuma atividade extra hoje." }),
    restDay: tr(lang, { fr: "Jour de repos — pas de séance prévue.", en: "Rest day — no session planned.", es: "Día de descanso — sin sesión prevista.", pt: "Dia de descanso — sem sessão prevista." }),
    seeInInjuries: tr(lang, { fr: "Voir dans Blessures →", en: "See in Injuries →", es: "Ver en Lesiones →", pt: "Ver em Lesões →" }),
    at: tr(lang, { fr: "Prévu à", en: "Scheduled at", es: "Previsto a las", pt: "Previsto às" }),
    match: tr(lang, { fr: "Match / Combat", en: "Match / Fight", es: "Partido / Combate", pt: "Jogo / Luta" }),
    loisir: tr(lang, { fr: "Session loisir", en: "Casual session", es: "Sesión libre", pt: "Sessão livre" }),
    entrainement: tr(lang, { fr: "Entraînement", en: "Training", es: "Entrenamiento", pt: "Treino" }),
    editSport: tr(lang, { fr: "Modifier les séances sportives", en: "Edit sports sessions", es: "Editar sesiones deportivas", pt: "Editar sessões esportivas" }),
    save: tr(lang, { fr: "Enregistrer", en: "Save", es: "Guardar", pt: "Salvar" }),
    backToBase: tr(lang, { fr: "Revenir au planning de base", en: "Revert to default schedule", es: "Volver a la planificación base", pt: "Voltar ao planejamento padrão" }),
    addRdv: tr(lang, { fr: "Ajouter un RDV médical", en: "Add a medical appointment", es: "Añadir una cita médica", pt: "Adicionar consulta médica" }),
    saveRdv: tr(lang, { fr: "Enregistrer le RDV", en: "Save appointment", es: "Guardar la cita", pt: "Salvar consulta" }),
    sessionsOfDay: tr(lang, { fr: "Séances du jour — touche pour voir le détail", en: "Today's sessions — tap to see details", es: "Sesiones del día — toca para ver el detalle", pt: "Sessões do dia — toque para ver o detalhe" }),
    recupProgram: tr(lang, { fr: "Programme de récup", en: "Recovery program", es: "Programa de recuperación", pt: "Programa de recuperação" }),
    combinedNote: (n) => tr(lang, { fr: `Étirements et conseils réunis pour tes ${n} séances du jour.`, en: `Stretches and advice combined for your ${n} sessions today.`, es: `Estiramientos y consejos combinados para tus ${n} sesiones de hoy.`, pt: `Alongamentos e dicas reunidos para as suas ${n} sessões de hoje.` }),
    thisSessionStretches: tr(lang, { fr: "Étirements spécifiques à cette séance", en: "Stretches specific to this session", es: "Estiramientos específicos de esta sesión", pt: "Alongamentos específicos desta sessão" }),
  };

  const [expandedSessionId, setExpandedSessionId] = useState(null);
  const individualSportPlans = sportEntries.map((e) => ({ entry: e, plan: generatePlan(profile, { eventType: e.type, intensity: e.intensity || "moyen", fatigue: 3, hoursToNext: 48, sport: e.sport, heure: e.heure, muscuZones: e.muscuZones, seed: date + "-" + e.id }, lang) }));
  const combinedPlan = sportEntries.length > 0 ? mergeSportEntriesPlan(profile, sportEntries, date, lang) : null;
  const restPlan = entries.length === 0 ? buildRestDayPlan(profile, lang) : null;

  return (
    <div className="fixed inset-0 flex items-end z-50" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="w-full rounded-t-[28px] p-5 pt-3 max-h-[85vh] overflow-y-auto" style={{ background: "rgba(15,33,28,0.78)", backdropFilter: "blur(32px)", WebkitBackdropFilter: "blur(32px)", border: `1px solid ${C.glassBorder}`, boxShadow: `inset 0 1px 0 ${C.glassHighlight}` }} onClick={(e) => e.stopPropagation()}>
        <div className="w-9 h-1 rounded-full mx-auto mb-4" style={{ background: C.border }} />
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest" style={{ color: C.textFaint, ...fontBody }}>{fmtDate(date, lang, { weekday: "long", day: "numeric", month: "long" })}</p>
            <p className="font-bold text-lg mt-1 tracking-tight" style={{ color: C.text, ...fontDisplay }}>{entries.length === 0 ? T.dayOff : T.itemsPlanned(entries.length)}</p>
          </div>
          <button onClick={onClose}><X size={18} style={{ color: C.textMuted }} /></button>
        </div>

        {entries.length === 0 && (
          <>
            {effectiveAuto?.level === "recup_active" ? (
              <Card className="mb-3" style={{ background: C.reposActifSoft, border: `1px solid ${C.reposActif}44` }}>
                <div className="flex items-center gap-2 mb-2"><Leaf size={15} style={{ color: C.reposActif }} /><p className="font-bold text-sm" style={{ color: C.reposActif, ...fontBody }}>{T.autoActive}</p></div>
                <p className="text-[11px]" style={{ color: C.reposActif, ...fontBody }}>{T.autoActiveNote}</p>
              </Card>
            ) : effectiveAuto?.level === "repos_complet" ? (
              <Card className="mb-3" style={{ background: C.dangerSoft, border: `1px solid ${C.danger}33` }}>
                <div className="flex items-center gap-2 mb-2"><Moon size={15} style={{ color: C.danger }} /><p className="font-bold text-sm" style={{ color: C.danger, ...fontBody }}>{T.fullRest}</p></div>
                <p className="text-[11px] leading-relaxed" style={{ color: C.danger, ...fontBody }}>{T.fullRestNote}</p>
              </Card>
            ) : (
              <Card className="mb-3" style={{ background: C.glassSoft }}>
                <p className="text-xs" style={{ color: C.textMuted, ...fontBody }}>{T.restDay}</p>
                {!isPro && auto?.level && (
                  <button onClick={openPro} className="flex items-center gap-1.5 mt-2">
                    <Lock size={11} style={{ color: C.textFaint }} />
                    <span className="text-[10px]" style={{ color: C.textFaint, ...fontBody }}>{T.autoProHint}</span>
                  </button>
                )}
              </Card>
            )}
            <PlanTabs plan={restPlan} />
          </>
        )}

        {entries.map((e) => {
          if (e.type === "blessure") return (
            <Card key={e.id} className="mb-3" style={{ background: C.blessureSoft, border: `1px solid ${C.blessure}33` }}>
              <div className="flex items-center gap-2 mb-1"><HeartPulse size={15} style={{ color: C.blessure }} /><p className="font-bold text-sm" style={{ color: C.blessure, ...fontBody }}>{e.label}</p></div>
              <button onClick={() => goTo && goTo("blessures")} className="text-[11px] font-semibold mt-1" style={{ color: C.blessure }}>{T.seeInInjuries}</button>
            </Card>
          );
          if (e.type === "rdv") return (
            <Card key={e.id} className="mb-3" style={{ background: C.rdvSoft, border: `1px solid ${C.rdv}33` }}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2"><Stethoscope size={15} style={{ color: C.rdv }} /><p className="font-bold text-sm" style={{ color: C.rdv, ...fontBody }}>{praticienLabel(e.praticien, lang)}</p></div>
                <button onClick={() => onRemoveEntry(date, e.id)}><Trash2 size={13} style={{ color: C.textFaint }} /></button>
              </div>
              {e.motif && <p className="text-xs" style={{ color: C.textMuted, ...fontBody }}>{e.motif}</p>}
              {e.heure && <p className="text-[11px] mt-1" style={{ color: C.textFaint, ...fontBody }}>{T.at} {e.heure}</p>}
            </Card>
          );
          return null;
        })}

        {sportEntries.length > 0 && (
          <>
            <p className="text-[10px] uppercase tracking-widest mb-2 mt-1 px-1" style={{ color: C.textFaint, ...fontBody }}>{T.sessionsOfDay}</p>
            <GroupedList>
              {individualSportPlans.map(({ entry: e, plan }, i) => {
                const Icon = EVENT_ICONS[e.type] || Activity;
                const typeLabel = e.type === "match" ? T.match : e.type === "loisir" ? T.loisir : T.entrainement;
                const isOpen = expandedSessionId === e.id;
                return (
                  <div key={e.id}>
                    <ListRow
                      onClick={() => setExpandedSessionId(isOpen ? null : e.id)}
                      last={i === individualSportPlans.length - 1 && !isOpen}
                      left={<div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: entryColor(e) + "22" }}><Icon size={15} style={{ color: entryColor(e) }} /></div>}
                      title={`${sportIcon(e.sport)} ${sportLabel(e.sport, lang)} — ${typeLabel}`}
                      subtitle={[e.sport === "muscu" && e.muscuZones?.length > 0 ? e.muscuZones.map((z) => zoneLabel(z, lang)).join(" + ") : null, e.heure, e.label].filter(Boolean).join(" · ") || undefined}
                      right={<div className="flex items-center gap-2"><span style={{ ...fontMono, color: scoreColor(plan.score), fontSize: 14 }}>{plan.score}</span><ChevronDown size={14} style={{ color: C.textMuted, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} /></div>}
                    />
                    {isOpen && (
                      <div className="px-4 pb-3 flex flex-col gap-2" style={{ borderBottom: i === individualSportPlans.length - 1 ? "none" : `1px solid ${C.glassBorder}` }}>
                        <p className="text-[10px] uppercase tracking-wide mt-1" style={{ color: C.textFaint, ...fontBody }}>{T.thisSessionStretches}</p>
                        {plan.stretches.map((s, si) => (
                          <div key={si} className="flex items-center justify-between text-xs" style={{ color: C.textMuted, ...fontBody }}>
                            <span>{s.label}</span><span style={{ ...fontMono, color: C.primary, fontSize: 10 }}>{s.duree}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </GroupedList>

            <div className="mt-4 mb-2">
              <SectionTitle icon={Sparkles}>{T.recupProgram}</SectionTitle>
              {combinedPlan.combined && <p className="text-[11px] -mt-2 mb-3" style={{ color: C.textFaint, ...fontBody }}>{T.combinedNote(combinedPlan.sessionsCount)}</p>}
              <div className="flex justify-center mb-3"><RecoveryDial score={combinedPlan.score} label={T.recupProgram} sub={combinedPlan.duree} size={150} /></div>
              <PlanTabs plan={combinedPlan} />
            </div>
          </>
        )}

        <div className="flex flex-col gap-2 mt-2">
          <button onClick={() => setEditingSport(!editingSport)} className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: C.primary, ...fontBody }}><Pencil size={13} /> {T.editSport}</button>
          {editingSport && (
            <div className="mb-2">
              <EntryListEditor entries={localSport} defaultSport={profile.sports?.[0] || "autre"} onChange={setLocalSport} />
              <div className="flex gap-2 mt-2">
                <Btn small full onClick={saveSportEdit} icon={Check}>{T.save}</Btn>
                {isException && <Btn small variant="ghost" onClick={() => { onClearException(date); setEditingSport(false); }}>{T.backToBase}</Btn>}
              </div>
            </div>
          )}

          <button onClick={() => setAddingRdv(!addingRdv)} className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: C.rdv, ...fontBody }}><Stethoscope size={13} /> {T.addRdv}</button>
          {addingRdv && (
            <div className="rounded-2xl p-3" style={{ background: C.bgElevated, backdropFilter: "blur(14px)", border: `1px solid ${C.glassBorder}` }}>
              <RdvForm value={newRdvVal} onChange={setNewRdvVal} />
              <Btn small full onClick={saveRdv} disabled={!newRdvVal.motif} icon={Check}>{T.saveRdv}</Btn>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   PLANNING TAB
   ============================================================ */
function PlanningTab({ profile, plannerConfig, onSetWeekly, onSaveException, onClearException, onAddEntry, onRemoveEntry, goTo }) {
  const { lang } = useLang();
  const { isPro, openPro } = usePro();
  const weeklyDays = plannerConfig?.weeklyDays || emptyWeekly();
  const exceptions = plannerConfig?.exceptions || {};
  const monthlyUsed = useMemo(() => countMonthlyExtras(exceptions), [exceptions]);
  const [expandedDow, setExpandedDow] = useState(null);
  const [monthIdx, setMonthIdx] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState(null);
  const [excDate, setExcDate] = useState(""); const [excEntries, setExcEntries] = useState([]);
  const [rdvDate, setRdvDate] = useState(new Date().toISOString().slice(0, 10));
  const [rdvVal, setRdvVal] = useState(newRdv());
  const year = new Date().getFullYear();

  const schedule = useMemo(() => buildYearSchedule(weeklyDays, exceptions, year, profile), [weeklyDays, exceptions, year, profile]);
  const monthDays = schedule.filter((d) => new Date(d.date).getMonth() === monthIdx);
  const firstDow = monthDays.length ? monthDays[0].dow : 0;
  const activeMonthDays = monthDays.filter((d) => d.entries.length > 0);

  const loadExcForEdit = (date) => { setExcDate(date); setExcEntries((exceptions[date] || []).filter((e) => SPORT_TYPES.includes(e.type))); };
  const saveExcForm = () => {
    if (!excDate) return;
    const others = (exceptions[excDate] || []).filter((e) => !SPORT_TYPES.includes(e.type));
    onSaveException(excDate, [...excEntries, ...others]);
    setExcDate(""); setExcEntries([]);
  };
  const selectedDayObj = selectedDate ? schedule.find((d) => d.date === selectedDate) : null;

  const addRdv = () => { if (!rdvDate || !rdvVal.motif) return; onAddEntry(rdvDate, { id: Date.now() + Math.random(), type: "rdv", ...rdvVal }); setRdvVal(newRdv()); };
  const upcomingRdvs = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return schedule.filter((d) => d.date >= today && d.entries.some((e) => e.type === "rdv")).flatMap((d) => d.entries.filter((e) => e.type === "rdv").map((e) => ({ date: d.date, entry: e }))).slice(0, 20);
  }, [schedule]);

  const T = {
    title: tr(lang, { fr: "Planning", en: "Schedule", es: "Planificación", pt: "Planejamento" }),
    subtitle: tr(lang, { fr: "Modifiable à tout moment si besoin", en: "Editable anytime if needed", es: "Editable en cualquier momento si es necesario", pt: "Editável a qualquer momento se necessário" }),
    intro: tr(lang, { fr: "L'app choisit elle-même quand insérer de la récup active ou du repos complet, en plus de la récup, la nutrition et les rappels générés pour toute l'année.", en: "The app decides on its own when to insert active recovery or full rest, on top of the recovery, nutrition and reminders generated for the whole year.", es: "La app decide por sí sola cuándo insertar recuperación activa o descanso completo, además de la recuperación, la nutrición y los avisos generados para todo el año.", pt: "O app decide sozinho quando inserir recuperação ativa ou descanso completo, além da recuperação, nutrição e lembretes gerados para o ano inteiro." }),
    fixedDays: tr(lang, { fr: "Jours fixes de la semaine", en: "Fixed weekly days", es: "Días fijos de la semana", pt: "Dias fixos da semana" }),
    off: tr(lang, { fr: "Off", en: "Off", es: "Libre", pt: "Livre" }),
    addSession: tr(lang, { fr: "Ajouter une séance sportive ponctuelle", en: "Add a one-off sports session", es: "Añadir una sesión deportiva puntual", pt: "Adicionar uma sessão esportiva pontual" }),
    addSessionHint: tr(lang, { fr: "Match imprévu, entraînement en plus, session loisir ou jour off exceptionnel — sur n'importe quelle date.", en: "Unplanned match, extra training, casual session or exceptional day off — on any date.", es: "Partido imprevisto, entrenamiento extra, sesión libre o día libre excepcional — en cualquier fecha.", pt: "Jogo imprevisto, treino extra, sessão livre ou folga excepcional — em qualquer data." }),
    date: tr(lang, { fr: "Date", en: "Date", es: "Fecha", pt: "Data" }),
    saveDate: tr(lang, { fr: "Enregistrer pour cette date", en: "Save for this date", es: "Guardar para esta fecha", pt: "Salvar para esta data" }),
    offException: tr(lang, { fr: "Off exceptionnel", en: "Exceptional day off", es: "Libre excepcional", pt: "Folga excepcional" }),
    medicalRdv: tr(lang, { fr: "RDV médical", en: "Medical appointment", es: "Cita médica", pt: "Consulta médica" }),
    medicalRdvHint: tr(lang, { fr: "Contrôle, suivi de blessure ou consultation de routine — totalement séparé de tes séances sportives.", en: "Check-up, injury follow-up or routine consultation — completely separate from your sports sessions.", es: "Control, seguimiento de lesión o consulta de rutina — totalmente separado de tus sesiones deportivas.", pt: "Check-up, acompanhamento de lesão ou consulta de rotina — totalmente separado das suas sessões esportivas." }),
    quotaHint: (used, max) => tr(lang, { fr: `Compte gratuit : ${used}/${max} exceptions & RDV utilisés ce mois-ci`, en: `Free plan: ${used}/${max} exceptions & appointments used this month`, es: `Plan gratuito: ${used}/${max} excepciones y citas usadas este mes`, pt: `Plano grátis: ${used}/${max} exceções e consultas usadas este mês` }),
    addToSchedule: tr(lang, { fr: "Ajouter au planning", en: "Add to schedule", es: "Añadir a la planificación", pt: "Adicionar ao planejamento" }),
    monthDetail: tr(lang, { fr: "Détail du mois", en: "Month detail", es: "Detalle del mes", pt: "Detalhe do mês" }),
    noSessionMonth: tr(lang, { fr: "Aucune séance programmée ce mois-ci.", en: "No session scheduled this month.", es: "Ninguna sesión programada este mes.", pt: "Nenhuma sessão programada este mês." }),
    session: tr(lang, { fr: "session", en: "session", es: "sesión", pt: "sessão" }),
    sessions: tr(lang, { fr: "sessions", en: "sessions", es: "sesiones", pt: "sessões" }),
    legendRest: tr(lang, { fr: "Repos", en: "Rest", es: "Descanso", pt: "Descanso" }),
    legendChill: tr(lang, { fr: "Chill", en: "Easy", es: "Suave", pt: "Leve" }),
    legendMedium: tr(lang, { fr: "Moyen", en: "Medium", es: "Medio", pt: "Médio" }),
    legendIntense: tr(lang, { fr: "Intense", en: "Intense", es: "Intenso", pt: "Intenso" }),
    legendMatch: tr(lang, { fr: "Match/Combat", en: "Match/Fight", es: "Partido/Combate", pt: "Jogo/Luta" }),
    legendLoisir: tr(lang, { fr: "Loisir", en: "Casual", es: "Libre", pt: "Livre" }),
    legendActive: tr(lang, { fr: "Récup active", en: "Active recovery", es: "Recuperación activa", pt: "Recuperação ativa" }),
    legendRdv: tr(lang, { fr: "RDV médical", en: "Medical appointment", es: "Cita médica", pt: "Consulta médica" }),
    legendInjury: tr(lang, { fr: "Blessure", en: "Injury", es: "Lesión", pt: "Lesão" }),
    blessure: tr(lang, { fr: "Blessure", en: "Injury", es: "Lesión", pt: "Lesão" }),
    rdv: tr(lang, { fr: "RDV", en: "Appt.", es: "Cita", pt: "Consulta" }),
  };

  return (
    <div className="px-5 pt-4 pb-24">
      <LargeHeader title={T.title} subtitle={T.subtitle} />
      <p className="text-xs mb-4 -mt-3" style={{ color: C.textMuted, ...fontBody }}>{T.intro}</p>

      {!isPro && (
        <button onClick={openPro} className="w-full flex items-center gap-2 mb-4 px-3.5 py-2.5 rounded-2xl" style={{ background: C.glassSoft, border: `1px solid ${C.glassBorder}` }}>
          <Lock size={13} style={{ color: C.textFaint }} />
          <span className="text-[11px] flex-1 text-left" style={{ color: C.textMuted, ...fontBody }}>{T.quotaHint(monthlyUsed, FREE_EXCEPTIONS_PER_MONTH)}</span>
          <ProBadge />
        </button>
      )}

      <Card className="mb-4">
        <SectionTitle icon={CalendarDays}>{T.fixedDays}</SectionTitle>
        {DAYS[lang].map((d, i) => (
          <div key={d} className="mb-2 pb-2" style={{ borderBottom: `1px solid ${C.borderSoft}66` }}>
            <button onClick={() => setExpandedDow(expandedDow === i ? null : i)} className="w-full flex items-center justify-between">
              <span className="text-xs font-semibold" style={{ color: C.text, ...fontBody }}>{d}</span>
              <div className="flex items-center gap-1.5">
                {weeklyDays[i].length === 0 ? <span className="text-[10px]" style={{ color: C.textFaint, ...fontBody }}>{T.off}</span> : weeklyDays[i].map((e) => <span key={e.id} className="text-sm">{sportIcon(e.sport)}</span>)}
                <ChevronDown size={14} style={{ color: C.textMuted, transform: expandedDow === i ? "rotate(180deg)" : "none" }} />
              </div>
            </button>
            {expandedDow === i && <div className="mt-2"><EntryListEditor entries={weeklyDays[i]} defaultSport={profile.sports?.[0] || "autre"} onChange={(entries) => onSetWeekly(i, entries)} /></div>}
          </div>
        ))}
      </Card>

      <Card className="mb-4">
        <SectionTitle icon={Plus}>{T.addSession}</SectionTitle>
        <p className="text-[11px] mb-3" style={{ color: C.textFaint, ...fontBody }}>{T.addSessionHint}</p>
        <Field label={T.date}><TextInput type="date" value={excDate} onChange={(e) => setExcDate(e.target.value)} /></Field>
        {excDate && <EntryListEditor entries={excEntries} defaultSport={profile.sports?.[0] || "autre"} onChange={setExcEntries} />}
        <div className="mt-2"><Btn onClick={saveExcForm} full disabled={!excDate} icon={Check}>{T.saveDate}</Btn></div>
        {Object.keys(exceptions).length > 0 && (
          <div className="flex flex-col gap-2 mt-4">
            {Object.entries(exceptions).sort(([a], [b]) => a.localeCompare(b)).map(([date, ents]) => (
              <div key={date} className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: C.bgElevated }}>
                <button onClick={() => loadExcForEdit(date)} className="text-left flex-1"><span className="text-[11px]" style={{ color: C.text, ...fontBody }}>{date} — {ents.length === 0 ? T.offException : ents.map((e) => e.type === "blessure" ? T.blessure : e.type === "rdv" ? T.rdv : eventLabel(e.type, lang)).join(", ")}</span></button>
                <button onClick={() => onClearException(date)}><Trash2 size={13} style={{ color: C.textFaint }} /></button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mb-4" style={{ background: `linear-gradient(160deg, ${C.rdv}18 0%, ${C.surface} 55%)` }}>
        <SectionTitle icon={Stethoscope}>{T.medicalRdv}</SectionTitle>
        <p className="text-[11px] mb-3" style={{ color: C.textFaint, ...fontBody }}>{T.medicalRdvHint}</p>
        <Field label={T.date}><TextInput type="date" value={rdvDate} onChange={(e) => setRdvDate(e.target.value)} /></Field>
        <RdvForm value={rdvVal} onChange={setRdvVal} />
        <Btn full onClick={addRdv} disabled={!rdvVal.motif} icon={Plus}>{T.addToSchedule}</Btn>
        {upcomingRdvs.length > 0 && (
          <div className="mt-4">
            <GroupedList>
              {upcomingRdvs.map((r, i) => (
                <ListRow key={r.entry.id} last={i === upcomingRdvs.length - 1}
                  left={<div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: C.rdvSoft }}><Stethoscope size={15} style={{ color: C.rdv }} /></div>}
                  title={praticienLabel(r.entry.praticien, lang)} subtitle={`${fmtDate(r.date, lang, { day: "2-digit", month: "short" })}${r.entry.heure ? " · " + r.entry.heure : ""}${r.entry.motif ? " · " + r.entry.motif : ""}`}
                  right={<button onClick={() => onRemoveEntry(r.date, r.entry.id)}><Trash2 size={13} style={{ color: C.textFaint }} /></button>} />
              ))}
            </GroupedList>
          </div>
        )}
      </Card>

      <Card className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setMonthIdx((m) => (m + 11) % 12)}><ChevronLeft size={18} style={{ color: C.textMuted }} /></button>
          <span className="text-sm font-bold tracking-tight" style={{ color: C.text, ...fontDisplay }}>{MONTHS[lang][monthIdx]} {year}</span>
          <button onClick={() => setMonthIdx((m) => (m + 1) % 12)}><ChevronRight size={18} style={{ color: C.textMuted }} /></button>
        </div>
        <div className="grid grid-cols-7 gap-1.5 mb-2">{DAYS[lang].map((d) => <span key={d} className="text-[9px] text-center" style={{ color: C.textFaint, ...fontBody }}>{d}</span>)}</div>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: firstDow }).map((_, i) => <div key={"e" + i} />)}
          {monthDays.map((d) => (
            <button key={d.date} onClick={() => setSelectedDate(d.date)} className="aspect-square rounded-xl flex items-center justify-center text-[10px] font-semibold relative" style={{ background: dayColor(d) + (d.entries.length === 0 ? "22" : ""), color: d.entries.length === 0 ? C.textFaint : "#0A1613", ...fontMono }}>
              {Number(d.date.slice(-2))}
              {d.entries.length > 1 && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px]" style={{ background: C.bgElevated, color: C.text, border: `1px solid ${C.border}` }}>{d.entries.length}</span>}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 mt-4">
          {[[T.legendRest, C.border], [T.legendChill, C.primaryDim], [T.legendMedium, C.primary], [T.legendIntense, C.warn], [T.legendMatch, C.danger], [T.legendLoisir, C.loisir], [T.legendActive, C.reposActif], [T.legendRdv, C.rdv], [T.legendInjury, C.blessure]].map(([l, c]) => (
            <div key={l} className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ background: c }} /><span className="text-[10px]" style={{ color: C.textMuted, ...fontBody }}>{l}</span></div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle icon={Eye}>{T.monthDetail}</SectionTitle>
        {activeMonthDays.length === 0 ? <p className="text-xs" style={{ color: C.textFaint, ...fontBody }}>{T.noSessionMonth}</p> : (
          <GroupedList>
            {activeMonthDays.map((d, i) => (
              <ListRow key={d.date} last={i === activeMonthDays.length - 1} onClick={() => setSelectedDate(d.date)} chevron
                left={<div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: dayColor(d) }} />}
                title={`${fmtDate(d.date, lang, { day: "2-digit", month: "short" })} · ${d.entries.length} ${d.entries.length > 1 ? T.sessions : T.session}`}
                subtitle={d.entries.map((e) => e.type === "blessure" ? T.blessure : e.type === "rdv" ? T.rdv : eventLabel(e.type, lang)).join(" · ")}
                right={<span className="text-sm">{d.entries.map((e) => e.type === "blessure" ? "🩹" : e.type === "rdv" ? "🩺" : sportIcon(e.sport)).join(" ")}</span>} />
            ))}
          </GroupedList>
        )}
      </Card>

      {selectedDayObj && <DayDetailSheet date={selectedDayObj.date} entries={selectedDayObj.entries} isException={selectedDayObj.isException} auto={selectedDayObj.auto} profile={profile} onClose={() => setSelectedDate(null)} onSaveException={onSaveException} onClearException={onClearException} onAddEntry={onAddEntry} onRemoveEntry={onRemoveEntry} goTo={goTo} />}
    </div>
  );
}

/* ============================================================
   HOME TAB
   ============================================================ */
function HomeTab({ profile, sessionsLog, injuries, plannerConfig, lastPlan, goTo, onSaveException, onClearException, onAddEntry, onRemoveEntry }) {
  const { lang } = useLang();
  const today = new Date(); const todayIso = today.toISOString().slice(0, 10);
  const year = today.getFullYear();
  const weeklyDays = plannerConfig?.weeklyDays || emptyWeekly();
  const exceptions = plannerConfig?.exceptions || {};
  const hasPlanner = weeklyDays.some((d) => d.length > 0) || Object.keys(exceptions).length > 0;
  const [selectedDate, setSelectedDate] = useState(null);

  const schedule = useMemo(() => buildYearSchedule(weeklyDays, exceptions, year, profile), [plannerConfig, profile, year]);
  const activeInjury = useMemo(() => injuries.find((i) => i.arret && i.dateDebut && i.dateDebut.slice(0, 10) <= todayIso && (!i.dateRetour || i.dateRetour.slice(0, 10) >= todayIso)), [injuries]);

  const weekSchedule = useMemo(() => {
    const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const found = schedule.find((s) => s.date === iso);
      return found ? { ...found, isToday: iso === todayIso } : { date: iso, dow: i, entries: [], isToday: iso === todayIso };
    });
  }, [schedule]);

  const reminders = useMemo(() => {
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const iso = tomorrow.toISOString().slice(0, 10);
    const found = schedule.find((s) => s.date === iso);
    return (found?.entries || []).filter((e) => e.notify && e.type !== "blessure");
  }, [schedule]);

  const nextEvent = useMemo(() => {
    if (!hasPlanner) return null;
    const idx = schedule.findIndex((s) => s.date === todayIso);
    if (idx < 0) return null;
    for (let i = idx; i < Math.min(schedule.length, idx + 200); i++) {
      if (schedule[i].entries.some((e) => SPORT_TYPES.includes(e.type))) return { daysAway: i - idx };
    }
    return null;
  }, [schedule]);

  const weekCount = sessionsLog.filter((s) => (today - new Date(s.date)) / 86400000 <= 7).length;
  const recent = sessionsLog.slice(-5);
  const avgScore = recent.length ? Math.round(recent.reduce((a, s) => a + s.score, 0) / recent.length) : null;
  const selectedDayObj = selectedDate ? schedule.find((d) => d.date === selectedDate) : null;

  const T = {
    hi: tr(lang, { fr: "Salut 👋", en: "Hi 👋", es: "Hola 👋", pt: "Olá 👋" }),
    injuryOff: (part) => tr(lang, { fr: `En arrêt — ${part}`, en: `Off — ${part}`, es: `De baja — ${part}`, pt: `Afastado — ${part}` }),
    since: (d) => tr(lang, { fr: `Depuis le ${d}`, en: `Since ${d}`, es: `Desde el ${d}`, pt: `Desde ${d}` }),
    returnLabel: (d) => tr(lang, { fr: `· retour ${d}`, en: `· return ${d}`, es: `· vuelta ${d}`, pt: `· retorno ${d}` }),
    onDate: (d) => tr(lang, { fr: `le ${d}`, en: `on ${d}`, es: `el ${d}`, pt: `em ${d}` }),
    tbd: tr(lang, { fr: "à définir", en: "TBD", es: "por determinar", pt: "a definir" }),
    reminderTomorrow: tr(lang, { fr: "Rappel pour demain", en: "Reminder for tomorrow", es: "Aviso para mañana", pt: "Lembrete para amanhã" }),
    reminderNote: tr(lang, { fr: "Affiché dans l'app à l'ouverture — une vraie notification push nécessiterait l'app installée en arrière-plan.", en: "Shown in-app on open — a real push notification would require the app installed and running in the background.", es: "Se muestra en la app al abrirla — una notificación push real requeriría la app instalada en segundo plano.", pt: "Exibido no app ao abrir — uma notificação push real exigiria o app instalado em segundo plano." }),
    reminderAt: (t) => tr(lang, { fr: `— rappel prévu à ${t}`, en: `— reminder set for ${t}`, es: `— aviso previsto a las ${t}`, pt: `— lembrete previsto para ${t}` }),
    sessionsWeek: tr(lang, { fr: "Séances / 7j", en: "Sessions / 7d", es: "Sesiones / 7d", pt: "Sessões / 7d" }),
    avgScore: tr(lang, { fr: "Score moyen", en: "Average score", es: "Puntuación media", pt: "Pontuação média" }),
    nextEvent: tr(lang, { fr: "Prochain évent.", en: "Next event", es: "Próximo evento", pt: "Próximo evento" }),
    thisWeek: tr(lang, { fr: "Cette semaine", en: "This week", es: "Esta semana", pt: "Esta semana" }),
    configure: tr(lang, { fr: "Configurer", en: "Set up", es: "Configurar", pt: "Configurar" }),
    configureHint: tr(lang, { fr: "Configure tes jours fixes pour voir ta semaine ici.", en: "Set up your fixed days to see your week here.", es: "Configura tus días fijos para ver tu semana aquí.", pt: "Configure seus dias fixos para ver sua semana aqui." }),
    tapDay: tr(lang, { fr: "Touche un jour pour voir le détail complet.", en: "Tap a day to see the full detail.", es: "Toca un día para ver el detalle completo.", pt: "Toque em um dia para ver o detalhe completo." }),
    quickRecup: tr(lang, { fr: "Récup ponctuelle", en: "One-off recovery", es: "Recuperación puntual", pt: "Recuperação pontual" }),
    nutrition: tr(lang, { fr: "Nutrition", en: "Nutrition", es: "Nutrición", pt: "Nutrição" }),
    injuries: tr(lang, { fr: "Blessures", en: "Injuries", es: "Lesiones", pt: "Lesões" }),
    planning: tr(lang, { fr: "Planning", en: "Schedule", es: "Planificación", pt: "Planejamento" }),
    lastSession: tr(lang, { fr: "Dernière séance", en: "Last session", es: "Última sesión", pt: "Última sessão" }),
    recoveryNeed: tr(lang, { fr: "Besoin de récupération", en: "Recovery need", es: "Necesidad de recuperación", pt: "Necessidade de recuperação" }),
    noSessionYet: tr(lang, { fr: "Aucune séance enregistrée. Génère ton premier plan de récup.", en: "No session logged yet. Generate your first recovery plan.", es: "Aún no hay sesiones registradas. Genera tu primer plan de recuperación.", pt: "Nenhuma sessão registrada ainda. Gere seu primeiro plano de recuperação." }),
    start: tr(lang, { fr: "Commencer", en: "Get started", es: "Empezar", pt: "Começar" }),
    history: tr(lang, { fr: "Historique", en: "History", es: "Historial", pt: "Histórico" }),
    nothingYet: tr(lang, { fr: "Rien pour l'instant.", en: "Nothing yet.", es: "Nada por el momento.", pt: "Nada por enquanto." }),
    match: tr(lang, { fr: "Match / Combat", en: "Match / Fight", es: "Partido / Combate", pt: "Jogo / Luta" }),
    loisir: tr(lang, { fr: "Session loisir", en: "Casual session", es: "Sesión libre", pt: "Sessão livre" }),
    entrainement: tr(lang, { fr: "Entraînement", en: "Training", es: "Entrenamiento", pt: "Treino" }),
  };

  return (
    <div className="px-5 pt-4 pb-24">
      <LargeHeader title={profile.name} subtitle={T.hi} right={<div className="flex gap-1">{(profile.sports || []).slice(0, 3).map((s) => <span key={s} className="text-xl">{sportIcon(s)}</span>)}</div>} />

      {activeInjury && (
        <button onClick={() => goTo("blessures")} className="w-full text-left mb-4 rounded-[22px] p-3.5 flex items-start gap-3" style={{ background: C.dangerSoft, border: `1px solid ${C.danger}33` }}>
          <HeartPulse size={18} style={{ color: C.danger, flexShrink: 0, marginTop: 1 }} />
          <div><p className="text-xs font-bold" style={{ color: C.danger, ...fontBody }}>{T.injuryOff(bodyPartLabel(activeInjury.part, lang))}</p><p className="text-[11px] mt-0.5" style={{ color: C.danger, ...fontBody }}>{T.since(fmtDate(activeInjury.dateDebut, lang))} {T.returnLabel(activeInjury.dateRetour ? T.onDate(fmtDate(activeInjury.dateRetour, lang)) : T.tbd)}</p></div>
        </button>
      )}

      {reminders.length > 0 && (
        <Card className="mb-4" style={{ background: `linear-gradient(160deg, ${C.primary}22 0%, ${C.surface} 60%)` }}>
          <div className="flex items-center gap-2 mb-2"><Bell size={15} style={{ color: C.primary }} /><p className="font-bold text-sm tracking-tight" style={{ color: C.primary, ...fontDisplay }}>{T.reminderTomorrow}</p></div>
          {reminders.map((r) => <p key={r.id} className="text-[11px] mb-1" style={{ color: C.primary, ...fontBody }}>{r.type === "rdv" ? `${praticienLabel(r.praticien, lang)}${r.motif ? " — " + r.motif : ""}` : `${eventLabel(r.type, lang)} ${sportIcon(r.sport)}`}{r.heure && ` ${r.heure}`} {T.reminderAt(r.notifyTime)}</p>)}
          <p className="text-[9px] mt-1" style={{ color: C.primary, opacity: 0.7, ...fontBody }}>{T.reminderNote}</p>
        </Card>
      )}

      <Card style={{ padding: 0 }} className="mb-4">
        <div className="grid grid-cols-3">
          {[{ v: weekCount, l: T.sessionsWeek, c: C.primary }, { v: avgScore ?? "—", l: T.avgScore, c: avgScore ? scoreColor(avgScore) : C.textFaint }, { v: nextEvent ? `J-${nextEvent.daysAway}` : "—", l: T.nextEvent, c: C.text }].map((s, i) => (
            <div key={i} className="flex flex-col items-center py-3.5" style={{ borderRight: i < 2 ? `1px solid ${C.borderSoft}66` : "none" }}>
              <p style={{ ...fontMono, color: s.c, fontSize: 20 }}>{s.v}</p>
              <p className="text-[9px] uppercase tracking-wide" style={{ color: C.textFaint, ...fontBody }}>{s.l}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mb-4">
        <div className="flex items-center justify-between mb-3"><SectionTitle icon={CalendarDays}>{T.thisWeek}</SectionTitle>{!hasPlanner && <button onClick={() => goTo("planning")} className="text-[10px] font-semibold" style={{ color: C.primary }}>{T.configure}</button>}</div>
        {hasPlanner ? (
          <div className="grid grid-cols-7 gap-1.5">
            {weekSchedule.map((d) => (
              <button key={d.date} onClick={() => setSelectedDate(d.date)} className="flex flex-col items-center gap-1">
                <span className="text-[9px]" style={{ color: C.textFaint, ...fontBody }}>{DAYS[lang][d.dow]}</span>
                <div className="w-full aspect-square rounded-xl flex items-center justify-center relative" style={{ background: dayColor(d) + (d.entries.length === 0 ? "22" : ""), border: d.isToday ? `1.5px solid ${C.text}` : "none" }}>
                  {d.entries[0]?.type === "rdv" ? <span className="text-xs">🩺</span> : d.entries[0]?.sport && <span className="text-xs">{sportIcon(d.entries[0].sport)}</span>}
                  {d.entries.length > 1 && <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full flex items-center justify-center text-[6px]" style={{ background: C.bgElevated, color: C.text }}>{d.entries.length}</span>}
                </div>
              </button>
            ))}
          </div>
        ) : <p className="text-xs" style={{ color: C.textFaint, ...fontBody }}>{T.configureHint}</p>}
        <p className="text-[10px] mt-2" style={{ color: C.textFaint, ...fontBody }}>{T.tapDay}</p>
      </Card>

      <div className="flex gap-3 mb-5 overflow-x-auto pb-1">
        <IconTile icon={Sparkles} label={T.quickRecup} onClick={() => goTo("recup")} color={C.primary} />
        <IconTile icon={Utensils} label={T.nutrition} onClick={() => goTo("nutrition")} color={C.warn} />
        <IconTile icon={HeartPulse} label={T.injuries} onClick={() => goTo("blessures")} color={C.blessure} />
        <IconTile icon={CalendarDays} label={T.planning} onClick={() => goTo("planning")} color={C.rdv} />
      </div>

      {lastPlan ? (
        <HeroCard accent={scoreColor(lastPlan.score)} className="flex flex-col items-center mb-4" style={{ paddingTop: 20 }}><p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: C.textFaint, ...fontBody }}>{T.lastSession}</p><RecoveryDial score={lastPlan.score} label={T.recoveryNeed} sub={lastPlan.duree} size={160} /></HeroCard>
      ) : (
        <Card className="mb-4"><p className="text-xs mb-3" style={{ color: C.textMuted, ...fontBody }}>{T.noSessionYet}</p><Btn onClick={() => goTo("recup")} icon={Sparkles} full>{T.start}</Btn></Card>
      )}

      <SectionTitle icon={TrendingUp}>{T.history}</SectionTitle>
      {sessionsLog.length === 0 ? <Card><p className="text-xs" style={{ color: C.textFaint, ...fontBody }}>{T.nothingYet}</p></Card> : (
        <GroupedList>
          {[...sessionsLog].reverse().slice(0, 8).map((s, i, arr) => (
            <ListRow key={s.id} last={i === arr.length - 1}
              left={<span className="text-lg shrink-0">{sportIcon(s.sport)}</span>}
              title={s.eventType === "match" ? T.match : s.eventType === "loisir" ? T.loisir : T.entrainement}
              subtitle={fmtDate(s.date, lang)}
              right={<div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ background: scoreColor(s.score) }} /><span style={{ ...fontMono, color: C.text, fontSize: 15 }}>{s.score}</span></div>} />
          ))}
        </GroupedList>
      )}

      {selectedDayObj && <DayDetailSheet date={selectedDayObj.date} entries={selectedDayObj.entries} isException={selectedDayObj.isException} auto={selectedDayObj.auto} profile={profile} onClose={() => setSelectedDate(null)} onSaveException={onSaveException} onClearException={onClearException} onAddEntry={onAddEntry} onRemoveEntry={onRemoveEntry} goTo={goTo} />}
    </div>
  );
}

/* ============================================================
   PROFILE / SETTINGS
   ============================================================ */
/* ============================================================
   ÉCRAN REGEN PRO — présentation de l'offre, essai gratuit
   ============================================================ */
function ProTab() {
  const { lang } = useLang();
  const { isPro, isTrial, trialDaysLeft, cycle, cancelled, renewalDate, history, startTrial, activateDemo, setProDemo, cancelSub, resumeSub } = usePro();
  const [pickCycle, setPickCycle] = useState("monthly");
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const T = {
    title: "REGEN Pro",
    subtitle: tr(lang, { fr: "Va plus loin dans ta récupération", en: "Take your recovery further", es: "Lleva tu recuperación más lejos", pt: "Leve sua recuperação mais longe" }),
    youArePro: tr(lang, { fr: "Tu es Pro ✨", en: "You're Pro ✨", es: "Eres Pro ✨", pt: "Você é Pro ✨" }),
    trialActive: (n) => tr(lang, { fr: `Essai gratuit actif — ${n} jour${n > 1 ? "s" : ""} restant${n > 1 ? "s" : ""}`, en: `Free trial active — ${n} day${n > 1 ? "s" : ""} left`, es: `Prueba gratuita activa — ${n} día${n > 1 ? "s" : ""} restante${n > 1 ? "s" : ""}`, pt: `Teste grátis ativo — ${n} dia${n > 1 ? "s" : ""} restante${n > 1 ? "s" : ""}` }),
    until: (d) => tr(lang, { fr: `Actif jusqu'au ${d}`, en: `Active until ${d}`, es: `Activo hasta el ${d}`, pt: `Ativo até ${d}` }),
    nextPayment: (d, price) => tr(lang, { fr: `Prochain paiement automatique : ${d} — ${price}`, en: `Next automatic payment: ${d} — ${price}`, es: `Próximo pago automático: ${d} — ${price}`, pt: `Próximo pagamento automático: ${d} — ${price}` }),
    firstPayment: (d, price) => tr(lang, { fr: `Premier prélèvement à la fin de l'essai : ${d} — ${price}`, en: `First charge at the end of the trial: ${d} — ${price}`, es: `Primer cobro al final de la prueba: ${d} — ${price}`, pt: `Primeira cobrança no fim do teste: ${d} — ${price}` }),
    cancelledNote: (d) => tr(lang, { fr: `Abonnement annulé — accès conservé jusqu'au ${d}, aucun renouvellement ensuite.`, en: `Subscription cancelled — access kept until ${d}, no renewal after that.`, es: `Suscripción cancelada — acceso conservado hasta el ${d}, sin renovación después.`, pt: `Assinatura cancelada — acesso mantido até ${d}, sem renovação depois.` }),
    cancelBtn: tr(lang, { fr: "Annuler l'abonnement", en: "Cancel subscription", es: "Cancelar suscripción", pt: "Cancelar assinatura" }),
    confirmCancelTitle: tr(lang, { fr: "Confirmer l'annulation ?", en: "Confirm cancellation?", es: "¿Confirmar cancelación?", pt: "Confirmar cancelamento?" }),
    confirmCancelNote: (d) => tr(lang, { fr: `Tu garderas l'accès Pro jusqu'au ${d}. Aucun montant supplémentaire ne sera prélevé après cette date.`, en: `You'll keep Pro access until ${d}. No further amount will be charged after that date.`, es: `Conservarás el acceso Pro hasta el ${d}. No se cobrará ningún importe adicional después de esa fecha.`, pt: `Você manterá o acesso Pro até ${d}. Nenhum valor adicional será cobrado após essa data.` }),
    confirmCancelBtn: tr(lang, { fr: "Oui, annuler", en: "Yes, cancel", es: "Sí, cancelar", pt: "Sim, cancelar" }),
    keepSub: tr(lang, { fr: "Garder mon abonnement", en: "Keep my subscription", es: "Mantener mi suscripción", pt: "Manter minha assinatura" }),
    resumeBtn: tr(lang, { fr: "Réactiver le renouvellement automatique", en: "Reactivate auto-renewal", es: "Reactivar la renovación automática", pt: "Reativar a renovação automática" }),
    monthly: tr(lang, { fr: "Mensuel", en: "Monthly", es: "Mensual", pt: "Mensal" }),
    yearly: tr(lang, { fr: "Annuel (-44%)", en: "Yearly (-44%)", es: "Anual (-44%)", pt: "Anual (-44%)" }),
    startTrial: tr(lang, { fr: "Essayer gratuitement 7 jours", en: "Try free for 7 days", es: "Prueba gratis 7 días", pt: "Testar grátis por 7 dias" }),
    priceNoteMonthly: tr(lang, { fr: "Puis 5,99€/mois. Résiliable à tout moment.", en: "Then $5.99/mo. Cancel anytime.", es: "Luego 5,99€/mes. Cancela cuando quieras.", pt: "Depois 5,99€/mês. Cancele quando quiser." }),
    priceNoteYearly: tr(lang, { fr: "Puis 39,99€/an. Résiliable à tout moment.", en: "Then $39.99/yr. Cancel anytime.", es: "Luego 39,99€/año. Cancela cuando quieras.", pt: "Depois 39,99€/ano. Cancele quando quiser." }),
    demoNote: tr(lang, { fr: "Démo : le vrai paiement (App Store / Google Play) sera branché une fois l'app publiée sur les stores. Ce bouton simule l'accès Pro pour tester dès maintenant.", en: "Demo: real payment (App Store / Google Play) will be wired once the app is published. This button simulates Pro access so you can test it now.", es: "Demo: el pago real (App Store / Google Play) se conectará al publicar la app. Este botón simula el acceso Pro para probar ahora.", pt: "Demo: o pagamento real (App Store / Google Play) será conectado após a publicação. Este botão simula o acesso Pro para testar agora." }),
    activateDemo: tr(lang, { fr: "Activer Pro directement (démo)", en: "Activate Pro directly (demo)", es: "Activar Pro directamente (demo)", pt: "Ativar Pro diretamente (demo)" }),
    included: tr(lang, { fr: "Inclus dans Pro", en: "Included in Pro", es: "Incluido en Pro", pt: "Incluído no Pro" }),
    f1t: tr(lang, { fr: "Sports & séances illimités", en: "Unlimited sports & sessions", es: "Deportes y sesiones ilimitados", pt: "Esportes e sessões ilimitados" }),
    f1d: tr(lang, { fr: `Plusieurs sports, et plus de ${FREE_SESSIONS_PER_DAY} séance par jour — au lieu d'un seul sport et ${FREE_SESSIONS_PER_DAY} séance/jour en gratuit.`, en: `Multiple sports, and more than ${FREE_SESSIONS_PER_DAY} session per day — instead of one sport and ${FREE_SESSIONS_PER_DAY} session/day for free.`, es: `Varios deportes, y más de ${FREE_SESSIONS_PER_DAY} sesión al día — en vez de un solo deporte y ${FREE_SESSIONS_PER_DAY} sesión/día gratis.`, pt: `Vários esportes, e mais de ${FREE_SESSIONS_PER_DAY} sessão por dia — em vez de um esporte e ${FREE_SESSIONS_PER_DAY} sessão/dia grátis.` }),
    f2t: tr(lang, { fr: "Nutrition avancée", en: "Advanced nutrition", es: "Nutrición avanzada", pt: "Nutrição avançada" }),
    f2d: tr(lang, { fr: "Besoins caloriques et macronutriments détaillés (kcal, protéines, glucides, lipides) selon ton profil.", en: "Detailed calorie and macro needs (kcal, protein, carbs, fat) based on your profile.", es: "Necesidades calóricas y de macros detalladas (kcal, proteínas, carbohidratos, grasas) según tu perfil.", pt: "Necessidades calóricas e de macros detalhadas (kcal, proteínas, carboidratos, gorduras) conforme seu perfil." }),
    f3t: tr(lang, { fr: "Programme chronométré précis", en: "Precise timed program", es: "Programa cronometrado preciso", pt: "Programa cronometrado preciso" }),
    f3d: tr(lang, { fr: "Horaires exacts calculés à partir de l'heure de ta séance, au lieu de délais approximatifs.", en: "Exact times calculated from your session time, instead of rough delays.", es: "Horarios exactos calculados a partir de la hora de tu sesión, en vez de tiempos aproximados.", pt: "Horários exatos calculados a partir do horário da sua sessão, em vez de tempos aproximados." }),
    f4t: tr(lang, { fr: "Récup intelligente automatique", en: "Smart automatic recovery", es: "Recuperación inteligente automática", pt: "Recuperação inteligente automática" }),
    f4d: tr(lang, { fr: "L'app détecte seule quand il te faut de la récup active ou un repos complet, selon ta charge récente.", en: "The app detects on its own when you need active recovery or full rest, based on your recent load.", es: "La app detecta sola cuándo necesitas recuperación activa o descanso completo, según tu carga reciente.", pt: "O app detecta sozinho quando você precisa de recuperação ativa ou descanso completo, conforme sua carga recente." }),
    f5t: tr(lang, { fr: "RDV & exceptions illimités", en: "Unlimited appointments & exceptions", es: "Citas y excepciones ilimitadas", pt: "Consultas e exceções ilimitadas" }),
    f5d: tr(lang, { fr: `Version gratuite limitée à ${FREE_EXCEPTIONS_PER_MONTH} ajouts ponctuels par mois (RDV médicaux, séances imprévues...). Illimité avec Pro.`, en: `Free plan limited to ${FREE_EXCEPTIONS_PER_MONTH} one-off additions per month (medical appointments, unplanned sessions...). Unlimited with Pro.`, es: `Plan gratuito limitado a ${FREE_EXCEPTIONS_PER_MONTH} añadidos puntuales al mes (citas médicas, sesiones imprevistas...). Ilimitado con Pro.`, pt: `Plano gratuito limitado a ${FREE_EXCEPTIONS_PER_MONTH} adições pontuais por mês (consultas médicas, sessões imprevistas...). Ilimitado no Pro.` }),
    f6t: tr(lang, { fr: "Synchronisation multi-appareils", en: "Multi-device sync", es: "Sincronización multidispositivo", pt: "Sincronização multi-dispositivo" }),
    f6d: tr(lang, { fr: "Retrouve tes données sur tous tes appareils via ton compte cloud. Arrive avec la prochaine mise à jour.", en: "Access your data on all your devices via your cloud account. Coming in a future update.", es: "Accede a tus datos en todos tus dispositivos con tu cuenta en la nube. Llega en una próxima actualización.", pt: "Acesse seus dados em todos os dispositivos com sua conta na nuvem. Chega em uma próxima atualização." }),
    soon: tr(lang, { fr: "Bientôt", en: "Coming soon", es: "Próximamente", pt: "Em breve" }),
    freeStaysFree: tr(lang, { fr: "Le reste de l'app (récup ponctuelle, conseils blessures, planning de base) reste gratuit, sans limite de temps.", en: "The rest of the app (one-off recovery, injury guidance, base scheduling) stays free, with no time limit.", es: "El resto de la app (recuperación puntual, orientación de lesiones, planificación básica) sigue siendo gratis, sin límite de tiempo.", pt: "O resto do app (recuperação pontual, orientação de lesões, planejamento básico) continua grátis, sem limite de tempo." }),
    history: tr(lang, { fr: "Historique des paiements", en: "Payment history", es: "Historial de pagos", pt: "Histórico de pagamentos" }),
    noHistory: tr(lang, { fr: "Aucun paiement pour l'instant.", en: "No payments yet.", es: "Sin pagos por el momento.", pt: "Nenhum pagamento por enquanto." }),
    demoBadge: tr(lang, { fr: "démo", en: "demo", es: "demo", pt: "demo" }),
  };

  const features = [
    { Icon: InfinityIcon, title: T.f1t, desc: T.f1d },
    { Icon: Flame, title: T.f2t, desc: T.f2d },
    { Icon: Clock, title: T.f3t, desc: T.f3d },
    { Icon: ZapIcon, title: T.f4t, desc: T.f4d },
    { Icon: Stethoscope, title: T.f5t, desc: T.f5d },
    { Icon: Cloud, title: T.f6t, desc: T.f6d, soon: true },
  ];

  const priceLabel = (c) => (c === "yearly" ? `${CYCLE_PRICE.yearly}€/an` : `${CYCLE_PRICE.monthly}€/mois`);

  return (
    <div className="px-5 pt-4 pb-24">
      <div className="flex flex-col items-center mb-6 mt-1">
        <div className="w-16 h-16 rounded-[20px] flex items-center justify-center mb-3" style={{ background: gradPrimary, boxShadow: `0 12px 28px -10px ${C.primary}88` }}><Crown size={28} color="#052821" /></div>
        <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: C.text, ...fontDisplay }}>{T.title}</h1>
        <p className="text-xs mt-1" style={{ color: C.textMuted, ...fontBody }}>{T.subtitle}</p>
      </div>

      {isPro ? (
        <>
          <HeroCard accent={C.primary} className="mb-4 flex flex-col items-center text-center">
            <Crown size={22} style={{ color: C.primary, marginBottom: 6 }} />
            <p className="font-bold text-sm" style={{ color: C.primary, ...fontDisplay }}>{isTrial ? T.trialActive(trialDaysLeft) : T.youArePro}</p>
            <p className="text-[11px] mt-2" style={{ color: C.textMuted, ...fontBody }}>{T.until(fmtDate(renewalDate, lang))}</p>
            {cancelled ? (
              <p className="text-[11px] mt-1 px-3" style={{ color: C.warn, ...fontBody }}>{T.cancelledNote(fmtDate(renewalDate, lang))}</p>
            ) : (
              <p className="text-[11px] mt-1" style={{ color: C.textMuted, ...fontBody }}>{isTrial ? T.firstPayment(fmtDate(renewalDate, lang), priceLabel(cycle)) : T.nextPayment(fmtDate(renewalDate, lang), priceLabel(cycle))}</p>
            )}
          </HeroCard>

          {!cancelled && !confirmingCancel && <Btn full variant="danger" onClick={() => setConfirmingCancel(true)} icon={X}>{T.cancelBtn}</Btn>}
          {confirmingCancel && (
            <Card className="mb-2" style={{ background: C.dangerSoft, border: `1px solid ${C.danger}44` }}>
              <p className="font-bold text-sm mb-1" style={{ color: C.danger, ...fontBody }}>{T.confirmCancelTitle}</p>
              <p className="text-[11px] leading-relaxed mb-3" style={{ color: C.danger, ...fontBody }}>{T.confirmCancelNote(fmtDate(renewalDate, lang))}</p>
              <div className="flex gap-2">
                <Btn small full variant="danger" onClick={() => { cancelSub(); setConfirmingCancel(false); }}>{T.confirmCancelBtn}</Btn>
                <Btn small full variant="ghost" onClick={() => setConfirmingCancel(false)}>{T.keepSub}</Btn>
              </div>
            </Card>
          )}
          {cancelled && <Btn full variant="ghost" onClick={resumeSub} icon={Sparkles}>{T.resumeBtn}</Btn>}

          <div className="mt-6">
            <SectionTitle icon={Clock}>{T.history}</SectionTitle>
            {(!history || history.length === 0) ? (
              <Card><p className="text-xs" style={{ color: C.textFaint, ...fontBody }}>{T.noHistory}</p></Card>
            ) : (
              <GroupedList>
                {[...history].reverse().map((h, i, arr) => (
                  <ListRow key={i} last={i === arr.length - 1}
                    left={<div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: C.primarySoft }}><Crown size={14} style={{ color: C.primary }} /></div>}
                    title={h.label} subtitle={fmtDate(h.date, lang)}
                    right={<span style={{ ...fontMono, color: C.text, fontSize: 13 }}>{h.amount.toFixed(2)}€</span>} />
                ))}
              </GroupedList>
            )}
          </div>
        </>
      ) : (
        <Card className="mb-6" style={{ background: `linear-gradient(155deg, ${C.primary}22, ${C.surface})` }}>
          <div className="mb-4"><SegmentedControl options={[{ value: "monthly", label: T.monthly }, { value: "yearly", label: T.yearly }]} value={pickCycle} onChange={setPickCycle} /></div>
          <Btn full icon={Sparkles} onClick={() => startTrial(pickCycle)}>{T.startTrial}</Btn>
          <p className="text-[11px] text-center mt-3" style={{ color: C.textMuted, ...fontBody }}>{pickCycle === "yearly" ? T.priceNoteYearly : T.priceNoteMonthly}</p>
          <div className="mt-4 pt-4" style={{ borderTop: `1px dashed ${C.border}` }}>
            <p className="text-[10px] leading-relaxed mb-3" style={{ color: C.textFaint, ...fontBody }}>{T.demoNote}</p>
            <Btn full small variant="ghost" onClick={() => activateDemo(pickCycle)}>{T.activateDemo}</Btn>
          </div>
        </Card>
      )}

      <SectionTitle icon={Crown}>{T.included}</SectionTitle>
      <div className="flex flex-col gap-3 mb-5">
        {features.map((f, i) => (
          <Card key={i} className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.primarySoft }}><f.Icon size={17} style={{ color: C.primary }} /></div>
            <div>
              <div className="flex items-center gap-2"><p className="text-sm font-semibold" style={{ color: C.text, ...fontBody }}>{f.title}</p>{f.soon && <Badge color={C.textMuted}>{T.soon}</Badge>}</div>
              <p className="text-[11px] leading-relaxed mt-0.5" style={{ color: C.textMuted, ...fontBody }}>{f.desc}</p>
            </div>
          </Card>
        ))}
      </div>
      <p className="text-[10px] text-center leading-relaxed" style={{ color: C.textFaint, ...fontBody }}>{T.freeStaysFree}</p>
    </div>
  );
}

function ProfileScreen({ profile, userId, accessToken, onSave, onClose, onLogout, onDeleteAccount, onOpenPro }) {
  const { lang } = useLang();
  const { isPro, isTrial, trialDaysLeft } = usePro();
  const [p, setP] = useState(profile);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notifStatus, setNotifStatus] = useState(typeof Notification !== "undefined" ? Notification.permission : "unsupported");
  const [notifLoading, setNotifLoading] = useState(false);
  const toggleNotif = async () => {
    setNotifLoading(true);
    if (notifStatus === "granted") { await unsubscribeFromPush(userId, accessToken); setNotifStatus("default"); }
    else { const r = await subscribeToPush(userId, accessToken); setNotifStatus(r.ok ? "granted" : (typeof Notification !== "undefined" ? Notification.permission : "denied")); }
    setNotifLoading(false);
  };
  const toggleSport = (k) => {
    setP((prev) => {
      const already = prev.sports.includes(k);
      if (already) return { ...prev, sports: prev.sports.filter((x) => x !== k) };
      if (!isPro && prev.sports.length >= 1) { onOpenPro(); return prev; }
      return { ...prev, sports: [...prev.sports, k] };
    });
  };
  const toggleEquip = (e) => setP((prev) => ({ ...prev, equipement: prev.equipement.includes(e) ? prev.equipement.filter((x) => x !== e) : [...prev.equipement, e] }));
  const toggleAllergy = (k) => setP((prev) => ({ ...prev, allergies: (prev.allergies || []).includes(k) ? prev.allergies.filter((x) => x !== k) : [...(prev.allergies || []), k] }));
  const [dislikedInput, setDislikedInput] = useState("");
  const addDisliked = () => {
    const val = dislikedInput.trim();
    if (!val) return;
    setP((prev) => ({ ...prev, dislikedFoods: [...(prev.dislikedFoods || []), val] }));
    setDislikedInput("");
  };
  const removeDisliked = (i) => setP((prev) => ({ ...prev, dislikedFoods: (prev.dislikedFoods || []).filter((_, idx) => idx !== i) }));
  const [newEmail, setNewEmail] = useState("");
  const [emailChangeStatus, setEmailChangeStatus] = useState(""); // "" | "sending" | "sent" | "error"
  const [emailChangeError, setEmailChangeError] = useState("");
  const submitEmailChange = async () => {
    if (!EMAIL_REGEX.test(newEmail)) { setEmailChangeStatus("error"); setEmailChangeError(T.emailInvalid); return; }
    setEmailChangeStatus("sending"); setEmailChangeError("");
    try { await sbUpdateEmail(accessToken, newEmail.toLowerCase().trim()); setEmailChangeStatus("sent"); }
    catch (err) { setEmailChangeStatus("error"); setEmailChangeError(err.message); }
  };
  const [deleteError, setDeleteError] = useState("");
  const confirmDelete = async () => {
    setDeleting(true); setDeleteError("");
    const result = await onDeleteAccount();
    if (result && !result.ok) { setDeleteError(result.error); setDeleting(false); }
  };
  const T = {
    title: tr(lang, { fr: "Mon profil", en: "My profile", es: "Mi perfil", pt: "Meu perfil" }),
    language: tr(lang, { fr: "Langue", en: "Language", es: "Idioma", pt: "Idioma" }),
    notifications: tr(lang, { fr: "Notifications", en: "Notifications", es: "Notificaciones", pt: "Notificações" }),
    notifOn: tr(lang, { fr: "Rappels activés", en: "Reminders on", es: "Recordatorios activados", pt: "Lembretes ativados" }),
    notifOff: tr(lang, { fr: "Activer les rappels", en: "Enable reminders", es: "Activar recordatorios", pt: "Ativar lembretes" }),
    notifBlocked: tr(lang, { fr: "Notifications bloquées — autorise-les dans les réglages de ton navigateur/téléphone pour recevoir tes rappels.", en: "Notifications blocked — allow them in your browser/phone settings to get your reminders.", es: "Notificaciones bloqueadas — actívalas en los ajustes de tu navegador/teléfono para recibir tus recordatorios.", pt: "Notificações bloqueadas — permita nas configurações do navegador/telefone para receber seus lembretes." }),
    notifUnsupported: tr(lang, { fr: "Notifications non disponibles sur cet appareil/navigateur.", en: "Notifications not available on this device/browser.", es: "Notificaciones no disponibles en este dispositivo/navegador.", pt: "Notificações não disponíveis neste dispositivo/navegador." }),
    note: tr(lang, { fr: "Poids, sports et niveau sont pris en compte à chaque nouveau plan généré — mets-les à jour dès qu'ils changent. Ton âge se recalcule automatiquement depuis ta date de naissance.", en: "Weight, sports and level are used every time a new plan is generated — update them as soon as they change. Your age is recalculated automatically from your date of birth.", es: "El peso, los deportes y el nivel se usan en cada nuevo plan generado — actualízalos en cuanto cambien. Tu edad se recalcula automáticamente según tu fecha de nacimiento.", pt: "Peso, esportes e nível são considerados a cada novo plano gerado — atualize-os assim que mudarem. Sua idade é recalculada automaticamente a partir da data de nascimento." }),
    firstNameShown: tr(lang, { fr: "Prénom affiché", en: "Displayed first name", es: "Nombre mostrado", pt: "Nome exibido" }),
    sexe: tr(lang, { fr: "Sexe", en: "Sex", es: "Sexo", pt: "Sexo" }),
    birth: tr(lang, { fr: "Date de naissance", en: "Date of birth", es: "Fecha de nacimiento", pt: "Data de nascimento" }),
    ageToday: (age) => tr(lang, { fr: `→ ${age} ans aujourd'hui.`, en: `→ ${age} years old today.`, es: `→ ${age} años hoy.`, pt: `→ ${age} anos hoje.` }),
    height: tr(lang, { fr: "Taille (cm)", en: "Height (cm)", es: "Altura (cm)", pt: "Altura (cm)" }),
    weight: tr(lang, { fr: "Poids (kg)", en: "Weight (kg)", es: "Peso (kg)", pt: "Peso (kg)" }),
    sports: tr(lang, { fr: "Sports pratiqués", en: "Sports practiced", es: "Deportes practicados", pt: "Esportes praticados" }),
    sportsFreeHint: tr(lang, { fr: "Compte gratuit : 1 sport. Passe à Pro pour en ajouter d'autres.", en: "Free plan: 1 sport. Upgrade to Pro to add more.", es: "Plan gratuito: 1 deporte. Pasa a Pro para añadir más.", pt: "Plano grátis: 1 esporte. Torne-se Pro para adicionar mais." }),
    level: tr(lang, { fr: "Niveau", en: "Level", es: "Nivel", pt: "Nível" }),
    equipment: tr(lang, { fr: "Matériel disponible", en: "Available equipment", es: "Equipo disponible", pt: "Equipamento disponível" }),
    allergiesLabel: tr(lang, { fr: "Allergies alimentaires", en: "Food allergies", es: "Alergias alimentarias", pt: "Alergias alimentares" }),
    dislikedLabel: tr(lang, { fr: "Aliments à éviter", en: "Foods to avoid", es: "Alimentos a evitar", pt: "Alimentos a evitar" }),
    dislikedHint: tr(lang, { fr: "Ces aliments ne seront plus jamais proposés dans tes repas conseillés.", en: "These foods will never be suggested in your recommended meals again.", es: "Estos alimentos ya no se sugerirán en tus comidas recomendadas.", pt: "Esses alimentos não serão mais sugeridos nas suas refeições recomendadas." }),
    dislikedPh: tr(lang, { fr: "ex : brocolis, thon...", en: "e.g. broccoli, tuna...", es: "ej. brócoli, atún...", pt: "ex: brócolis, atum..." }),
    add: tr(lang, { fr: "Ajouter", en: "Add", es: "Añadir", pt: "Adicionar" }),
    emailLabel: tr(lang, { fr: "Adresse email", en: "Email address", es: "Correo electrónico", pt: "Endereço de email" }),
    emailPh: tr(lang, { fr: "nouvelle@adresse.com", en: "new@address.com", es: "nueva@direccion.com", pt: "novo@endereco.com" }),
    emailChangeBtn: tr(lang, { fr: "Changer d'adresse", en: "Change address", es: "Cambiar dirección", pt: "Alterar endereço" }),
    emailSending: tr(lang, { fr: "Envoi...", en: "Sending...", es: "Enviando...", pt: "Enviando..." }),
    emailSent: tr(lang, { fr: "✓ Email envoyé — clique le lien reçu pour confirmer le changement.", en: "✓ Email sent — click the link you received to confirm the change.", es: "✓ Correo enviado — haz clic en el enlace recibido para confirmar el cambio.", pt: "✓ Email enviado — clique no link recebido para confirmar a mudança." }),
    emailInvalid: tr(lang, { fr: "Adresse email invalide.", en: "Invalid email address.", es: "Correo electrónico no válido.", pt: "Email inválido." }),
    logout: tr(lang, { fr: "Se déconnecter", en: "Log out", es: "Cerrar sesión", pt: "Sair" }),
    legalTerms: tr(lang, { fr: "Conditions d'utilisation", en: "Terms of use", es: "Condiciones de uso", pt: "Termos de uso" }),
    legalPrivacy: tr(lang, { fr: "Confidentialité", en: "Privacy", es: "Privacidad", pt: "Privacidade" }),
    deleteAccount: tr(lang, { fr: "Supprimer mon compte", en: "Delete my account", es: "Eliminar mi cuenta", pt: "Excluir minha conta" }),
    confirmDeleteTitle: tr(lang, { fr: "Supprimer définitivement ton compte ?", en: "Permanently delete your account?", es: "¿Eliminar tu cuenta definitivamente?", pt: "Excluir sua conta definitivamente?" }),
    confirmDeleteNote: tr(lang, { fr: "Ton profil, ton historique de séances, ton planning et tes données de blessures seront définitivement supprimés. Cette action est irréversible.", en: "Your profile, session history, schedule and injury data will be permanently deleted. This action cannot be undone.", es: "Tu perfil, historial de sesiones, planificación y datos de lesiones se eliminarán definitivamente. Esta acción es irreversible.", pt: "Seu perfil, histórico de sessões, planejamento e dados de lesões serão excluídos definitivamente. Esta ação é irreversível." }),
    confirmDeleteBtn: tr(lang, { fr: "Oui, tout supprimer", en: "Yes, delete everything", es: "Sí, eliminar todo", pt: "Sim, excluir tudo" }),
    cancelDelete: tr(lang, { fr: "Annuler", en: "Cancel", es: "Cancelar", pt: "Cancelar" }),
    deleting: tr(lang, { fr: "Suppression en cours…", en: "Deleting…", es: "Eliminando…", pt: "Excluindo…" }),
    proCardTitle: tr(lang, { fr: "REGEN Pro", en: "REGEN Pro", es: "REGEN Pro", pt: "REGEN Pro" }),
    proCardFree: tr(lang, { fr: "Débloque le multi-sport, la nutrition avancée et plus →", en: "Unlock multi-sport, advanced nutrition and more →", es: "Desbloquea multideporte, nutrición avanzada y más →", pt: "Desbloqueie multi-esporte, nutrição avançada e mais →" }),
  };
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: C.mesh, backgroundColor: C.bg }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ background: "rgba(10,20,18,0.55)", backdropFilter: "blur(24px)", borderBottom: `1px solid ${C.glassBorder}` }}><h2 className="font-bold text-lg tracking-tight" style={{ color: C.text, ...fontDisplay }}>{T.title}</h2><button onClick={onClose}><X size={20} style={{ color: C.textMuted }} /></button></div>
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <button onClick={onOpenPro} className="w-full text-left mb-4 rounded-2xl p-3.5 flex items-center gap-3" style={{ background: gradPrimary }}>
          <Crown size={20} color="#052821" />
          <div className="flex-1">
            <p className="text-sm font-bold" style={{ color: "#052821", ...fontDisplay }}>{T.proCardTitle}{isPro && <span className="ml-1.5">{isTrial ? `· ${trialDaysLeft}j` : "· actif"}</span>}</p>
            {!isPro && <p className="text-[11px]" style={{ color: "#052821", ...fontBody }}>{T.proCardFree}</p>}
          </div>
          <ChevronRightIcon size={16} color="#052821" />
        </button>
        <Field label={T.language}><LanguageSwitcher /></Field>
        <Field label={T.notifications}>
          {notifStatus === "unsupported" ? (
            <p className="text-[11px]" style={{ color: C.textFaint, ...fontBody }}>{T.notifUnsupported}</p>
          ) : notifStatus === "denied" ? (
            <p className="text-[11px]" style={{ color: C.textFaint, ...fontBody }}>{T.notifBlocked}</p>
          ) : (
            <button onClick={toggleNotif} disabled={notifLoading} className="w-full flex items-center gap-3 rounded-2xl px-3 py-2.5" style={{ background: notifStatus === "granted" ? C.primarySoft : C.surface, border: `1px solid ${notifStatus === "granted" ? C.primary : C.borderSoft}66` }}>
              <Bell size={16} style={{ color: notifStatus === "granted" ? C.primary : C.textMuted }} />
              <span className="text-xs flex-1 text-left" style={{ color: C.text, ...fontBody }}>{notifStatus === "granted" ? T.notifOn : T.notifOff}</span>
              <div className="w-10 h-6 rounded-full relative" style={{ background: notifStatus === "granted" ? C.primary : C.border }}>
                <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: notifStatus === "granted" ? 18 : 2 }} />
              </div>
            </button>
          )}
        </Field>
        <div className="mb-4 px-3 py-2.5 rounded-2xl" style={{ background: `linear-gradient(155deg, ${C.primary}26, ${C.primaryAlt}12)`, border: `1px solid ${C.primary}33`, backdropFilter: "blur(14px)" }}>
          <p className="text-[11px] leading-relaxed" style={{ color: C.primary, ...fontBody }}>{T.note}</p>
        </div>
        <Field label={T.firstNameShown}><TextInput value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></Field>
        <Field label={T.sexe}><SegmentedControl options={SEXES.map((s) => ({ value: s.key, label: tr(lang, s) }))} value={p.sexe} onChange={(v) => setP({ ...p, sexe: v })} /></Field>
        <Field label={T.birth}><TextInput type="date" value={p.dateNaissance} onChange={(e) => setP({ ...p, dateNaissance: e.target.value })} />{p.dateNaissance && <p className="text-[11px] mt-1.5" style={{ color: C.textFaint, ...fontBody }}>{T.ageToday(computeAge(p.dateNaissance))}</p>}</Field>
        <Field label={T.height}><TextInput type="number" value={p.taille} onChange={(e) => setP({ ...p, taille: e.target.value })} /></Field>
        <Field label={T.weight}><TextInput type="number" value={p.poids} onChange={(e) => setP({ ...p, poids: e.target.value })} /></Field>
        <Field label={<span>{T.sports}{!isPro && <span className="ml-1.5"><ProBadge /></span>}</span>}>
          <SportGrid selected={p.sports} onToggle={toggleSport} />
          {!isPro && <p className="text-[10px] mt-2" style={{ color: C.textFaint, ...fontBody }}>{T.sportsFreeHint}</p>}
        </Field>
        <Field label={T.level}><div className="flex flex-wrap gap-2">{NIVEAUX.map((n) => <Pill key={n.key} active={p.niveau === n.key} onClick={() => setP({ ...p, niveau: n.key })}>{tr(lang, n)}</Pill>)}</div></Field>
        <Field label={T.equipment}>
          <div className="flex flex-col gap-2">{EQUIPEMENTS.map((e) => (<button key={e.key} onClick={() => toggleEquip(e.key)} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left" style={{ background: p.equipement.includes(e.key) ? C.primarySoft : C.surface, border: `1px solid ${p.equipement.includes(e.key) ? C.primary : C.borderSoft}66` }}><div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ background: p.equipement.includes(e.key) ? C.primary : "transparent", border: `1px solid ${p.equipement.includes(e.key) ? C.primary : C.border}` }}>{p.equipement.includes(e.key) && <Check size={11} color="#052821" />}</div><span className="text-xs" style={{ color: C.text, ...fontBody }}>{tr(lang, e)}</span></button>))}</div>
        </Field>
        <Field label={T.emailLabel}>
          <div className="flex gap-2">
            <div className="flex-1"><TextInput type="email" value={newEmail} onChange={(e) => { setNewEmail(e.target.value); setEmailChangeStatus(""); }} placeholder={T.emailPh} autoComplete="email" /></div>
            <Btn small onClick={submitEmailChange} disabled={emailChangeStatus === "sending" || !newEmail}>{emailChangeStatus === "sending" ? T.emailSending : T.emailChangeBtn}</Btn>
          </div>
          {emailChangeStatus === "sent" && <p className="text-[11px] mt-2" style={{ color: C.primary, ...fontBody }}>{T.emailSent}</p>}
          {emailChangeStatus === "error" && <p className="text-[11px] mt-2" style={{ color: C.danger, ...fontBody }}>{emailChangeError}</p>}
        </Field>
        <Field label={T.allergiesLabel}>
          <div className="flex flex-wrap gap-2">{ALLERGENS.map((a) => (<Pill key={a.key} active={(p.allergies || []).includes(a.key)} onClick={() => toggleAllergy(a.key)}>{tr(lang, a)}</Pill>))}</div>
        </Field>
        <Field label={T.dislikedLabel}>
          <p className="text-[11px] mb-2" style={{ color: C.textFaint, ...fontBody }}>{T.dislikedHint}</p>
          <div className="flex gap-2 mb-2">
            <div className="flex-1"><TextInput value={dislikedInput} onChange={(e) => setDislikedInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDisliked(); } }} placeholder={T.dislikedPh} /></div>
            <Btn small onClick={addDisliked}>{T.add}</Btn>
          </div>
          {(p.dislikedFoods || []).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {(p.dislikedFoods || []).map((food, i) => (
                <div key={i} className="flex items-center gap-1.5 rounded-full pl-3 pr-1.5 py-1" style={{ background: C.surface, border: `1px solid ${C.borderSoft}66` }}>
                  <span className="text-xs" style={{ color: C.text, ...fontBody }}>{food}</span>
                  <button onClick={() => removeDisliked(i)} className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: C.glassSoft }}><X size={10} style={{ color: C.textMuted }} /></button>
                </div>
              ))}
            </div>
          )}
        </Field>
      </div>
      <div className="px-5 pt-3 shrink-0" style={{ background: "rgba(10,20,18,0.72)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", borderTop: `1px solid ${C.glassBorder}`, paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
        <Btn full onClick={() => onSave(p)} disabled={p.sports.length === 0} icon={Check}>{T.save}</Btn>
        <div className="mt-2"><Btn full variant="danger" onClick={onLogout} icon={LogOut}>{T.logout}</Btn></div>
        <p className="text-[10px] text-center mt-3" style={{ color: C.textFaint, ...fontBody }}>
          <a href="/conditions.html" target="_blank" rel="noopener noreferrer" style={{ color: C.textMuted, textDecoration: "underline" }}>{T.legalTerms}</a>
          {" · "}
          <a href="/confidentialite.html" target="_blank" rel="noopener noreferrer" style={{ color: C.textMuted, textDecoration: "underline" }}>{T.legalPrivacy}</a>
        </p>
        {!confirmingDelete ? (
          <button onClick={() => setConfirmingDelete(true)} className="w-full text-center mt-3 pb-1 text-[11px]" style={{ color: C.textFaint, ...fontBody }}>{T.deleteAccount}</button>
        ) : (
          <div className="mt-3 mb-1 p-3 rounded-2xl" style={{ background: C.dangerSoft, border: `1px solid ${C.danger}44` }}>
            <p className="font-bold text-xs mb-1" style={{ color: C.danger, ...fontBody }}>{T.confirmDeleteTitle}</p>
            <p className="text-[11px] leading-relaxed mb-3" style={{ color: C.danger, ...fontBody }}>{T.confirmDeleteNote}</p>
            {deleteError && <p className="text-[11px] leading-relaxed mb-3 font-semibold" style={{ color: C.danger, ...fontBody }}>⚠️ {deleteError}</p>}
            <div className="flex gap-2">
              <Btn small full variant="danger" onClick={confirmDelete} disabled={deleting}>{deleting ? T.deleting : T.confirmDeleteBtn}</Btn>
              <Btn small full variant="ghost" onClick={() => setConfirmingDelete(false)} disabled={deleting}>{T.cancelDelete}</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   ROOT APP
   ============================================================ */
export default function App() {
  const [booting, setBooting] = useState(true);
  const [authUser, setAuthUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [userData, setUserData] = useState(null);
  const [screen, setScreen] = useState("auth");
  const [tab, setTab] = useState("home");
  const [showProfile, setShowProfile] = useState(false);
  const [lang, setLangState] = useState("fr");
  const [recoveryToken, setRecoveryToken] = useState(null);

  useEffect(() => {
    // Lien "mot de passe oublié" cliqué depuis l'email : Supabase redirige ici
    // avec un token dans le hash de l'URL, ce qui prime sur le flux normal.
    if (typeof window !== "undefined" && window.location.hash.includes("type=recovery")) {
      const params = new URLSearchParams(window.location.hash.replace("#", "?"));
      const t = params.get("access_token");
      if (t) setRecoveryToken(t);
    }
    (async () => {
      const savedLang = await storageGet("app:lang");
      if (savedLang && LANGS.includes(savedLang)) setLangState(savedLang);
      const session = await storageGet("auth:session");
      if (session?.access_token) {
        try {
          let token = session.access_token;
          let res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } });
          // Session expirée : si "Rester connecté" était coché, on la renouvelle
          // silencieusement avec le refresh_token au lieu de déconnecter.
          if (!res.ok && session.persistent && session.refresh_token) {
            const refreshRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, { method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY }, body: JSON.stringify({ refresh_token: session.refresh_token }) });
            if (refreshRes.ok) {
              const refreshed = await refreshRes.json();
              token = refreshed.access_token;
              await storageSet("auth:session", { access_token: token, refresh_token: refreshed.refresh_token, user_id: session.user_id, persistent: true });
              res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } });
            }
          }
          if (res.ok) {
            const user = await res.json();
            const data = await loadUserData(user.id, token, user.user_metadata);
            setAuthUser(user); setAccessToken(token); setUserData(data);
            setScreen(data.profile ? "main" : "onboarding");
          } else {
            await storageDelete("auth:session");
          }
        } catch { await storageDelete("auth:session"); }
      }
      setBooting(false);
    })();
  }, []);

  const setLang = (l) => { setLangState(l); storageSet("app:lang", l); };
  const handleAuth = (user, token, data, refreshToken, staySignedIn) => {
    setAuthUser(user); setAccessToken(token); setUserData(data);
    storageSet("auth:session", { access_token: token, refresh_token: refreshToken || null, user_id: user.id, persistent: !!staySignedIn });
    setScreen(data.profile ? "main" : "onboarding");
  };

  // ---- REGEN Pro : abonnement, essai gratuit, renouvellement auto simulé ----
  const proStatus = computeProStatus(userData?.pro);
  const saveSubscription = async (pro) => { await sbUpsert("subscriptions", { user_id: authUser.id, status: pro.status, cycle: pro.cycle, trial_start: pro.trialStart, subscribed_at: pro.subscribedAt, next_billing_date: pro.nextBillingDate, cancelled: pro.cancelled, history: pro.history || [] }, accessToken); };

  // Règle en continu les renouvellements/expirations "automatiques" dès que
  // les données utilisateur changent (et donc aussi à l'ouverture de l'app).
  useEffect(() => {
    if (!userData?.pro || !authUser) return;
    const { pro: settled, changed } = resolvePro(userData.pro);
    if (changed) { setUserData((prev) => ({ ...prev, pro: settled })); saveSubscription(settled); }
  }, [userData?.pro]);

  const notifyAccountEmail = async (payload) => {
    try { await fetch(`${SUPABASE_URL}/functions/v1/send-account-email`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" }, body: JSON.stringify(payload) }); } catch {}
  };
  const handleStartTrial = async (cycle) => { const pro = { ...defaultPro(), status: "trial", trialStart: new Date().toISOString(), cycle: cycle || "monthly" }; setUserData((prev) => ({ ...prev, pro })); await saveSubscription(pro); notifyAccountEmail({ type: "purchase", cycle: cycle || "monthly", trial: true }); };
  const handleActivateDemo = async (cycle) => {
    const now = new Date();
    const pro = { status: "pro", trialStart: null, cycle: cycle || "monthly", subscribedAt: now.toISOString(), nextBillingDate: new Date(now.getTime() + CYCLE_DAYS[cycle || "monthly"] * 86400000).toISOString(), cancelled: false, history: [{ date: now.toISOString(), amount: CYCLE_PRICE[cycle || "monthly"], label: "REGEN Pro (démo)" }] };
    setUserData((prev) => ({ ...prev, pro })); await saveSubscription(pro);
    notifyAccountEmail({ type: "purchase", cycle: cycle || "monthly", trial: false });
  };
  const handleCancelSub = async () => { const pro = { ...(userData.pro || defaultPro()), cancelled: true }; setUserData((prev) => ({ ...prev, pro })); await saveSubscription(pro); notifyAccountEmail({ type: "cancel", nextBillingDate: pro.nextBillingDate }); };
  const handleResumeSub = async () => { const pro = { ...(userData.pro || defaultPro()), cancelled: false }; setUserData((prev) => ({ ...prev, pro })); await saveSubscription(pro); };
  const handleSetProDemo = async (status) => { if (status === "free") { const pro = defaultPro(); setUserData((prev) => ({ ...prev, pro })); await saveSubscription(pro); } };
  const openPro = () => setTab("pro");

  const saveProfileRow = async (profile) => sbUpsert("profiles", { id: authUser.id, nom: userData.nom, prenom: userData.prenom, username: userData.username, sexe: profile.sexe, date_naissance: profile.dateNaissance || null, taille: Number(profile.taille) || null, poids: Number(profile.poids) || null, sports: profile.sports, niveau: profile.niveau, equipement: profile.equipement, allergies: profile.allergies || [], disliked_foods: profile.dislikedFoods || [] }, accessToken);
  const handleOnboardingComplete = async (profileData) => {
    const sports = proStatus.isPro ? profileData.sports : profileData.sports.slice(0, FREE_SPORTS_MAX);
    const profile = { ...profileData, sports, name: userData.prenom };
    await saveProfileRow(profile);
    setUserData((prev) => ({ ...prev, profile })); setScreen("main");
  };
  const handleGeneratePlan = async (plan) => {
    const row = await sbInsert("sessions_log", { user_id: authUser.id, data: plan }, accessToken);
    const saved = row ? { ...plan, id: row.id } : plan;
    setUserData((prev) => ({ ...prev, sessionsLog: [...(prev.sessionsLog || []), saved] }));
  };
  const handleSaveProfile = async (p) => {
    const sports = proStatus.isPro ? p.sports : p.sports.slice(0, FREE_SPORTS_MAX);
    const profile = { ...p, sports };
    await saveProfileRow(profile);
    setUserData((prev) => ({ ...prev, profile })); setShowProfile(false);
  };

  const ensurePlanner = () => userData.plannerConfig || { weeklyDays: emptyWeekly(), exceptions: {} };
  const savePlanner = async (cfg) => { await sbUpsert("planner_config", { user_id: authUser.id, weekly_days: cfg.weeklyDays, exceptions: cfg.exceptions }, accessToken); };
  // Toute liste d'entrées "sport" est bridée à 1/jour en gratuit, quel que
  // soit ce que l'interface a tenté d'envoyer — c'est la vraie limite,
  // appliquée ici et pas seulement dans les boutons.
  const clampSportEntries = (entries) => proStatus.isPro ? entries : entries.filter((e) => SPORT_TYPES.includes(e.type)).slice(0, FREE_SESSIONS_PER_DAY).concat(entries.filter((e) => !SPORT_TYPES.includes(e.type)));

  const handleSetWeekly = async (dow, entries) => {
    const cfg = ensurePlanner(); const clamped = clampSportEntries(entries);
    if (!proStatus.isPro && clamped.length < entries.length) openPro();
    const newCfg = { ...cfg, weeklyDays: cfg.weeklyDays.map((d, i) => i === dow ? clamped : d) };
    setUserData((prev) => ({ ...prev, plannerConfig: newCfg })); await savePlanner(newCfg);
  };
  const handleSaveException = async (date, entries) => {
    const cfg = ensurePlanner();
    const clamped = clampSportEntries(entries);
    if (!proStatus.isPro) {
      if (clamped.filter((e) => SPORT_TYPES.includes(e.type)).length < entries.filter((e) => SPORT_TYPES.includes(e.type)).length) { openPro(); return; }
      const monthKey = new Date().toISOString().slice(0, 7);
      const otherMonths = { ...cfg.exceptions }; delete otherMonths[date];
      const usedElsewhere = countMonthlyExtras(otherMonths);
      const newCount = clamped.filter((e) => e.type !== "blessure").length;
      if (date.startsWith(monthKey) && usedElsewhere + newCount > FREE_EXCEPTIONS_PER_MONTH) { openPro(); return; }
    }
    const newCfg = { ...cfg, exceptions: { ...cfg.exceptions, [date]: clamped } };
    setUserData((prev) => ({ ...prev, plannerConfig: newCfg })); await savePlanner(newCfg);
  };
  const handleClearException = async (date) => {
    const cfg = ensurePlanner(); const exceptions = { ...cfg.exceptions }; delete exceptions[date];
    const newCfg = { ...cfg, exceptions };
    setUserData((prev) => ({ ...prev, plannerConfig: newCfg })); await savePlanner(newCfg);
  };
  const handleAddEntry = async (date, entry) => {
    const cfg = ensurePlanner();
    const { entries } = getDayEntries(cfg.weeklyDays, cfg.exceptions, date);
    if (!proStatus.isPro) {
      if (SPORT_TYPES.includes(entry.type) && entries.filter((e) => SPORT_TYPES.includes(e.type)).length >= FREE_SESSIONS_PER_DAY) { openPro(); return; }
      if (entry.type !== "blessure") {
        const monthKey = new Date().toISOString().slice(0, 7);
        if (date.startsWith(monthKey) && countMonthlyExtras(cfg.exceptions) >= FREE_EXCEPTIONS_PER_MONTH) { openPro(); return; }
      }
    }
    const newCfg = { ...cfg, exceptions: { ...cfg.exceptions, [date]: [...entries, entry] } };
    setUserData((prev) => ({ ...prev, plannerConfig: newCfg })); await savePlanner(newCfg);
  };
  const handleRemoveEntry = async (date, entryId) => {
    const cfg = ensurePlanner();
    const { entries } = getDayEntries(cfg.weeklyDays, cfg.exceptions, date);
    const newCfg = { ...cfg, exceptions: { ...cfg.exceptions, [date]: entries.filter((e) => e.id !== entryId) } };
    setUserData((prev) => ({ ...prev, plannerConfig: newCfg })); await savePlanner(newCfg);
  };

  const handleAddInjury = async (injury) => {
    const { id: _tmp, ...injuryData } = injury;
    const row = await sbInsert("injuries", { user_id: authUser.id, data: injuryData }, accessToken);
    const saved = row ? { ...injuryData, id: row.id } : injury;
    const cfg = ensurePlanner();
    const newCfg = { ...cfg, exceptions: addBlessureRange(cfg.exceptions, saved, lang) };
    setUserData((prev) => ({ ...prev, injuries: [...(prev.injuries || []), saved], plannerConfig: newCfg }));
    await savePlanner(newCfg);
  };
  const handleUpdateInjury = async (id, patch) => {
    const injuries = (userData.injuries || []).map((i) => i.id === id ? { ...i, ...patch } : i);
    const updated = injuries.find((i) => i.id === id);
    const { id: _rowId, ...updatedData } = updated;
    await sbUpdate("injuries", `id=eq.${id}`, { data: updatedData }, accessToken);
    const cfg = ensurePlanner();
    const newCfg = patch.dateRetour ? { ...cfg, exceptions: addBlessureRange(cfg.exceptions, updated, lang) } : cfg;
    setUserData((prev) => ({ ...prev, injuries, plannerConfig: newCfg }));
    if (patch.dateRetour) await savePlanner(newCfg);
  };
  const handleDeleteInjury = async (id) => {
    await sbDelete("injuries", `id=eq.${id}`, accessToken);
    const cfg = ensurePlanner();
    const newCfg = { ...cfg, exceptions: removeInjuryExceptions(cfg.exceptions, id) };
    setUserData((prev) => ({ ...prev, injuries: (prev.injuries || []).filter((i) => i.id !== id), plannerConfig: newCfg }));
    await savePlanner(newCfg);
  };

  const handleLogout = async () => {
    await sbSignOut(accessToken);
    await storageDelete("auth:session");
    setAuthUser(null); setAccessToken(null); setUserData(null); setScreen("auth"); setTab("home"); setShowProfile(false);
  };

  // Suppression complète et réelle du compte — appelle une fonction serveur
  // qui efface les données ET la ligne d'authentification elle-même.
  const handleDeleteAccount = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, apikey: SUPABASE_ANON_KEY } });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return { ok: false, error: `Erreur ${res.status} : ${body || "échec de la suppression."}` };
      }
    } catch (err) {
      return { ok: false, error: String(err?.message || err) };
    }
    await sbSignOut(accessToken);
    await storageDelete("auth:session");
    setAuthUser(null); setAccessToken(null); setUserData(null); setScreen("auth"); setTab("home"); setShowProfile(false);
    return { ok: true };
  };

  const lastPlan = userData?.sessionsLog?.length ? userData.sessionsLog[userData.sessionsLog.length - 1] : null;
  const NAV_KEYS = {
    home: { fr: "Accueil", en: "Home", es: "Inicio", pt: "Início" },
    recup: { fr: "Récup ponct.", en: "Recovery", es: "Recup.", pt: "Recup." },
    nutrition: { fr: "Nutrition", en: "Nutrition", es: "Nutrición", pt: "Nutrição" },
    blessures: { fr: "Blessures", en: "Injuries", es: "Lesiones", pt: "Lesões" },
    planning: { fr: "Planning", en: "Schedule", es: "Plan", pt: "Plano" },
    pro: { fr: "Pro", en: "Pro", es: "Pro", pt: "Pro" },
  };
  const NAV = [["home", Home], ["recup", Activity], ["nutrition", Utensils], ["blessures", HeartPulse], ["planning", CalendarDays], ["pro", Crown]];

  return (
    <ProContext.Provider value={{ ...proStatus, startTrial: handleStartTrial, activateDemo: handleActivateDemo, setProDemo: handleSetProDemo, cancelSub: handleCancelSub, resumeSub: handleResumeSub, openPro }}>
      <LangContext.Provider value={{ lang, setLang }}>
        <div className="w-full h-dvh flex items-center justify-center" style={{ background: "#000" }}>
          <style>{FONTS}</style>
          <div className="relative w-full max-w-[480px] h-dvh overflow-hidden flex flex-col" style={{ background: C.mesh, backgroundColor: C.bg, paddingTop: "env(safe-area-inset-top)", ...fontBody }}>
            {booting && <div className="flex-1 flex items-center justify-center"><img src={APP_LOGO} alt="REGEN" className="w-14 h-14 rounded-2xl object-cover animate-pulse" /></div>}
            {!booting && recoveryToken && <ResetPasswordScreen token={recoveryToken} onDone={() => { setRecoveryToken(null); window.history.replaceState(null, "", window.location.pathname); }} />}
            {!booting && !recoveryToken && screen === "auth" && <AuthScreen onAuth={handleAuth} />}
            {!booting && !recoveryToken && screen === "onboarding" && <Onboarding onComplete={handleOnboardingComplete} />}
            {!booting && !recoveryToken && screen === "main" && userData?.profile && (
              <>
                <div className="flex items-center justify-between px-5 py-3.5 shrink-0" style={{ background: "rgba(10,20,18,0.55)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", borderBottom: `1px solid ${C.glassBorder}` }}>
                  <div className="flex items-center gap-2"><img src={APP_LOGO} alt="REGEN" className="w-6 h-6 rounded-lg object-cover" /><span className="font-bold text-sm tracking-tight" style={{ color: C.text, ...fontDisplay }}>REGEN</span>{proStatus.isPro && <Crown size={13} style={{ color: C.primary }} />}</div>
                  <button onClick={() => setShowProfile(true)} className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs" style={{ background: gradPrimary, color: "#052821", ...fontMono }}>{(userData.prenom || userData.username || "U")[0].toUpperCase()}</button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {tab === "home" && <HomeTab profile={userData.profile} sessionsLog={userData.sessionsLog || []} injuries={userData.injuries || []} plannerConfig={userData.plannerConfig} lastPlan={lastPlan} goTo={setTab} onSaveException={handleSaveException} onClearException={handleClearException} onAddEntry={handleAddEntry} onRemoveEntry={handleRemoveEntry} />}
                  {tab === "recup" && <RecupTab profile={userData.profile} onGenerate={handleGeneratePlan} />}
                  {tab === "nutrition" && <NutritionTab lastPlan={lastPlan} />}
                  {tab === "blessures" && <BlessuresTab injuries={userData.injuries || []} onAddInjury={handleAddInjury} onUpdateInjury={handleUpdateInjury} onDeleteInjury={handleDeleteInjury} onAddRdv={handleAddEntry} />}
                  {tab === "planning" && <PlanningTab profile={userData.profile} plannerConfig={userData.plannerConfig} onSetWeekly={handleSetWeekly} onSaveException={handleSaveException} onClearException={handleClearException} onAddEntry={handleAddEntry} onRemoveEntry={handleRemoveEntry} goTo={setTab} />}
                  {tab === "pro" && <ProTab />}
                </div>
                <div className="fixed bottom-0 left-1/2 w-full max-w-[480px] flex flex-col" style={{ pointerEvents: "none", transform: "translateX(-50%)", zIndex: 40 }}>
                  <div style={{ height: 28, background: `linear-gradient(to bottom, transparent, ${C.bg}CC)` }} />
                  <div className="flex justify-around items-center py-2.5" style={{ pointerEvents: "auto", background: "rgba(10,20,18,0.72)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", borderTop: `1px solid ${C.glassBorder}`, paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}>
                    {NAV.map(([key, Icon]) => (<button key={key} onClick={() => setTab(key)} className="flex flex-col items-center gap-0.5 px-2"><Icon size={19} style={{ color: tab === key ? C.primary : C.textFaint }} /><span className="text-[9px] font-semibold text-center" style={{ color: tab === key ? C.primary : C.textFaint, ...fontBody }}>{tr(lang, NAV_KEYS[key])}</span></button>))}
                  </div>
                </div>
                {showProfile && <ProfileScreen profile={userData.profile} userId={authUser.id} accessToken={accessToken} onSave={handleSaveProfile} onClose={() => setShowProfile(false)} onLogout={handleLogout} onDeleteAccount={handleDeleteAccount} onOpenPro={() => { setShowProfile(false); setTab("pro"); }} />}
              </>
            )}
          </div>
        </div>
      </LangContext.Provider>
    </ProContext.Provider>
  );
}
