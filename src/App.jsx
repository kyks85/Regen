import React, { useState, useEffect, useMemo, useContext, createContext, useRef } from "react";
import {
  Activity, Home, Utensils, HeartPulse, CalendarDays, User, LogOut,
  ChevronLeft, ChevronRight, Droplet, Moon, Snowflake, Flame, ShoppingBag,
  AlertTriangle, Check, X, Plus, Trash2, Zap, Eye, EyeOff,
  Sparkles, Clock, TrendingUp, ChevronDown, Pencil, Flag, Coffee, Bell, Leaf, Stethoscope, ChevronRight as ChevronRightIcon, Globe, Lock, Crown, Infinity as InfinityIcon, Cloud, Zap as ZapIcon, HelpCircle
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
// Date du jour dans le fuseau horaire de l'utilisateur (YYYY-MM-DD) — et non en UTC,
// sinon entre minuit et 2h du matin l'app croirait être encore la veille.
function isoLocal(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

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
  const monthKey = isoLocal().slice(0, 7);
  let count = 0;
  Object.entries(exceptions || {}).forEach(([date, ents]) => { if (date.startsWith(monthKey)) (ents || []).forEach((e) => { if (e.type !== "blessure") count++; }); });
  return count;
}
// METTRE false AVANT LA PUBLICATION : masque le bouton « Activer Pro (démo) » qui contourne le paiement.
const ENABLE_DEMO_PRO = true;
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
        <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: gradPrimary, color: "#052821" }}>{tr(lang, { fr: "Débloquer avec Pro", en: "Unlock with Pro", es: "Desbloquear con Pro", pt: "Desbloquear com Pro" })}</span>
      </button>
    </div>
  );
}
function ProBadge() {
  const { lang } = useLang();
  return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: gradPrimary, color: "#052821" }}><Crown size={9} /> PRO</span>;
}



/* ============================================================
   DESIGN TOKENS
   ============================================================ */
const C = {
  bg: "#0A1613",
  mesh: "radial-gradient(ellipse 900px 650px at 8% -8%, rgba(73,227,196,0.20), transparent 58%), radial-gradient(ellipse 750px 750px at 108% 6%, rgba(124,109,255,0.17), transparent 55%), radial-gradient(ellipse 900px 550px at 45% 118%, rgba(255,111,165,0.12), transparent 55%), #070E0D",
  glass: "rgba(30,62,56,0.55)", glassStrong: "rgba(30,62,56,0.72)", glassSoft: "rgba(255,255,255,0.045)",
  glassBorder: "rgba(255,255,255,0.13)", glassHighlight: "rgba(255,255,255,0.07)",
  bgElevated: "rgba(255,255,255,0.045)", surface: "rgba(30,62,56,0.62)", surfaceAlt: "rgba(34,70,60,0.66)",
  border: "#2A5648", borderSoft: "#214439",
  primary: "#49E3C4", primaryAlt: "#3DA9FF", primaryDim: "#2E8C77", primarySoft: "rgba(73,227,196,0.16)",
  warn: "#FF9366", warnSoft: "rgba(255,147,102,0.16)",
  danger: "#FF6161", dangerSoft: "rgba(255,97,97,0.14)",
  scoreMid: "#F2C14E", scoreHigh: "#FF8A66",
  loisir: "#B98CFF", loisirSoft: "rgba(185,140,255,0.16)",
  reposActif: "#3D8A78", reposActifSoft: "rgba(61,138,120,0.22)",
  blessure: "#E27FA0", blessureSoft: "rgba(226,127,160,0.16)",
  rdv: "#6BA8FF", rdvSoft: "rgba(107,168,255,0.16)",
  text: "#EAF4F0", textMuted: "#8FAAA2", textFaint: "#7D9A91",
};
const gradPrimary = `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryAlt} 100%)`;
const APP_LOGO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAIAAABt+uBvAAApC0lEQVR4nHV9ebxlVXXmt/Y+507vvqleUQwFVUBBCQEMMggYpUCMCggkDhGNaEcBE8jQMf4wBO02xpB2TBuluyNiSKIoUcHEASWiIoiAokAMs6CRogqq3njHc87ee/Ufezz3lVfgnXuGPXzrW+Pe50pExMwAAEgpp6ZnOtMz7e50o9UWUoKISLjL7kNE8Qvbh5kZTKDkMhHBMBPAABgkCLYvtncyCPYRtg0AJAT5ZolAICKyV5mZfNMMMBsCAX7wyZBgRwTbx8QVdueYYRtjA2ajlSrL0aA/6q0N+r2qLMNUCYAgml3YOLtxv2anCxJFVVVVVZWl1pqNMR4++AMiYnD9nAcPZM85XACiyXvsyXTk9euubSKKrbi/fgDhWYcB2ac43pC0a/tinrzqZElCkJBSSpllWZ7lgmDKor+6vLx3j6oqOuCQrTMb94PIhqNRMR5VVcUMCuOzowmSC1MhAMR1hGrUSqfLIALb5pzomJJpOhJQ/ThIP8Hb8ihFmhIcgiq4LwHoCeiTmfgn2BhjnxRSNBvNztSUJAxXV+jQ55846PfLsiBLcBLh8TA3P/ZU1JPkdZjFc7UB7/uTqIzHDvVmw3xs9w4KrnUUuqUwXwIMu/sTtkYksU4Lw1gJYDaGOcvyztQUzR18KJGwQ0302X31h1Gijsj1XjmlfRhzkI57xN1fUxAk1iAVeGpZuP4f9ygBtYFQndEcUYhX1426dujnGyVtjBFCSCcd+4lPsBtpYFPaLMNbZ0dbdiIOA0y6B1Gd6OwMrW8sPuabpWA7wJFBcb6cosUAe8qQfShB0tryOJgAEnntoAg6+VkywBBCCOc+Ymceo2iRUfs4baurkB1cnEoYG1lbxhPP121vAA5gIicGj3h6mZkmqVRDaqJJCtZznR9A4kcCude5DmZ4F85xPkQB93W08U27e37VyPZ1zsuB44l92PTgoyfgsZ2ms633RtYPeHImc/QKWB+QnYAXdt1WUtpERo7qgcU1FxyMTnBp7KcWR8K1JqMhYx/ThLFxNO7RojLHLhlMTByBrFGPI6ZR6awjqyt26tqCdQqIOcWNVi40xiEqJGeyOAMAsgri58MxnImPT2hGPboJh8bfWwcttYn2BuLUd7Adgxskh/kEPbYTpfVNRT1P5WpSw08p4cJxXXgeslrYyQwg4xjsBvlQaCMMrt6DBwHxrkANMAxAThoIXVF6Z8ol68fqEbFvyfsGBkAcz9aobNFzUNQHXcMEjpnu8brICV4w7DsEAIhoQRNLNRl1OrgoAp6ik1pqgL2H8Trirpv0Tj+MxI8lH3Z2IUja3ez8bGpqEotFjtexxQSoAOKk3UnEH71aYqmzOhI1sxnVhOoniGunYjKHCY4S1b3OPq1ycrwPr+D8hY1A9hmrB5xCkJ1MOhAkpH+BZbWmKDmwHTn5iHo3MRhKBj+prknvMXayeaC/J+gj1318JFQUU82VR/n7eCNlc/3OGAoETY78qk8hEXSCIdf+SfMUBB+XpQARKAbhkeGJVBMj5Yfrr5LX7trZOFBOw2lPNWfrmW3WPglZkn8i3OAMGruHiSjJu6yPiRUKWsfKiAHVhxj8EiWGg7MwVpdORIudTD1QiSNkxkEWvAVq6CRo2NYj4M5ScKwJAGwSzvs0hWuYezjDRCJvIrI0eSY0iOB4yfnw8HUfsgwPi5qNnQiqap2E8D8qwoSDq13yTLdMYzAJiEyKLLP3CCk5fTK1pskA7eOUSSYYZtsCBNmwJFE0eC9ttTNlCzn1n7BQvnsrrSgsrv1JbFAsXoEnMI2s8rTi6FWcOJOCS7DU9ikhSGaZYfT7/bWlFRul9Nb6AfH1n0A3IpCg/lpPVUoI2Vvt9VbXlDYil0KIwNGYIHFw4wkAoVXy9t6ng1Gm+5IyUhtEwaauN3HsAi9jxUDJeQ/XREXE/hGSIOR4NFZFOTc/d9pvnHLKjpOPPe24mUb3ps9/+bPXfr7RyGFMomleqQJwQo7H47PO3vHmP/q96ZnuTx94+J7b7vnh3fc9+8xuymRnqg2GUSq1Jz4kdtrpbIk3HWmEFSK1aLz9BKKTnt28dUKzODHHnhz2ofXiTlMfp8tW9CRICDEajbUy27Yfes5rzjnj/JceesSWDPkIYw2zCQt//e6/uv7//NPM7IxRqt6k64ukHA4GJ59ywqe+cl2PSgXdRDMD7dq16+5bf/DVG7/ywE/+0xg9NdWBYaN1AoEfq59GzOM45O8JFC69SI7DzTMHbXVXkodS/UrLdKlM4g3hyDsakclKqXI4ft6x2y+85A07Ljiz250rMB5VI2JIIjbcybuP3//QJa+6NGtI0ilpwyxJZnJtaeWqj/7Fa976u8+N98hMMsMQ8rwxhalCj3582703/v3n77nzXiFlu93UlWLD5GmCQMXIECRHNrCO3mMf6s6cgeLM0wmnShTQAXuuUu1mWP/HICkgxGB1ddPmA9/ynj9++ZvObbW7Qx4slkuZkEJI+7QymkEEwcw0gXqgrnfrUuSGSANSSAIEqFJq0SxD0vEvf9HxLz/17q/ccd1HPvnEA4+0ZroiI6NM4n0ZAHGSryJeYQ/ThM1NJyeC3zDhPqs3ifZM2ux1ULueMqmMGQ1G5154/se+fu25l1xYNHmxWNGaSWaGSBtWWjNRp9lti6mv3PBvVTEWRGxSq+nFzTBay2Z+y03fHKnxXHsDCVFqrYw2RJDCgFbK3lI1OPG8HR/+2v/7b1e8nUDjopSNjKlmEJxog7cLAWVdxuF2Z8atOZzZfCiC7Yq4ThqtlC8UQ1rv9wgyk4PeYH7j/OV//WdnvvqVaxhWRdGQkogkiA0TMJV3WmiOqt7eJ5798uduvvHvb2i1WjDGxy+ArzeHcqXI5LA/OP2cl77xsjcdcMzWuZmNCmqgB0YbkkKDDaPSSuRyTsw+9KP7P/aOq5968NHOhhlTaTALP+4w5jhRtxpRO133NABAM5u3WrA5QSelfM3D2ItJRGfXq0Qmhyu9o08+9vKPv+fg7dsG5YoUUpIQAIwBMJ1Pt5A98+iT3/nKt+689Y6nHntyOBxNdTqsNdWcS20y9gxlcjgcE/iQIw47ZcepZ5x35rYXHUfIe3rNaAMpNbMBV1q3mlPj1f6n3/mR27/4jfbsFGsNBnFtBYXqgMRw0TlPP3U3KqKZzVuBpHqBfVAmBEHBkBOcSWZANLLh0tqLfuulf3DN/6BOY1QMmlkuQRIw2kw1Oh00Hr37J/963Rd+cNv3+yurotVqNnIJGKUpNlfvNVoiMEBSGBJlVenRWDYav37K8Re87XUnvOolJLK1qgcShqDYVFrLRj5NUze87xM3f/QfWnPTpA0bFpj8UPw3BvT1kNrGPKDpzVsTWzMZdnOM+X2WEC4RABJZNlxZPePN57/lf79rbEpok0kpGMScCzkn55595InPffja27/xXTUump12JgUbhmHrbkI2FYnps4kwEROlSSSkIR4Px2A+/tQT3vDOS47acUofg7IojCBNMMwVm+nG7K3XfOaG//GJVrcNY4iZasYjUSgfH+0jirH+fnrz1hgiB7H5haYQonJNrI4+opEPl1Z3vOWCiz72rtVySMwNKSURtGk3Om1Ft/zdZ794zT/3V9baM11iNkqDDWKZ2LUqrJ9JzF4opnr7yl6gxCAhBYQYDUdC0NlvvOB1V10mF2b6xRqkqGAqw9qYhdbGb1xz/Rfe8/H2TJe1JsM2+6OEm+tBSfwXJQD5ESURjc2XI3IcUkTnQknk2XBl7eRXv+yia9/bVyMJCBICEMbMNuf7P3/muj95/wO3392Ymc6EMEqzMeSlSD4Hd725paiQ7IVkNPjjkF759JxIZJKFGK/1Nm/bevFH3334S07eWywaIkNgoFRqrr3h1g9+8qtXX9uen+ayAlyh1wc+tK/yknMS0Q1ZgOojiuTz52uxChNElo36w20nH/e2L32kzNkY1RCZJGKlZ1rzv/jej677w/ct7nquM901VeWSCU5rQTH0Iu+5yE/eu4yUTWEoDFcbJRAghMzzUVHkQr7+vX988iWv6xVrINLEyhjNZq41d9OfXP2Df/xye27aVJUHKAkf6xClRpoCQGnVBQmPojWvXyIplFJT87OXfP2axpb91HicZ5IAqXm+tfGBL3/jny9/nwEajdyUFWwoaAuC6dA8VIFB6YEDx9dNnYpNDNQWRwmUSc1crQ3O/vNLf/PK318p1hSMIdJGM1EH+Wde884nf/CTdrdtKuWmXeu+5haCfbJyEimSaeyUohP+cVZACF1U537oHfnWg/ujoZKiAgqts9bcvTd9/frL3gchcil1UcIYGJ89m1BXSGuIqUugmGZHL0J21ORY5uNaS0ljYNhUShhuzc/c8sFPfe29fyea3YJRMMZEI61Wc7zyY1d0N8wqpSEE10hTq3LUiqKe7sIfBEr5ScRb4zcGUZ6Nl9dOuvjVB56zY+9guZKyBMZKNVvz/3nLdz532fuyTArAVIqYYRhsYAwzu4WdJBVMhsnw83ci8SfqXCMvzSRvtLzSxlSqNdu97SOf/u4HPtVozQ+VKgwXJFcHA9p2yEved3k1KpBJUCLvCJKnah01BkS4PZR1IoV8VB5OkKBqNN7vqMNfcOVbl4s1TVQCY62pPb3zgYdvvvxqIQUZw0qB7RYJv7uI68oaiRPzyBqZgrmOx0Cs8wbGW8kywNDGlFVjfva7/+va//jMv2ZT82OlS0DJfLG/fPAbzj7y/LOK1T5lMnKmJiQgSSjCWeHBibBO1oNSqyGFqdSJV721mJselmVBKLXRWd5fXPvX3//LcjDMpGSliJlik2nZNMTswQynzddKWakPjVjVuEexfMgAGzYGWudTrW9e8aGdd/+Yu92R0gVQMC1V42Pf/bb2xnmtDUQad/k+/Ag5jpYBiBTIuriQtsIEymSxOtj68hdtOm/HWn9FSVkCBZjy9p3v/vjiQ0822k1TVc5G2Aqtj6ecekS6BB1J/k19ASfCqX282nkmBZhglVhpAlRVfO9PPzheGVZZXhiuhBgMR+KILdsvfW3VH0FKM8GfOgLp7EVipNwfTu9MbIABsnbziD++sGdUZagECq2pM/PoF77x6I3fbM5Pm6IMNjgpkwRvbv/6rWuUBD4pJn44HBjFaQ3LuxRKnw7OxYCZqyrvtJf+8/EHr74O7e7YmIJRkVwZ9g78vfNnjtiqS0VCmGDsahNOl/+Z2dekYynA3+z9BIOIiSiT5Vr/4LNfPHXa8b3BoBBUGFaNxmDP0gN//WnRyFhp56o47cVHGsl+Ow+WmykniWoQyb52frCPkCJONSFyHDIXZT4z9cT1Nz13549Vd2qsdAEejstq44Ytb7lAjcbIZAh4LBBR0zlBgiAi+lGba1pn3a0BslbroDe/alWXBWMMjLTRjalHP3Fj76mnZTNnpdax1qu6szwUZhgmyS4cNZYwHoDEsHPamiVSiH+S3CdVXmY2BgyjqkevvlZVXBAVjJLEymBt6tVndLYcpMsKQqSDiTSyI/I2VEQb4ATAxlu+xNcJNRjNn3hU49Rjh/1BSaLUrNrN3s/+6xef+Vo21eJSUapXYU5Ek1Sgmo8OEaCzyGGZJK1oxaNUqZxPJkp55fMQBldV1mkvf//He77+fT3dHVe6AI2Hldq8aeGCM/VwzFJEm+tdZn1l2RnpdAgu3mU/eKf+gkjrhd8+a9iQpeYKKNiYRufp6/+t3LsspIQx9cpa6HndxyotfGdJvDXpd4PthbW/SG71uWvNAzmIY2OGWWDXJ7+gSlMIURgURL3xuH3ejqw7FZYq65JJBwBGKJXEODHNumAZbUrVOnBT52WnDAdFRVRqU+X5aNee5276jmw3obVX0JiL1qN5Qp1KMd7w4iNKeRAG6PNK992rKpHfMuHomOToBB+Ostay0+r98D96dz2ou51SmxI06g/VMYe3jv81PSoghFnfb+1Doo4cIe5x8SOTQg1HMy88jg85sBgVFVOljZnqLH71jvHOZynP2K23hGl5YG1rSKhEqbD9BUdvTgkQzMrETmG34dHhRv6Uhzg6BA8cg8ti9Yu3ImtWDA2qFKpWq33WKVxWLATCINNx2i8MMGdxUCGIiwxi97oAo3H6SQOwMgxbUyn1ytfugHQV1SRocY34ZYRIAQ7g+GzcA5bs6Ivb6fy+Ga47tHq2GguothniiboMG0OtxvD2ezs796puA6UyRHpU0Gm/Lqe7bJj8HvzARt+L3diTxEETXiMYaaN0vmFWnHT0cDgqiUrDutUsH396/MDjstlw9InRBCPEh0l3wcCFlNyHyd57UNJrtPcTjqwWntdurHUX8AMMI8+Lnbv7d92v251SG8VUDsbm8M35ti1cVW4tL4lBQmplexYpPn5UIaIAE3FZ5VsO1AfvX45KxVCGdbs5uPsBtbQMIVyy7luvrVnu45NeYGawYTYRBZ681VdKwpqU/4eihYrP1TM8d46YoXXxvR9piMqgYqhK6+6UOPYILhWcliEm6fVhiLqrqblWd73S4nmHllNtrY0ioQDFNPrhQ7Y5mtDcAHW9o3oOHJK/ODFOFqM8YJ760QXUh+jFHKLhWnHbQ8nGoJGpBx+t1oZKSqWhDUrA/NoRTq98cjQBgj0T9klzSuU4DSKwwfbDSyJtoBlaSLU2Kh96ihqZM0BpuSsRXTKTySGsx9P7/Oi86pvpA+ejeUkSukStUu22ps8w8lz/8ply53M6b2jDiqkqKr1tC7VavO9hRc8g3GRqrh1h2mwMZIbDD1FKG0Ab1lmmdi+rXXsoz2AiUep2p7bFPdWEQJCQg4cZTpIO0X94SHwsy4gbkfeZz8YmCGBIwWt9PLmT85wNM0iX2hy0CdNTrDUSu1MXCtguPcaEzdM8ktkYajXNARtVpRWT0kZnmdq1hN4AQiDUYmobYGsMj4SNpQmOhSmujymJZa2p8aBO6H6wFpx4njpIyQMEglL882dYNpmJIU3FPD1NM9PQzCQmHk+VSdgGEovHKSvAjKm2mptRldYgZaBFpnbv4aLwm5EC1lFLU9uTBpBxfvueVXKSPWHqoT8zqAaqQ9wPOmYpEx0wwHuWALtERqyZW23MdGF0CE9SgxBQynwr5Ijg7ZOTjGa0WqrVYgVigl3U2rsKbdxwPT/T/Tfr7Y2Nep0kalL3Xjb1QH5rWmLGCW6lMpmyi1VqWNm9L6aOvGtleYUNAAkWMJpbGU91XDk4mEm/chrCryyRuU82wk4RImZDjRxZgw3DEAwxBA2GYJN0HvjsdCdII7EFYUrpjEAw/v0ej43XyHXbh5HEl0GKIblJhOrmEC2+nTn3h9D+aQZkxp0WjA9t67iEcWdgIH2x1wKTklRIQLABIJgNsUAtt/AuLA3AJ01n7Xz4b7AjofLI4YWV9BXOFAL26PmLqUn+FQbJx/RKw4ANQQgwAxlkto/B1j6U+X4mL9Ra1wwINgwmZgEIq/ZhW65txB/bmD+ej2P2YjCwaZZz5QQwEQlBwhs2Ewyz20EdGrQQJVlcigZj0h8nshHSBZyGoAEjnEWD03vvXNLU0W/itClPXXHJ5UFVxYpZCBgGCzLEecsi5+wN+0l4JV4fj6bRdjznpU9ZZgA9GqNSEIQ8p0YuSRpXJ6hBk+ZMk1bem67YYQhoGGg0wBKaQIARrFkUVcjfglFwts2rceaassapRjcGCEKgKDGqkDdhGAZQwOyM50jYKZ8WHIJG21aJk4F72Xg7JwSEVGs96nS2HrN948EHZHnj2Z27nn7ocdXr0cy0YGatU/GRlXZiq8m9CJScDn2xCzyImWdnmQUUISNAoNQYjmywEp9JdxhGL5aIk/1tbKUgJY3GvNrH3DyMBgtWTAsLyLMQfCeq5IsRCcj1Qprvxj4jpWHGuDj1defsuPTVh77gqKzdJFC/HO595Jf3fu5b377+S6osZathKh0oFOefvhHiEUru4bCDCQDYYNMmGDs3CRgqFNb6Ntey3pTjewvsSkzMWcQ6qkWyqZOA8RhLazhMwhCIMFY44AB0plCO3XNexdZH/knjjGSHNQOUZ6asWq3m73ziPSf9zivHqPYWQ4wqzSyknH7+kec+//mHnX3ajW//y5Vn94p2i8sKxP5/IUDwg4RX8TiXNA4nFpL2PwCaAAFDaDR5dYWWlyGzZK90cKDeHRDWbb7yMDkxk+CiwC93QjSgAQOUmhcWsGEWKgnS01jOBGTCcFMPCQYok0bpzuzM6//lo4f+ztm/7K/uHYz6mgYQY8oGhhaHo5+vPbdw+gkXfe3/Lmw71AzHlEmQVSViX7pK8pSanOsfgtLUmcLWwzCqAAkDyAbtXUavBymi8NZDwSlAEUiqnTQGjz8JSBgCZygNunPYtg1V5QfqvUlaFuSQN3HSHRiAlGy40cjP/ae/mfuNk55ZWeqRWINYY1o16DF6TGtMQ5nvXenhsM3nfPYDnf0WTKUoy+DfO2TfbwzVQ46SWFJnXpXCpv14/80oNIyAJsgGfvE0RmNbMavlMvDRE4CwNp9OgsMfZhhmKfDYkyg0kMEQFCCaOO5YaJ1s16r14qNRxGgtQCkEpOSiPO2jV3ZefNIzy4vDLF816Bn0mHosVg2tGqwa6hnRl/nu5R6O3LLjU3+VN5psGFLC7YZxkgiJTAy8a1VkghAoSxx1FGbmUWgYCU1ARo88CqPdhhKOdJz4iISgMYp1GFr6NBp46ufYs4gshyFAYlTipJPR6cAXRIP9CogExDjhE4io0eDltWPedens6895Zu9SXzSWFK8ZsWywYmjV0IqmZUXLWixpWlboUbZ7z1rn9Bce/zfv5FEBKZmIKa2XEZDuBOBExHaKBGY+4WRoAW19XYaiwsMPQwhonxLUrSeRCydSG1QD0E3UGEiJZ5/FQw+j0YEGWGJYYPtR2HYkihJChHDYvujiGe+/+lyQQWg2zNLyAW88f/4dFz/z3MoqsqWKVzTtVbyk5aISi0osaVrUtKixqGhJ0XKFHuVP71ruvPGCQ/7sUl7pUaMJIYiCJUpcgo8EAARrxUpjYQEnnYrB2BmgrInn9vLPnuQsY6MDP+rbv53Yw7JPzRkjqCQzDKMqcc8PkTVhAAhUhjuzeNlZpBSkcE3GxMA522ToBBLUavLi8sxvnrHwwb/YvTJcqbCssKywWPFSRUsVLyksVQ6XxZKWKixWWNZiWdEKZ8/sXun+6aXzb30DL61Qown3ixoUiO92svlCm+taShQFTn4hthyBYQGWUEBzih54EIt7kEmKmsWedgkB2b5xiBBLJBlV0BWt0WjQfffxag8ih02IeyN+xbl0/T+g30OzxUYHTfPj9qIgYilJSN671Dz7rM41Vz9bGCoVZQKamYj96r9VQQCGWbNbtCdmYX+RxpBZ7Dfe/c5Gqct//heamwYRtGK2P0Tg3hXxOx6ZIFgKAKQqvOIClGTDFGLBAO78Tv01rGTrnQ8B7ZlQ7vAcTTQxZv6tFp54DD/5EU45HWs9kMRgjP024w/+CNdfh717kOUsiIzx7AMzIAQJghAYFzA6u/giuvJPlitlylJISSWDRBxJXOIlV1BjGzNDgCWDQVqzKYb07neJ/Q8w13yStEKnzdqw0X71yQtXSBDBaMpy/NabcNLpWO0DGTS42aRdO/Gju9G0S57BtDs1S1qxAKXrYMnVRN0AZpQV3fJ1Pu0saFvplxhVfObZhAbfcyfuvh29ITcayHJrFMEgbVBUYBZHP48uv1SfdYZa7YFBJLgyJChxeeE/DBJugYvZvhfnrthUWTP6fbz5rTjiKP709fTg/aQU57l7fduWJbRCVUBK2rKdTnwZv+p8Njm0AgkYjdlp3PJF7N6N6S6qKgHD6oCrOoV3kChfOCCyh2oYOSqQ363SbvO1N2LhQFSlKza2W7j3+/Tsc6RG/NRj9PijvGsn93vQhppN2jBP25/HO17Mv/Ei7nbR60MICB+Skd+Yae0IG79G6ncFwgUI7ioDhmEYGihLTHWhGXfeTnfdgZ89xivLKMYwhjKJuQVs2U5bnsedBXSb/KrzoDwHmGmqhf/+Rvz0ATRzaE1JaBIo5BZHrI43Fg4I5fAEnWCBADvILEe/z2/9Q7z9Ciw9h6wBY5BlGK7hW7dSdxqb9qOc0F/mqkAu0e3Sfvvx7DwLgeEQMMhzz2O3FOXAinmyl4RVO4tOAMtujzAMbaANKgPNaLXBRCuLWF5Cbw2DEVig2UHWRq+P3TvxipfxIUdgNIIQ0AqzG+ieW3DVZWi1oUqEn9vxJsWjFEPlLEYvvwIdRy+tqd2hr9+E8y7k6QVUJSBQaMxuwtHH8f0/oVJxI+PZGcwtULvJWcYDg/4iJKHRgCAUpYOANYggBZLt5CG3QXAUAR1jxyJc2GGXn5SBUlgdoVJsADmD6SnkJY1GGA0x2I21NRx+OA7ejmEBymAAzkhr3PxZZrgQsf4JY/FFWFsP2kfyso8PGUaeYddOfOmzdNlVvGcPsgaYsTbCkcfh6Z3Yuxcz01jtU6GQZ2jkyDPIDEKgMBB2dUDYbUs2nvaRh/HoWKW3JCKwXVBl+F9fc4GrQ0dDa1QaSqOqoBTKiqoKZYlijEKh2cBJp/HYuBxbKcxvxF3/hvvuQqeDqkBInVMGeZBC6kr5hv0T7tQYlFZiXeBnJ/axG3HwURj1QRLMyBs0WsW3vgqRodlEI0eWcZ4jyyiTkAIgFkQkIFwjJASTcGYoWABHIHKbcoyB8XaR/Q8ZMEMxlILS0AyloA10wKhEWVJVor+Ks8/lzdsxHNqICRDImd71WvzsYeQZlLKtTa4zxmNX6soSn+7+GP87EWmODhgCMST1e7jub/m910FZiytorNDdxC94MX3v39EVKCpkOeUVZzmkhBSwPx8pJASBQEK6DT6WSuTNsJ1GEIs1OjE3ZXdGGyhNxkBrVsa+5wldUVWxqqAqrK3ghS/kg49GbwCRwRCqChsX6F8+hEceRHca5ThZdAjhjP/5Oe/QvBfbsCks1ASvW99XyUCswFCjgd4av+MDOPdt2PssspxAYMOdafz0HrrvLkx1QYQsQ55DSGTSaRMRhLBbcuLyBAkW7ncjnMEmwca4eq5fCIs01oa1hgEZ4+2RgaqgFKuCmHllCduPxCtei0Hpog2jeWoGOx+kK1/HSpNRYA1jkmC2fsQ1NlE+v4kjCgljksPkPJEQYHC7jQ/fjI3baNSHcJYenQ7u+zbddzempiElpISQyHNHEyHcP+xVichhRWRfmIt9+3zBVhS83wWMYW3I2Lc0LEYaljhs0FvBoYfy2ReihOMIMyCpI/A/X8MP349mA1XpX+RL4YkKhEgmBoPyuf0Sd06TAE0s7lvdkxmKMY4+gd7/JYw1swakI2qnhXv/nX70A0xNQwBCQmYgcvoVFCqEPzYUco7f+3t4Z2/9l4mxHDNg2OoXjIGqoBW0Amv0VnHEEXz2G1FJGOVa0wYb5+jTV+Dm63hqGtUYAHn9SgxQUJlkAdSOI5/bL7BjIlAM962Lswl5A/1VnHMR/eEnsLjMknxZgdDt0AO3445vQeZoNgCABIQEwXmxsHUO5M8I+6sXPiiKm+c9m5KqjX9BBmwccZRCfxUvOAFnvpZLAVO5Mo7W2DhLt/0DPn4Fd6agSrvTnIJfiLDEL5RM2AMU6gbeXifrG5NLEr5US8ga6K/RW/4cr7sSe5fYMgUMJup28eSP+dabaVSi045xoEgBEj4ylE7vSIBg3xFit3iBiEiI7g2DNVz+ZTAuQCVOfzmf8AoMShjtIgmlMD9DP/0mPnAxSLBRYB83c1iqTJUDFCk8AZAVWvKO5ERoFB+KCBJIQOY0GvCl78fZl9HeVc6ESzqNQaeL/m5892Y89gg12silY4QAYAkVeCTCNi8XGflybeSRyycNwgyFgCoxHNABm/hlr+YDj0F/6A0/oDU2dMXjd/DfvAVVBQGoimE8O9x0/E/lRiONkNVbIhAom91o15XqHGE/en8uXA6RC4FJQmQYD3DJ++mVl/Fi32UPDLBBo4Wc8dD36Z5vY89eNFuQDkEnQYo2m4hA0pYgAe+5Iljal8wJJKArlGNqSpz8Yj7xlYwuxsOY5SlNG6boidv5wxfzaEBSsnYvkURNQjq/GkwU0LFfs9mN9sAvKlGkjF0ppxR0zyPfGgtJIuNhn373ClxwJa8WMBUJ6QIZAN0OjZZw/2144IdYXUXWQiZdpOVss+1LxJ4svpE47CNshtZUVeg0cPTz+QUv5Q2HYlDC2LodwWgwaKGD+7+Kj1/OSpMkqNIumTObuFU4YJFm7t7Be4/OBAoAIdAmWJyICcXn6wpHBGIhIHPqr+IVb8JFH2bVwagPKd0qpWFkDZrKeOU5PPp9eugn2PMcFENkkNJZ6FoZRsD4Mg2D2XifpSGYNsxj+7F8zEt44TAUjHIciWMU8hamJd32cdxwNUNCEOnK/kBhMD3e1tQtdLKin6ohAZTNbIzmOHgxBpJE0q2NpBRKwGMr/yynfg/HnEIX/63Z/xgsjUEGJP39DNlAU6Ic0p4n8Iuf4qlHsPdZjAu4kqFbhnalL6Nc0AyFRoYNC3TIEXzYcdh8DHfmMAbKEQgQEnYPjWF022SWceNVfNsNaE+DmHTluk7cEq3XMT81SqfJEaCFEKH5eROSEL8WVE+iA1/iAkDIGhiNaHaWXn8ln/o2LgRGIyJi61bYQDPI5rGALqi3GyvPYHE3Vnaj30NZQpXQClKg2UG7i5kFbDgACwdjdjM3u1BAaWAqFzE4lhnkLZoGPfZt3PAX/PNHeWrGenSiOjrOm6cbdcJxNDoT2TtlMwvJ41G5yFe/Cd5mUtrXxBK8s2iQOQyoHOLEs/BbV+GgE3gIFGPnvGzCaQxAEBJZjtz9Qg8ZwCiGIVdHzDgE1hWgdMTFvVBp2DBkE9Mkejv5Gx/Cdz8PAzRyVmUIwymOLriqCQefzIoDMZKJBYASC8OpJZtw+esBqsUNDEhJWZOHA7TadMaFdObbecOR3AdGJWCDFBHlxiY6eCdPa1BMKDPHQpqToAEJ5A2aAooV3PuP+Pdr8dxObk+BDYyyrKF1Q5uMDWm9jiQ8csAyZdN1gLw7De2AfMmfa8BFF1MLr8hl5FnOTBgNaH6BXvTbOOUi3vh8VsAYUCVgfFMiEWECeU0F2EdAAqKJFtACDZ+m+7/Ed9yAXz7GjRakhK7AJhInMiYGwPCaEb75EJZD/5SMhwDKpjekyrWOFL/iZGglABRGEbMtgSwjAx71aXoGv/YS/Pp5OHwHugdBgwugYhjlssp0M6eD3rcjc2SEDJBAuSZ238sPfgX/cSv27uashTyHKSk4Ppg4xFhucr7bydmemhC69+t+Yv7RbHpDQgiGW6gKjyQ3B5O/Xok5WTEKtR72cZ3MYRjlmARj40E49AW07cV88ImYPRzNBRYgdrKPs7NRkcW5GqL3Szz7IH52F352F3Y/harivAWZgRWMXU5mT2MT/m8F/Gu/QSVSx1xDIUxkPSM8QEmoHFUssfAJ6PZ7QHFdDJAOICWUzECSlEI1ZjDaUzS3Pxa2YMMWmj2IpzehNY2sxQwyFYo+jZZ4ZRdWnsbe/8LyTgxWoJmzJrIMYBgdFCpa1uCzXH2k5tORcibaBx+dUtg3ihpq2fSGiZpG3QbVnqj9v0v8yo9jUyK71AyLkGGQ1tAVjLIwk6WbVTNj/BKVhMxZ5q6qbbRLO5J9vvATDFMN9qfOCoojjH/3MRdKDijrzu/zrtoZDr/VTEHJ0hvqAUCyazy5JcGdgFBsFZ5l6b1B1N5C+9f2yBdBgqASb5VGyF7A65L2dFKTI4+Di8cZfsWnjrbfdLmvffHgieCh9tPHvhGmQC07E5OIkep91jKPoMBMBLBvZ/LZ+LyP3RzP4rm6Meb4LT6f3m9HEQCanKUbGybAsM/WGOKdZBjAeoYFTL1P9WYsKIh/hL0prcdv9qciQ/gfml13lCI2aVASyxCsQLTdPPm4/biN5JNCd6ONdf449zCcmrfDhN6v19kaS5y+ceRCaNz/1rP/ES/2/F1XrAgvsKdATQ6Va6fD5Bx/HEhhTcL7uag//x/WnBuFskfo+AAAAABJRU5ErkJggg==";
// Dans l'app mobile (Capacitor), un lien relatif ne marcherait pas : on utilise l'adresse du site.
const LEGAL_BASE = (typeof window !== "undefined" && window.Capacitor && typeof window.Capacitor.isNativePlatform === "function" && window.Capacitor.isNativePlatform()) ? "https://regen-mu.vercel.app" : "";
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
  loisir: { fr: "Séance loisir", en: "Casual session", es: "Sesión libre", pt: "Sessão livre" },
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
  adducteurs: { fr: { label: "Adducteurs", instr: "Assis, plantes des pieds jointes, genoux vers le sol, pousse doucement avec les coudes.", duree: "40 sec" }, en: { label: "Adductors", instr: "Seated, soles of the feet together, knees toward the ground, gently push down with your elbows.", duree: "40 sec" }, es: { label: "Aductores", instr: "Sentado, plantas de los pies juntas, rodillas hacia el suelo, empuja suavemente con los codos.", duree: "40 seg" }, pt: { label: "Adutores", instr: "Sentado, solas dos pés juntas, joelhos em direção ao chão, empurre suavemente com os cotovelos.", duree: "40 seg" } },
  epaules: { fr: { label: "Épaules", instr: "Bras tendu devant la poitrine, ramène-le avec l'autre bras jusqu'au tirage à l'arrière de l'épaule.", duree: "30 sec x2 / bras" }, en: { label: "Shoulders", instr: "Arm straight across your chest, pull it in with the other arm until you feel a stretch at the back of the shoulder.", duree: "30 sec x2 / arm" }, es: { label: "Hombros", instr: "Brazo estirado frente al pecho, tíralo con el otro brazo hasta sentir el tirón en la parte posterior del hombro.", duree: "30 seg x2 / brazo" }, pt: { label: "Ombros", instr: "Braço esticado à frente do peito, puxe-o com o outro braço até sentir o alongamento atrás do ombro.", duree: "30 seg x2 / braço" } },
  rotateurs_epaule: { fr: { label: "Rotateurs de l'épaule", instr: "Coude au corps à 90°, avec ou sans élastique, rotation externe lente et contrôlée sans à-coup — cible la coiffe des rotateurs.", duree: "15 reps x2 / bras" }, en: { label: "Shoulder rotator cuff", instr: "Elbow at your side, bent at 90°, with or without a band, slow controlled external rotation without jerking — targets the rotator cuff.", duree: "15 reps x2 / arm" }, es: { label: "Rotadores del hombro", instr: "Codo pegado al cuerpo a 90°, con o sin banda elástica, rotación externa lenta y controlada — trabaja el manguito rotador.", duree: "15 reps x2 / brazo" }, pt: { label: "Rotadores do ombro", instr: "Cotovelo junto ao corpo a 90°, com ou sem elástico, rotação externa lenta e controlada — trabalha o manguito rotador.", duree: "15 reps x2 / braço" } },
  trapezes: { fr: { label: "Trapèzes", instr: "Incline doucement la tête d'un côté, main du même côté sur la tête pour accentuer légèrement.", duree: "20-30 sec / côté" }, en: { label: "Traps", instr: "Gently tilt your head to one side, hand on the same side resting on your head to lightly deepen the stretch.", duree: "20-30 sec / side" }, es: { label: "Trapecios", instr: "Inclina suavemente la cabeza hacia un lado, mano del mismo lado sobre la cabeza para acentuar ligeramente.", duree: "20-30 seg / lado" }, pt: { label: "Trapézios", instr: "Incline suavemente a cabeça para um lado, mão do mesmo lado sobre a cabeça para acentuar levemente.", duree: "20-30 seg / lado" } },
  avant_bras: { fr: { label: "Avant-bras", instr: "Bras tendu devant toi, poignet fléchi puis étendu, tire les doigts avec l'autre main.", duree: "20 sec x2 / position" }, en: { label: "Forearms", instr: "Arm out in front of you, wrist flexed then extended, pull the fingers back with the other hand.", duree: "20 sec x2 / position" }, es: { label: "Antebrazos", instr: "Brazo estirado frente a ti, muñeca flexionada y luego extendida, tira de los dedos con la otra mano.", duree: "20 seg x2 / posición" }, pt: { label: "Antebraços", instr: "Braço esticado à frente, punho flexionado e depois estendido, puxe os dedos com a outra mão.", duree: "20 seg x2 / posição" } },
  cou: { fr: { label: "Cou", instr: "Rotations lentes et inclinaisons douces de la tête, sans forcer.", duree: "1 min" }, en: { label: "Neck", instr: "Slow rotations and gentle head tilts, without forcing.", duree: "1 min" }, es: { label: "Cuello", instr: "Rotaciones lentas e inclinaciones suaves de la cabeza, sin forzar.", duree: "1 min" }, pt: { label: "Pescoço", instr: "Rotações lentas e inclinações suaves da cabeça, sem forçar.", duree: "1 min" } },
  poignet: { fr: { label: "Poignet", instr: "Bras tendu, poignet fléchi puis étendu, tire doucement les doigts avec l'autre main.", duree: "20 sec x2 / position" }, en: { label: "Wrist", instr: "Arm straight, wrist flexed then extended, gently pull the fingers with the other hand.", duree: "20 sec x2 / position" }, es: { label: "Muñeca", instr: "Brazo estirado, muñeca flexionada y luego extendida, tira suavemente de los dedos con la otra mano.", duree: "20 seg x2 / posición" }, pt: { label: "Punho", instr: "Braço esticado, punho flexionado e depois estendido, puxe suavemente os dedos com a outra mão.", duree: "20 seg x2 / posição" } },
  coude: { fr: { label: "Coude (épicondyle)", instr: "Bras tendu, poignet fléchi paume vers le bas, tire doucement la main vers le bas pour étirer l'épicondyle latéral — zone souvent sollicitée en cas de tennis elbow.", duree: "20 sec x2 / bras" }, en: { label: "Elbow (epicondyle)", instr: "Arm straight, wrist flexed palm down, gently pull the hand down to stretch the lateral epicondyle — an area often overloaded in tennis elbow.", duree: "20 sec x2 / arm" }, es: { label: "Codo (epicóndilo)", instr: "Brazo estirado, muñeca flexionada con la palma hacia abajo, tira suavemente de la mano hacia abajo para estirar el epicóndilo lateral.", duree: "20 seg x2 / brazo" }, pt: { label: "Cotovelo (epicôndilo)", instr: "Braço esticado, punho flexionado com a palma para baixo, puxe suavemente a mão para baixo para alongar o epicôndilo lateral.", duree: "20 seg x2 / braço" } },
  lombaires: { fr: { label: "Lombaires", instr: "Allongé sur le dos, ramène les deux genoux vers la poitrine, arrondis le bas du dos.", duree: "40 sec" }, en: { label: "Lower back", instr: "Lying on your back, bring both knees to your chest, rounding the lower back.", duree: "40 sec" }, es: { label: "Lumbares", instr: "Tumbado boca arriba, lleva ambas rodillas al pecho, redondeando la zona lumbar.", duree: "40 seg" }, pt: { label: "Lombar", instr: "Deitado de costas, leve os dois joelhos ao peito, arredondando a lombar.", duree: "40 seg" } },
  cervicales: { fr: { label: "Cervicales", instr: "Menton vers la poitrine puis rotations lentes, épaules basses et relâchées.", duree: "1 min" }, en: { label: "Neck (cervical)", instr: "Chin to chest then slow rotations, shoulders low and relaxed.", duree: "1 min" }, es: { label: "Cervicales", instr: "Barbilla hacia el pecho y luego rotaciones lentas, hombros bajos y relajados.", duree: "1 min" }, pt: { label: "Cervical", instr: "Queixo em direção ao peito e depois rotações lentas, ombros baixos e relaxados.", duree: "1 min" } },
  dorsaux: { fr: { label: "Dorsaux", instr: "Bras tendus devant toi, dos rond, recule les hanches (posture de l'enfant).", duree: "45 sec" }, en: { label: "Lats", instr: "Arms extended in front of you, rounded back, sit your hips back (child's pose).", duree: "45 sec" }, es: { label: "Dorsales", instr: "Brazos extendidos al frente, espalda redondeada, lleva las caderas hacia atrás (postura del niño).", duree: "45 seg" }, pt: { label: "Dorsais", instr: "Braços estendidos à frente, costas arredondadas, quadril para trás (postura da criança).", duree: "45 seg" } },
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
      pre: { fr: ["Riz basmati + filet de poulet grillé + brocolis vapeur", "Pâtes complètes + dés de dinde + sauce tomate légère", "Porridge d'avoine + banane + une cuillère de miel", "Patate douce rôtie + œufs brouillés + épinards", "Pain complet + omelette + tranche de jambon blanc"], en: ["Basmati rice + grilled chicken breast + steamed broccoli", "Whole-wheat pasta + diced turkey + light tomato sauce", "Oat porridge + banana + a spoonful of honey", "Roasted sweet potato + scrambled eggs + spinach", "Wholegrain bread + omelette + a slice of ham"], es: ["Arroz basmati + pechuga de pollo a la plancha + brócoli al vapor", "Pasta integral + dados de pavo + salsa de tomate ligera", "Porridge de avena + plátano + una cucharada de miel", "Boniato asado + huevos revueltos + espinacas", "Pan integral + tortilla + una loncha de jamón"], pt: ["Arroz basmati + peito de frango grelhado + brócolis no vapor", "Massa integral + peru em cubos + molho de tomate leve", "Mingau de aveia + banana + uma colher de mel", "Batata-doce assada + ovos mexidos + espinafre", "Pão integral + omelete + uma fatia de presunto"] },
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
      post: { fr: ["Whey + banane + lait", "Steak haché maigre + riz + légumes", "Œufs + fromage blanc + fruits", "Poulet + patate douce + haricots verts", "Skyr + granola + fruits rouges"], en: ["Whey protein + banana + milk", "Lean ground beef + rice + vegetables", "Eggs + cottage cheese + fruit", "Chicken + sweet potato + green beans", "Skyr + granola + berries"], es: ["Whey + plátano + leche", "Carne magra + arroz + verduras", "Huevos + queso fresco + fruta", "Pollo + boniato + judías verdes", "Skyr + granola + frutos rojos"], pt: ["Whey + banana + leite", "Carne magra moída + arroz + legumes", "Ovos + queijo cottage + frutas", "Frango + batata-doce + vagem", "Skyr + granola + frutas vermelhas"] },
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
      pre: { fr: ["Pâtes blanches, peu de fibres", "Riz blanc + banane", "Pain blanc + miel", "Semoule + compote", "Biscuits énergétiques + banane"], en: ["White pasta, low fiber", "White rice + banana", "White bread + honey", "Couscous + apple sauce", "Energy biscuits + banana"], es: ["Pasta blanca, baja en fibra", "Arroz blanco + plátano", "Pan blanco + miel", "Sémola + compota de manzana", "Galletas energéticas + plátano"], pt: ["Massa branca, baixa em fibra", "Arroz branco + banana", "Pão branco + mel", "Cuscuz + compota de maçã", "Biscoitos energéticos + banana"] },
      post: { fr: ["Boisson de récupération + banane", "Riz + poulet + légumes + jus d'orange", "Yaourt grec + miel + fruits", "Pâtes + jambon blanc", "Compote + fromage blanc + amandes"], en: ["Recovery drink + banana", "Rice + chicken + vegetables + orange juice", "Greek yogurt + honey + fruit", "Pasta + ham", "Apple sauce + cottage cheese + almonds"], es: ["Bebida de recuperación + plátano", "Arroz + pollo + verduras + zumo de naranja", "Yogur griego + miel + fruta", "Pasta + jamón", "Compota + queso fresco + almendras"], pt: ["Bebida de recuperação + banana", "Arroz + frango + legumes + suco de laranja", "Iogurte grego + mel + fruta", "Massa + presunto", "Compota de maçã + queijo cottage + amêndoas"] },
    },
  },
};
const REST_MEALS = {
  main: { fr: ["Riz complet + poulet + légumes de saison", "Pâtes complètes + œufs + légumes rôtis", "Quinoa + poisson + brocolis", "Patate douce + poulet + haricots verts", "Riz + tofu ou légumineuses + légumes sautés"], en: ["Brown rice + chicken + seasonal vegetables", "Wholegrain pasta + eggs + roasted vegetables", "Quinoa + fish + broccoli", "Sweet potato + chicken + green beans", "Rice + tofu or legumes + sautéed vegetables"], es: ["Arroz integral + pollo + verduras de temporada", "Pasta integral + huevos + verduras asadas", "Quinoa + pescado + brócoli", "Boniato + pollo + judías verdes", "Arroz + tofu o legumbres + verduras salteadas"], pt: ["Arroz integral + frango + legumes da estação", "Massa integral + ovos + legumes assados", "Quinoa + peixe + brócolis", "Batata-doce + frango + vagem", "Arroz + tofu ou leguminosas + legumes salteados"] },
  snack: { fr: ["Yaourt + fruits + une poignée d'oléagineux", "Fromage blanc + miel + fruits secs", "Fruit frais + une poignée d'amandes", "Tartine de pain complet + avocat", "Smoothie fruits + lait ou boisson végétale"], en: ["Yogurt + fruit + a handful of nuts", "Cottage cheese + honey + dried fruit", "Fresh fruit + a handful of almonds", "Wholegrain toast + avocado", "Fruit smoothie + milk or plant-based drink"], es: ["Yogur + fruta + un puñado de frutos secos", "Queso fresco + miel + frutos secos", "Fruta fresca + un puñado de almendras", "Tostada integral + aguacate", "Batido de frutas + leche o bebida vegetal"], pt: ["Iogurte + fruta + um punhado de oleaginosas", "Queijo cottage + mel + frutas secas", "Fruta fresca + um punhado de amêndoas", "Torrada integral + abacate", "Vitamina de frutas + leite ou bebida vegetal"] },
};
// Repas végétariens / vegan (utilisés quand le régime est choisi dans le profil).
// Tableaux alignés par index entre les 4 langues.
const VEG_MEALS = {
  train: {
    pre: {
      fr: ["Riz + lentilles corail + épinards", "Pâtes complètes + pois chiches + sauce tomate", "Porridge d'avoine + banane + purée d'amande", "Patate douce rôtie + houmous + légumes", "Pain complet + houmous + avocat"],
      en: ["Rice + red lentils + spinach", "Wholegrain pasta + chickpeas + tomato sauce", "Oat porridge + banana + almond butter", "Roasted sweet potato + hummus + vegetables", "Wholegrain bread + hummus + avocado"],
      es: ["Arroz + lentejas rojas + espinacas", "Pasta integral + garbanzos + salsa de tomate", "Porridge de avena + plátano + crema de almendra", "Boniato asado + hummus + verduras", "Pan integral + hummus + aguacate"],
      pt: ["Arroz + lentilhas vermelhas + espinafre", "Massa integral + grão-de-bico + molho de tomate", "Mingau de aveia + banana + pasta de amêndoa", "Batata-doce assada + húmus + legumes", "Pão integral + húmus + abacate"],
    },
    post: {
      fr: ["Bol de quinoa + tofu grillé + légumes sautés", "Smoothie banane + boisson végétale + flocons d'avoine", "Riz + haricots rouges + maïs + avocat", "Houmous + pain complet + crudités", "Dal de lentilles + riz basmati"],
      en: ["Quinoa bowl + grilled tofu + sautéed vegetables", "Banana smoothie + plant-based drink + rolled oats", "Rice + kidney beans + corn + avocado", "Hummus + wholegrain bread + raw vegetables", "Lentil dal + basmati rice"],
      es: ["Bol de quinoa + tofu a la plancha + verduras salteadas", "Batido de plátano + bebida vegetal + copos de avena", "Arroz + alubias rojas + maíz + aguacate", "Hummus + pan integral + crudités", "Dal de lentejas + arroz basmati"],
      pt: ["Bowl de quinoa + tofu grelhado + legumes salteados", "Vitamina de banana + bebida vegetal + flocos de aveia", "Arroz + feijão vermelho + milho + abacate", "Húmus + pão integral + crudités", "Dal de lentilhas + arroz basmati"],
    },
  },
  match: {
    pre: {
      fr: ["Pâtes blanches + sauce tomate + huile d'olive", "Riz blanc + carottes cuites + compote", "Pain blanc + confiture + banane", "Semoule + légumes cuits sans peau + pois chiches", "Purée de pommes de terre + carottes + huile d'olive"],
      en: ["White pasta + tomato sauce + olive oil", "White rice + cooked carrots + apple sauce", "White bread + jam + banana", "Couscous + peeled cooked vegetables + chickpeas", "Mashed potatoes + carrots + olive oil"],
      es: ["Pasta blanca + salsa de tomate + aceite de oliva", "Arroz blanco + zanahorias cocidas + compota", "Pan blanco + mermelada + plátano", "Cuscús + verduras cocidas sin piel + garbanzos", "Puré de patatas + zanahorias + aceite de oliva"],
      pt: ["Massa branca + molho de tomate + azeite", "Arroz branco + cenouras cozidas + compota", "Pão branco + geleia + banana", "Cuscuz + legumes cozidos sem casca + grão-de-bico", "Purê de batatas + cenouras + azeite"],
    },
    post: {
      fr: ["Riz + lentilles + légumes + jus d'orange", "Pâtes + pois chiches + tomates cerises + huile d'olive", "Purée de patate douce + haricots blancs + épinards", "Smoothie banane + dattes + boisson végétale + purée d'amande", "Bol de quinoa + tofu + légumes + jus d'orange"],
      en: ["Rice + lentils + vegetables + orange juice", "Pasta + chickpeas + cherry tomatoes + olive oil", "Mashed sweet potato + white beans + spinach", "Banana smoothie + dates + plant-based drink + almond butter", "Quinoa bowl + tofu + vegetables + orange juice"],
      es: ["Arroz + lentejas + verduras + zumo de naranja", "Pasta + garbanzos + tomates cherry + aceite de oliva", "Puré de boniato + alubias blancas + espinacas", "Batido de plátano + dátiles + bebida vegetal + crema de almendra", "Bol de quinoa + tofu + verduras + zumo de naranja"],
      pt: ["Arroz + lentilhas + legumes + suco de laranja", "Massa + grão-de-bico + tomates-cereja + azeite", "Purê de batata-doce + feijão-branco + espinafre", "Vitamina de banana + tâmaras + bebida vegetal + pasta de amêndoa", "Bowl de quinoa + tofu + legumes + suco de laranja"],
    },
  },
};
const REST_VEG = {
  main: {
    fr: ["Riz complet + lentilles + légumes de saison", "Pâtes complètes + pois chiches + légumes rôtis", "Quinoa + tofu + brocolis", "Patate douce + haricots rouges + haricots verts", "Bol de riz + houmous + légumes crus"],
    en: ["Brown rice + lentils + seasonal vegetables", "Wholegrain pasta + chickpeas + roasted vegetables", "Quinoa + tofu + broccoli", "Sweet potato + kidney beans + green beans", "Rice bowl + hummus + raw vegetables"],
    es: ["Arroz integral + lentejas + verduras de temporada", "Pasta integral + garbanzos + verduras asadas", "Quinoa + tofu + brócoli", "Boniato + alubias rojas + judías verdes", "Bol de arroz + hummus + verduras crudas"],
    pt: ["Arroz integral + lentilhas + legumes da estação", "Massa integral + grão-de-bico + legumes assados", "Quinoa + tofu + brócolis", "Batata-doce + feijão vermelho + vagem", "Bowl de arroz + húmus + legumes crus"],
  },
  snack: {
    fr: ["Fruit frais + une poignée de noix", "Tartine de pain complet + houmous", "Compote sans sucre ajouté + flocons d'avoine", "Smoothie fruits + boisson végétale", "Banane + purée d'amande sur pain complet"],
    en: ["Fresh fruit + a handful of walnuts", "Wholegrain toast + hummus", "Unsweetened apple sauce + rolled oats", "Fruit smoothie + plant-based drink", "Banana + almond butter on wholegrain bread"],
    es: ["Fruta fresca + un puñado de nueces", "Tostada de pan integral + hummus", "Compota sin azúcar añadido + copos de avena", "Batido de frutas + bebida vegetal", "Plátano + crema de almendra sobre pan integral"],
    pt: ["Fruta fresca + um punhado de nozes", "Torrada de pão integral + húmus", "Compota sem açúcar adicionado + flocos de aveia", "Vitamina de frutas + bebida vegetal", "Banana + pasta de amêndoa em pão integral"],
  },
};
// Allergènes et régimes — chaque mot-clé est cherché (sans accents, en début
// de mot) dans le texte FRANÇAIS du repas. Les tableaux de repas sont alignés
// par index entre les langues : filtrer sur le français exclut le bon repas
// quelle que soit la langue affichée. En cas de doute on EXCLUT (sécurité).
const MEAT_KW = ["poulet", "dinde", "boeuf", "steak", "jambon", "porc", "bacon", "lardon", "saucisse", "viande", "canard", "agneau", "veau", "poisson", "thon", "saumon", "crevette", "fruits de mer", "anchois", "sardine", "cabillaud", "maquereau", "truite", "moule", "calamar"];
const DAIRY_KW = ["lait", "fromage", "yaourt", "yogourt", "whey", "skyr", "beurre", "creme", "proteine", "recuperation", "kefir", "mozzarella", "ricotta"];
const ALLERGENS = [
  { key: "gluten", group: "allergy", fr: "Gluten", en: "Gluten", es: "Gluten", pt: "Glúten", kw: ["pain", "pate", "semoule", "couscous", "biscuit", "toast", "granola", "avoine", "porridge", "flocons", "tartine", "muesli", "ble", "orge", "seigle", "boulgour", "wrap", "cereale", "barre", "crepe"] },
  { key: "lactose", group: "allergy", fr: "Lactose / produits laitiers", en: "Lactose / dairy", es: "Lactosa / lácteos", pt: "Lactose / laticínios", kw: DAIRY_KW },
  { key: "oeufs", group: "allergy", fr: "Œufs", en: "Eggs", es: "Huevos", pt: "Ovos", kw: ["oeuf", "omelette", "mayonnaise"] },
  { key: "fruits_coque", group: "allergy", fr: "Fruits à coque", en: "Tree nuts", es: "Frutos secos", pt: "Oleaginosas", kw: ["amande", "noix", "noisette", "pistache", "cajou", "pecan", "oleagineux", "fruits secs", "granola", "muesli", "praline"] },
  { key: "arachide", group: "allergy", fr: "Arachides / cacahuètes", en: "Peanuts", es: "Cacahuetes", pt: "Amendoim", kw: ["arachide", "cacahuete", "cacahuette"] },
  { key: "poisson", group: "allergy", fr: "Poisson / fruits de mer", en: "Fish / seafood", es: "Pescado / marisco", pt: "Peixe / frutos do mar", kw: ["poisson", "thon", "saumon", "crevette", "fruits de mer", "anchois", "sardine", "maquereau", "cabillaud", "truite", "moule", "calamar"] },
  { key: "soja", group: "allergy", fr: "Soja", en: "Soy", es: "Soja", pt: "Soja", kw: ["soja", "tofu", "tempeh", "edamame", "boisson vegetale"] },
  { key: "porc", group: "allergy", fr: "Porc", en: "Pork", es: "Cerdo", pt: "Porco", kw: ["jambon", "porc", "bacon", "lardon", "saucisse", "gelatine"] },
  { key: "halal", group: "diet", fr: "Halal (sans porc)", en: "Halal (no pork)", es: "Halal (sin cerdo)", pt: "Halal (sem porco)", kw: ["jambon", "porc", "bacon", "lardon", "saucisse", "gelatine"] },
  { key: "vegetarien", group: "diet", fr: "Végétarien", en: "Vegetarian", es: "Vegetariano", pt: "Vegetariano", kw: MEAT_KW },
  { key: "vegan", group: "diet", fr: "Vegan", en: "Vegan", es: "Vegano", pt: "Vegano", kw: [...MEAT_KW, ...DAIRY_KW, "oeuf", "omelette", "miel", "gelatine", "mayonnaise"] },
];
// Texte sans accents / œ → oe, en minuscules, pour comparer sans se tromper.
const normFood = (s) => (s || "").toLowerCase().replace(/œ/g, "oe").normalize("NFD").replace(/[̀-ͯ]/g, "");
// Le mot-clé doit commencer un mot (évite "ble" dans "table"), sans exiger la fin (pluriels).
const hasFoodKw = (lowerNorm, kw) => new RegExp("(^|[^a-z])" + kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(lowerNorm);
function excludedMealIndices(frArray, allergyKeys, dislikedWords) {
  const excluded = new Set();
  const words = (dislikedWords || []).map((w) => normFood(w).trim()).filter(Boolean).map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w));
  const allergenKws = (allergyKeys || []).flatMap((k) => ALLERGENS.find((a) => a.key === k)?.kw || []);
  frArray.forEach((text, i) => {
    const lower = normFood(text);
    if (allergenKws.some((kw) => hasFoodKw(lower, kw)) || words.some((w) => hasFoodKw(lower, w))) excluded.add(i);
  });
  return excluded;
}
// Repas "neutres" de secours (sans viande, œuf, produit laitier, gluten, fruit à coque…).
const SAFE_MEALS = {
  fr: ["Riz + légumes de saison + fruit frais", "Pommes de terre vapeur + légumes verts + fruit frais", "Quinoa + légumes rôtis + fruit frais"],
  en: ["Rice + seasonal vegetables + fresh fruit", "Steamed potatoes + green vegetables + fresh fruit", "Quinoa + roasted vegetables + fresh fruit"],
  es: ["Arroz + verduras de temporada + fruta fresca", "Patatas al vapor + verduras verdes + fruta fresca", "Quinoa + verduras asadas + fruta fresca"],
  pt: ["Arroz + legumes da estação + fruta fresca", "Batatas cozidas no vapor + legumes verdes + fruta fresca", "Quinoa + legumes assados + fruta fresca"],
};
// Choisit un repas en excluant allergies/régimes/aliments non aimés.
// Si le pool est entièrement exclu, on NE retombe JAMAIS sur un repas à risque :
// on tente les repas neutres, puis un conseil générique.
function pickFromPoolSafe(langArray, frArray, seed, allergyKeys, dislikedWords, lang) {
  const pick = (arr, frArr) => {
    const excluded = excludedMealIndices(frArr, allergyKeys, dislikedWords);
    const allowed = arr.map((_, i) => i).filter((i) => !excluded.has(i));
    return allowed.length > 0 ? arr[allowed[hashStr(seed) % allowed.length]] : null;
  };
  const fromPool = pick(langArray, frArray);
  if (fromPool) return fromPool;
  const l = lang || "fr";
  const safe = pick(SAFE_MEALS[l] || SAFE_MEALS.fr, SAFE_MEALS.fr);
  const addProtein = tr(l, { fr: " — ajoute une source de protéines compatible avec tes restrictions", en: " — add a protein source that fits your restrictions", es: " — añade una fuente de proteínas compatible con tus restricciones", pt: " — adicione uma fonte de proteína compatível com suas restrições" });
  if (safe) return safe + addProtein;
  return tr(l, { fr: "Compose un repas adapté à tes restrictions : féculent + légumes + protéine compatible.", en: "Build a meal that fits your restrictions: starch + vegetables + a compatible protein.", es: "Compón una comida adaptada a tus restricciones: almidón + verduras + proteína compatible.", pt: "Monte uma refeição adequada às suas restrições: carboidrato + legumes + proteína compatível." });
}
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return Math.abs(h); }
function pickFromPool(pool, seed) { return pool[hashStr(seed) % pool.length]; }
function buildMeals(eventType, intensity, sportKey, seed, lang, allergies, dislikedFoods) {
  const category = SPORT_CATEGORY[sportKey] || "team";
  const slot = eventType === "match" ? "match" : "train";
  const pool = (MEALS[category] || MEALS.team)[slot];
  const isVeg = (allergies || []).some((k) => k === "vegetarien" || k === "vegan");
  const vp = VEG_MEALS[slot];
  // Régime végétarien/vegan : les repas sans viande passent en premier, puis le reste (filtré).
  const preList = isVeg ? (vp.pre[lang] || vp.pre.fr).concat(pool.pre[lang] || pool.pre.fr) : (pool.pre[lang] || pool.pre.fr);
  const preFr = isVeg ? vp.pre.fr.concat(pool.pre.fr) : pool.pre.fr;
  const postList = isVeg ? (vp.post[lang] || vp.post.fr).concat(pool.post[lang] || pool.post.fr) : (pool.post[lang] || pool.post.fr);
  const postFr = isVeg ? vp.post.fr.concat(pool.post.fr) : pool.post.fr;
  // L'intensité influence le choix ET la portion : sur une séance chill, le
  // repas d'avant reste léger (première moitié du pool, pensée plus digeste) ;
  // sur une séance intense, on va chercher dans toute la liste sans restriction.
  const chill = eventType !== "match" && intensity === "chill";
  const prePool = chill ? preList.slice(0, Math.ceil(preList.length / 2)) : preList;
  const prePoolFr = chill ? preFr.slice(0, Math.ceil(preFr.length / 2)) : preFr;
  const portionNote = eventType !== "match" ? (intensity === "chill" ? tr(lang, { fr: " (portion modérée suffit)", en: " (a moderate portion is enough)", es: " (una porción moderada basta)", pt: " (uma porção moderada basta)" }) : intensity === "intense" ? tr(lang, { fr: " (portion complète, ne lésine pas sur les glucides)", en: " (full portion, don't skimp on carbs)", es: " (porción completa, no escatimes en carbohidratos)", pt: " (porção completa, não economize nos carboidratos)" }) : "") : "";
  return {
    pre: pickFromPoolSafe(prePool, prePoolFr, seed + "-pre", allergies, dislikedFoods, lang) + portionNote,
    post: pickFromPoolSafe(postList, postFr, seed + "-post", allergies, dislikedFoods, lang),
  };
}
function buildRestDayMeals(seed, lang, allergies, dislikedFoods) {
  const isVeg = (allergies || []).some((k) => k === "vegetarien" || k === "vegan");
  const mainL = isVeg ? (REST_VEG.main[lang] || REST_VEG.main.fr).concat(REST_MEALS.main[lang] || REST_MEALS.main.fr) : (REST_MEALS.main[lang] || REST_MEALS.main.fr);
  const mainFr = isVeg ? REST_VEG.main.fr.concat(REST_MEALS.main.fr) : REST_MEALS.main.fr;
  const snackL = isVeg ? (REST_VEG.snack[lang] || REST_VEG.snack.fr).concat(REST_MEALS.snack[lang] || REST_MEALS.snack.fr) : (REST_MEALS.snack[lang] || REST_MEALS.snack.fr);
  const snackFr = isVeg ? REST_VEG.snack.fr.concat(REST_MEALS.snack.fr) : REST_MEALS.snack.fr;
  return {
    pre: pickFromPoolSafe(mainL, mainFr, seed + "-main", allergies, dislikedFoods, lang),
    post: pickFromPoolSafe(snackL, snackFr, seed + "-snack", allergies, dislikedFoods, lang),
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
  if (plan.coldHeat?.[0]) raw.push({ offsetMin: plan.coldHeat[0].delayMin || 180, label: plan.coldHeat[0].titre, Icon: Snowflake, tab: "froid" });
  const timed = raw.map((s) => ({
    ...s,
    timeLabel: endTime ? addMinutes(endTime, s.offsetMin, lang) : (s.offsetMin === 0 ? rightAfter : s.offsetMin < 60 ? `+${s.offsetMin} min` : `+${Math.floor(s.offsetMin / 60)}h${s.offsetMin % 60 ? String(s.offsetMin % 60).padStart(2, "0") : ""}`),
  }));
  return [preMealStep, warmupStep, ...timed, { timeLabel: evening, label: tr(lang, { fr: `Coucher visé — objectif ${plan.sommeil}h de sommeil`, en: `Target bedtime — aim for ${plan.sommeil}h of sleep`, es: `Hora de acostarse — objetivo ${plan.sommeil}h de sueño`, pt: `Hora de dormir — meta de ${plan.sommeil}h de sono` }), Icon: Moon, tab: null }];
}

/* ============================================================
   RECOVERY LOGIC
   ============================================================ */
/* Charge cumulée : chaque séance récente (journal + planning) pèse selon son intensité,
   et son poids diminue de moitié toutes les 36 h (oubli sur ~5 jours). Plusieurs séances
   le même jour s'additionnent donc vraiment. Les coefficients sont des estimations
   raisonnables, pas une mesure médicale. */
let LOAD_CTX = { sessionsLog: [], plannerConfig: null, checkins: {} };
const setLoadContext = (ctx) => { LOAD_CTX = ctx; };
function sessionWeight(type, intensity, rpe, minutes) {
  if (rpe && minutes) return Math.max(0.15, Math.min(1.3, (rpe * minutes) / 600));   // charge « durée × effort ressenti »
  if (type === "match") return 1;
  return intensity === "intense" ? 0.8 : intensity === "chill" ? 0.2 : 0.5;
}
function computeLoad(at = new Date(), ctx = LOAD_CTX) {
  const atT = at.getTime();
  const items = [];
  const logged = new Set();
  (ctx.sessionsLog || []).forEach((x) => {
    if (!x || !x.date || x.restDay) return;
    const t = new Date(x.date).getTime();
    if (!Number.isFinite(t)) return;
    logged.add(`${isoLocal(new Date(x.date))}|${x.sport}|${x.eventType}`);
    items.push({ t, w: sessionWeight(x.eventType, x.intensity, x.rpe, x.minutes) });
  });
  const cfg = ctx.plannerConfig;
  if (cfg && cfg.weeklyDays) {
    for (let d = 0; d <= 7; d++) {
      const day = new Date(atT - d * 86400000);
      const iso = isoLocal(day);
      const { entries } = getDayEntries(cfg.weeklyDays, cfg.exceptions || {}, iso);
      (entries || []).forEach((e) => {
        if (!SPORT_TYPES.includes(e.type)) return;
        if (logged.has(`${iso}|${e.sport}|${e.type}`)) return;
        const [hh, mm] = String(e.heure || "18:00").split(":").map(Number);
        const t = new Date(iso + "T00:00:00").getTime() + ((hh || 0) * 60 + (mm || 0)) * 60000;
        items.push({ t, w: sessionWeight(e.type, e.intensity || "moyen") });
      });
    }
  }
  let load = 0, count7 = 0;
  items.forEach((it) => {
    const ageH = (atT - it.t) / 3600000;
    if (ageH < 0 || ageH > 7 * 24) return;
    count7++;
    if (ageH <= 120) load += it.w * Math.pow(0.5, ageH / 36);
  });
  return { bonus: Math.min(30, Math.round(load * 14)), count7 };
}
/* Bilan du jour : sommeil, courbatures, stress, énergie (1 à 5) → forme du jour et ajustement du score. */
const SORE_ZONES = { jambes: ["quads", "ischios", "mollets"], dos: ["lombaires", "dorsaux"], epaules: ["epaules", "trapezes"], bras: ["avant_bras", "poignet"], cou: ["cou", "cervicales"], hanches: ["hanches", "adducteurs"] };
function readinessRaw(ci) {
  if (!ci) return null;
  const v = (n) => Math.max(1, Math.min(5, Number(n) || 3));
  return (5 - v(ci.sleep)) + (v(ci.sore) - 1) + (v(ci.stress) - 1) + (5 - v(ci.energy));   // 0 (très en forme) à 16
}
const readinessScore = (ci) => (ci ? 100 - Math.round((readinessRaw(ci) * 100) / 16) : null);
const readinessBonus = (ci) => (ci ? Math.max(-3, Math.min(10, Math.round((readinessRaw(ci) - 6) * 0.9))) : 0);
/* Besoin de récupération « en direct » : tient compte de TOUTES les séances (faites, imprévues, prévues,
   à venir dans les 48 h), du suivi du plan de récup (cases cochées) et du bilan du jour. */
function liveRecoveryNeed(now = new Date(), ctx = LOAD_CTX, settings = {}) {
  const nowT = now.getTime();
  const done = settings.done || {};
  const doneN = (k) => DONE_ITEMS.filter((i) => (done[k] || {})[i]).length;
  const items = [];
  const loggedCount = {};
  (ctx.sessionsLog || []).forEach((x) => {
    if (!x || !x.date || x.restDay) return;
    const t = new Date(x.date).getTime(); if (!Number.isFinite(t)) return;
    const key = `${isoLocal(new Date(x.date))}|${x.sport}|${x.eventType}`;
    loggedCount[key] = (loggedCount[key] || 0) + 1;
    items.push({ t, w: sessionWeight(x.eventType, x.intensity, x.rpe, x.minutes), n: doneN(`s:${x.date}`) });
  });
  const cfg = ctx.plannerConfig;
  if (cfg && cfg.weeklyDays) {
    const seen = {};
    for (let d = -7; d <= 2; d++) {
      const iso = isoLocal(new Date(nowT - d * 86400000));
      const { entries } = getDayEntries(cfg.weeklyDays, cfg.exceptions || {}, iso);
      (entries || []).forEach((e) => {
        if (!SPORT_TYPES.includes(e.type)) return;
        const key = `${iso}|${e.sport}|${e.type}`;
        seen[key] = (seen[key] || 0) + 1;
        if (seen[key] <= (loggedCount[key] || 0)) return;   // déjà comptée via l'historique
        const [hh, mm] = String(e.heure || "18:00").split(":").map(Number);
        const t = new Date(iso + "T00:00:00").getTime() + ((hh || 0) * 60 + (mm || 0)) * 60000;
        items.push({ t, w: sessionWeight(e.type, e.intensity || "moyen"), n: doneN(`d:${iso}`) });
      });
    }
  }
  let past = 0, future = 0, any = false;
  items.forEach((it) => {
    const dh = (it.t - nowT) / 3600000;
    if (dh <= 0) {
      const age = -dh; if (age > 120) return;
      any = true;
      past += it.w * Math.pow(0.5, age / 36) * (1 - Math.min(0.24, 0.06 * it.n));   // plan de récup suivi = besoin réduit
    } else if (dh <= 48) { any = true; future += it.w * (dh <= 24 ? 0.5 : 0.25); }   // séance proche = il faut être récupéré avant
  });
  let need = 100 * (1 - Math.exp(-0.9 * (past + 0.6 * future)));
  const ci = (settings.checkins || {})[isoLocal(now)];
  if (ci) { any = true; need += Math.max(-5, Math.min(12, (readinessRaw(ci) - 6) * 1.2)); }
  return { score: Math.max(0, Math.min(100, Math.round(need))), any };
}

function computeScore({ eventType, intensity, fatigue, hoursToNext, age, niveau, weekLoad = 0, loadBonus = null, rpe = null, minutes = null, readiness = 0 }) {
  let s = fatigue * 10;
  s += readiness;
  // Charge cumulée des séances récentes (voir computeLoad).
  if (loadBonus != null) s += loadBonus;
  else if (weekLoad >= 2) s += Math.min(12, (weekLoad - 1) * 4);
  if (rpe && minutes) s += Math.max(2, Math.min(34, Math.round((rpe * minutes) / 24)));   // durée × effort ressenti
  else if (eventType === "match") s += 27;
  else if (intensity === "intense") s += 20;
  else if (intensity === "moyen") s += 10;
  else s += 2;
  if (hoursToNext <= 24) s += 15; else if (hoursToNext <= 48) s += 6; else if (hoursToNext >= 96) s -= 10;
  if (age >= 45) s += 15; else if (age >= 35) s += 8;
  s *= NIVEAU_MULT[niveau] || 1;
  return Math.max(5, Math.min(100, Math.round(s)));
}
const scoreColor = (score) => (score >= 70 ? C.scoreHigh : score >= 40 ? C.scoreMid : C.primary);
// Mot associé au score : la couleur ne doit jamais être le seul indice (daltonisme).
const scoreWord = (score, lang) => (score >= 70 ? tr(lang, { fr: "Intense", en: "Hard", es: "Intenso", pt: "Intenso" }) : score >= 40 ? tr(lang, { fr: "Modéré", en: "Moderate", es: "Moderado", pt: "Moderado" }) : tr(lang, { fr: "Léger", en: "Light", es: "Ligero", pt: "Leve" }));
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
function buildColdHeat(equipement, score, zoneLabel, lang, strength = false) {
  const has = (x) => equipement?.includes(x); const items = [];
  const on = zoneLabel ? tr(lang, { fr: ` (${zoneLabel} en priorité)`, en: ` (${zoneLabel} first)`, es: ` (${zoneLabel} primero)`, pt: ` (${zoneLabel} primeiro)` }) : "";
  if (has("cold_bath") && score >= 45) {
    if (strength) items.push({ type: "froid", delayMin: 300, titre: tr(lang, { fr: "Bain froid / douche froide (plus tard)", en: "Cold bath / cold shower (later)", es: "Baño frío / ducha fría (más tarde)", pt: "Banho frio / ducha fria (mais tarde)" }), texte: tr(lang, { fr: "Après de la musculation, attends au moins 4 à 6 h avant un bain froid : juste après l'effort, il peut freiner les gains de force et de masse musculaire. Utile surtout les jours de grosse fatigue ou de courbatures.", en: "After strength training, wait at least 4-6 h before a cold bath: right after the session it can blunt strength and muscle gains. Most useful on days of heavy fatigue or soreness.", es: "Tras entrenar fuerza, espera al menos 4-6 h antes de un baño frío: justo después puede frenar las ganancias de fuerza y masa muscular. Útil sobre todo en días de mucha fatiga o agujetas.", pt: "Após musculação, espere pelo menos 4-6 h antes de um banho frio: logo após o treino ele pode atrapalhar os ganhos de força e massa muscular. Útil sobretudo em dias de muita fadiga ou dor muscular." }) });
    else items.push({ type: "froid", delayMin: 180, titre: tr(lang, { fr: "Bain froid / douche froide", en: "Cold bath / cold shower", es: "Baño frío / ducha fría", pt: "Banho frio / ducha fria" }), texte: tr(lang, { fr: "10-15 min en eau à 10-15°C dans les 30-60 min après l'effort pour limiter l'inflammation.", en: "10-15 min in 10-15°C water within 30-60 min after training to limit inflammation.", es: "10-15 min en agua a 10-15°C dentro de los 30-60 min tras el esfuerzo para limitar la inflamación.", pt: "10-15 min em água a 10-15°C nos 30-60 min após o esforço para limitar a inflamação." }) });
  }
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
// Conseils d'amélioration de la récup : (1) matériel à envisager selon CE que l'utilisateur
// ne possède pas encore, (2) astuces gratuites. Rien n'est présenté comme indispensable.
function buildAdvice(equipement, sportKey, eventType, score, weekLoad, niveau, lang) {
  const has = (x) => (equipement || []).includes(x);
  const T4 = (fr, en, es, pt) => tr(lang, { fr, en, es, pt });
  const cat = SPORT_CATEGORY[sportKey] || "autre";
  const strength = sportKey === "muscu";
  const buy = [];
  if (!has("foam_roller")) buy.push({ p: 1, price: "15–30 €", t: T4("Un rouleau de massage", "A foam roller", "Un rodillo de espuma", "Um rolo de espuma"), d: T4("Le meilleur rapport utilité/prix : il détend cuisses, mollets et dos en quelques minutes. Choisis une densité moyenne si tu débutes.", "Best value for money: it loosens quads, calves and back in a few minutes. Pick a medium density if you're starting out.", "La mejor relación utilidad/precio: relaja muslos, gemelos y espalda en pocos minutos. Elige densidad media si empiezas.", "Melhor custo-benefício: alivia coxas, panturrilhas e costas em poucos minutos. Escolha densidade média se está começando.") });
  if (!has("massage_ball")) buy.push({ p: 3, price: "5–10 €", t: T4("Une balle de massage", "A massage ball", "Una pelota de masaje", "Uma bola de massagem"), d: T4("Idéale pour les zones que le rouleau n'atteint pas : voûte du pied, fessiers, omoplates. Se glisse dans un sac.", "Ideal for spots the roller can't reach: arch of the foot, glutes, shoulder blades. Fits in a bag.", "Ideal para zonas que el rodillo no alcanza: planta del pie, glúteos, omóplatos. Cabe en una bolsa.", "Ideal para áreas que o rolo não alcança: sola do pé, glúteos, omoplatas. Cabe numa bolsa.") });
  if (!has("mat")) buy.push({ p: 4, price: "15–30 €", t: T4("Un tapis de sol", "A floor mat", "Una colchoneta", "Um tapete de solo"), d: T4("Rend les étirements et le retour au calme plus confortables, surtout à la maison.", "Makes stretching and cool-downs more comfortable, especially at home.", "Hace los estiramientos y la vuelta a la calma más cómodos, sobre todo en casa.", "Torna alongamentos e volta à calma mais confortáveis, principalmente em casa.") });
  if (!has("elastic_bands") && cat !== "natation") buy.push({ p: 2, price: "10–20 €", t: T4("Des bandes élastiques", "Resistance bands", "Bandas elásticas", "Faixas elásticas"), d: T4("Parfaites pour la mobilité et le renforcement léger des épaules, hanches et chevilles : qui peuvent aider à réduire le risque de blessure.", "Great for mobility and light strengthening of shoulders, hips and ankles: which can help reduce injury risk.", "Perfectas para movilidad y refuerzo ligero de hombros, caderas y tobillos: que pueden ayudar a reducir el riesgo de lesiones.", "Ótimas para mobilidade e fortalecimento leve de ombros, quadris e tornozelos: que podem ajudar a reduzir o risco de lesões.") });
  if (!has("ice_pack") && !has("cold_bath") && !strength && score >= 55) buy.push({ p: 2, price: "5–10 €", t: T4("Une poche de froid réutilisable", "A reusable cold pack", "Una bolsa de frío reutilizable", "Uma bolsa de frio reutilizável"), d: T4("Utile pour calmer une zone qui chauffe (cheville, genou) après un gros effort. Toujours avec un tissu entre la poche et la peau.", "Useful to calm a sore spot (ankle, knee) after a hard effort. Always keep a cloth between the pack and your skin.", "Útil para calmar una zona dolorida (tobillo, rodilla) tras un gran esfuerzo. Siempre con una tela entre la bolsa y la piel.", "Útil para acalmar uma área dolorida (tornozelo, joelho) após um grande esforço. Sempre com um pano entre a bolsa e a pele.") });
  if (!has("massage_gun") && score >= 60) buy.push({ p: 5, price: "60–150 €", t: T4("Pistolet de massage (optionnel)", "Massage gun (optional)", "Pistola de masaje (opcional)", "Pistola de massagem (opcional)"), d: T4("Confortable et rapide, mais pas indispensable : un rouleau fait presque le même travail. Jamais sur une zone blessée, un os ou une articulation.", "Comfortable and quick but not essential: a roller does almost the same job. Never on an injured area, a bone or a joint.", "Cómoda y rápida, pero no imprescindible: un rodillo hace casi lo mismo. Nunca sobre una zona lesionada, un hueso o una articulación.", "Confortável e rápida, mas não essencial: um rolo faz quase o mesmo. Nunca em área lesionada, osso ou articulação.") });
  buy.sort((a, b) => a.p - b.p);

  const tips = [];
  tips.push({ p: score >= 50 ? 1 : 3, t: T4("Dors 7 à 9 h", "Sleep 7–9 h", "Duerme 7 a 9 h", "Durma 7 a 9 h"), d: T4("Le sommeil est le premier outil de récupération. Couche-toi à heure régulière et coupe les écrans 30 min avant.", "Sleep is the #1 recovery tool. Go to bed at a regular time and cut screens 30 min before.", "El sueño es la primera herramienta de recuperación. Acuéstate a hora regular y apaga pantallas 30 min antes.", "O sono é a principal ferramenta de recuperação. Deite em horário regular e desligue as telas 30 min antes.") });
  tips.push({ p: 2, t: T4("Des protéines à chaque repas", "Protein at every meal", "Proteína en cada comida", "Proteína em cada refeição"), d: T4("Répartis-les sur la journée (20 à 40 g par repas) plutôt que tout le soir : c'est plus efficace pour réparer les muscles.", "Spread them across the day (20–40 g per meal) rather than all at night: more effective for muscle repair.", "Repártela durante el día (20 a 40 g por comida) en vez de todo por la noche: es más eficaz para reparar el músculo.", "Distribua ao longo do dia (20 a 40 g por refeição) em vez de tudo à noite: é mais eficaz para reparar os músculos.") });
  if (score >= 40) tips.push({ p: 2, t: T4("Surveille la couleur de ton urine", "Check your urine colour", "Vigila el color de tu orina", "Observe a cor da urina"), d: T4("Jaune très pâle = bien hydraté. Foncé = bois davantage, et pense à saler un peu tes repas si tu transpires beaucoup.", "Pale yellow = well hydrated. Dark = drink more, and salt your meals a little if you sweat a lot.", "Amarillo muy pálido = bien hidratado. Oscuro = bebe más, y sala un poco las comidas si sudas mucho.", "Amarelo bem claro = bem hidratado. Escuro = beba mais e use um pouco de sal nas refeições se suar muito.") });
  if (score >= 50) tips.push({ p: 3, t: T4("Bouge doucement le lendemain", "Move gently the next day", "Muévete suave al día siguiente", "Mexa-se suavemente no dia seguinte"), d: T4("10 à 20 min de marche, vélo tranquille ou mobilité : ça relance la circulation mieux que le canapé.", "10–20 min of walking, easy cycling or mobility: it gets circulation going better than the couch.", "10 a 20 min de caminata, bici suave o movilidad: reactiva la circulación mejor que el sofá.", "10 a 20 min de caminhada, bike leve ou mobilidade: ativa a circulação melhor que o sofá.") });
  if (weekLoad >= 3 || niveau === "avance" || niveau === "competition") tips.push({ p: 1, t: T4("Prévois une semaine allégée", "Plan a lighter week", "Planifica una semana ligera", "Planeje uma semana leve"), d: T4("Toutes les 4 à 6 semaines, réduis le volume d'environ un tiers : le corps progresse pendant le repos, pas seulement pendant l'effort.", "Every 4–6 weeks, cut volume by about a third: the body improves during rest, not only during effort.", "Cada 4 a 6 semanas, reduce el volumen en un tercio: el cuerpo progresa en el descanso, no solo en el esfuerzo.", "A cada 4 a 6 semanas, reduza o volume em cerca de um terço: o corpo evolui no descanso, não só no esforço.") });
  if (eventType === "match" || score >= 65) tips.push({ p: 4, t: T4("Limite l'alcool ce soir-là", "Limit alcohol that night", "Limita el alcohol esa noche", "Limite o álcool nessa noite"), d: T4("Il dégrade le sommeil et ralentit la réparation musculaire, surtout après un gros effort.", "It worsens sleep and slows muscle repair, especially after a hard effort.", "Empeora el sueño y frena la reparación muscular, sobre todo tras un gran esfuerzo.", "Prejudica o sono e atrasa a reparação muscular, principalmente após um grande esforço.") });
  const sp = {
    running: [T4("Surveille l'usure de tes chaussures", "Track your shoe wear", "Controla el desgaste de tus zapatillas", "Acompanhe o desgaste dos tênis"), T4("Une paire dure en général 600 à 800 km. Alterner deux paires réduit un peu les contraintes répétées.", "A pair usually lasts 600–800 km. Rotating two pairs slightly reduces repeated stress.", "Un par suele durar 600 a 800 km. Alternar dos pares reduce algo el estrés repetido.", "Um par costuma durar 600 a 800 km. Alternar dois pares reduz um pouco o estresse repetido.")],
    cyclisme: [T4("Vérifie ton réglage de selle", "Check your saddle setup", "Revisa la altura del sillín", "Verifique a altura do selim"), T4("Une selle trop haute ou trop basse charge genoux et bas du dos. Un réglage en magasin prend 20 minutes.", "A saddle too high or low loads knees and lower back. A shop fitting takes about 20 minutes.", "Un sillín muy alto o bajo carga rodillas y lumbares. Un ajuste en tienda lleva 20 minutos.", "Um selim alto ou baixo demais sobrecarrega joelhos e lombar. Um ajuste em loja leva 20 minutos.")],
    muscu: [T4("Alterne les groupes musculaires", "Rotate muscle groups", "Alterna grupos musculares", "Alterne grupos musculares"), T4("Laisse 48 h entre deux séances sur les mêmes muscles. Après la muscu, garde le froid intense pour un autre jour.", "Leave 48 h between sessions on the same muscles. After lifting, save intense cold for another day.", "Deja 48 h entre sesiones de los mismos músculos. Tras la musculación, deja el frío intenso para otro día.", "Deixe 48 h entre sessões dos mesmos músculos. Após a musculação, deixe o frio intenso para outro dia.")],
    natation: [T4("Entretiens la mobilité des épaules", "Keep your shoulders mobile", "Cuida la movilidad de los hombros", "Cuide da mobilidade dos ombros"), T4("Quelques rotations avec une bande élastique après la séance peuvent aider à protéger les épaules, très sollicitées en natation.", "A few rotations with a resistance band after the session can help protect the shoulders, which are heavily used in swimming.", "Unas rotaciones con banda elástica tras la sesión pueden ayudar a proteger los hombros, muy exigidos al nadar.", "Algumas rotações com faixa elástica após a sessão podem ajudar a proteger os ombros, muito exigidos na natação.")],
    tennis: [T4("Renforce épaule et poignet", "Strengthen shoulder and wrist", "Refuerza hombro y muñeca", "Fortaleça ombro e punho"), T4("Un peu de renforcement des rotateurs et des avant-bras peut aider à limiter les douleurs au coude et à l'épaule.", "A little rotator-cuff and forearm strengthening can help reduce elbow and shoulder pain.", "Un poco de refuerzo de manguito rotador y antebrazos puede ayudar a reducir el dolor de codo y hombro.", "Um pouco de fortalecimento de manguito rotador e antebraços pode ajudar a reduzir dores no cotovelo e ombro.")],
  };
  if (sp[sportKey]) tips.push({ p: 2, t: sp[sportKey][0], d: sp[sportKey][1] });
  else if (cat === "team") tips.push({ p: 3, t: T4("Soigne tes chevilles et tes ischios", "Look after ankles and hamstrings", "Cuida tobillos e isquios", "Cuide de tornozelos e posteriores"), d: T4("Ce sont les zones les plus touchées dans les sports collectifs : 5 min d'équilibre et de renfo léger avant l'entraînement peuvent aider.", "These are the most injured areas in team sports: 5 min of balance and light strengthening before training can help.", "Son las zonas más lesionadas en deportes de equipo: 5 min de equilibrio y refuerzo ligero antes de entrenar pueden ayudar.", "São as áreas mais lesionadas em esportes coletivos: 5 min de equilíbrio e reforço leve antes do treino podem ajudar.") });
  tips.sort((a, b) => a.p - b.p);
  return { buy: buy.slice(0, 3), tips: tips.slice(0, 4), hasAll: buy.length === 0 };
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
  const minutes = Number(input.minutes) > 0 ? Number(input.minutes) : null;
  const rpe = minutes && Number(input.rpe) > 0 ? Number(input.rpe) : null;
  // Le bilan du jour compte pour les séances « maintenant » (pas pour celles prévues plus tard).
  const ci = restDay || input.loadAt ? null : (LOAD_CTX.checkins || {})[isoLocal()] || null;
  const age = computeAge(profile.dateNaissance);
  const ld = restDay ? { bonus: 0, count7: 0 } : computeLoad(input.loadAt || new Date());
  const weekLoad = input.weekLoad ?? ld.count7;
  const score = computeScore({ eventType, intensity, fatigue, hoursToNext, age, niveau: profile.niveau, weekLoad, loadBonus: ld.bonus, rpe, minutes, readiness: readinessBonus(ci) });
  const sportKey = sport || profile.sports?.[0] || "autre";
  const baseKeys = computeMuscleKeys(sportKey, muscuZones);
  const soreKeys = ci && Array.isArray(ci.zones) ? ci.zones.flatMap((z) => SORE_ZONES[z] || []) : [];
  const muscleKeys = [...new Set([...baseKeys, ...soreKeys])];
  const stretches = muscleKeys.map((k) => { const d = STRETCH_DB[k] || STRETCH_DB.corps_entier; return { key: k, ...(d[lang] || d.fr) }; });
  const warmup = restDay ? [] : buildWarmup(muscleKeys, lang);
  const zones = zonesLabel(muscleKeys, lang);
  const mealSeed = seed || `${Date.now()}-${Math.random()}`;
  return {
    id: Date.now() + Math.random(), date: new Date().toISOString(), heure: heure || null,
    eventType, intensity, fatigue, hoursToNext, sport: sportKey, muscuZones: muscuZones || [], lang, restDay: !!restDay, weekLoad, minutes, rpe, readiness: readinessScore(ci), soreZones: ci && ci.zones ? ci.zones : [],
    score, duree: recoveryDurationLabel(score, lang), stretches, warmup,
    massage: buildMassage(profile.equipement, zones, lang), coldHeat: buildColdHeat(profile.equipement, score, zones, lang, sportKey === "muscu"),
    sommeil: sleepHours(score, eventType), hydratation: hydrationLiters(Number(profile.poids), eventType, intensity),
    produits: buildProducts(profile.equipement, eventType, score, lang),
    conseils: buildAdvice(profile.equipement, sportKey, eventType, score, weekLoad, profile.niveau, lang),
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
    plan: generatePlan(profile, { eventType: e.type, intensity: e.intensity || "moyen", fatigue: 3, hoursToNext: 48, sport: e.sport, heure: e.heure, muscuZones: e.muscuZones, seed: date + "-" + e.id, loadAt: new Date(date + "T00:00:00") }, lang),
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
    massage: buildMassage(profile.equipement, zones, lang), coldHeat: buildColdHeat(profile.equipement, score, zones, lang, sportEntries.some((e) => e.sport === "muscu")),
    sommeil, hydratation, produits: buildProducts(profile.equipement, ref.eventType, score, lang), conseils: buildAdvice(profile.equipement, sportEntries[0]?.sport || "autre", ref.eventType, score, 0, profile.niveau, lang), meals: ref.meals,
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
    urgentMsg = S("Arrête immédiatement l'activité. En cas de perte de connaissance, vomissements, confusion ou vision trouble, consulte les urgences sans délai.", "Stop the activity immediately. If you experience loss of consciousness, vomiting, confusion or blurred vision, go to the emergency room right away.", "Detén la actividad de inmediato. Si hay pérdida de conciencia, vómitos, confusión o visión borrosa, acude a urgencias sin demora.", "Pare a atividade imediatamente. Em caso de perda de consciência, vômitos, confusão ou visão turva, procure um pronto-socorro sem demora.");
    specialistes = [S("Médecin", "Doctor", "Médico", "Médico"), S("Urgences si symptômes neurologiques", "ER if neurological symptoms", "Urgencias si hay síntomas neurológicos", "Emergência se houver sintomas neurológicos")];
    conseil = S("Repos complet, pas de reprise avant avis médical, même si les symptômes semblent légers.", "Complete rest, no return to activity before medical advice, even if symptoms seem mild.", "Reposo completo, no reanudar sin consejo médico, aunque los síntomas parezcan leves.", "Repouso completo, não retomar sem avaliação médica, mesmo que os sintomas pareçam leves.");
  } else if (symptomKey === "fourmillements") {
    urgent = true;
    urgentMsg = S("Des fourmillements ou une perte de sensation qui persistent doivent être évalués rapidement par un médecin.", "Persistent tingling or loss of sensation should be checked quickly by a doctor.", "El hormigueo o la pérdida de sensibilidad persistentes deben ser evaluados rápidamente por un médico.", "Formigamento ou perda de sensibilidade persistentes devem ser avaliados rapidamente por um médico.");
    specialistes = [S("Médecin généraliste", "General practitioner", "Médico general", "Clínico geral"), S("Neurologue si persistance", "Neurologist if it persists", "Neurólogo si persiste", "Neurologista se persistir")];
    conseil = S("Évite de solliciter la zone concernée en attendant la consultation.", "Avoid straining the affected area until you see a doctor.", "Evita forzar la zona afectada mientras esperas la consulta.", "Evite forçar a área afetada enquanto aguarda a consulta.");
  } else if (symptomKey === "choc") {
    specialistes = [S("Médecin (radiographie possible)", "Doctor (X-ray may be needed)", "Médico (posible radiografía)", "Médico (possível radiografia)")];
    conseil = S("Une imagerie peut être nécessaire pour écarter une fracture ou fissure. Glace et repos en attendant.", "Imaging may be needed to rule out a fracture. Ice and rest in the meantime.", "Puede ser necesaria una prueba de imagen para descartar una fractura. Hielo y reposo mientras tanto.", "Pode ser necessário exame de imagem para descartar fratura. Gelo e repouso enquanto isso.");
  } else if (symptomKey === "gonflement" && (partKey === "genou" || partKey === "cheville")) {
    specialistes = [S("Médecin du sport", "Sports physician", "Médico deportivo", "Médico do esporte"), S("Kinésithérapeute pour le suivi", "Physiotherapist for follow-up", "Fisioterapeuta para el seguimiento", "Fisioterapeuta para acompanhamento")];
    conseil = S("Protocole PEACE & LOVE, recommandé aujourd'hui : les premiers jours, protège la zone (repos relatif), surélève-la, comprime légèrement, évite de prendre des anti-inflammatoires sans avis médical. Dès que la douleur le permet, reprends progressivement le mouvement (marche, mobilité douce). Consulte rapidement si ça gonfle beaucoup ou si tu ne peux pas poser le pied.", "PEACE & LOVE protocol, recommended today: for the first days, protect the area (relative rest), elevate it, compress lightly, and avoid anti-inflammatory drugs without medical advice. As soon as pain allows, gradually restart movement (walking, gentle mobility). See a doctor quickly if it swells a lot or you can't put weight on it.", "Protocolo PEACE & LOVE, recomendado hoy: los primeros días protege la zona (reposo relativo), elévala, comprime ligeramente y evita los antiinflamatorios sin consejo médico. En cuanto el dolor lo permita, retoma el movimiento poco a poco (caminar, movilidad suave). Consulta pronto si se hincha mucho o no puedes apoyar el pie.", "Protocolo PEACE & LOVE, recomendado hoje: nos primeiros dias proteja a área (repouso relativo), eleve-a, comprima levemente e evite anti-inflamatórios sem orientação médica. Assim que a dor permitir, retome o movimento aos poucos (caminhada, mobilidade suave). Procure um médico rapidamente se inchar muito ou se não conseguir apoiar o pé.");
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
  const dow = (new Date(dateIso + "T12:00:00").getDay() + 6) % 7;
  const isException = Object.prototype.hasOwnProperty.call(exceptions, dateIso);
  return { entries: isException ? exceptions[dateIso] : (weeklyDays[dow] || []), isException, dow };
}
/* ============================================================
   SOMMEIL & RAPPELS (coucher, étirements)
   Les réglages vivent dans la table `user_settings`. L'app calcule à l'avance
   la liste des rappels des 14 prochains jours (`queue`) ; le serveur n'a plus
   qu'à envoyer ceux dont l'heure est arrivée.
   ============================================================ */
const defaultSettings = () => ({ wake: ["07:00", "07:00", "07:00", "07:00", "07:00", "07:00", "07:00"], sleepOn: false, sleepScope: "sessions", stretchOn: false, stretchDelay: 30, queue: [] });
const toMin = (hhmm) => { const [h, m] = String(hhmm || "").split(":").map(Number); return (Number.isFinite(h) && Number.isFinite(m)) ? h * 60 + m : null; };
const fmtHM = (min) => { const m = ((Math.round(min) % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); };
const dowOfIso = (iso) => (new Date(iso + "T12:00:00").getDay() + 6) % 7;
const addDaysIso = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return isoLocal(d); };
const fmtHoursLabel = (h) => (h % 1 ? `${Math.floor(h)}h30` : `${h}h`);

// Heures de sommeil conseillées pour la nuit qui suit le jour `dateIso`
// (même logique que le plan de récup). null = pas de séance ce jour-là.
function sleepHoursForDay(entries, profile, dateIso, sessionsLog) {
  const sp = (entries || []).filter((e) => SPORT_TYPES.includes(e.type));
  const logged = (sessionsLog || []).filter((x) => x.date && !x.restDay && x.sommeil && isoLocal(new Date(x.date)) === dateIso);
  if (!sp.length && !logged.length) return null;
  const age = computeAge(profile.dateNaissance);
  let h = 0;
  sp.forEach((e) => {
    const sc = computeScore({ eventType: e.type, intensity: e.intensity || "moyen", fatigue: 3, hoursToNext: 48, age, niveau: profile.niveau });
    h = Math.max(h, sleepHours(sc, e.type));
  });
  if (sp.length > 1) h = Math.min(10, h + 0.5);
  logged.forEach((x) => { h = Math.max(h, Number(x.sommeil) || 0); });
  return h;
}

function buildReminderQueue(cfg, settings, profile, sessionsLog, lang, now = new Date()) {
  const out = [];
  if (!profile || !(settings.sleepOn || settings.stretchOn)) return out;
  const weekly = cfg?.weeklyDays || emptyWeekly(); const exc = cfg?.exceptions || {};
  const todayIso = isoLocal(now); const nowAbs = now.getHours() * 60 + now.getMinutes();
  const T4 = (fr, en, es, pt) => tr(lang, { fr, en, es, pt });
  const seen = new Set();
  const push = (item) => { const k = `${item.date}-${item.kind}-${item.time}`; if (seen.has(k)) return; seen.add(k); out.push(item); };
  for (let i = 0; i < 14; i++) {
    const date = addDaysIso(todayIso, i);
    const { entries } = getDayEntries(weekly, exc, date);
    if (settings.sleepOn) {
      let hrs = sleepHoursForDay(entries, profile, date, sessionsLog);
      if (hrs == null && settings.sleepScope === "all") hrs = 8;
      const wakeStr = (settings.wake || [])[dowOfIso(addDaysIso(date, 1))];
      const wake = toMin(wakeStr);
      if (hrs != null && wake != null) {
        const bedAbs = 1440 + wake - Math.round(hrs * 60);   // minutes depuis 00:00 du jour `date`
        const remAbs = bedAbs - 30;
        if (i * 1440 + remAbs > nowAbs) {
          const bed = fmtHM(bedAbs);
          push({ date: remAbs >= 1440 ? addDaysIso(date, 1) : date, time: fmtHM(remAbs), kind: "sleep", bed, wake: wakeStr, hours: hrs,
            body: T4(`Dodo dans 30 min 🌙 Couche-toi à ${bed} pour ${fmtHoursLabel(hrs)} de sommeil (réveil ${wakeStr}).`, `Bedtime in 30 min 🌙 Be in bed by ${bed} for ${fmtHoursLabel(hrs)} of sleep (wake-up ${wakeStr}).`, `Hora de dormir en 30 min 🌙 Acuéstate a las ${bed} para dormir ${fmtHoursLabel(hrs)} (despertar ${wakeStr}).`, `Hora de dormir em 30 min 🌙 Deite às ${bed} para ${fmtHoursLabel(hrs)} de sono (despertar ${wakeStr}).`) });
        }
      }
    }
    if (settings.stretchOn) {
      (entries || []).filter((e) => SPORT_TYPES.includes(e.type)).forEach((e) => {
        const base = toMin(e.heure);
        const t = base != null ? base + (Number(settings.stretchDelay) || 30) : 19 * 60;
        if (t >= 1440 || i * 1440 + t <= nowAbs) return;
        const zones = zonesLabel(computeMuscleKeys(e.sport, e.muscuZones), lang);
        push({ date, time: fmtHM(t), kind: "stretch", sport: e.sport,
          body: T4(`Étirements 🧘 5 à 10 min${zones ? ` (${zones})` : ""} pour accélérer ta récup.`, `Stretch time 🧘 5–10 min${zones ? ` (${zones})` : ""} to speed up your recovery.`, `Hora de estirar 🧘 5 a 10 min${zones ? ` (${zones})` : ""} para acelerar tu recuperación.`, `Hora de alongar 🧘 5 a 10 min${zones ? ` (${zones})` : ""} para acelerar sua recuperação.`) });
      });
    }
  }
  return out.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
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
    const iso = isoLocal(d);
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
// ne devient effectif qu'une fois que la personne clique sur le lien reçu.
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
  const [profileRows, sessionRows, plannerRows, injuryRows, proRows, settingsRows] = await Promise.all([
    sbSelect("profiles", `id=eq.${userId}&select=*`, accessToken),
    sbSelect("sessions_log", `user_id=eq.${userId}&select=*&order=created_at`, accessToken),
    sbSelect("planner_config", `user_id=eq.${userId}&select=*`, accessToken),
    sbSelect("injuries", `user_id=eq.${userId}&select=*&order=created_at`, accessToken),
    sbSelect("subscriptions", `user_id=eq.${userId}&select=*`, accessToken),
    sbSelect("user_settings", `user_id=eq.${userId}&select=*`, accessToken),
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
    settings: { ...defaultSettings(), ...((settingsRows && settingsRows[0] && settingsRows[0].data) || {}) },
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
function Field({ label, children }) { return <div className="mb-5"><label className="block text-xs font-semibold mb-1.5 tracking-wide uppercase" style={{ color: C.textMuted, ...fontBody }}>{label}</label>{children}</div>; }
const inputStyle = { background: C.glassSoft, border: `1px solid ${C.glassBorder}`, color: C.text, backdropFilter: "blur(10px)", ...fontBody };
function TextInput(props) { return <input {...props} className="w-full rounded-xl px-3 py-2.5 outline-none" style={{ ...inputStyle, fontSize: 16, minWidth: 0, maxWidth: "100%", boxSizing: "border-box", ...(["date", "time", "datetime-local", "month"].includes(props.type) ? { WebkitAppearance: "none", appearance: "none", textAlign: "left", minHeight: 46, display: "block", width: "100%" } : {}), ...props.style }} />; }
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
  return <div className={`rounded-[22px] p-5 ${className}`} style={{ background: C.glass, backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)", border: `1px solid ${C.glassBorder}`, boxShadow: `inset 0 1px 0 ${C.glassHighlight}, 0 20px 36px -22px rgba(0,0,0,0.65)`, ...style }}>{children}</div>;
}
function HeroCard({ children, accent, style, className = "" }) {
  const a = accent || C.primary;
  return <div className={`rounded-[26px] p-5 relative overflow-hidden ${className}`} style={{ background: `linear-gradient(155deg, ${a}3D 0%, ${C.glassStrong} 55%, ${C.glass} 100%)`, backdropFilter: "blur(26px)", WebkitBackdropFilter: "blur(26px)", border: `1px solid ${C.glassBorder}`, boxShadow: `inset 0 1px 0 ${C.glassHighlight}, 0 24px 48px -22px ${a}33`, ...style }}>{children}</div>;
}
function Pill({ children, active, onClick, color, small }) {
  return <button onClick={onClick} className={`rounded-full font-semibold transition-colors ${small ? "px-2.5 py-1.5 text-[11px]" : "px-3 py-2 text-xs"}`} style={{ background: active ? (color || C.primary) : C.glassSoft, color: active ? "#052821" : C.textMuted, border: `1px solid ${active ? (color || C.primary) : C.glassBorder}`, backdropFilter: "blur(10px)", ...fontBody }}>{children}</button>;
}
function SegmentedControl({ options, value, onChange, small, colorMap }) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const activeColor = (colorMap && colorMap[value]) || C.primary;
  return (
    <div className={`relative flex rounded-2xl ${small ? "p-0.5" : "p-1"}`} style={{ background: C.glassSoft, border: `1px solid ${C.glassBorder}`, backdropFilter: "blur(10px)" }}>
      <div className="absolute top-0.5 bottom-0.5 rounded-xl transition-all duration-300 ease-out" style={{ left: `calc(${100 / options.length}% * ${idx} + 2px)`, width: `calc(${100 / options.length}% - 4px)`, background: activeColor === C.primary ? gradPrimary : activeColor, boxShadow: `0 4px 12px -4px ${activeColor}77` }} />
      {options.map((opt) => (
        <button key={opt.value} type="button" onClick={() => onChange(opt.value)} className={`relative z-10 flex-1 font-semibold rounded-xl transition-colors ${small ? "py-2 text-[11px]" : "py-2.5 text-xs"}`} style={{ color: value === opt.value ? "#052821" : C.textMuted, ...fontBody }}>{opt.label}</button>
      ))}
    </div>
  );
}
function SectionTitle({ icon: Icon, children, action }) { return <div className="flex items-center justify-between mb-4"><div className="flex items-center gap-2">{Icon && <Icon size={16} style={{ color: C.primary }} />}<h3 className="text-sm font-bold tracking-tight" style={{ color: C.text, ...fontDisplay }}>{children}</h3></div>{action}</div>; }
function Badge({ children, color }) { return <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ background: color + "22", color, backdropFilter: "blur(6px)", ...fontBody }}>{children}</span>; }
function LargeHeader({ title, subtitle, right }) {
  return (
    <div className="flex items-end justify-between mb-7 mt-2">
      <div>
        {subtitle && <p className="text-[13px] mb-0.5" style={{ color: C.textMuted, ...fontBody }}>{subtitle}</p>}
        <h1 className="text-[30px] font-extrabold tracking-tight leading-none" style={{ color: C.text, ...fontDisplay }}>{title}</h1>
      </div>
      {right}
    </div>
  );
}
/* Section repliable : garde tout le contenu mais le range proprement */
function Accordion({ icon: Icon, title, hint, defaultOpen, color, children, className = "mb-4" }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const c = color || C.primary;
  return (
    <div className={`rounded-[22px] overflow-hidden ${className}`} style={{ background: C.glass, backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)", border: `1px solid ${C.glassBorder}`, boxShadow: `inset 0 1px 0 ${C.glassHighlight}, 0 20px 36px -22px rgba(0,0,0,0.65)` }}>
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-5 py-4 text-left">
        {Icon && <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: c + "22" }}><Icon size={16} style={{ color: c }} /></div>}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold tracking-tight" style={{ color: C.text, ...fontDisplay }}>{title}</p>
          {hint && <p className="text-xs mt-0.5" style={{ color: C.textFaint, ...fontBody }}>{hint}</p>}
        </div>
        <ChevronDown size={16} style={{ color: C.textMuted, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </button>
      {open && <div className="px-5 pb-5 pt-1">{children}</div>}
    </div>
  );
}
/* Petit texte d'aide discret, replié par défaut */
function InfoToggle({ label, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-6">
      <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-1.5 text-xs font-semibold py-2" style={{ color: C.primary, ...fontBody }}>
        <Sparkles size={12} /> {label} <ChevronDown size={12} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </button>
      {open && <p className="text-xs leading-relaxed mt-2" style={{ color: C.textMuted, ...fontBody }}>{children}</p>}
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
        <p className="text-sm font-semibold break-words" style={{ color: C.text, ...fontBody }}>{title}</p>
        {subtitle && <p className="text-xs break-words" style={{ color: C.textFaint, ...fontBody }}>{subtitle}</p>}
      </div>
      {right}
      {chevron && <ChevronRightIcon size={15} style={{ color: C.textFaint }} />}
    </Comp>
  );
}
function LegalFooter({ className = "" }) {
  const { lang } = useLang();
  const a = { color: C.textMuted, textDecoration: "underline" };
  return (
    <p className={`text-[11px] text-center leading-relaxed ${className}`} style={{ color: C.textFaint, ...fontBody }}>
      <a href={`${LEGAL_BASE}/conditions.html`} target="_blank" rel="noopener noreferrer" style={a}>{tr(lang, { fr: "Conditions d'utilisation", en: "Terms of use", es: "Condiciones de uso", pt: "Termos de uso" })}</a>
      {" · "}
      <a href={`${LEGAL_BASE}/confidentialite.html`} target="_blank" rel="noopener noreferrer" style={a}>{tr(lang, { fr: "Confidentialité", en: "Privacy", es: "Privacidad", pt: "Privacidade" })}</a>
    </p>
  );
}
function IconTile({ icon: Icon, label, onClick, color }) {
  const c = color || C.primary;
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 flex-1 min-w-0">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: `linear-gradient(155deg, ${c}33 0%, ${c}14 100%)`, border: `1px solid ${c}40`, backdropFilter: "blur(12px)", boxShadow: `0 8px 16px -8px ${c}55` }}><Icon size={22} style={{ color: c }} /></div>
      <span className="text-[11px] font-semibold text-center leading-tight break-words w-full" style={{ color: C.textMuted, ...fontBody }}>{label}</span>
    </button>
  );
}
function LanguageSwitcher({ compact }) {
  const { lang, setLang } = useLang();
  return (
    <div className={`flex gap-1.5 ${compact ? "" : "flex-wrap"}`}>
      {LANGS.map((l) => (
        <button key={l} onClick={() => setLang(l)} className="px-2.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1" style={{ background: lang === l ? C.primary : C.glassSoft, color: lang === l ? "#052821" : C.textMuted, border: `1px solid ${lang === l ? C.primary : C.glassBorder}`, backdropFilter: "blur(8px)", ...fontBody }}>
          <span>{LANG_META[l].flag}</span>{compact ? l.toUpperCase() : LANG_META[l].label}
        </button>
      ))}
    </div>
  );
}

function RecoveryDial({ score, label, sub, size = 200 }) {
  const compact = size < 175; // petit cadran : le libellé passe sous le cercle pour ne pas toucher l'anneau
  const r = 80, circ = 2 * Math.PI * r, offset = circ * (1 - score / 100), col = scoreColor(score);
  return (
    <div className="flex flex-col items-center">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 200 200" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="100" cy="100" r={r} fill="none" stroke={C.border} strokeWidth="14" />
          <circle cx="100" cy="100" r={r} fill="none" stroke={col} strokeWidth="14" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.8s ease, stroke 0.8s ease", filter: `drop-shadow(0 0 18px ${col}99)` }} />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span style={{ ...fontMono, color: col, fontSize: compact ? 38 : 40, fontWeight: 600, lineHeight: 1 }}>{score}</span>
          {!compact && <span className="text-[11px] uppercase tracking-widest mt-1 text-center px-4" style={{ color: C.textMuted, ...fontBody }}>{label}</span>}
        </div>
      </div>
      {compact && <span className="text-[11px] uppercase tracking-widest mt-2 text-center px-2" style={{ color: C.textMuted, ...fontBody }}>{label}</span>}
      {sub && <span className="text-[12px] mt-3 font-semibold text-center px-2" style={{ color: col, ...fontBody }}>{sub}</span>}
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
      <button onClick={() => onChange({ ...value, notify: !value.notify })} className="flex items-center gap-2 mb-1 py-2">
        <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: value.notify ? C.rdv : "transparent", border: `1px solid ${value.notify ? C.rdv : C.border}` }}>{value.notify && <Check size={11} color="#052821" />}</div>
        <span className="text-xs" style={{ color: C.text, ...fontBody }}>{T.notify}</span>
      </button>
      {value.notify && <div className="mb-1"><TextInput type="time" value={value.notifyTime} onChange={(e) => onChange({ ...value, notifyTime: e.target.value })} /></div>}
    </div>
  );
}

/* ============================================================
   PLAN TABS
   ============================================================ */

/* ============================================================
   SUIVI : bilan du jour, suivi du plan de récup, récap de la semaine
   Les données vivent dans user_settings.data (checkins, done) : pas de nouvelle table.
   ============================================================ */
const TrackCtx = createContext({ settings: {}, setCheckin: () => {}, toggleDone: () => {} });
const useTrack = () => useContext(TrackCtx);
const DONE_ITEMS = ["hydra", "stretch", "meal", "sleep"];

function ScalePicker({ label, lowLabel, highLabel, value, onChange }) {
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold mb-1.5" style={{ color: C.text, ...fontBody }}>{label}</p>
      <div className="flex gap-1.5" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} onClick={() => onChange(n)} className="flex-1 rounded-xl text-sm font-bold transition-colors" style={{ minHeight: 44, background: value === n ? gradPrimary : C.surface, color: value === n ? "#052821" : C.textMuted, border: `1px solid ${value === n ? "transparent" : C.border}`, ...fontMono }}>{n}</button>
        ))}
      </div>
      <div className="flex justify-between mt-1 px-0.5"><span className="text-[11px]" style={{ color: C.textFaint, ...fontBody }}>{lowLabel}</span><span className="text-[11px]" style={{ color: C.textFaint, ...fontBody }}>{highLabel}</span></div>
    </div>
  );
}

function CheckinCard({ asPage, onDone }) {
  const { lang } = useLang();
  const { settings, setCheckin } = useTrack();
  const today = isoLocal();
  const saved = (settings.checkins || {})[today];
  const [editing, setEditing] = useState(!!asPage);
  const [v, setV] = useState(saved ? { sleep: saved.sleep, sore: saved.sore, stress: saved.stress, energy: saved.energy, zones: saved.zones || [] } : { sleep: 3, sore: 2, stress: 2, energy: 3, zones: [] });
  const T = {
    title: tr(lang, { fr: "Bilan du jour", en: "Daily check-in", es: "Chequeo del día", pt: "Check-in do dia" }),
    sub: tr(lang, { fr: "4 touches pour affiner tes conseils et ton score", en: "4 taps to fine-tune your advice and score", es: "4 toques para afinar tus consejos y tu puntuación", pt: "4 toques para ajustar seus conselhos e sua pontuação" }),
    sleep: tr(lang, { fr: "Sommeil de la nuit", en: "Last night's sleep", es: "Sueño de la noche", pt: "Sono da noite" }),
    sleepLo: tr(lang, { fr: "mauvais", en: "poor", es: "malo", pt: "ruim" }), sleepHi: tr(lang, { fr: "excellent", en: "excellent", es: "excelente", pt: "excelente" }),
    sore: tr(lang, { fr: "Courbatures", en: "Soreness", es: "Agujetas", pt: "Dor muscular" }),
    soreLo: tr(lang, { fr: "aucune", en: "none", es: "ninguna", pt: "nenhuma" }), soreHi: tr(lang, { fr: "fortes", en: "strong", es: "fuertes", pt: "fortes" }),
    stress: tr(lang, { fr: "Stress", en: "Stress", es: "Estrés", pt: "Estresse" }),
    stressLo: tr(lang, { fr: "calme", en: "calm", es: "calma", pt: "calmo" }), stressHi: tr(lang, { fr: "élevé", en: "high", es: "alto", pt: "alto" }),
    energy: tr(lang, { fr: "Énergie", en: "Energy", es: "Energía", pt: "Energia" }),
    energyLo: tr(lang, { fr: "faible", en: "low", es: "baja", pt: "baixa" }), energyHi: tr(lang, { fr: "haute", en: "high", es: "alta", pt: "alta" }),
    zones: tr(lang, { fr: "Zones sensibles (optionnel)", en: "Sore areas (optional)", es: "Zonas sensibles (opcional)", pt: "Áreas sensíveis (opcional)" }),
    save: tr(lang, { fr: "Enregistrer mon bilan", en: "Save my check-in", es: "Guardar mi chequeo", pt: "Salvar meu check-in" }),
    form: tr(lang, { fr: "Forme du jour", en: "Today's form", es: "Forma de hoy", pt: "Forma de hoje" }),
    edit: tr(lang, { fr: "Modifier", en: "Edit", es: "Modificar", pt: "Editar" }),
    taken: tr(lang, { fr: "Pris en compte dans le score et les étirements de tes prochaines séances.", en: "Factored into the score and stretches of your next sessions.", es: "Se tiene en cuenta en la puntuación y los estiramientos de tus próximas sesiones.", pt: "Considerado na pontuação e nos alongamentos das suas próximas sessões." }),
    sensitive: tr(lang, { fr: "Zones sensibles", en: "Sore areas", es: "Zonas sensibles", pt: "Áreas sensíveis" }),
  };
  const zoneLabels = { jambes: tr(lang, { fr: "Jambes", en: "Legs", es: "Piernas", pt: "Pernas" }), dos: tr(lang, { fr: "Dos", en: "Back", es: "Espalda", pt: "Costas" }), epaules: tr(lang, { fr: "Épaules", en: "Shoulders", es: "Hombros", pt: "Ombros" }), bras: tr(lang, { fr: "Bras", en: "Arms", es: "Brazos", pt: "Braços" }), cou: tr(lang, { fr: "Cou", en: "Neck", es: "Cuello", pt: "Pescoço" }), hanches: tr(lang, { fr: "Hanches", en: "Hips", es: "Caderas", pt: "Quadris" }) };
  const word = (r) => (r >= 70 ? tr(lang, { fr: "Bonne forme", en: "Good form", es: "Buena forma", pt: "Boa forma" }) : r >= 40 ? tr(lang, { fr: "Forme moyenne", en: "Average form", es: "Forma media", pt: "Forma média" }) : tr(lang, { fr: "Récupération à privilégier", en: "Prioritise recovery", es: "Prioriza la recuperación", pt: "Priorize a recuperação" }));
  const tip = (r) => (r >= 70 ? tr(lang, { fr: "Tu peux suivre ton programme comme prévu.", en: "You can follow your program as planned.", es: "Puedes seguir tu programa como estaba previsto.", pt: "Você pode seguir seu programa como planejado." }) : r >= 40 ? tr(lang, { fr: "Écoute ton corps et soigne l'hydratation et le sommeil.", en: "Listen to your body and take care of hydration and sleep.", es: "Escucha a tu cuerpo y cuida la hidratación y el sueño.", pt: "Ouça seu corpo e cuide da hidratação e do sono." }) : tr(lang, { fr: "Pense à alléger la séance si besoin et à soigner sommeil, repas et hydratation.", en: "Consider a lighter session if needed, and look after sleep, meals and hydration.", es: "Piensa en aligerar la sesión si hace falta y cuida sueño, comidas e hidratación.", pt: "Pense em aliviar a sessão se precisar e cuide de sono, refeições e hidratação." }));
  const toggleZone = (z) => setV((p) => ({ ...p, zones: p.zones.includes(z) ? p.zones.filter((x) => x !== z) : [...p.zones, z] }));
  if (saved && !editing) {
    const r = readinessScore(saved);
    const col = r >= 70 ? C.primary : r >= 40 ? C.scoreMid : C.scoreHigh;
    return (
      <Card className="mb-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.textFaint, ...fontBody }}>{T.form}</p>
            <p className="text-sm font-bold mt-0.5 break-words" style={{ color: col, ...fontDisplay }}>{word(r)}</p>
          </div>
          <span style={{ ...fontMono, color: col, fontSize: 30, lineHeight: 1 }}>{r}</span>
        </div>
        <p className="text-xs mt-2 leading-relaxed" style={{ color: C.textMuted, ...fontBody }}>{tip(r)}</p>
        {saved.zones && saved.zones.length > 0 && <p className="text-xs mt-1.5" style={{ color: C.textMuted, ...fontBody }}>{T.sensitive} : {saved.zones.map((z) => zoneLabels[z]).join(", ")}</p>}
        <p className="text-[11px] mt-2" style={{ color: C.textFaint, ...fontBody }}>{T.taken}</p>
        <button onClick={() => { setV({ sleep: saved.sleep, sore: saved.sore, stress: saved.stress, energy: saved.energy, zones: saved.zones || [] }); setEditing(true); }} className="text-xs font-semibold mt-1 py-2" style={{ color: C.primary, ...fontBody }}>{T.edit}</button>
      </Card>
    );
  }
  return (
    <Card className="mb-5">
      <SectionTitle icon={Sparkles}>{T.title}</SectionTitle>
      <p className="text-xs -mt-2 mb-4" style={{ color: C.textFaint, ...fontBody }}>{T.sub}</p>
      <ScalePicker label={T.sleep} lowLabel={T.sleepLo} highLabel={T.sleepHi} value={v.sleep} onChange={(n) => setV({ ...v, sleep: n })} />
      <ScalePicker label={T.sore} lowLabel={T.soreLo} highLabel={T.soreHi} value={v.sore} onChange={(n) => setV({ ...v, sore: n })} />
      <ScalePicker label={T.stress} lowLabel={T.stressLo} highLabel={T.stressHi} value={v.stress} onChange={(n) => setV({ ...v, stress: n })} />
      <ScalePicker label={T.energy} lowLabel={T.energyLo} highLabel={T.energyHi} value={v.energy} onChange={(n) => setV({ ...v, energy: n })} />
      <p className="text-xs font-semibold mb-1.5" style={{ color: C.text, ...fontBody }}>{T.zones}</p>
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.keys(zoneLabels).map((z) => (
          <button key={z} type="button" aria-pressed={v.zones.includes(z)} onClick={() => toggleZone(z)} className="px-3 rounded-full text-xs font-semibold" style={{ minHeight: 40, background: v.zones.includes(z) ? C.primary : C.surface, color: v.zones.includes(z) ? "#052821" : C.textMuted, border: `1px solid ${v.zones.includes(z) ? C.primary : C.border}`, ...fontBody }}>{zoneLabels[z]}</button>
        ))}
      </div>
      <Btn full onClick={() => { setCheckin(today, v); setEditing(false); if (onDone) onDone(); }}>{T.save}</Btn>
    </Card>
  );
}


const formeWord = (r, lang) => (r >= 70 ? tr(lang, { fr: "Bonne forme", en: "Good form", es: "Buena forma", pt: "Boa forma" }) : r >= 40 ? tr(lang, { fr: "Forme moyenne", en: "Average form", es: "Forma media", pt: "Forma média" }) : tr(lang, { fr: "Récupération à privilégier", en: "Prioritise recovery", es: "Prioriza la recuperación", pt: "Priorize a recuperação" }));
function CheckinPage({ onBack }) {
  const { lang } = useLang();
  const back = tr(lang, { fr: "Accueil", en: "Home", es: "Inicio", pt: "Início" });
  return (
    <div className="px-5 pt-4 pb-24">
      <button onClick={onBack} className="text-xs mb-1 flex items-center gap-1 py-2 pr-3" style={{ color: C.primary }}><ChevronLeft size={14} /> {back}</button>
      <LargeHeader title={tr(lang, { fr: "Bilan du jour", en: "Daily check-in", es: "Chequeo del día", pt: "Check-in do dia" })} subtitle={tr(lang, { fr: "Ta forme du moment", en: "How you feel today", es: "Cómo te sientes hoy", pt: "Como você está hoje" })} />
      <CheckinCard asPage onDone={onBack} />
    </div>
  );
}

function RecoveryChecklist({ plan, checkKey }) {
  const { lang } = useLang();
  const { settings, toggleDone } = useTrack();
  const done = (settings.done || {})[checkKey] || {};
  const n = DONE_ITEMS.filter((k) => done[k]).length;
  const items = {
    hydra: tr(lang, { fr: `Hydratation (${plan.hydratation} L)`, en: `Hydration (${plan.hydratation} L)`, es: `Hidratación (${plan.hydratation} L)`, pt: `Hidratação (${plan.hydratation} L)` }),
    stretch: tr(lang, { fr: "Étirements faits", en: "Stretching done", es: "Estiramientos hechos", pt: "Alongamentos feitos" }),
    meal: tr(lang, { fr: "Repas de récupération", en: "Recovery meal", es: "Comida de recuperación", pt: "Refeição de recuperação" }),
    sleep: tr(lang, { fr: `Coucher à l'heure (${plan.sommeil} h de sommeil visées)`, en: `Bed on time (aiming for ${plan.sommeil} h of sleep)`, es: `Acostarte a tiempo (objetivo ${plan.sommeil} h de sueño)`, pt: `Dormir na hora (meta de ${plan.sommeil} h de sono)` }),
  };
  const title = tr(lang, { fr: "Suivi de ta récup", en: "Your recovery tracker", es: "Seguimiento de tu recuperación", pt: "Acompanhamento da sua recuperação" });
  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between mb-3"><p className="text-sm font-bold" style={{ color: C.text, ...fontDisplay }}>{title}</p><span style={{ ...fontMono, color: n === 4 ? C.primary : C.textMuted, fontSize: 14 }}>{n}/4</span></div>
      {DONE_ITEMS.map((k) => (
        <button key={k} type="button" role="checkbox" aria-checked={!!done[k]} onClick={() => toggleDone(checkKey, k)} className="w-full flex items-center gap-3 text-left" style={{ minHeight: 44 }}>
          <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: done[k] ? C.primary : "transparent", border: `1.5px solid ${done[k] ? C.primary : C.border}` }}>{done[k] && <Check size={14} style={{ color: "#052821" }} />}</span>
          <span className="text-xs leading-snug" style={{ color: done[k] ? C.textMuted : C.text, textDecoration: done[k] ? "line-through" : "none", ...fontBody }}>{items[k]}</span>
        </button>
      ))}
    </Card>
  );
}


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
    ["produits", tr(lang, { fr: "Conseils", en: "Tips", es: "Consejos", pt: "Dicas" }), ShoppingBag],
  ];
  const T = {
    noHeureHint: tr(lang, { fr: "Renseigne l'heure de la séance pour des horaires précis — sinon voici l'ordre à suivre avec des délais indicatifs.", en: "Enter the session time for precise timing — otherwise here's the order to follow with rough delays.", es: "Indica la hora de la sesión para horarios precisos — si no, aquí tienes el orden a seguir con tiempos indicativos.", pt: "Informe o horário da sessão para horários precisos — caso contrário, aqui está a ordem a seguir com tempos indicativos." }),
    proTimingHint: tr(lang, { fr: "Horaires exacts calculés automatiquement avec REGEN Pro.", en: "Exact times calculated automatically with REGEN Pro.", es: "Horarios exactos calculados automáticamente con REGEN Pro.", pt: "Horários exatos calculados automaticamente com o REGEN Pro." }),
    needsToday: tr(lang, { fr: "Besoins estimés du jour", en: "Estimated needs for the day", es: "Necesidades estimadas del día", pt: "Necessidades estimadas do dia" }),
    kcal: "kcal", protein: tr(lang, { fr: "Protéines", en: "Protein", es: "Proteínas", pt: "Proteínas" }), carbs: tr(lang, { fr: "Glucides", en: "Carbs", es: "Carbohidratos", pt: "Carboidratos" }), fat: tr(lang, { fr: "Lipides", en: "Fat", es: "Grasas", pt: "Gorduras" }),
    estimateNote: tr(lang, { fr: "Estimation selon ton profil (taille, poids, sexe, âge) et l'intensité de la séance — indicatif, pas un avis nutritionnel professionnel.", en: "Estimate based on your profile (height, weight, sex, age) and session intensity — indicative only, not professional nutritional advice.", es: "Estimación según tu perfil (altura, peso, sexo, edad) y la intensidad de la sesión — orientativo, no es un consejo nutricional profesional.", pt: "Estimativa com base no seu perfil (altura, peso, sexo, idade) e na intensidade da sessão — indicativo, não é aconselhamento nutricional profissional." }),
    mealBefore: tr(lang, { fr: "Repas avant l'effort", en: "Meal before training", es: "Comida antes del esfuerzo", pt: "Refeição antes do esforço" }),
    mealAfter: tr(lang, { fr: "Repas après l'effort", en: "Meal after training", es: "Comida después del esfuerzo", pt: "Refeição depois do esforço" }),
    withYourGear: tr(lang, { fr: "Avec ton matériel", en: "With your gear", es: "Con tu equipo", pt: "Com o seu equipamento" }),
    toConsider: tr(lang, { fr: "À envisager (facultatif)", en: "Worth considering (optional)", es: "A considerar (opcional)", pt: "A considerar (opcional)" }),
    gearOk: tr(lang, { fr: "Tu as déjà le matériel essentiel : rien à acheter pour mieux récupérer.", en: "You already have the essential gear: nothing to buy to recover better.", es: "Ya tienes el material esencial: no necesitas comprar nada para recuperarte mejor.", pt: "Você já tem o equipamento essencial: nada a comprar para recuperar melhor." }),
    freeTips: tr(lang, { fr: "Astuces gratuites", en: "Free tips", es: "Consejos gratuitos", pt: "Dicas gratuitas" }),
    adviceNote: tr(lang, { fr: "Suggestions indicatives, sans lien commercial. Les prix sont des ordres de grandeur.", en: "Indicative suggestions with no commercial link. Prices are rough ranges.", es: "Sugerencias orientativas, sin vínculo comercial. Los precios son aproximados.", pt: "Sugestões indicativas, sem vínculo comercial. Os preços são aproximados." }),
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
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1" style={{ WebkitMaskImage: "linear-gradient(to right, #000 calc(100% - 28px), transparent)", maskImage: "linear-gradient(to right, #000 calc(100% - 28px), transparent)", paddingRight: 28 }}>
        {tabs.map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)} className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold" style={{ background: tab === k ? C.primary : C.surface, color: tab === k ? "#052821" : C.textMuted, border: `1px solid ${tab === k ? C.primary : C.borderSoft}66` }}><Icon size={13} /> {label}</button>
        ))}
      </div>
      {tab === "programme" && (
        <div className="flex flex-col gap-2.5">
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
              <p className="text-[11px]" style={{ color: C.textFaint, ...fontBody }}>{isPro ? T.noHeureHint : T.proTimingHint}</p>
            </button>
          )}
        </div>
      )}
      {tab === "avant" && !plan.restDay && (
        <div className="flex flex-col gap-3">
          <p className="text-xs px-1 -mt-1 mb-1" style={{ color: C.textFaint, ...fontBody }}>{T.warmupIntro}</p>
          {(plan.warmup || []).map((s, i) => <Card key={i}><div className="flex justify-between items-start mb-1"><p className="font-semibold text-sm" style={{ color: C.text, ...fontBody }}>{s.label}</p><span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: C.primarySoft, color: C.primary, ...fontMono }}>{s.duree}</span></div><p className="text-xs leading-relaxed" style={{ color: C.textMuted, ...fontBody }}>{s.instr}</p></Card>)}
        </div>
      )}
      {tab === "etirements" && <div className="flex flex-col gap-3">{plan.stretches.map((s, i) => <Card key={i}><div className="flex justify-between items-start mb-1"><p className="font-semibold text-sm" style={{ color: C.text, ...fontBody }}>{s.label}</p><span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: C.primarySoft, color: C.primary, ...fontMono }}>{s.duree}</span></div><p className="text-xs leading-relaxed" style={{ color: C.textMuted, ...fontBody }}>{s.instr}</p></Card>)}</div>}
      {tab === "massage" && <Card><SectionTitle icon={HeartPulse}>{plan.massage.titre}</SectionTitle><p className="text-xs leading-relaxed" style={{ color: C.textMuted, ...fontBody }}>{plan.massage.texte}</p></Card>}
      {tab === "froid" && <div className="flex flex-col gap-3">{plan.coldHeat.map((c, i) => <Card key={i}><div className="flex items-center gap-2 mb-1">{c.type === "froid" ? <Snowflake size={14} style={{ color: "#6BC6FF" }} /> : c.type === "chaud" ? <Flame size={14} style={{ color: C.warn }} /> : <Zap size={14} style={{ color: C.primary }} />}<p className="font-semibold text-sm" style={{ color: C.text, ...fontBody }}>{c.titre}</p></div><p className="text-xs leading-relaxed" style={{ color: C.textMuted, ...fontBody }}>{c.texte}</p></Card>)}</div>}
      {tab === "nutrition" && (
        <div className="flex flex-col gap-3">
          <ProLock active={!isPro}>
            <Card>
              <SectionTitle icon={Flame} action={<ProBadge />}>{T.needsToday}</SectionTitle>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div><p style={{ ...fontMono, color: C.primary, fontSize: 17 }}>{plan.nutrients.kcal}</p><p className="text-[11px] uppercase" style={{ color: C.textFaint }}>{T.kcal}</p></div>
                <div><p style={{ ...fontMono, color: C.text, fontSize: 17 }}>{plan.nutrients.protein}g</p><p className="text-[11px] uppercase" style={{ color: C.textFaint }}>{T.protein}</p></div>
                <div><p style={{ ...fontMono, color: C.text, fontSize: 17 }}>{plan.nutrients.carbs}g</p><p className="text-[11px] uppercase" style={{ color: C.textFaint }}>{T.carbs}</p></div>
                <div><p style={{ ...fontMono, color: C.text, fontSize: 17 }}>{plan.nutrients.fat}g</p><p className="text-[11px] uppercase" style={{ color: C.textFaint }}>{T.fat}</p></div>
              </div>
              <p className="text-[11px] mt-2" style={{ color: C.textFaint, ...fontBody }}>{T.estimateNote}</p>
            </Card>
          </ProLock>
          {plan.restDay ? (
            <>
              <Card><SectionTitle icon={Clock}>{T.mealMain}</SectionTitle><p className="text-xs leading-relaxed" style={{ color: C.textMuted, ...fontBody }}>{plan.meals.pre}</p><p className="text-[11px] mt-2" style={{ color: C.textFaint, ...fontBody }}>{T.spreadDay}</p></Card>
              <Card><SectionTitle icon={TrendingUp}>{T.mealSnack}</SectionTitle><p className="text-xs leading-relaxed" style={{ color: C.textMuted, ...fontBody }}>{plan.meals.post}</p></Card>
            </>
          ) : (
            <>
              <Card><SectionTitle icon={Clock}>{T.mealBefore}</SectionTitle><p className="text-xs leading-relaxed mb-2" style={{ color: C.textMuted, ...fontBody }}>{plan.meals.pre}</p><p className="text-[11px] font-semibold" style={{ color: C.primary, ...fontBody }}>{T.toEatAt(timing.pre)}</p></Card>
              <Card><SectionTitle icon={TrendingUp}>{T.mealAfter}</SectionTitle><p className="text-xs leading-relaxed mb-2" style={{ color: C.textMuted, ...fontBody }}>{plan.meals.post}</p><p className="text-[11px] font-semibold" style={{ color: C.primary, ...fontBody }}>{T.toEatAt(timing.post)}</p></Card>
            </>
          )}
          <Card><SectionTitle icon={Droplet}>{T.hydration}</SectionTitle><div className="flex items-center gap-3"><span style={{ ...fontMono, color: C.primary, fontSize: 26 }}>{plan.hydratation}L</span><span className="text-xs" style={{ color: C.textMuted, ...fontBody }}>{T.recommendedDay}</span></div></Card>
        </div>
      )}
      {tab === "produits" && (
        <div className="flex flex-col gap-3">
          {plan.produits.length > 0 && <p className="text-xs font-semibold uppercase tracking-wider mt-1" style={{ color: C.textMuted, ...fontBody }}>{T.withYourGear}</p>}
          {plan.produits.map((p, i) => <Card key={i}><p className="text-xs leading-relaxed" style={{ color: C.textMuted, ...fontBody }}>{p}</p></Card>)}
          {plan.conseils && (<>
            <p className="text-xs font-semibold uppercase tracking-wider mt-3" style={{ color: C.textMuted, ...fontBody }}>{T.toConsider}</p>
            {plan.conseils.hasAll && <Card><p className="text-xs leading-relaxed" style={{ color: C.textMuted, ...fontBody }}>{T.gearOk}</p></Card>}
            {plan.conseils.buy.map((b, i) => (
              <Card key={i}>
                <div className="flex items-start justify-between gap-3 mb-1.5"><p className="text-sm font-bold" style={{ color: C.text, ...fontDisplay }}>{b.t}</p><span className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: C.primarySoft, color: C.primary, ...fontMono }}>{b.price}</span></div>
                <p className="text-xs leading-relaxed" style={{ color: C.textMuted, ...fontBody }}>{b.d}</p>
              </Card>
            ))}
            <p className="text-xs font-semibold uppercase tracking-wider mt-3" style={{ color: C.textMuted, ...fontBody }}>{T.freeTips}</p>
            {plan.conseils.tips.map((b, i) => (
              <Card key={i}><p className="text-sm font-bold mb-1.5" style={{ color: C.text, ...fontDisplay }}>{b.t}</p><p className="text-xs leading-relaxed" style={{ color: C.textMuted, ...fontBody }}>{b.d}</p></Card>
            ))}
            <p className="text-[11px] leading-relaxed text-center px-3" style={{ color: C.textFaint, ...fontBody }}>{T.adviceNote}</p>
          </>)}
        </div>
      )}
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
                  <span className="text-xs" style={{ color: ok ? C.text : C.textFaint, ...fontBody }}>{r.label}</span>
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
    usernameHint: tr(lang, { fr: "Utilisé pour t'identifier dans l'app. Unique, 3-20 caractères (lettres, chiffres, _).", en: "Used to identify you in the app. Unique, 3-20 characters (letters, numbers, _).", es: "Se usa para identificarte en la app. Único, 3-20 caracteres (letras, números, _).", pt: "Usado para identificar você no app. Único, 3-20 caracteres (letras, números, _)." }),
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
    <div ref={(el) => { if (el) el.scrollTop = 0; }} key={mode} className="flex-1 min-h-0 overflow-y-auto flex flex-col [&>:first-child]:mt-auto [&>:last-child]:mb-auto px-6 py-10">
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
            <p className="text-[11px] mt-1.5" style={{ color: C.textFaint, ...fontBody }}>{T.usernameHint}</p>
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
                <span className="text-xs" style={{ color: ok ? C.text : C.textFaint, ...fontBody }}>{r.label}</span>
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
          {confirmPassword && confirmPassword !== password && <p className="text-[11px] mt-1.5" style={{ color: C.danger, ...fontBody }}>{T.mismatch}</p>}
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
        <button type="button" onClick={() => { setForgotOpen(true); setForgotSent(false); }} className="w-full text-center mt-4 text-xs" style={{ color: C.primary, ...fontBody }}>{T.forgotLink}</button>
      )}
      </form>
      <p className="text-[11px] text-center mt-6" style={{ color: C.textFaint, ...fontBody }}>{T.disclaimer}</p>
      <p className="text-[11px] text-center mt-2" style={{ color: C.textFaint, ...fontBody }}>
        <a href={`${LEGAL_BASE}/conditions.html`} target="_blank" rel="noopener noreferrer" style={{ color: C.textMuted, textDecoration: "underline" }}>{T.legalTerms}</a>
        {" · "}
        <a href={`${LEGAL_BASE}/confidentialite.html`} target="_blank" rel="noopener noreferrer" style={{ color: C.textMuted, textDecoration: "underline" }}>{T.legalPrivacy}</a>
      </p>

      {forgotOpen && (
        <div className="fixed-full z-50 flex items-end" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={() => setForgotOpen(false)}>
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
          <span className="text-xl">{s.icon}</span><span className="text-[11px] text-center" style={{ color: selected.includes(key) ? C.primary : C.textMuted, ...fontBody }}>{sportLabel(key, lang)}</span>
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
        <button key={k} onClick={() => onToggle(k)} className="px-2.5 py-1.5 rounded-full text-xs font-semibold" style={{ background: selected.includes(k) ? C.primary : C.glassSoft, color: selected.includes(k) ? "#052821" : C.textMuted, border: `1px solid ${selected.includes(k) ? C.primary : C.glassBorder}`, backdropFilter: "blur(8px)", ...fontBody }}>{MUSCU_ZONES[k].icon} {zoneLabel(k, lang)}</button>
      ))}
    </div>
  );
}

/* ============================================================
   ONBOARDING
   ============================================================ */
/* ============================================================
   TUTORIEL : un court accueil (3 écrans) après l'inscription, puis un petit
   guide propre à CHAQUE page, affiché la 1re fois et rouvrable avec le « ? ».
   ============================================================ */
function TutorialScreen({ onDone }) {
  const { lang } = useLang();
  const [i, setI] = useState(0);
  const T4 = (fr, en, es, pt) => tr(lang, { fr, en, es, pt });
  const slides = [
    { Icon: Sparkles, color: C.primary,
      t: T4("Bienvenue sur REGEN", "Welcome to REGEN", "Bienvenido a REGEN", "Bem-vindo ao REGEN"),
      d: T4("REGEN t'aide à mieux récupérer après le sport : plan personnalisé, planning, suivi des blessures, nutrition et rappels.", "REGEN helps you recover better after sport: personalised plan, schedule, injury tracking, nutrition and reminders.", "REGEN te ayuda a recuperarte mejor tras el deporte: plan personalizado, calendario, seguimiento de lesiones, nutrición y recordatorios.", "O REGEN ajuda você a recuperar melhor após o esporte: plano personalizado, agenda, acompanhamento de lesões, nutrição e lembretes."),
      b: [] },
    { Icon: Activity, color: C.primary,
      t: T4("Comment ça marche", "How it works", "Cómo funciona", "Como funciona"),
      d: T4("Trois gestes suffisent.", "Three simple steps.", "Tres pasos sencillos.", "Três passos simples."),
      b: [T4("Dis ce que tu as fait (séance imprévue) ou prépare ta semaine dans le Planning.", "Tell us what you did (unplanned session) or set up your week in the Schedule.", "Cuenta lo que hiciste (sesión imprevista) o prepara tu semana en el Plan.", "Conte o que você fez (sessão imprevista) ou prepare sua semana na Agenda."), T4("Reçois ton plan de récup : étirements, massage, froid/chaud, sommeil, nutrition.", "Get your recovery plan: stretching, massage, cold/heat, sleep, nutrition.", "Recibe tu plan de recuperación: estiramientos, masaje, frío/calor, sueño, nutrición.", "Receba seu plano de recuperação: alongamentos, massagem, frio/calor, sono, nutrição."), T4("Suis ton score, tes rappels et tes progrès sur l'Accueil.", "Follow your score, reminders and progress on Home.", "Sigue tu puntuación, recordatorios y progreso en Inicio.", "Acompanhe sua pontuação, lembretes e progresso na Página inicial.")] },
    { Icon: HelpCircle, color: C.primary,
      t: T4("Un guide sur chaque page", "A guide on every page", "Una guía en cada página", "Um guia em cada página"),
      d: T4("Pas besoin de tout retenir maintenant.", "No need to remember everything now.", "No hace falta recordar todo ahora.", "Não precisa lembrar de tudo agora."),
      b: [T4("La première fois que tu ouvres une page, un petit guide t'explique à quoi elle sert.", "The first time you open a page, a short guide explains what it's for.", "La primera vez que abres una página, una guía breve te explica para qué sirve.", "Na primeira vez que abre uma página, um guia curto explica para que ela serve."), T4("Touche le bouton « ? » en haut de l'écran pour le revoir quand tu veux.", "Tap the \"?\" button at the top of the screen to see it again anytime.", "Toca el botón «?» en la parte superior para verla cuando quieras.", "Toque no botão «?» no topo da tela para rever quando quiser."), T4("Tout commence gratuitement : Pro est optionnel.", "Everything starts free: Pro is optional.", "Todo empieza gratis: Pro es opcional.", "Tudo começa grátis: o Pro é opcional.")] },
  ];
  const last = i === slides.length - 1;
  const sl = slides[i];
  const L = { next: T4("Suivant", "Next", "Siguiente", "Próximo"), start: T4("C'est parti !", "Let's go!", "¡Vamos!", "Vamos lá!"), skip: T4("Passer", "Skip", "Saltar", "Pular"), back: T4("Retour", "Back", "Atrás", "Voltar") };
  const Icon = sl.Icon;
  return (
    <div className="absolute inset-0 flex flex-col px-6 pt-8 pb-6" style={{ zIndex: 70, background: C.bg, paddingTop: "max(32px, env(safe-area-inset-top))" }}>
      <div className="flex items-center justify-between mb-8">
        <div className="flex gap-1.5 flex-1 mr-4">{slides.map((_, k) => <div key={k} className="flex-1 h-1 rounded-full" style={{ background: k <= i ? C.primary : C.border }} />)}</div>
        {!last && <button onClick={onDone} className="text-xs font-semibold py-2 pl-3" style={{ color: C.textMuted, ...fontBody }}>{L.skip}</button>}
      </div>
      <div className="flex-1 overflow-y-auto flex flex-col">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ background: `${sl.color}22`, border: `1px solid ${sl.color}55` }}><Icon size={30} style={{ color: sl.color }} /></div>
        <h2 className="text-2xl font-extrabold tracking-tight mb-3" style={{ color: C.text, ...fontDisplay }}>{sl.t}</h2>
        <p className="text-sm leading-relaxed mb-5" style={{ color: C.textMuted, ...fontBody }}>{sl.d}</p>
        {sl.b.length > 0 && <ul className="flex flex-col gap-3">{sl.b.map((x, k) => (
          <li key={k} className="flex gap-3 items-start rounded-2xl p-3.5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <Check size={15} className="shrink-0 mt-0.5" style={{ color: C.primary }} /><span className="text-xs leading-relaxed" style={{ color: C.text, ...fontBody }}>{x}</span>
          </li>))}</ul>}
      </div>
      <div className="flex gap-2 mt-4">
        {i > 0 && <Btn variant="ghost" onClick={() => setI(i - 1)}>{L.back}</Btn>}
        <Btn full onClick={() => (last ? onDone() : setI(i + 1))}>{last ? L.start : L.next}</Btn>
      </div>
    </div>
  );
}

// Contenu des guides : une entrée par page (clé = page).
function getGuides(lang) {
  const T4 = (fr, en, es, pt) => tr(lang, { fr, en, es, pt });
  return {
    home: { Icon: Home,
      t: T4("Ton accueil", "Your home", "Tu inicio", "Sua página inicial"),
      d: T4("Tout ton suivi en un coup d'œil.", "Everything you track, at a glance.", "Todo tu seguimiento de un vistazo.", "Todo o seu acompanhamento num relance."),
      b: [T4("La grande carte montre le score de ta dernière séance : plus il est haut, plus ton corps a besoin de récupérer. Touche-la pour rouvrir le plan.", "The big card shows your last session's score: the higher it is, the more your body needs to recover. Tap it to reopen the plan.", "La tarjeta grande muestra la puntuación de tu última sesión: cuanto más alta, más necesita recuperarse tu cuerpo. Tócala para reabrir el plan.", "O cartão grande mostra a pontuação da última sessão: quanto mais alta, mais seu corpo precisa recuperar. Toque para reabrir o plano."),
          T4("Les raccourcis mènent à la Séance imprévue, la Nutrition, les Blessures et le Planning.", "The shortcuts lead to Unplanned session, Nutrition, Injuries and Schedule.", "Los accesos llevan a Sesión imprevista, Nutrición, Lesiones y Plan.", "Os atalhos levam a Sessão imprevista, Nutrição, Lesões e Agenda."),
          T4("La carte « Sommeil & étirements » règle tes heures de réveil et tes rappels de coucher et d'étirements.", "The \"Sleep & stretching\" card sets your wake-up times and your bedtime and stretching reminders.", "La tarjeta «Sueño y estiramientos» ajusta tus horas de despertar y tus recordatorios de dormir y estirar.", "O cartão «Sono e alongamentos» define seus horários de despertar e lembretes de dormir e alongar."),
          T4("« Cette semaine » résume ton planning : touche un jour pour voir son détail.", "\"This week\" sums up your schedule: tap a day to see its details.", "«Esta semana» resume tu plan: toca un día para ver su detalle.", "«Esta semana» resume sua agenda: toque num dia para ver os detalhes."),
          T4("La courbe suit ton score sur 4, 8 ou 12 semaines. Dans l'historique, touche une séance pour rouvrir son plan, ou la poubelle pour la supprimer.", "The curve tracks your score over 4, 8 or 12 weeks. In the history, tap a session to reopen its plan, or the bin to delete it.", "La curva sigue tu puntuación en 4, 8 o 12 semanas. En el historial, toca una sesión para reabrir su plan, o la papelera para borrarla.", "A curva acompanha sua pontuação em 4, 8 ou 12 semanas. No histórico, toque numa sessão para reabrir o plano, ou na lixeira para excluir.")] },
    recup: { Icon: Activity,
      t: T4("Séance imprévue déjà faite", "Unplanned session, already done", "Sesión imprevista ya hecha", "Sessão imprevista já feita"),
      d: T4("Utilise cette page quand tu as fait du sport sans l'avoir prévu.", "Use this page when you worked out without planning it.", "Usa esta página cuando hayas hecho deporte sin planearlo.", "Use esta página quando tiver treinado sem ter planejado."),
      b: [T4("Indique le sport, le type de séance, l'intensité, l'heure et ta fatigue.", "Enter the sport, session type, intensity, time and how tired you are.", "Indica el deporte, el tipo de sesión, la intensidad, la hora y tu fatiga.", "Informe o esporte, o tipo de sessão, a intensidade, o horário e sua fadiga."),
          T4("Tu reçois un plan de récup complet : programme minuté, étirements, massage, froid/chaud, nutrition et conseils.", "You get a full recovery plan: timed programme, stretching, massage, cold/heat, nutrition and tips.", "Recibes un plan de recuperación completo: programa con horarios, estiramientos, masaje, frío/calor, nutrición y consejos.", "Você recebe um plano de recuperação completo: programa com horários, alongamentos, massagem, frio/calor, nutrição e dicas."),
          T4("Le plan est gardé dans l'historique de l'Accueil, et la séance s'ajoute au planning d'aujourd'hui.", "The plan is kept in the Home history, and the session is added to today's schedule.", "El plan se guarda en el historial de Inicio y la sesión se añade al plan de hoy.", "O plano fica no histórico da Página inicial e a sessão é adicionada à agenda de hoje."),
          T4("Une séance que tu connais à l'avance ? Ajoute-la plutôt dans Planning → Ajouts.", "A session you know about in advance? Add it in Schedule → Add instead.", "¿Una sesión que conoces de antemano? Añádela en Plan → Añadir.", "Uma sessão que você já conhece? Adicione em Agenda → Adicionar.")] },
    recup_result: { Icon: Flame,
      t: T4("Ton plan de récup", "Your recovery plan", "Tu plan de recuperación", "Seu plano de recuperação"),
      d: T4("Voilà ce dont ton corps a besoin après cette séance.", "Here's what your body needs after this session.", "Esto es lo que tu cuerpo necesita tras esta sesión.", "É disto que seu corpo precisa após esta sessão."),
      b: [T4("Le cercle donne ton score de 0 à 100 et la durée de récup conseillée. Il est majoré si tu as enchaîné plusieurs séances cette semaine.", "The circle gives your score from 0 to 100 and the recommended recovery time. It goes up if you've done several sessions this week.", "El círculo da tu puntuación de 0 a 100 y el tiempo de recuperación recomendado. Sube si encadenaste varias sesiones esta semana.", "O círculo mostra sua pontuação de 0 a 100 e o tempo de recuperação recomendado. Aumenta se você fez várias sessões esta semana."),
          T4("Fais défiler les onglets : Programme (les étapes dans l'ordre), Avant, Étirements, Massage, Froid / Chaud, Nutrition et Conseils.", "Scroll through the tabs: Programme (steps in order), Before, Stretching, Massage, Cold / Heat, Nutrition and Tips.", "Desplaza las pestañas: Programa (pasos en orden), Antes, Estiramientos, Masaje, Frío / Calor, Nutrición y Consejos.", "Role pelas abas: Programa (etapas em ordem), Antes, Alongamentos, Massagem, Frio / Calor, Nutrição e Dicas."),
          T4("Dans Conseils : du matériel à envisager selon ce que tu possèdes, et des astuces gratuites.", "In Tips: gear to consider based on what you own, and free tricks.", "En Consejos: material a considerar según lo que tienes y trucos gratuitos.", "Em Dicas: equipamentos a considerar conforme o que você tem e truques gratuitos."),
          T4("Ce sont des conseils généraux : ils ne remplacent pas un avis médical.", "These are general tips: they don't replace medical advice.", "Son consejos generales: no sustituyen la opinión médica.", "São dicas gerais: não substituem um parecer médico.")] },
    nutrition: { Icon: Utensils,
      t: T4("Nutrition", "Nutrition", "Nutrición", "Nutrição"),
      d: T4("Quoi manger et boire autour de ta séance.", "What to eat and drink around your session.", "Qué comer y beber alrededor de tu sesión.", "O que comer e beber em torno da sessão."),
      b: [T4("Tes besoins estimés (calories, protéines, glucides, lipides) sont calculés d'après ton profil et ta séance (Pro).", "Your estimated needs (calories, protein, carbs, fat) are calculated from your profile and session (Pro).", "Tus necesidades estimadas (calorías, proteínas, carbohidratos, grasas) se calculan según tu perfil y sesión (Pro).", "Suas necessidades estimadas (calorias, proteínas, carboidratos, gorduras) são calculadas conforme seu perfil e sessão (Pro)."),
          T4("Les repas avant et après l'effort respectent tes allergies et ton régime, renseignés dans ton profil.", "Meals before and after effort respect your allergies and diet, set in your profile.", "Las comidas antes y después del esfuerzo respetan tus alergias y dieta, indicadas en tu perfil.", "As refeições antes e depois do esforço respeitam suas alergias e dieta, definidas no perfil."),
          T4("L'hydratation indique combien boire sur la journée.", "Hydration shows how much to drink over the day.", "La hidratación indica cuánto beber durante el día.", "A hidratação indica quanto beber ao longo do dia."),
          T4("Les repas changent d'une séance à l'autre. Modifie tes aliments à éviter dans Profil → Aliments.", "Meals change from one session to the next. Edit foods to avoid in Profile → Food.", "Las comidas cambian de una sesión a otra. Cambia los alimentos a evitar en Perfil → Alimentos.", "As refeições mudam de uma sessão para outra. Edite os alimentos a evitar em Perfil → Alimentos.")] },
    blessures: { Icon: HeartPulse,
      t: T4("Blessures", "Injuries", "Lesiones", "Lesões"),
      d: T4("Un pépin ? Fais le point calmement.", "A niggle? Take stock calmly.", "¿Una molestia? Haz balance con calma.", "Um incômodo? Faça um balanço com calma."),
      b: [T4("Conseil : choisis la zone et la gêne, REGEN t'oriente vers le bon spécialiste et te donne des conseils en attendant.", "Advice: pick the area and symptom, REGEN points you to the right specialist and gives tips meanwhile.", "Consejo: elige zona y molestia, REGEN te orienta al especialista adecuado y te da consejos mientras tanto.", "Conselho: escolha a área e o incômodo, o REGEN indica o especialista certo e dá dicas enquanto isso."),
          T4("Arrêt : déclare une blessure qui t'arrête, avec ou sans date de retour, et suis-la.", "Time off: report an injury that stops you, with or without a return date, and track it.", "Baja: declara una lesión que te detiene, con o sin fecha de vuelta, y haz su seguimiento.", "Afastamento: declare uma lesão que o impede, com ou sem data de retorno, e acompanhe."),
          T4("Historique : retrouve tes gênes et arrêts, renseigne la date de retour, ajoute un rendez-vous médical lié.", "History: find your niggles and time off, set the return date, add a linked medical appointment.", "Historial: encuentra tus molestias y bajas, indica la fecha de vuelta, añade una cita médica vinculada.", "Histórico: veja seus incômodos e afastamentos, informe a data de retorno, adicione uma consulta ligada."),
          T4("Les arrêts apparaissent dans ton planning. Ces conseils ne remplacent jamais un médecin.", "Time off shows up in your schedule. This advice never replaces a doctor.", "Las bajas aparecen en tu plan. Estos consejos nunca sustituyen a un médico.", "Os afastamentos aparecem na sua agenda. Estas dicas nunca substituem um médico.")] },
    planning: { Icon: CalendarDays,
      t: T4("Planning", "Schedule", "Plan", "Agenda"),
      d: T4("Organise ta semaine et tes séances.", "Organise your week and sessions.", "Organiza tu semana y tus sesiones.", "Organize sua semana e suas sessões."),
      b: [T4("Calendrier : touche un jour pour voir son détail et son plan de récup. Les couleurs indiquent le type de journée.", "Calendar: tap a day to see its details and recovery plan. Colours show the type of day.", "Calendario: toca un día para ver su detalle y plan de recuperación. Los colores indican el tipo de día.", "Calendário: toque num dia para ver detalhes e plano de recuperação. As cores indicam o tipo de dia."),
          T4("Semaine type : règle une fois pour toutes tes jours fixes (sport, intensité, heure).", "Weekly: set your fixed days once and for all (sport, intensity, time).", "Semana tipo: fija una vez tus días fijos (deporte, intensidad, hora).", "Semana tipo: defina uma vez seus dias fixos (esporte, intensidade, horário)."),
          T4("Ajouts : prévois une séance exceptionnelle ou un rendez-vous médical, ou renseigne une séance imprévue déjà faite pour obtenir sa récup.", "Add: plan an extra session or a medical appointment, or enter an unplanned session you already did to get its recovery.", "Añadir: planifica una sesión extra o una cita médica, o introduce una sesión imprevista ya hecha para obtener su recuperación.", "Adicionar: planeje uma sessão extra ou uma consulta médica, ou informe uma sessão imprevista já feita para obter a recuperação."),
          T4("L'app insère elle-même de la récup active ou du repos selon ta charge. Le gratuit permet 3 ajouts par mois.", "The app adds active recovery or rest on its own based on your load. Free allows 3 additions per month.", "La app añade sola recuperación activa o descanso según tu carga. Lo gratuito permite 3 añadidos al mes.", "O app insere sozinho recuperação ativa ou descanso conforme sua carga. O grátis permite 3 adições por mês.")] },
    pro: { Icon: Crown,
      t: T4("REGEN Pro", "REGEN Pro", "REGEN Pro", "REGEN Pro"),
      d: T4("Va plus loin quand tu en as besoin.", "Go further when you need it.", "Ve más lejos cuando lo necesites.", "Vá além quando precisar."),
      b: [T4("Gratuit : 1 sport, 1 séance par jour, plans de récup, conseils blessures et planning de base.", "Free: 1 sport, 1 session per day, recovery plans, injury guidance and basic schedule.", "Gratis: 1 deporte, 1 sesión al día, planes de recuperación, orientación de lesiones y plan básico.", "Grátis: 1 esporte, 1 sessão por dia, planos de recuperação, orientação de lesões e agenda básica."),
          T4("Pro : sports et séances illimités, nutrition détaillée, programme chronométré, récup automatique, ajouts illimités.", "Pro: unlimited sports and sessions, detailed nutrition, timed programme, automatic recovery, unlimited additions.", "Pro: deportes y sesiones ilimitados, nutrición detallada, programa con horarios, recuperación automática, añadidos ilimitados.", "Pro: esportes e sessões ilimitados, nutrição detalhada, programa cronometrado, recuperação automática, adições ilimitadas."),
          T4("L'essai Pro dure 7 jours. Tu peux résilier à tout moment depuis cette page.", "The Pro trial lasts 7 days. You can cancel anytime from this page.", "La prueba Pro dura 7 días. Puedes cancelar en cualquier momento desde esta página.", "O teste Pro dura 7 dias. Você pode cancelar a qualquer momento nesta página.")] },
    rappels: { Icon: Moon,
      t: T4("Sommeil & étirements", "Sleep & stretching", "Sueño y estiramientos", "Sono e alongamentos"),
      d: T4("Dors assez et étire-toi à temps.", "Sleep enough and stretch on time.", "Duerme lo suficiente y estira a tiempo.", "Durma o suficiente e alongue a tempo."),
      b: [T4("Sommeil : indique ton heure de réveil pour chaque jour. REGEN calcule ton heure de coucher idéale.", "Sleep: set your wake-up time for each day. REGEN works out your ideal bedtime.", "Sueño: indica tu hora de despertar cada día. REGEN calcula tu hora ideal de acostarte.", "Sono: informe seu horário de despertar em cada dia. O REGEN calcula seu horário ideal de dormir."),
          T4("Active le rappel de coucher : tu es prévenu 30 minutes avant, les soirs de séance ou tous les soirs.", "Turn on the bedtime reminder: you're alerted 30 minutes before, on session evenings or every evening.", "Activa el recordatorio de dormir: te avisa 30 minutos antes, las noches de sesión o todas las noches.", "Ative o lembrete de dormir: você é avisado 30 minutos antes, nas noites de sessão ou todas as noites."),
          T4("Rappels : active le rappel d'étirements après chaque séance, avec les zones à étirer.", "Reminders: turn on the stretching reminder after each session, with the areas to stretch.", "Recordatorios: activa el aviso de estiramientos tras cada sesión, con las zonas a estirar.", "Lembretes: ative o aviso de alongamento após cada sessão, com as áreas a alongar."),
          T4("Pour recevoir de vraies notifications, active-les dans Profil → Compte.", "To get real notifications, turn them on in Profile → Account.", "Para recibir notificaciones reales, actívalas en Perfil → Cuenta.", "Para receber notificações de verdade, ative em Perfil → Conta.")] },
    profile: { Icon: User,
      t: T4("Ton profil", "Your profile", "Tu perfil", "Seu perfil"),
      d: T4("Plus il est précis, plus les conseils le sont.", "The more accurate it is, the more accurate the advice.", "Cuanto más preciso, más precisos los consejos.", "Quanto mais preciso, mais precisos os conselhos."),
      b: [T4("Mets à jour ton poids, ton niveau, tes sports et ton matériel : les plans se recalculent. Pense à Enregistrer.", "Update your weight, level, sports and equipment: plans are recalculated. Remember to Save.", "Actualiza tu peso, nivel, deportes y equipo: los planes se recalculan. No olvides Guardar.", "Atualize peso, nível, esportes e equipamento: os planos são recalculados. Lembre-se de Salvar."),
          T4("Aliments : gère tes allergies, ton régime et les aliments à éviter.", "Food: manage your allergies, diet and foods to avoid.", "Alimentos: gestiona tus alergias, dieta y alimentos a evitar.", "Alimentos: gerencie alergias, dieta e alimentos a evitar."),
          T4("Compte : langue, notifications, Sommeil & étirements, abonnement, tutoriel et déconnexion.", "Account: language, notifications, Sleep & stretching, subscription, tutorial and log out.", "Cuenta: idioma, notificaciones, Sueño y estiramientos, suscripción, tutorial y cerrar sesión.", "Conta: idioma, notificações, Sono e alongamentos, assinatura, tutorial e sair.")] },
  };
}

// Petite fenêtre en bas de l'écran : le guide de la page courante.
function GuideSheet({ guideKey, onClose }) {
  const { lang } = useLang();
  const g = getGuides(lang)[guideKey];
  if (!g) return null;
  const Icon = g.Icon;
  const ok = tr(lang, { fr: "Compris", en: "Got it", es: "Entendido", pt: "Entendi" });
  return (
    <div className="absolute inset-0 flex flex-col justify-end" style={{ zIndex: 80, background: "rgba(0,0,0,0.62)" }} onClick={onClose}>
      <div role="dialog" aria-label={g.t} onClick={(e) => e.stopPropagation()} className="rounded-t-[28px] px-5 pt-5 flex flex-col" style={{ background: C.bg, border: `1px solid ${C.glassBorder}`, borderBottom: "none", maxHeight: "82%", paddingBottom: "max(20px, env(safe-area-inset-bottom))", boxShadow: "0 -20px 50px rgba(0,0,0,.5)" }}>
        <div className="w-10 h-1 rounded-full mx-auto mb-4 shrink-0" style={{ background: C.border }} />
        <div className="flex items-center gap-3 mb-2 shrink-0">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: C.primarySoft, border: `1px solid ${C.primary}55` }}><Icon size={22} style={{ color: C.primary }} /></div>
          <h2 className="text-lg font-extrabold tracking-tight leading-tight" style={{ color: C.text, ...fontDisplay }}>{g.t}</h2>
        </div>
        <div className="overflow-y-auto min-h-0 flex-1" style={{ WebkitMaskImage: "linear-gradient(to bottom, #000 calc(100% - 22px), transparent)", maskImage: "linear-gradient(to bottom, #000 calc(100% - 22px), transparent)", paddingBottom: 14 }}>
          <p className="text-sm leading-relaxed mb-4" style={{ color: C.textMuted, ...fontBody }}>{g.d}</p>
          <ul className="flex flex-col gap-2.5 mb-4">
            {g.b.map((x, k) => (
              <li key={k} className="flex gap-3 items-start rounded-2xl p-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <Check size={15} className="shrink-0 mt-0.5" style={{ color: C.primary }} /><span className="text-xs leading-relaxed" style={{ color: C.text, ...fontBody }}>{x}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="shrink-0 pt-1"><Btn full onClick={onClose}>{ok}</Btn></div>
      </div>
    </div>
  );
}

function NotifPromptSheet({ onAccept, onLater }) {
  const { lang } = useLang();
  const T = {
    title: tr(lang, { fr: "Activer les rappels ?", en: "Turn on reminders?", es: "¿Activar los recordatorios?", pt: "Ativar os lembretes?" }),
    desc: tr(lang, { fr: "REGEN peut te prévenir la veille d'une séance, avant l'heure du coucher et pour tes étirements. Tu pourras le changer à tout moment dans ton profil.", en: "REGEN can notify you the day before a session, before bedtime and for your stretches. You can change this at any time in your profile.", es: "REGEN puede avisarte la víspera de una sesión, antes de la hora de acostarte y para tus estiramientos. Puedes cambiarlo en cualquier momento en tu perfil.", pt: "O REGEN pode avisar você na véspera de uma sessão, antes da hora de dormir e para os seus alongamentos. Você pode mudar isso a qualquer momento no seu perfil." }),
    yes: tr(lang, { fr: "Activer", en: "Turn on", es: "Activar", pt: "Ativar" }),
    later: tr(lang, { fr: "Plus tard", en: "Not now", es: "Más tarde", pt: "Agora não" }),
  };
  return (
    <div className="absolute inset-0 flex flex-col justify-end" style={{ zIndex: 85, background: "rgba(0,0,0,0.62)" }}>
      <div role="dialog" aria-label={T.title} className="rounded-t-[28px] px-5 pt-5 flex flex-col" style={{ background: C.bg, border: `1px solid ${C.glassBorder}`, borderBottom: "none", paddingBottom: "max(20px, env(safe-area-inset-bottom))", boxShadow: "0 -20px 50px rgba(0,0,0,.5)" }}>
        <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: C.border }} />
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: C.primarySoft, border: `1px solid ${C.primary}55` }}><Bell size={22} style={{ color: C.primary }} /></div>
          <h2 className="text-lg font-extrabold tracking-tight leading-tight" style={{ color: C.text, ...fontDisplay }}>{T.title}</h2>
        </div>
        <p className="text-sm leading-relaxed mb-5" style={{ color: C.textMuted, ...fontBody }}>{T.desc}</p>
        <Btn full onClick={onAccept}>{T.yes}</Btn>
        <button onClick={onLater} className="w-full py-3 mt-1 text-sm font-semibold" style={{ color: C.textMuted, ...fontBody }}>{T.later}</button>
      </div>
    </div>
  );
}

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
    dietLabel: tr(lang, { fr: "Régime alimentaire", en: "Diet", es: "Régimen alimentario", pt: "Regime alimentar" }),
    allergyNote: tr(lang, { fr: "Les repas proposés sont des suggestions générales : vérifie toujours les étiquettes des produits (traces possibles). En cas d'allergie grave, demande l'avis de ton médecin.", en: "Suggested meals are general ideas: always check product labels (traces possible). With a severe allergy, ask your doctor.", es: "Las comidas propuestas son sugerencias generales: revisa siempre las etiquetas (posibles trazas). Con una alergia grave, consulta a tu médico.", pt: "As refeições propostas são sugestões gerais: confira sempre os rótulos (possíveis traços). Em caso de alergia grave, consulte seu médico." }),
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
    freeF2: tr(lang, { fr: "Plans de récup & conseils blessures", en: "Recovery plans & injury guidance", es: "Planes de recuperación y orientación de lesiones", pt: "Planos de recuperação e orientação de lesões" }),
    freeF3: tr(lang, { fr: `${FREE_EXCEPTIONS_PER_MONTH} RDV/exceptions par mois`, en: `${FREE_EXCEPTIONS_PER_MONTH} appointments/exceptions per month`, es: `${FREE_EXCEPTIONS_PER_MONTH} citas/excepciones al mes`, pt: `${FREE_EXCEPTIONS_PER_MONTH} consultas/exceções por mês` }),
    proTitle: tr(lang, { fr: "Pro — 7 jours gratuits", en: "Pro — 7 days free", es: "Pro — 7 días gratis", pt: "Pro — 7 dias grátis" }),
    proF1: tr(lang, { fr: "Sports & séances illimités", en: "Unlimited sports & sessions", es: "Deportes y sesiones ilimitados", pt: "Esportes e sessões ilimitados" }),
    proF2: tr(lang, { fr: "Nutrition avancée & récup intelligente", en: "Advanced nutrition & smart recovery", es: "Nutrición avanzada y recuperación inteligente", pt: "Nutrição avançada e recuperação inteligente" }),
    proF3: tr(lang, { fr: "RDV/exceptions illimités", en: "Unlimited appointments/exceptions", es: "Citas/excepciones ilimitadas", pt: "Consultas/exceções ilimitadas" }),
    proPrice: tr(lang, { fr: "Puis 5,99€/mois ou 39,99€/an. Résiliable à tout moment.", en: "Then €5.99/mo or €39.99/yr. Cancel anytime.", es: "Luego 5,99€/mes o 39,99€/año. Cancela cuando quieras.", pt: "Depois 5,99€/mês ou 39,99€/ano. Cancele quando quiser." }),
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
          <Field label={T.birth}><TextInput type="date" value={p.dateNaissance} onChange={(e) => setP({ ...p, dateNaissance: e.target.value })} />{p.dateNaissance && <p className="text-xs mt-1.5" style={{ color: C.textFaint, ...fontBody }}>{T.ageHint(computeAge(p.dateNaissance))}</p>}</Field>
          <Field label={T.height}><TextInput type="number" value={p.taille} onChange={(e) => setP({ ...p, taille: e.target.value })} placeholder="178" /></Field>
          <Field label={T.weight}><TextInput type="number" value={p.poids} onChange={(e) => setP({ ...p, poids: e.target.value })} placeholder="72" /></Field>
        </>)}
        {step === 1 && (<>
          <p className="text-xs mb-4" style={{ color: C.textMuted, ...fontBody }}>{T.planQuestion}</p>
          <button onClick={() => choosePlan("free")} className="w-full text-left rounded-2xl p-4 mb-3" style={{ background: planChoice === "free" ? C.primarySoft : C.surface, border: `1px solid ${planChoice === "free" ? C.primary : C.borderSoft}66` }}>
            <div className="flex items-center justify-between mb-2"><p className="font-bold text-sm" style={{ color: C.text, ...fontDisplay }}>{T.freeTitle}</p>{planChoice === "free" && <Check size={16} style={{ color: C.primary }} />}</div>
            <ul className="text-xs leading-relaxed list-disc pl-4" style={{ color: C.textMuted, ...fontBody }}>
              <li>{T.freeF1}</li><li>{T.freeF2}</li><li>{T.freeF3}</li>
            </ul>
          </button>
          <button onClick={() => choosePlan("pro")} className="w-full text-left rounded-2xl p-4" style={{ background: planChoice === "pro" ? `linear-gradient(155deg, ${C.primary}26, ${C.surface})` : C.surface, border: `1px solid ${planChoice === "pro" ? C.primary : C.borderSoft}66` }}>
            <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-1.5"><Crown size={14} style={{ color: C.primary }} /><p className="font-bold text-sm" style={{ color: C.text, ...fontDisplay }}>{T.proTitle}</p></div>{planChoice === "pro" && <Check size={16} style={{ color: C.primary }} />}</div>
            <ul className="text-xs leading-relaxed list-disc pl-4 mb-2" style={{ color: C.textMuted, ...fontBody }}>
              <li>{T.proF1}</li><li>{T.proF2}</li><li>{T.proF3}</li>
            </ul>
            <p className="text-[11px]" style={{ color: C.textFaint, ...fontBody }}>{T.proPrice}</p>
          </button>
          {planChoice && <p className="text-xs mt-4 text-center" style={{ color: C.primary, ...fontBody }}>{planChoice === "pro" ? T.chosenPro : T.chosenFree}</p>}
          <LegalFooter className="mt-4" />
        </>)}
        {step === 2 && (<>
          <Field label={T.sportsLabel}><SportGrid selected={p.sports} onToggle={toggleSport} />{!isPro && <p className="text-[11px] mt-2" style={{ color: C.textFaint, ...fontBody }}>{T.sportsFreeHint}</p>}</Field>
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
          <p className="text-xs mb-4" style={{ color: C.textFaint, ...fontBody }}>{T.allergiesHint}</p>
          <Field label={T.allergiesLabel}>
            <div className="flex flex-wrap gap-2">{ALLERGENS.filter((a) => a.group === "allergy").map((a) => (<Pill key={a.key} active={p.allergies.includes(a.key)} onClick={() => toggleAllergy(a.key)}>{tr(lang, a)}</Pill>))}</div>
          </Field>
          <Field label={T.dietLabel}>
            <div className="flex flex-wrap gap-2">{ALLERGENS.filter((a) => a.group === "diet").map((a) => (<Pill key={a.key} active={p.allergies.includes(a.key)} onClick={() => toggleAllergy(a.key)}>{tr(lang, a)}</Pill>))}</div>
          </Field>
          <p className="text-xs leading-relaxed mb-5" style={{ color: C.textFaint, ...fontBody }}>{T.allergyNote}</p>
          <Field label={T.dislikedLabel}>
            <p className="text-xs mb-2" style={{ color: C.textFaint, ...fontBody }}>{T.dislikedHint}</p>
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
          <LegalFooter className="mt-2 mb-2" />
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
        <button onClick={onRemove} className="shrink-0 mt-1 p-2 -m-2"><Trash2 size={15} style={{ color: C.textFaint }} /></button>
      </div>
      <select value={entry.sport} onChange={(e) => onChange({ sport: e.target.value })} className="text-xs rounded-xl px-2 py-1.5 w-full mb-2" style={inputStyle}>{Object.entries(SPORTS).map(([k]) => <option key={k} value={k}>{sportIcon(k)} {sportLabel(k, lang)}</option>)}</select>
      {entry.sport === "muscu" && (
        <div className="mb-2">
          <p className="text-[11px] mb-1.5" style={{ color: C.textFaint }}>{T.zones}</p>
          <MuscuZonePicker selected={entry.muscuZones || []} onToggle={toggleZone} />
        </div>
      )}
      {(entry.type === "entrainement" || entry.type === "loisir") && <div className="mb-2"><SegmentedControl small options={[{ value: "chill", label: T.chill }, { value: "moyen", label: T.moyen }, { value: "intense", label: T.intense }]} value={entry.intensity} onChange={(v) => onChange({ intensity: v })} colorMap={{ chill: C.primaryDim, moyen: C.primary, intense: C.warn }} /></div>}
      <div className="flex gap-2 mb-2">
        <div className="flex-1"><p className="text-[11px] mb-1" style={{ color: C.textFaint }}>{T.heure}</p><TextInput type="time" value={entry.heure || ""} onChange={(e) => onChange({ heure: e.target.value })} /></div>
        <div className="flex-1"><p className="text-[11px] mb-1" style={{ color: C.textFaint }}>{T.label}</p><TextInput value={entry.label || ""} onChange={(e) => onChange({ label: e.target.value })} placeholder={T.optional} /></div>
      </div>
      <button onClick={() => onChange({ notify: !entry.notify })} className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: entry.notify ? C.primary : "transparent", border: `1px solid ${entry.notify ? C.primary : C.border}` }}>{entry.notify && <Check size={11} color="#052821" />}</div>
        <span className="text-xs" style={{ color: C.text, ...fontBody }}>{T.notify}</span>
      </button>
      {entry.notify && <div className="mt-2"><p className="text-[11px] mb-1" style={{ color: C.textFaint }}>{T.reminderTime}</p><TextInput type="time" value={entry.notifyTime || "20:00"} onChange={(e) => onChange({ notifyTime: e.target.value })} /></div>}
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
      {!isPro && <p className="text-[11px] mt-2" style={{ color: C.textFaint, ...fontBody }}>{T.freeLimitHint}</p>}
    </div>
  );
}

/* ============================================================
   RÉCUP APRÈS SÉANCE (séance imprévue déjà faite)
   ============================================================ */
function RecupTab({ profile, onGenerate, result, setResult, onPlanFuture, sessionsLog, embedded, onAdded }) {
  const { lang } = useLang();
  const [sport, setSport] = useState(profile.sports?.[0] || "autre");
  const [eventType, setEventType] = useState("entrainement");
  const [intensity, setIntensity] = useState("moyen");
  const [fatigue, setFatigue] = useState(3);
  const [hoursToNext, setHoursToNext] = useState(48);
  const [heure, setHeure] = useState("");
  const [muscuZones, setMuscuZones] = useState([]);
  const [minutes, setMinutes] = useState(0);
  const [rpe, setRpe] = useState(6);

  const sportOptions = useMemo(() => {
    const declared = (profile.sports || []).map((k) => ({ value: k, label: `${sportIcon(k)} ${sportLabel(k, lang)}` }));
    const others = Object.keys(SPORTS).filter((k) => !(profile.sports || []).includes(k)).map((k) => ({ value: k, label: `${sportIcon(k)} ${sportLabel(k, lang)}` }));
    return [...declared, ...others];
  }, [profile.sports, lang]);

  const toggleZone = (k) => setMuscuZones((prev) => prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]);
  const submit = () => { const plan = generatePlan(profile, { eventType, intensity, fatigue, hoursToNext, sport, heure, muscuZones, minutes: minutes || null, rpe: minutes ? rpe : null }, lang); onGenerate(plan); if (embedded) { setMinutes(0); setHeure(""); setMuscuZones([]); onAdded && onAdded(); } else setResult(plan); };

  const T = {
    title: tr(lang, { fr: "Séance imprévue déjà faite", en: "Unplanned session, already done", es: "Sesión imprevista ya hecha", pt: "Sessão imprevista já feita" }),
    subtitle: tr(lang, { fr: "Tu as fait une séance qui n'était pas au planning ? Reçois ta récup", en: "Did a session that wasn't in your schedule? Get your recovery", es: "¿Hiciste una sesión que no estaba en tu plan? Recibe tu recuperación", pt: "Fez uma sessão que não estava na agenda? Receba sua recuperação" }),
    how: tr(lang, { fr: "Comment ça marche", en: "How it works", es: "Cómo funciona", pt: "Como funciona" }),
    howText: tr(lang, { fr: "Tu viens de faire une séance qui n'était pas prévue (un sport déclaré ou une activité pour le plaisir) ? Génère ton plan de récup juste après. Il est conservé : tu le retrouves dans l'historique de l'accueil, et la séance est ajoutée à ton planning pour aujourd'hui.", en: "Just did a session that wasn't planned (one of your sports or something for fun)? Generate your recovery plan right after. It's kept: you'll find it in the history on the home screen, and the session is added to your schedule for today.", es: "¿Acabas de hacer una sesión que no estaba prevista (uno de tus deportes o algo por diversión)? Genera tu plan de recuperación justo después. Se conserva: lo encuentras en el historial de inicio y la sesión se añade a tu planificación de hoy.", pt: "Acabou de fazer uma sessão que não estava prevista (um dos seus esportes ou algo por diversão)? Gere seu plano de recuperação logo depois. Ele fica guardado: você o encontra no histórico do início e a sessão é adicionada ao planejamento de hoje." }),
    futureLink: tr(lang, { fr: "Une séance que tu connais à l'avance ? Ajoute-la au planning →", en: "A session you know about in advance? Add it to your schedule →", es: "¿Una sesión que conoces de antemano? Añádela a la planificación →", pt: "Uma sessão que você já conhece? Adicione-a ao planejamento →" }),
    step1: tr(lang, { fr: "1 · La séance", en: "1 · The session", es: "1 · La sesión", pt: "1 · A sessão" }),
    step2: tr(lang, { fr: "2 · Ton état", en: "2 · How you feel", es: "2 · Tu estado", pt: "2 · Seu estado" }),
    sportLabel: tr(lang, { fr: "Sport de la séance", en: "Session sport", es: "Deporte de la sesión", pt: "Esporte da sessão" }),
    zonesLabel: tr(lang, { fr: "Zone(s) travaillée(s) — plusieurs choix possibles", en: "Muscle zone(s) — multiple choices possible", es: "Zona(s) trabajada(s) — varias opciones posibles", pt: "Zona(s) trabalhada(s) — múltiplas opções possíveis" }),
    typeLabel: tr(lang, { fr: "Type de séance", en: "Session type", es: "Tipo de sesión", pt: "Tipo de sessão" }),
    intensityLabel: tr(lang, { fr: "Intensité de la séance", en: "Session intensity", es: "Intensidad de la sesión", pt: "Intensidade da sessão" }),
    fatigueLabel: (f) => tr(lang, { fr: `Niveau de fatigue ressentie : ${f}/5`, en: `Perceived fatigue level: ${f}/5`, es: `Nivel de fatiga percibida: ${f}/5`, pt: `Nível de fadiga percebida: ${f}/5` }),
    hoursLabel: tr(lang, { fr: "Temps avant la prochaine séance / le prochain match", en: "Time before your next session / match", es: "Tiempo antes de la próxima sesión / partido", pt: "Tempo até a próxima sessão / jogo" }),
    heureLabel: tr(lang, { fr: "Heure de la séance (optionnel)", en: "Session time (optional)", es: "Hora de la sesión (opcional)", pt: "Horário da sessão (opcional)" }),
    generate: tr(lang, { fr: "Générer mon plan de récup", en: "Generate my recovery plan", es: "Generar mi plan de recuperación", pt: "Gerar meu plano de recuperação" }),
    newSession: tr(lang, { fr: "Nouvelle séance", en: "New session", es: "Nueva sesión", pt: "Nova sessão" }),
    scoreExplain: tr(lang, { fr: "Score de 0 à 100 calculé pour cette séance : plus il est haut, plus ton corps a besoin de temps pour récupérer.", en: "Score from 0 to 100 calculated for this session: the higher it is, the more time your body needs to recover.", es: "Puntuación de 0 a 100 calculada para esta sesión: cuanto más alta, más tiempo necesita tu cuerpo para recuperarse.", pt: "Pontuação de 0 a 100 calculada para esta sessão: quanto mais alta, mais tempo seu corpo precisa para se recuperar." }),
    generalDisclaimer: tr(lang, { fr: "Conseils généraux de récupération : ils ne remplacent pas l'avis d'un professionnel de santé. En cas de douleur persistante, consulte un professionnel.", en: "General recovery advice: it doesn't replace a health professional's opinion. If pain persists, see a professional.", es: "Consejos generales de recuperación: no sustituyen la opinión de un profesional sanitario. Si el dolor persiste, consulta a un profesional.", pt: "Conselhos gerais de recuperação: não substituem a opinião de um profissional de saúde. Se a dor persistir, consulte um profissional." }),
    loadNote: (n) => tr(lang, { fr: `Score majoré : tu as déjà fait ${n} séances ces 7 derniers jours.`, en: `Score increased: you already did ${n} sessions in the last 7 days.`, es: `Puntuación aumentada: ya hiciste ${n} sesiones en los últimos 7 días.`, pt: `Pontuação aumentada: você já fez ${n} sessões nos últimos 7 dias.` }),
    addDone: tr(lang, { fr: "Ajouter cette séance", en: "Add this session", es: "Añadir esta sesión", pt: "Adicionar esta sessão" }),
    durLabel: tr(lang, { fr: "Durée de la séance (optionnel)", en: "Session length (optional)", es: "Duración de la sesión (opcional)", pt: "Duração da sessão (opcional)" }),
    durNone: tr(lang, { fr: "Non précisée", en: "Not specified", es: "Sin especificar", pt: "Não informada" }),
    rpeLabel: (n) => tr(lang, { fr: `Effort ressenti : ${n}/10`, en: `Perceived effort: ${n}/10`, es: `Esfuerzo percibido: ${n}/10`, pt: `Esforço percebido: ${n}/10` }),
    rpeHint: tr(lang, { fr: "1 = très facile · 10 = effort maximal", en: "1 = very easy · 10 = maximal effort", es: "1 = muy fácil · 10 = esfuerzo máximo", pt: "1 = muito fácil · 10 = esforço máximo" }),
    usedNote: (m, r) => tr(lang, { fr: `Calculé avec ta durée (${m} min) et ton effort (${r}/10).`, en: `Calculated with your length (${m} min) and effort (${r}/10).`, es: `Calculado con tu duración (${m} min) y esfuerzo (${r}/10).`, pt: `Calculado com sua duração (${m} min) e esforço (${r}/10).` }),
    formNote: (r) => tr(lang, { fr: `Ton bilan du jour (forme ${r}/100) a été pris en compte.`, en: `Your daily check-in (form ${r}/100) was factored in.`, es: `Se tuvo en cuenta tu chequeo del día (forma ${r}/100).`, pt: `Seu check-in do dia (forma ${r}/100) foi considerado.` }),
    soreNote: tr(lang, { fr: "Tes zones sensibles ont été ajoutées aux étirements.", en: "Your sore areas were added to the stretches.", es: "Tus zonas sensibles se añadieron a los estiramientos.", pt: "Suas áreas sensíveis foram adicionadas aos alongamentos." }),
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

  const wrapCls = embedded ? "" : "px-5 pb-24 pt-4";
  if (result && !embedded) {
    return (
      <div className={wrapCls}>
        <button onClick={() => setResult(null)} className="text-xs mb-3 flex items-center gap-1 py-2" style={{ color: C.primary }}><ChevronLeft size={14} /> {T.newSession}</button>
        <HeroCard accent={scoreColor(result.score)} className="flex flex-col items-center mb-6" style={{ paddingTop: 24, paddingBottom: 20 }}>
          <div className="flex items-center gap-1.5 mb-2 flex-wrap justify-center"><Badge color={C.textMuted}>{fmtDate(result.date, lang)}</Badge><Badge color={C.textMuted}>{sportIcon(result.sport)} {sportLabel(result.sport, lang)}</Badge><Badge color={C.textMuted}>{result.eventType === "match" ? T.matchLabel : result.eventType === "loisir" ? T.loisirLabel : T.entrainementLabel}</Badge>{result.sport === "muscu" && result.muscuZones?.length > 0 && <Badge color={C.textMuted}>{result.muscuZones.map((z) => zoneLabel(z, lang)).join(" + ")}</Badge>}</div>
          <RecoveryDial score={result.score} label={T.recoveryNeed} sub={result.duree} size={190} />
          <p className="text-[11px] leading-relaxed text-center mt-3 px-3" style={{ color: C.textFaint, ...fontBody }}>{T.scoreExplain}</p>
          <p className="text-[11px] leading-relaxed text-center mt-2 px-3" style={{ color: C.textFaint, ...fontBody }}>{T.generalDisclaimer}</p>
          {result.weekLoad >= 2 && <p className="text-xs leading-relaxed text-center mt-2 px-3 font-semibold" style={{ color: C.warn, ...fontBody }}>{T.loadNote(result.weekLoad)}</p>}
          {result.minutes && result.rpe && <p className="text-[11px] leading-relaxed text-center mt-2 px-3" style={{ color: C.textFaint, ...fontBody }}>{T.usedNote(result.minutes, result.rpe)}</p>}
          {result.readiness != null && <p className="text-[11px] leading-relaxed text-center mt-1 px-3" style={{ color: C.textFaint, ...fontBody }}>{T.formNote(result.readiness)}</p>}
          {result.soreZones && result.soreZones.length > 0 && <p className="text-[11px] leading-relaxed text-center mt-1 px-3" style={{ color: C.textFaint, ...fontBody }}>{T.soreNote}</p>}
          <div className="flex gap-4 mt-4 text-center">
            <div><Moon size={16} style={{ color: C.primary, margin: "0 auto" }} /><p style={{ ...fontMono, color: C.text, fontSize: 16 }}>{result.sommeil}h</p><p className="text-[11px]" style={{ color: C.textMuted }}>{T.sleep}</p></div>
            <div><Droplet size={16} style={{ color: C.primary, margin: "0 auto" }} /><p style={{ ...fontMono, color: C.text, fontSize: 16 }}>{result.hydratation}L</p><p className="text-[11px]" style={{ color: C.textMuted }}>{T.hydration}</p></div>
          </div>
        </HeroCard>
        <RecoveryChecklist plan={result} checkKey={`s:${result.date}`} />
        <PlanTabs plan={result} />
      </div>
    );
  }

  return (
    <div className={wrapCls}>
      {!embedded && <LargeHeader title={T.title} subtitle={T.subtitle} />}
      {!embedded && <InfoToggle label={T.how}>{T.howText}</InfoToggle>}
      <p className="text-[11px] font-bold uppercase tracking-widest mb-3 px-1" style={{ color: C.textFaint, ...fontBody }}>{T.step1}</p>
      <Card className="mb-6">
        <Field label={T.sportLabel}><Select value={sport} onChange={(e) => setSport(e.target.value)} options={sportOptions} /></Field>
        {sport === "muscu" && <Field label={T.zonesLabel}><MuscuZonePicker selected={muscuZones} onToggle={toggleZone} /></Field>}
        <Field label={T.typeLabel}><SegmentedControl options={[{ value: "entrainement", label: T.entrainementLabel }, { value: "match", label: T.matchLabel }, { value: "loisir", label: T.loisirLabel }]} value={eventType} onChange={setEventType} colorMap={{ entrainement: C.primary, match: C.danger, loisir: C.loisir }} /></Field>
        {eventType !== "match" && <Field label={T.intensityLabel}><SegmentedControl options={[{ value: "chill", label: T.chill }, { value: "moyen", label: T.moyen }, { value: "intense", label: T.intense }]} value={intensity} onChange={setIntensity} colorMap={{ chill: C.primaryDim, moyen: C.primary, intense: C.warn }} /></Field>}
        <Field label={T.heureLabel}><TextInput type="time" value={heure} onChange={(e) => setHeure(e.target.value)} /></Field>
        <Field label={T.durLabel}><Select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} options={[{ value: 0, label: T.durNone }, ...[15, 30, 45, 60, 75, 90, 120, 150, 180].map((m) => ({ value: m, label: `${m} min` }))]} /></Field>
        {minutes > 0 && <Field label={T.rpeLabel(rpe)}><input type="range" min={1} max={10} value={rpe} onChange={(e) => setRpe(Number(e.target.value))} className="w-full" style={{ accentColor: C.primary }} /><p className="text-[11px] mt-1" style={{ color: C.textFaint, ...fontBody }}>{T.rpeHint}</p></Field>}
      </Card>
      <p className="text-[11px] font-bold uppercase tracking-widest mb-3 px-1" style={{ color: C.textFaint, ...fontBody }}>{T.step2}</p>
      <Card className="mb-7">
        <Field label={T.fatigueLabel(fatigue)}><input type="range" min={1} max={5} value={fatigue} onChange={(e) => setFatigue(Number(e.target.value))} className="w-full" style={{ accentColor: C.primary }} /></Field>
        <Field label={T.hoursLabel}><Select value={hoursToNext} onChange={(e) => setHoursToNext(Number(e.target.value))} options={[{ value: 12, label: T.lt12 }, { value: 24, label: T.h24 }, { value: 48, label: T.h48 }, { value: 72, label: T.h72 }, { value: 96, label: T.gt4 }]} /></Field>
      </Card>
      <Btn full onClick={submit} icon={embedded ? Plus : Sparkles}>{embedded ? T.addDone : T.generate}</Btn>
      {onPlanFuture && !embedded && <button type="button" onClick={onPlanFuture} className="w-full text-center mt-5 text-[12px] font-semibold" style={{ color: C.primary, ...fontBody }}>{T.futureLink}</button>}
    </div>
  );
}

/* ============================================================
   NUTRITION TAB
   ============================================================ */
// Répartition indicative des besoins du jour (≈25 % avant / 30 % après ; jour de repos 35 % / 15 %).
function mealRef(plan, which) {
  const n = plan && plan.nutrients; if (!n || !n.kcal) return null;
  const share = plan.restDay ? { pre: 0.35, post: 0.15 } : { pre: 0.25, post: 0.30 };
  const f = share[which];
  return [Math.round((n.kcal * f) / 10) * 10, Math.round(n.protein * f)];
}
function NutritionTab({ lastPlan, onBack }) {
  const { lang } = useLang();
  const { isPro } = usePro();
  const T = {
    title: tr(lang, { fr: "Nutrition", en: "Nutrition", es: "Nutrición", pt: "Nutrição" }),
    empty: tr(lang, { fr: "Génère d'abord un plan de récup pour obtenir des conseils repas et hydratation.", en: "Generate a recovery plan first to get meal and hydration advice.", es: "Genera primero un plan de recuperación para obtener consejos de comida e hidratación.", pt: "Gere primeiro um plano de recuperação para obter dicas de refeição e hidratação." }),
    lastSession: tr(lang, { fr: "dernière séance", en: "last session", es: "última sesión", pt: "última sessão" }),
    needs: tr(lang, { fr: "Besoins estimés", en: "Estimated needs", es: "Necesidades estimadas", pt: "Necessidades estimadas" }),
    kcal: "kcal", protein: tr(lang, { fr: "Protéines", en: "Protein", es: "Proteínas", pt: "Proteínas" }), carbs: tr(lang, { fr: "Glucides", en: "Carbs", es: "Carbohidratos", pt: "Carboidratos" }), fat: tr(lang, { fr: "Lipides", en: "Fat", es: "Grasas", pt: "Gorduras" }),
    mealBefore: tr(lang, { fr: "Repas avant l'effort", en: "Meal before training", es: "Comida antes del esfuerzo", pt: "Refeição antes do esforço" }),
    mealAfter: tr(lang, { fr: "Repas après l'effort", en: "Meal after training", es: "Comida después del esfuerzo", pt: "Refeição depois do esforço" }),
    toEatAt: (t) => tr(lang, { fr: `À prendre ${t}`, en: `Eat it ${t}`, es: `Tómalo ${t}`, pt: `Coma ${t}` }),
    hydration: tr(lang, { fr: "Hydratation", en: "Hydration", es: "Hidratación", pt: "Hidratação" }),
    recommendedDay: tr(lang, { fr: "recommandés sur la journée de récup", en: "recommended for your recovery day", es: "recomendados para el día de recuperación", pt: "recomendados para o dia de recuperação" }),
    back: tr(lang, { fr: "Accueil", en: "Home", es: "Inicio", pt: "Início" }),
    disclaimer: tr(lang, { fr: "Repères généraux, à adapter à ta faim et à tes besoins. Ils ne remplacent pas l'avis d'un médecin ou d'un diététicien. Vérifie toujours les étiquettes en cas d'allergie.", en: "General guidelines: adapt them to your hunger and needs. They don't replace a doctor's or dietitian's advice. Always check labels if you have an allergy.", es: "Pautas generales: adáptalas a tu hambre y necesidades. No sustituyen el consejo de un médico o dietista. Revisa siempre las etiquetas si tienes alergias.", pt: "Orientações gerais: adapte-as à sua fome e necessidades. Não substituem o conselho de um médico ou nutricionista. Verifique sempre os rótulos se tiver alergia." }),
    perMeal: (k, pr) => tr(lang, { fr: `Repère : ≈ ${k} kcal · ≈ ${pr} g de protéines`, en: `Guide: ≈ ${k} kcal · ≈ ${pr} g protein`, es: `Referencia: ≈ ${k} kcal · ≈ ${pr} g de proteínas`, pt: `Referência: ≈ ${k} kcal · ≈ ${pr} g de proteínas` }),
    footer: tr(lang, { fr: "Repas ciblés selon ton sport, et variés d'une séance à l'autre.", en: "Meals tailored to your sport, and varied from one session to the next.", es: "Comidas adaptadas a tu deporte, variadas de una sesión a otra.", pt: "Refeições adaptadas ao seu esporte, variadas de uma sessão para outra." }),
  };
  const backBtn = onBack ? <button onClick={onBack} className="text-xs mb-1 flex items-center gap-1 py-2 pr-3" style={{ color: C.primary }}><ChevronLeft size={14} /> {T.back}</button> : null;
  if (!lastPlan) return (<div className="px-5 pt-4 pb-24">{backBtn}<LargeHeader title={T.title} /><Card><p className="text-xs" style={{ color: C.textMuted, ...fontBody }}>{T.empty}</p></Card></div>);
  return (
    <div className="px-5 pt-4 pb-24">
      {backBtn}
      <LargeHeader title={T.title} subtitle={`${sportIcon(lastPlan.sport)} ${sportLabel(lastPlan.sport, lang)} · ${T.lastSession}`} />
      <ProLock active={!isPro}>
        <Card className="mb-4">
          <SectionTitle icon={Flame} action={<ProBadge />}>{T.needs}</SectionTitle>
          <div className="grid grid-cols-4 gap-2 text-center mb-1">
            <div><p style={{ ...fontMono, color: C.primary, fontSize: 18 }}>{lastPlan.nutrients.kcal}</p><p className="text-[11px] uppercase" style={{ color: C.textFaint }}>{T.kcal}</p></div>
            <div><p style={{ ...fontMono, color: C.text, fontSize: 18 }}>{lastPlan.nutrients.protein}g</p><p className="text-[11px] uppercase" style={{ color: C.textFaint }}>{T.protein}</p></div>
            <div><p style={{ ...fontMono, color: C.text, fontSize: 18 }}>{lastPlan.nutrients.carbs}g</p><p className="text-[11px] uppercase" style={{ color: C.textFaint }}>{T.carbs}</p></div>
            <div><p style={{ ...fontMono, color: C.text, fontSize: 18 }}>{lastPlan.nutrients.fat}g</p><p className="text-[11px] uppercase" style={{ color: C.textFaint }}>{T.fat}</p></div>
          </div>
        </Card>
      </ProLock>
      <Card className="mb-4"><SectionTitle icon={Clock}>{T.mealBefore}</SectionTitle><p className="text-xs leading-relaxed mb-2" style={{ color: C.textMuted, ...fontBody }}>{lastPlan.meals.pre}</p>{isPro && mealRef(lastPlan, "pre") && <p className="text-xs mb-2" style={{ color: C.textMuted, ...fontBody }}>{T.perMeal(...mealRef(lastPlan, "pre"))}</p>}<p className="text-[11px] font-semibold" style={{ color: C.primary, ...fontBody }}>{T.toEatAt(mealTiming(lastPlan.eventType, lastPlan.intensity, lang).pre)}</p></Card>
      <Card className="mb-4"><SectionTitle icon={TrendingUp}>{T.mealAfter}</SectionTitle><p className="text-xs leading-relaxed mb-2" style={{ color: C.textMuted, ...fontBody }}>{lastPlan.meals.post}</p>{isPro && mealRef(lastPlan, "post") && <p className="text-xs mb-2" style={{ color: C.textMuted, ...fontBody }}>{T.perMeal(...mealRef(lastPlan, "post"))}</p>}<p className="text-[11px] font-semibold" style={{ color: C.primary, ...fontBody }}>{T.toEatAt(mealTiming(lastPlan.eventType, lastPlan.intensity, lang).post)}</p></Card>
      <Card><SectionTitle icon={Droplet}>{T.hydration}</SectionTitle><div className="flex items-center gap-3 mb-2"><span style={{ ...fontMono, color: C.primary, fontSize: 28 }}>{lastPlan.hydratation}L</span><span className="text-xs" style={{ color: C.textMuted, ...fontBody }}>{T.recommendedDay}</span></div></Card>
      <p className="text-[11px] mt-3 text-center" style={{ color: C.textFaint, ...fontBody }}>{T.footer}</p>
      <p className="text-[11px] mt-2 text-center leading-relaxed" style={{ color: C.textFaint, ...fontBody }}>{T.disclaimer}</p>
    </div>
  );
}

/* ============================================================
   BLESSURES TAB
   ============================================================ */
function BlessuresTab({ injuries, onAddInjury, onUpdateInjury, onDeleteInjury, onAddRdv }) {
  const { lang } = useLang();
  const [view, setView] = useState("conseil");
  const [part, setPart] = useState(""); const [symptom, setSymptom] = useState(""); const [advice, setAdvice] = useState(null);
  const submitAdvice = () => { if (!part || !symptom) return; setAdvice(getInjuryAdvice(part, symptom, lang)); };
  const saveConseil = () => { onAddInjury({ id: Date.now() + Math.random(), kind: "conseil", declaredDate: new Date().toISOString(), part, symptom, urgent: advice.urgent, specialistes: advice.specialistes, conseil: advice.conseil, arret: false, dateDebut: null, dateRetour: null }); setPart(""); setSymptom(""); setAdvice(null); setView("historique"); };

  const [aPart, setAPart] = useState(""); const [aLabel, setALabel] = useState("");
  const [aDebut, setADebut] = useState(isoLocal());
  const [aRetourConnu, setARetourConnu] = useState(false); const [aRetour, setARetour] = useState("");
  const saveArret = () => { if (!aPart || !aLabel) return; onAddInjury({ id: Date.now() + Math.random(), kind: "arret", declaredDate: new Date().toISOString(), part: aPart, symptom: aLabel, urgent: false, specialistes: [], conseil: "", arret: true, dateDebut: aDebut, dateRetour: aRetourConnu ? aRetour : null }); setAPart(""); setALabel(""); setADebut(isoLocal()); setARetourConnu(false); setARetour(""); setView("historique"); };

  const [editingReturn, setEditingReturn] = useState(null); const [editDate, setEditDate] = useState("");
  const saveReturnDate = (id) => { onUpdateInjury(id, { dateRetour: editDate || null }); setEditingReturn(null); setEditDate(""); };

  const [rdvFor, setRdvFor] = useState(null);
  const [rdvDate, setRdvDate] = useState(isoLocal());
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
    tabAdvice: tr(lang, { fr: "Conseil", en: "Advice", es: "Consejo", pt: "Conselho" }),
    tabStop: tr(lang, { fr: "Arrêt", en: "Time off", es: "Baja", pt: "Afastamento" }),
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
    declaredOn: (d) => tr(lang, { fr: `Déclarée le ${d}`, en: `Reported on ${d}`, es: `Declarada el ${d}`, pt: `Declarada em ${d}` }),
  };

  return (
    <div className="px-5 pt-4 pb-24">
      <LargeHeader title={T.title} subtitle={T.subtitle} />
      <div className="flex items-start gap-2 mb-6 px-3.5 py-3 rounded-2xl" style={{ background: C.warnSoft, border: `1px solid ${C.warn}33` }}>
        <AlertTriangle size={14} style={{ color: C.warn, marginTop: 1, flexShrink: 0 }} />
        <p className="text-xs leading-relaxed" style={{ color: C.warn, ...fontBody }}>{T.disclaimer}</p>
      </div>

      <div className="mb-6"><SegmentedControl options={[{ value: "conseil", label: T.tabAdvice }, { value: "arret", label: T.tabStop }, { value: "historique", label: `${T.history}${sorted.length ? ` (${sorted.length})` : ""}` }]} value={view} onChange={setView} /></div>

      {view === "conseil" && (<>
      <Card>
      <SectionTitle icon={User}>{T.specialistAdvice}</SectionTitle>
      <Field label={T.zone}><Select value={part} onChange={(e) => { setPart(e.target.value); setAdvice(null); }} options={BODY_PARTS.map((b) => ({ value: b.key, label: tr(lang, b) }))} placeholder={T.chooseZone} /></Field>
      <Field label={T.symptomType}><Select value={symptom} onChange={(e) => { setSymptom(e.target.value); setAdvice(null); }} options={SYMPTOMS.map((s) => ({ value: s.key, label: tr(lang, s) }))} placeholder={T.describeSymptom} /></Field>
      <Btn full onClick={submitAdvice} disabled={!part || !symptom}>{T.getGuidance}</Btn>
      </Card>
      {advice && (
        <div className="mt-5 flex flex-col gap-4">
          {advice.urgent && <Card style={{ background: C.dangerSoft, border: `1px solid ${C.danger}44` }}><div className="flex items-center gap-2 mb-1"><AlertTriangle size={15} style={{ color: C.danger }} /><p className="font-bold text-sm" style={{ color: C.danger, ...fontBody }}>{T.attention}</p></div><p className="text-xs leading-relaxed" style={{ color: C.danger, ...fontBody }}>{advice.urgentMsg}</p></Card>}
          <Card><SectionTitle icon={User}>{T.specialists}</SectionTitle><div className="flex flex-wrap gap-2">{advice.specialistes.map((s, i) => <span key={i} className="text-xs px-3 py-1.5 rounded-full font-semibold" style={{ background: C.primarySoft, color: C.primary, ...fontBody }}>{s}</span>)}</div></Card>
          <Card><SectionTitle icon={Sparkles}>{T.inTheMeantime}</SectionTitle><p className="text-xs leading-relaxed" style={{ color: C.textMuted, ...fontBody }}>{advice.conseil}</p></Card>
          <Btn full onClick={saveConseil} icon={Check}>{T.save}</Btn>
        </div>
      )}

      </>)}

      {view === "arret" && (
      <Card>
      <SectionTitle icon={Bell}>{T.declareStop}</SectionTitle>
      <p className="text-xs mb-5" style={{ color: C.textFaint, ...fontBody }}>{T.declareStopHint}</p>
      <Field label={T.zone}><Select value={aPart} onChange={(e) => setAPart(e.target.value)} options={BODY_PARTS.map((b) => ({ value: b.key, label: tr(lang, b) }))} placeholder={T.chooseZone} /></Field>
      <Field label={T.injuryType}><TextInput value={aLabel} onChange={(e) => setALabel(e.target.value)} placeholder={T.injuryTypePh} /></Field>
      <Field label={T.startDate}><TextInput type="date" value={aDebut} onChange={(e) => setADebut(e.target.value)} /></Field>
      <button onClick={() => setARetourConnu(!aRetourConnu)} className="flex items-center gap-3 mb-1 py-2">
        <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: aRetourConnu ? C.primary : "transparent", border: `1px solid ${aRetourConnu ? C.primary : C.border}` }}>{aRetourConnu && <Check size={11} color="#052821" />}</div>
        <span className="text-xs" style={{ color: C.text, ...fontBody }}>{T.knownReturn}</span>
      </button>
      {aRetourConnu ? <Field label={T.plannedReturn}><TextInput type="date" value={aRetour} onChange={(e) => setARetour(e.target.value)} /></Field> : <p className="text-xs mb-3" style={{ color: C.textFaint, ...fontBody }}>{T.laterHint}</p>}
      <Btn full onClick={saveArret} disabled={!aPart || !aLabel} icon={Check}>{T.declareStopBtn}</Btn>
      </Card>
      )}

      {view === "historique" && (
      <div>
        <SectionTitle icon={Clock}>{T.history}</SectionTitle>
        {sorted.length === 0 ? <Card><p className="text-xs" style={{ color: C.textFaint, ...fontBody }}>{T.noEntry}</p></Card> : (
          <div className="flex flex-col gap-4">
            {sorted.map((inj) => (
              <Card key={inj.id}>
                <div className="flex justify-between items-start mb-1.5">
                  <div><p className="text-sm font-semibold" style={{ color: C.text, ...fontBody }}>{bodyPartLabel(inj.part, lang)}</p><p className="text-xs" style={{ color: C.textMuted, ...fontBody }}>{inj.kind === "conseil" ? symptomLabel(inj.symptom, lang) : inj.symptom}</p></div>
                  <div className="flex items-center gap-2">
                    <Badge color={inj.kind === "arret" ? C.danger : C.primary}>{inj.kind === "arret" ? T.stop : T.advice}</Badge>
                    {inj.urgent && <Badge color={C.danger}>{T.urgent}</Badge>}
                    <button onClick={() => onDeleteInjury(inj.id)} aria-label="Supprimer" className="p-2 -m-2"><Trash2 size={15} style={{ color: C.textFaint }} /></button>
                  </div>
                </div>
                {inj.kind === "arret" ? (
                  <div className="mt-2 px-3 py-2 rounded-xl" style={{ background: C.dangerSoft }}>
                    <p className="text-xs" style={{ color: C.danger, ...fontBody }}>{T.stoppedSince(fmtDate(inj.dateDebut, lang))} {T.returnLabel(inj.dateRetour ? T.onDate(fmtDate(inj.dateRetour, lang)) : T.tbd)}</p>
                    {editingReturn === inj.id ? (
                      <div className="flex gap-2 mt-2"><TextInput type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} style={{ flex: 1 }} /><Btn small onClick={() => saveReturnDate(inj.id)}>{T.ok}</Btn></div>
                    ) : (
                      <button onClick={() => { setEditingReturn(inj.id); setEditDate(inj.dateRetour || ""); }} className="flex items-center gap-1 mt-1 py-2 text-xs" style={{ color: C.danger, ...fontBody }}><Pencil size={11} /> {inj.dateRetour ? T.editReturn : T.setReturn}</button>
                    )}
                  </div>
                ) : (
                  <div className="mt-1 flex flex-wrap gap-1.5">{inj.specialistes.map((s, i) => <span key={i} className="text-[11px] px-2 py-1 rounded-full" style={{ background: C.primarySoft, color: C.primary }}>{s}</span>)}</div>
                )}

                <div className="mt-3 pt-3" style={{ borderTop: `1px dashed ${C.border}` }}>
                  {rdvFor === inj.id ? (
                    <>
                      <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: C.rdv }}><Stethoscope size={12} /> {T.linkedRdv}</p>
                      <Field label={T.rdvDate}><TextInput type="date" value={rdvDate} onChange={(e) => setRdvDate(e.target.value)} /></Field>
                      <RdvForm value={rdvVal} onChange={setRdvVal} />
                      <div className="flex gap-2"><Btn small full onClick={() => saveRdv(inj)} icon={Check}>{T.saveRdv}</Btn><Btn small variant="ghost" onClick={() => setRdvFor(null)}>{T.cancel}</Btn></div>
                    </>
                  ) : (
                    <button onClick={() => { setRdvFor(inj.id); setRdvVal(newRdv()); }} className="flex items-center gap-1.5 text-xs font-semibold py-2" style={{ color: C.rdv }}><Stethoscope size={12} /> {T.addRdv}</button>
                  )}
                </div>
                <p className="text-[11px] mt-2" style={{ color: C.textFaint, ...fontBody }}>{T.declaredOn(fmtDate(inj.declaredDate, lang))}</p>
              </Card>
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  );
}

/* ============================================================
   DAY DETAIL SHEET
   ============================================================ */
function DayDetailSheet({ date, entries, isException, auto, profile, onClose, onSaveException, onClearException, onAddEntry, onRemoveEntry, goTo, onOpenPlan }) {
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
    seeInInjuries: tr(lang, { fr: "Voir dans Blessures →", en: "See in Injuries →", es: "Ver en Lesiones →", pt: "Ver em Lesões →" }),
    at: tr(lang, { fr: "Prévu à", en: "Scheduled at", es: "Previsto a las", pt: "Previsto às" }),
    match: tr(lang, { fr: "Match / Combat", en: "Match / Fight", es: "Partido / Combate", pt: "Jogo / Luta" }),
    loisir: tr(lang, { fr: "Séance loisir", en: "Casual session", es: "Sesión libre", pt: "Sessão livre" }),
    entrainement: tr(lang, { fr: "Entraînement", en: "Training", es: "Entrenamiento", pt: "Treino" }),
    editSport: tr(lang, { fr: "Modifier les séances sportives", en: "Edit sports sessions", es: "Editar sesiones deportivas", pt: "Editar sessões esportivas" }),
    save: tr(lang, { fr: "Enregistrer", en: "Save", es: "Salvar", pt: "Salvar" }),
    backToBase: tr(lang, { fr: "Revenir au planning de base", en: "Revert to default schedule", es: "Volver a la planificación base", pt: "Voltar ao planejamento padrão" }),
    addRdv: tr(lang, { fr: "Ajouter un RDV médical", en: "Add a medical appointment", es: "Añadir una cita médica", pt: "Adicionar consulta médica" }),
    saveRdv: tr(lang, { fr: "Enregistrer le RDV", en: "Save appointment", es: "Guardar la cita", pt: "Salvar consulta" }),
    sessionsOfDay: tr(lang, { fr: "Séances du jour — touche pour voir le détail", en: "Today's sessions — tap to see details", es: "Sesiones del día — toca para ver el detalle", pt: "Sessões do dia — toque para ver o detalhe" }),
    recupProgram: tr(lang, { fr: "Programme de récup", en: "Recovery program", es: "Programa de recuperación", pt: "Programa de recuperação" }),
    combinedNote: (n) => tr(lang, { fr: `Étirements et conseils réunis pour tes ${n} séances du jour.`, en: `Stretches and advice combined for your ${n} sessions today.`, es: `Estiramientos y consejos combinados para tus ${n} sesiones de hoy.`, pt: `Alongamentos e dicas reunidos para as suas ${n} sessões de hoje.` }),
    openPlan: tr(lang, { fr: "Voir le plan de récup complet", en: "View full recovery plan", es: "Ver el plan de recuperación completo", pt: "Ver o plano de recuperação completo" }),
    thisSessionStretches: tr(lang, { fr: "Étirements spécifiques à cette séance", en: "Stretches specific to this session", es: "Estiramientos específicos de esta sesión", pt: "Alongamentos específicos desta sessão" }),
  };

  const [expandedSessionId, setExpandedSessionId] = useState(null);
  const individualSportPlans = sportEntries.map((e) => ({ entry: e, plan: generatePlan(profile, { eventType: e.type, intensity: e.intensity || "moyen", fatigue: 3, hoursToNext: 48, sport: e.sport, heure: e.heure, muscuZones: e.muscuZones, seed: date + "-" + e.id, loadAt: new Date(date + "T00:00:00") }, lang) }));
  const combinedPlan = sportEntries.length > 0 ? mergeSportEntriesPlan(profile, sportEntries, date, lang) : null;
  const restPlan = entries.length === 0 ? buildRestDayPlan(profile, lang) : null;

  return (
    <div className="fixed-full flex items-end z-50" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="w-full rounded-t-[28px] p-5 pt-3 max-h-[85vh] overflow-y-auto" style={{ background: "rgba(15,33,28,0.78)", backdropFilter: "blur(32px)", WebkitBackdropFilter: "blur(32px)", border: `1px solid ${C.glassBorder}`, boxShadow: `inset 0 1px 0 ${C.glassHighlight}` }} onClick={(e) => e.stopPropagation()}>
        <div className="w-9 h-1 rounded-full mx-auto mb-4" style={{ background: C.border }} />
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-[11px] uppercase tracking-widest" style={{ color: C.textFaint, ...fontBody }}>{fmtDate(date, lang, { weekday: "long", day: "numeric", month: "long" })}</p>
            <p className="font-bold text-lg mt-1 tracking-tight" style={{ color: C.text, ...fontDisplay }}>{entries.length === 0 ? T.dayOff : T.itemsPlanned(entries.length)}</p>
          </div>
          <button onClick={onClose}><X size={18} style={{ color: C.textMuted }} /></button>
        </div>

        {entries.length === 0 && (
          <>
            {effectiveAuto?.level === "recup_active" ? (
              <Card className="mb-3" style={{ background: C.reposActifSoft, border: `1px solid ${C.reposActif}44` }}>
                <div className="flex items-center gap-2 mb-2"><Leaf size={15} style={{ color: C.reposActif }} /><p className="font-bold text-sm" style={{ color: C.reposActif, ...fontBody }}>{T.autoActive}</p></div>
                <p className="text-xs" style={{ color: C.reposActif, ...fontBody }}>{T.autoActiveNote}</p>
              </Card>
            ) : effectiveAuto?.level === "repos_complet" ? (
              <Card className="mb-3" style={{ background: C.dangerSoft, border: `1px solid ${C.danger}33` }}>
                <div className="flex items-center gap-2 mb-2"><Moon size={15} style={{ color: C.danger }} /><p className="font-bold text-sm" style={{ color: C.danger, ...fontBody }}>{T.fullRest}</p></div>
                <p className="text-xs leading-relaxed" style={{ color: C.danger, ...fontBody }}>{T.fullRestNote}</p>
              </Card>
            ) : (
              <Card className="mb-3" style={{ background: C.glassSoft }}>
                <p className="text-xs" style={{ color: C.textMuted, ...fontBody }}>{T.restDay}</p>
                {!isPro && auto?.level && (
                  <button onClick={openPro} className="flex items-center gap-1.5 mt-2">
                    <Lock size={11} style={{ color: C.textFaint }} />
                    <span className="text-[11px]" style={{ color: C.textFaint, ...fontBody }}>{T.autoProHint}</span>
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
              <button onClick={() => goTo && goTo("blessures")} className="text-xs font-semibold mt-1" style={{ color: C.blessure }}>{T.seeInInjuries}</button>
            </Card>
          );
          if (e.type === "rdv") return (
            <Card key={e.id} className="mb-3" style={{ background: C.rdvSoft, border: `1px solid ${C.rdv}33` }}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2"><Stethoscope size={15} style={{ color: C.rdv }} /><p className="font-bold text-sm" style={{ color: C.rdv, ...fontBody }}>{praticienLabel(e.praticien, lang)}</p></div>
                <button onClick={() => onRemoveEntry(date, e.id)} aria-label="Supprimer" className="p-2 -m-2"><Trash2 size={15} style={{ color: C.textFaint }} /></button>
              </div>
              {e.motif && <p className="text-xs" style={{ color: C.textMuted, ...fontBody }}>{e.motif}</p>}
              {e.heure && <p className="text-xs mt-1" style={{ color: C.textFaint, ...fontBody }}>{T.at} {e.heure}</p>}
            </Card>
          );
          return null;
        })}

        {sportEntries.length > 0 && (
          <>
            <p className="text-[11px] uppercase tracking-widest mb-2 mt-1 px-1" style={{ color: C.textFaint, ...fontBody }}>{T.sessionsOfDay}</p>
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
                        <p className="text-[11px] uppercase tracking-wide mt-1" style={{ color: C.textFaint, ...fontBody }}>{T.thisSessionStretches}</p>
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
              {combinedPlan.combined && <p className="text-xs -mt-2 mb-3" style={{ color: C.textFaint, ...fontBody }}>{T.combinedNote(combinedPlan.sessionsCount)}</p>}
              <div className="flex justify-center mb-3"><RecoveryDial score={combinedPlan.score} label={T.recupProgram} sub={combinedPlan.duree} size={150} /></div>
              {!combinedPlan.restDay && <RecoveryChecklist plan={combinedPlan} checkKey={`d:${date}`} />}
              <PlanTabs plan={combinedPlan} />
            </div>
          </>
        )}

        <div className="flex flex-col gap-2 mt-2">
          <button onClick={() => setEditingSport(!editingSport)} className="flex items-center gap-1.5 text-xs font-semibold py-2" style={{ color: C.primary, ...fontBody }}><Pencil size={13} /> {T.editSport}</button>
          {editingSport && (
            <div className="mb-2">
              <EntryListEditor entries={localSport} defaultSport={profile.sports?.[0] || "autre"} onChange={setLocalSport} />
              <div className="flex gap-2 mt-2">
                <Btn small full onClick={saveSportEdit} icon={Check}>{T.save}</Btn>
                {isException && <Btn small variant="ghost" onClick={() => { onClearException(date); setEditingSport(false); }}>{T.backToBase}</Btn>}
              </div>
            </div>
          )}

          <button onClick={() => setAddingRdv(!addingRdv)} className="flex items-center gap-1.5 text-xs font-semibold py-2" style={{ color: C.rdv, ...fontBody }}><Stethoscope size={13} /> {T.addRdv}</button>
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
function PlanningTab({ profile, plannerConfig, onSetWeekly, onSaveException, onClearException, onAddEntry, onRemoveEntry, goTo, onOpenPlanById, initialView, recup }) {
  const { lang } = useLang();
  const { isPro, openPro } = usePro();
  const weeklyDays = plannerConfig?.weeklyDays || emptyWeekly();
  const exceptions = plannerConfig?.exceptions || {};
  const monthlyUsed = useMemo(() => countMonthlyExtras(exceptions), [exceptions]);
  const [view, setView] = useState(initialView || "calendrier");
  useEffect(() => { if (initialView) setView(initialView); }, [initialView]);
  const [expandedDow, setExpandedDow] = useState(null);
  const [monthIdx, setMonthIdx] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState(null);
  const [excDate, setExcDate] = useState(""); const [excEntries, setExcEntries] = useState([]);
  const [rdvDate, setRdvDate] = useState(isoLocal());
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
    const today = isoLocal();
    return schedule.filter((d) => d.date >= today && d.entries.some((e) => e.type === "rdv")).flatMap((d) => d.entries.filter((e) => e.type === "rdv").map((e) => ({ date: d.date, entry: e }))).slice(0, 20);
  }, [schedule]);

  const T = {
    title: tr(lang, { fr: "Planning", en: "Schedule", es: "Planificación", pt: "Planejamento" }),
    subtitle: tr(lang, { fr: "Modifiable à tout moment si besoin", en: "Editable anytime if needed", es: "Editable en cualquier momento si es necesario", pt: "Editável a qualquer momento se necessário" }),
    tabCalendar: tr(lang, { fr: "Calendrier", en: "Calendar", es: "Calendario", pt: "Calendário" }),
    tabWeek: tr(lang, { fr: "Semaine type", en: "Weekly", es: "Semana tipo", pt: "Semana tipo" }),
    tabAdd: tr(lang, { fr: "Ajouts", en: "Add", es: "Añadir", pt: "Adicionar" }),
    howLabel: tr(lang, { fr: "Comment ça marche", en: "How it works", es: "Cómo funciona", pt: "Como funciona" }),
    intro: tr(lang, { fr: "L'app choisit elle-même quand insérer de la récup active ou du repos complet, en plus de la récup, la nutrition et les rappels générés pour toute l'année.", en: "The app decides on its own when to insert active recovery or full rest, on top of the recovery, nutrition and reminders generated for the whole year.", es: "La app decide por sí sola cuándo insertar recuperación activa o descanso completo, además de la recuperación, la nutrición y los avisos generados para todo el año.", pt: "O app decide sozinho quando inserir recuperação ativa ou descanso completo, além da recuperação, nutrição e lembretes gerados para o ano inteiro." }),
    fixedDays: tr(lang, { fr: "Jours fixes de la semaine", en: "Fixed weekly days", es: "Días fijos de la semana", pt: "Dias fixos da semana" }),
    off: tr(lang, { fr: "Off", en: "Off", es: "Libre", pt: "Livre" }),
    addSession: tr(lang, { fr: "Séance exceptionnelle à venir", en: "Upcoming extra session", es: "Sesión extra próxima", pt: "Sessão extra futura" }),
    addSessionHint: tr(lang, { fr: "Tu sais déjà qu'elle aura lieu : match en plus, entraînement décalé, séance loisir ou jour off exceptionnel. Choisis la date, elle apparaît dans ton planning avec rappel possible.", en: "You already know it's happening: an extra match, a rescheduled training session, a casual session or an exceptional day off. Pick the date and it shows up in your schedule, with an optional reminder.", es: "Ya sabes que ocurrirá: partido extra, entrenamiento cambiado, sesión libre o día libre excepcional. Elige la fecha y aparece en tu planificación, con aviso opcional.", pt: "Você já sabe que vai acontecer: jogo extra, treino remarcado, sessão livre ou folga excepcional. Escolha a data e ela aparece no seu planejamento, com lembrete opcional." }),
    unplannedTitle: tr(lang, { fr: "Séance imprévue déjà faite", en: "Unplanned session, already done", es: "Sesión imprevista ya hecha", pt: "Sessão imprevista já feita" }),
    unplannedHint: tr(lang, { fr: "Tu viens de faire une séance non prévue ? Ajoute-la : elle rejoint ton planning et ton plan de récup du jour est mis à jour.", en: "Just did an unplanned session? Add it: it joins your schedule and today's recovery plan is updated.", es: "¿Acabas de hacer una sesión no prevista? Añádela: se une a tu planificación y el plan de recuperación de hoy se actualiza.", pt: "Acabou de fazer uma sessão não prevista? Adicione-a: ela entra no planejamento e o plano de recuperação de hoje é atualizado." }),
    alreadyDone: tr(lang, { fr: "Séance imprévue déjà faite ? Génère sa récup →", en: "Unplanned session already done? Generate its recovery →", es: "¿Sesión imprevista ya hecha? Genera su recuperación →", pt: "Sessão imprevista já feita? Gere a recuperação →" }),
    date: tr(lang, { fr: "Date", en: "Date", es: "Fecha", pt: "Data" }),
    saveDate: tr(lang, { fr: "Enregistrer pour cette date", en: "Save for this date", es: "Guardar para esta fecha", pt: "Salvar para esta data" }),
    offException: tr(lang, { fr: "Off exceptionnel", en: "Exceptional day off", es: "Libre excepcional", pt: "Folga excepcional" }),
    medicalRdv: tr(lang, { fr: "RDV médical", en: "Medical appointment", es: "Cita médica", pt: "Consulta médica" }),
    medicalRdvHint: tr(lang, { fr: "Contrôle, suivi de blessure ou consultation de routine — totalement séparé de tes séances sportives.", en: "Check-up, injury follow-up or routine consultation — completely separate from your sports sessions.", es: "Control, seguimiento de lesión o consulta de rutina — totalmente separado de tus sesiones deportivas.", pt: "Check-up, acompanhamento de lesão ou consulta de rotina — totalmente separado das suas sessões esportivas." }),
    quotaHint: (used, max) => tr(lang, { fr: `Compte gratuit : ${used}/${max} exceptions & RDV utilisés ce mois-ci`, en: `Free plan: ${used}/${max} exceptions & appointments used this month`, es: `Plan gratuito: ${used}/${max} excepciones y citas usadas este mes`, pt: `Plano grátis: ${used}/${max} exceções e consultas usadas este mês` }),
    addToSchedule: tr(lang, { fr: "Ajouter au planning", en: "Add to schedule", es: "Añadir a la planificación", pt: "Adicionar ao planejamento" }),
    monthDetail: tr(lang, { fr: "Détail du mois", en: "Month detail", es: "Detalle del mes", pt: "Detalhe do mês" }),
    noSessionMonth: tr(lang, { fr: "Aucune séance programmée ce mois-ci.", en: "No session scheduled this month.", es: "Ninguna sesión programada este mes.", pt: "Nenhuma sessão programada este mês." }),
    session: tr(lang, { fr: "séance", en: "session", es: "sesión", pt: "sessão" }),
    sessions: tr(lang, { fr: "séances", en: "sessions", es: "sesiones", pt: "sessões" }),
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
      <InfoToggle label={T.howLabel}>{T.intro}</InfoToggle>

      {!isPro && (
        <button onClick={openPro} className="w-full flex items-center gap-2 mb-5 px-3.5 py-3 rounded-2xl" style={{ background: C.glassSoft, border: `1px solid ${C.glassBorder}` }}>
          <Lock size={13} style={{ color: C.textFaint }} />
          <span className="text-xs flex-1 text-left" style={{ color: C.textMuted, ...fontBody }}>{T.quotaHint(monthlyUsed, FREE_EXCEPTIONS_PER_MONTH)}</span>
          <ProBadge />
        </button>
      )}

      <div className="mb-6"><SegmentedControl options={[{ value: "calendrier", label: T.tabCalendar }, { value: "semaine", label: T.tabWeek }, { value: "ajouts", label: T.tabAdd }]} value={view} onChange={setView} /></div>

      {view === "semaine" && (
      <Card className="mb-4">
        <SectionTitle icon={CalendarDays}>{T.fixedDays}</SectionTitle>
        {DAYS[lang].map((d, i) => (
          <div key={d} className="mb-3 pb-3" style={{ borderBottom: `1px solid ${C.borderSoft}66` }}>
            <button onClick={() => setExpandedDow(expandedDow === i ? null : i)} className="w-full flex items-center justify-between py-2">
              <span className="text-xs font-semibold" style={{ color: C.text, ...fontBody }}>{d}</span>
              <div className="flex items-center gap-1.5">
                {weeklyDays[i].length === 0 ? <span className="text-[11px]" style={{ color: C.textFaint, ...fontBody }}>{T.off}</span> : weeklyDays[i].map((e) => <span key={e.id} className="text-sm">{sportIcon(e.sport)}</span>)}
                <ChevronDown size={14} style={{ color: C.textMuted, transform: expandedDow === i ? "rotate(180deg)" : "none" }} />
              </div>
            </button>
            {expandedDow === i && <div className="mt-2"><EntryListEditor entries={weeklyDays[i]} defaultSport={profile.sports?.[0] || "autre"} onChange={(entries) => onSetWeekly(i, entries)} /></div>}
          </div>
        ))}
      </Card>
      )}

      {view === "ajouts" && (<>
      <Card className="mb-5">
        <SectionTitle icon={Plus}>{T.addSession}</SectionTitle>
        <p className="text-xs mb-3" style={{ color: C.textFaint, ...fontBody }}>{T.addSessionHint}</p>
        <Field label={T.date}><TextInput type="date" value={excDate} onChange={(e) => setExcDate(e.target.value)} /></Field>
        {excDate && <EntryListEditor entries={excEntries} defaultSport={profile.sports?.[0] || "autre"} onChange={setExcEntries} />}
        <div className="mt-2"><Btn onClick={saveExcForm} full disabled={!excDate} icon={Check}>{T.saveDate}</Btn></div>
        {Object.keys(exceptions).length > 0 && (
          <div className="flex flex-col gap-2 mt-4">
            {Object.entries(exceptions).sort(([a], [b]) => a.localeCompare(b)).map(([date, ents]) => (
              <div key={date} className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: C.bgElevated }}>
                <button onClick={() => loadExcForEdit(date)} className="text-left flex-1 py-1.5"><span className="text-xs" style={{ color: C.text, ...fontBody }}>{date} — {ents.length === 0 ? T.offException : ents.map((e) => e.type === "blessure" ? T.blessure : e.type === "rdv" ? T.rdv : eventLabel(e.type, lang)).join(", ")}</span></button>
                <button onClick={() => onClearException(date)} aria-label="Supprimer" className="p-2 -m-2"><Trash2 size={15} style={{ color: C.textFaint }} /></button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mb-4" style={{ background: `linear-gradient(160deg, ${C.rdv}18 0%, ${C.surface} 55%)` }}>
        <SectionTitle icon={Stethoscope}>{T.medicalRdv}</SectionTitle>
        <p className="text-xs mb-3" style={{ color: C.textFaint, ...fontBody }}>{T.medicalRdvHint}</p>
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
                  right={<button onClick={() => onRemoveEntry(r.date, r.entry.id)} aria-label="Supprimer" className="p-2 -m-2"><Trash2 size={15} style={{ color: C.textFaint }} /></button>} />
              ))}
            </GroupedList>
          </div>
        )}
      </Card>

      {recup && (
        <Card className="mt-5 mb-4" style={{ background: `linear-gradient(160deg, ${C.primary}14 0%, ${C.surface} 55%)` }}>
          <SectionTitle icon={Activity}>{T.unplannedTitle}</SectionTitle>
          <p className="text-xs -mt-2 mb-4" style={{ color: C.textFaint, ...fontBody }}>{T.unplannedHint}</p>
          <RecupTab embedded profile={profile} onGenerate={recup.onGenerate} result={null} setResult={recup.setResult} sessionsLog={recup.sessionsLog} onAdded={recup.onAdded} />
        </Card>
      )}
      </>)}

      {view === "calendrier" && (<>
      <Card className="mb-5">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setMonthIdx((m) => (m + 11) % 12)}><ChevronLeft size={18} style={{ color: C.textMuted }} /></button>
          <span className="text-sm font-bold tracking-tight" style={{ color: C.text, ...fontDisplay }}>{MONTHS[lang][monthIdx]} {year}</span>
          <button onClick={() => setMonthIdx((m) => (m + 1) % 12)}><ChevronRight size={18} style={{ color: C.textMuted }} /></button>
        </div>
        <div className="grid grid-cols-7 gap-1.5 mb-2">{DAYS[lang].map((d) => <span key={d} className="text-[11px] text-center" style={{ color: C.textFaint, ...fontBody }}>{d}</span>)}</div>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: firstDow }).map((_, i) => <div key={"e" + i} />)}
          {monthDays.map((d) => (
            <button key={d.date} onClick={() => setSelectedDate(d.date)} className="aspect-square rounded-xl flex items-center justify-center text-[11px] font-semibold relative" style={{ background: dayColor(d) + (d.entries.length === 0 ? "22" : ""), color: d.entries.length === 0 ? C.textFaint : "#0A1613", ...fontMono }}>
              {Number(d.date.slice(-2))}
              {d.entries.length > 1 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px]" style={{ background: C.bgElevated, color: C.text, border: `1px solid ${C.border}` }}>{d.entries.length}</span>}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 mt-4">
          {[[T.legendRest, C.border], [T.legendChill, C.primaryDim], [T.legendMedium, C.primary], [T.legendIntense, C.warn], [T.legendMatch, C.danger], [T.legendLoisir, C.loisir], [T.legendActive, C.reposActif], [T.legendRdv, C.rdv], [T.legendInjury, C.blessure]].map(([l, c]) => (
            <div key={l} className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ background: c }} /><span className="text-[11px]" style={{ color: C.textMuted, ...fontBody }}>{l}</span></div>
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
      </>)}

      {selectedDayObj && <DayDetailSheet date={selectedDayObj.date} entries={selectedDayObj.entries} isException={selectedDayObj.isException} auto={selectedDayObj.auto} profile={profile} onClose={() => setSelectedDate(null)} onSaveException={onSaveException} onClearException={onClearException} onAddEntry={onAddEntry} onRemoveEntry={onRemoveEntry} goTo={goTo} onOpenPlan={onOpenPlanById} />}
    </div>
  );
}

/* ============================================================
   HOME TAB
   ============================================================ */
function ToggleRow({ label, sub, on, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="w-full flex items-center gap-3 rounded-2xl px-3 py-3 text-left" style={{ background: on ? C.primarySoft : C.glassSoft, border: `1px solid ${on ? C.primary + "55" : C.border}` }}>
      <div className="flex-1">
        <p className="text-sm font-semibold" style={{ color: C.text, ...fontBody }}>{label}</p>
        {sub && <p className="text-xs mt-0.5 leading-relaxed" style={{ color: C.textMuted, ...fontBody }}>{sub}</p>}
      </div>
      <div className="w-10 h-6 rounded-full relative shrink-0" style={{ background: on ? C.primary : C.border }}>
        <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: on ? 18 : 2 }} />
      </div>
    </button>
  );
}

// Page dédiée « Sommeil & étirements » : deux sections séparées (Sommeil / Rappels).
function RemindersScreen({ settings, onSave, onBack, initialView }) {
  const { lang } = useLang();
  const T4 = (fr, en, es, pt) => tr(lang, { fr, en, es, pt });
  const [view, setView] = useState(initialView || "sommeil");
  const wake = settings.wake || defaultSettings().wake;
  const setWake = (i, v) => onSave({ wake: wake.map((w, k) => (k === i ? v : w)) });
  const all = settings.queue || [];
  const T = {
    back: T4("Accueil", "Home", "Inicio", "Início"),
    title: T4("Sommeil & étirements", "Sleep & stretching", "Sueño y estiramientos", "Sono e alongamentos"),
    subtitle: T4("Dors assez, étire-toi à temps", "Sleep enough, stretch on time", "Duerme lo suficiente, estira a tiempo", "Durma o suficiente, alongue a tempo"),
    tabSleep: T4("Sommeil", "Sleep", "Sueño", "Sono"), tabRem: T4("Étirements", "Stretching", "Estiramientos", "Alongamentos"),
    wakeTitle: T4("Heures de réveil", "Wake-up times", "Horas de despertar", "Horários de despertar"),
    wakeHint: T4("À quelle heure te lèves-tu chaque jour ? REGEN en déduit l'heure de coucher idéale.", "What time do you get up each day? REGEN works out your ideal bedtime.", "¿A qué hora te levantas cada día? REGEN calcula tu hora ideal de acostarte.", "A que horas você acorda cada dia? O REGEN calcula seu horário ideal de dormir."),
    same: T4("Même heure tous les jours (comme le lundi)", "Same time every day (like Monday)", "Misma hora todos los días (como el lunes)", "Mesmo horário todos os dias (como segunda)"),
    sleepTitle: T4("Rappel de coucher", "Bedtime reminder", "Recordatorio de dormir", "Lembrete de dormir"),
    sleepToggle: T4("Me rappeler d'aller dormir", "Remind me to go to bed", "Recordarme que me acueste", "Lembrar-me de dormir"),
    sleepSub: T4("30 min avant l'heure conseillée : heure de réveil moins les heures de sommeil de ton plan de récup.", "30 min before the recommended time: wake-up time minus the sleep hours from your recovery plan.", "30 min antes de la hora recomendada: hora de despertar menos las horas de sueño de tu plan.", "30 min antes do horário recomendado: horário de despertar menos as horas de sono do seu plano."),
    scopeSessions: T4("Soirs de séance", "Session evenings", "Noches de sesión", "Noites de sessão"),
    scopeAll: T4("Tous les soirs", "Every evening", "Todas las noches", "Todas as noites"),
    scopeHint: T4("Séance prévue, ajout exceptionnel ou séance imprévue : tous comptent.", "Planned session, extra session or unplanned session: all count.", "Sesión planificada, extra o imprevista: todas cuentan.", "Sessão planejada, extra ou imprevista: todas contam."),
    stretchTitle: T4("Étirements", "Stretching", "Estiramientos", "Alongamento"),
    stretchToggle: T4("Me rappeler de m'étirer", "Remind me to stretch", "Recordarme estirar", "Lembrar-me de alongar"),
    stretchSub: T4("Après chaque séance, avec les zones à étirer. Sans heure de séance, rappel à 19:00.", "After each session, with the areas to stretch. If the session has no time, reminder at 19:00.", "Tras cada sesión, con las zonas a estirar. Sin hora de sesión, recordatorio a las 19:00.", "Após cada sessão, com as áreas a alongar. Sem horário, lembrete às 19:00."),
    delay: T4("Combien de temps après la séance ?", "How long after the session?", "¿Cuánto después de la sesión?", "Quanto tempo após a sessão?"),
    upcoming: T4("Prochains rappels", "Upcoming reminders", "Próximos recordatorios", "Próximos lembretes"),
    none: T4("Aucun rappel prévu pour l'instant. Ajoute une séance au planning ou active un rappel ci-dessus.", "No reminder planned yet. Add a session to your schedule or turn a reminder on above.", "Ningún recordatorio por ahora. Añade una sesión al plan o activa un recordatorio.", "Nenhum lembrete por enquanto. Adicione uma sessão à agenda ou ative um lembrete."),
    note: T4("Les rappels sont préparés pour les 14 prochains jours et mis à jour à chaque ouverture de l'app. Pour les recevoir en notification, active-les dans Profil → Compte.", "Reminders are prepared for the next 14 days and refreshed each time you open the app. To get them as notifications, turn them on in Profile → Account.", "Los recordatorios se preparan para los próximos 14 días y se actualizan al abrir la app. Para recibirlos como notificación, actívalos en Perfil → Cuenta.", "Os lembretes são preparados para os próximos 14 dias e atualizados ao abrir o app. Para recebê-los como notificação, ative em Perfil → Conta."),
    kindSleep: T4("Coucher", "Bedtime", "Dormir", "Dormir"), kindStretch: T4("Étirements", "Stretching", "Estiramientos", "Alongamento"),
  };
  const UpcomingList = ({ kind }) => {
    const items = all.filter((q) => q.kind === kind).slice(0, 5);
    return (
      <Card className="mb-4">
        <SectionTitle icon={Bell}>{T.upcoming}</SectionTitle>
        {items.length === 0 ? <p className="text-xs leading-relaxed" style={{ color: C.textMuted, ...fontBody }}>{T.none}</p> : (
          <div className="flex flex-col gap-2.5">
            {items.map((q, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-xs font-semibold w-20 shrink-0" style={{ color: C.primary, ...fontMono }}>{DAYS[lang][dowOfIso(q.date)]} {q.date.slice(8)}/{q.date.slice(5, 7)}<br />{q.time}</span>
                <span className="text-xs leading-relaxed" style={{ color: C.textMuted, ...fontBody }}>{q.body}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    );
  };
  return (
    <div className="px-5 pt-4 pb-24">
      {onBack && <button onClick={onBack} className="text-xs mb-1 flex items-center gap-1 py-2 pr-3" style={{ color: C.primary }}><ChevronLeft size={14} /> {T.back}</button>}
      <LargeHeader title={T.title} subtitle={T.subtitle} />
      <div className="mb-6"><SegmentedControl options={[{ value: "sommeil", label: T.tabSleep }, { value: "rappels", label: T.tabRem }]} value={view} onChange={setView} /></div>

      {view === "sommeil" && (<>
        <Card className="mb-4">
          <SectionTitle icon={Moon}>{T.wakeTitle}</SectionTitle>
          <p className="text-xs leading-relaxed mb-4" style={{ color: C.textMuted, ...fontBody }}>{T.wakeHint}</p>
          <div className="flex flex-col gap-2">
            {wake.map((w, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm font-semibold w-12" style={{ color: C.text, ...fontBody }}>{DAYS[lang][i]}</span>
                <div className="flex-1"><TextInput type="time" value={w} onChange={(e) => e.target.value && setWake(i, e.target.value)} /></div>
              </div>
            ))}
          </div>
          <button onClick={() => onSave({ wake: wake.map(() => wake[0]) })} className="text-xs font-semibold mt-1 py-2" style={{ color: C.primary, ...fontBody }}>{T.same}</button>
        </Card>
        <Card className="mb-4">
          <SectionTitle icon={Moon}>{T.sleepTitle}</SectionTitle>
          <ToggleRow label={T.sleepToggle} sub={T.sleepSub} on={!!settings.sleepOn} onChange={(v) => onSave({ sleepOn: v })} />
          {settings.sleepOn && (
            <div className="mt-3">
              <div className="flex gap-2 mb-2"><Pill active={settings.sleepScope !== "all"} onClick={() => onSave({ sleepScope: "sessions" })}>{T.scopeSessions}</Pill><Pill active={settings.sleepScope === "all"} onClick={() => onSave({ sleepScope: "all" })}>{T.scopeAll}</Pill></div>
              <p className="text-[11px]" style={{ color: C.textFaint, ...fontBody }}>{T.scopeHint}</p>
            </div>
          )}
        </Card>
        <UpcomingList kind="sleep" />
      </>)}

      {view === "rappels" && (<>
        <Card className="mb-4">
          <SectionTitle icon={Activity}>{T.stretchTitle}</SectionTitle>
          <ToggleRow label={T.stretchToggle} sub={T.stretchSub} on={!!settings.stretchOn} onChange={(v) => onSave({ stretchOn: v })} />
          {settings.stretchOn && (
            <div className="mt-3">
              <p className="text-xs mb-2" style={{ color: C.textMuted, ...fontBody }}>{T.delay}</p>
              <div className="flex gap-2">{[15, 30, 60].map((m) => <Pill key={m} active={Number(settings.stretchDelay) === m} onClick={() => onSave({ stretchDelay: m })}>{m} min</Pill>)}</div>
            </div>
          )}
        </Card>
        <UpcomingList kind="stretch" />
      </>)}
      <p className="text-[11px] leading-relaxed text-center px-3" style={{ color: C.textFaint, ...fontBody }}>{T.note}</p>
    </div>
  );
}

// Courbe du score de récupération sur plusieurs semaines.
function ScoreChart({ sessionsLog }) {
  const { lang } = useLang();
  const T4 = (fr, en, es, pt) => tr(lang, { fr, en, es, pt });
  const [weeks, setWeeks] = useState(8);
  const T = {
    title: T4("Évolution de ton score", "Your score over time", "Evolución de tu puntuación", "Evolução da sua pontuação"),
    empty: T4("Fais au moins 2 séances pour voir ta courbe apparaître.", "Do at least 2 sessions to see your curve appear.", "Haz al menos 2 sesiones para ver tu curva.", "Faça pelo menos 2 sessões para ver sua curva."),
    emptyRange: T4("Pas assez de séances sur cette période : essaie une période plus longue.", "Not enough sessions in this period: try a longer one.", "No hay suficientes sesiones en este periodo: prueba uno más largo.", "Poucas sessões neste período: tente um mais longo."),
    avg: T4("Moyenne", "Average", "Media", "Média"), last: T4("Dernière", "Latest", "Última", "Última"), count: T4("Séances", "Sessions", "Sesiones", "Sessões"),
    w: (n) => T4(`${n} sem.`, `${n} wk`, `${n} sem.`, `${n} sem.`),
    up: T4("Charge en hausse : pense à lever le pied si tu es fatigué.", "Load going up: ease off if you feel tired.", "Carga al alza: baja el ritmo si estás cansado.", "Carga em alta: reduza o ritmo se estiver cansado."),
    down: T4("Charge en baisse : bonne phase de récupération.", "Load going down: good recovery phase.", "Carga a la baja: buena fase de recuperación.", "Carga em queda: boa fase de recuperação."),
    flat: T4("Charge stable sur la période.", "Stable load over the period.", "Carga estable en el periodo.", "Carga estável no período."),
    hint: T4("Plus le score est haut, plus la séance était exigeante pour ton corps.", "The higher the score, the more demanding the session was for your body.", "Cuanto más alta la puntuación, más exigente fue la sesión.", "Quanto mais alta a pontuação, mais exigente foi a sessão."),
  };
  const all = (sessionsLog || []).filter((x) => x.date && Number.isFinite(Number(x.score))).map((x) => ({ t: new Date(x.date).getTime(), v: Math.round(Number(x.score)) })).filter((x) => Number.isFinite(x.t)).sort((a, b) => a.t - b.t);
  const end = Date.now(); const start = end - weeks * 7 * 86400000;
  const pts = all.filter((x) => x.t >= start && x.t <= end + 86400000);
  const W = 340, H = 150, L = 28, R = 10, Tp = 10, B = 22;
  const X = (t) => L + ((t - start) / (end - start)) * (W - L - R);
  const Y = (v) => Tp + (1 - v / 100) * (H - Tp - B);
  const avg = pts.length ? Math.round(pts.reduce((a, x) => a + x.v, 0) / pts.length) : 0;
  const half = Math.floor(pts.length / 2);
  const mean = (arr) => (arr.length ? arr.reduce((a, x) => a + x.v, 0) / arr.length : 0);
  const diff = pts.length >= 4 ? mean(pts.slice(half)) - mean(pts.slice(0, half)) : 0;
  const trend = diff >= 5 ? T.up : diff <= -5 ? T.down : T.flat;
  const dFmt = (t) => { const d = new Date(t); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`; };
  return (
    <Card className="mb-7">
      <SectionTitle icon={TrendingUp}>{T.title}</SectionTitle>
      {all.length < 2 ? <p className="text-xs leading-relaxed" style={{ color: C.textMuted, ...fontBody }}>{T.empty}</p> : (<>
        <div className="mb-3"><SegmentedControl small options={[4, 8, 12].map((n) => ({ value: n, label: T.w(n) }))} value={weeks} onChange={setWeeks} /></div>
        {pts.length < 2 ? <p className="text-xs leading-relaxed" style={{ color: C.textMuted, ...fontBody }}>{T.emptyRange}</p> : (<>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${T.title} : ${T.avg} ${avg}, ${pts.length} ${T.count}`}>
            {[0, 50, 100].map((g) => (<g key={g}><line x1={L} x2={W - R} y1={Y(g)} y2={Y(g)} stroke={C.border} strokeWidth="1" strokeDasharray={g === 50 ? "3 4" : "0"} /><text x={L - 6} y={Y(g) + 3} textAnchor="end" fontSize="9" fill={C.textFaint}>{g}</text></g>))}
            <line x1={L} x2={W - R} y1={Y(avg)} y2={Y(avg)} stroke={C.primary} strokeWidth="1" strokeDasharray="2 3" opacity="0.6" />
            <polyline fill="none" stroke={C.primary} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={pts.map((x) => `${X(x.t).toFixed(1)},${Y(x.v).toFixed(1)}`).join(" ")} />
            {pts.map((x, i) => <circle key={i} cx={X(x.t)} cy={Y(x.v)} r="3.5" fill={scoreColor(x.v)} stroke={C.bg} strokeWidth="1.5" />)}
            <text x={L} y={H - 5} fontSize="9" fill={C.textFaint}>{dFmt(start)}</text>
            <text x={W - R} y={H - 5} textAnchor="end" fontSize="9" fill={C.textFaint}>{dFmt(end)}</text>
          </svg>
          <div className="grid grid-cols-3 gap-2 text-center mt-3 mb-3">
            <div><p style={{ ...fontMono, color: C.text, fontSize: 18 }}>{avg}</p><p className="text-[11px] uppercase" style={{ color: C.textFaint, ...fontBody }}>{T.avg}</p></div>
            <div><p style={{ ...fontMono, color: scoreColor(pts[pts.length - 1].v), fontSize: 18 }}>{pts[pts.length - 1].v}</p><p className="text-[11px] uppercase" style={{ color: C.textFaint, ...fontBody }}>{T.last}</p></div>
            <div><p style={{ ...fontMono, color: C.text, fontSize: 18 }}>{pts.length}</p><p className="text-[11px] uppercase" style={{ color: C.textFaint, ...fontBody }}>{T.count}</p></div>
          </div>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mb-3">{[[20, "0–39"], [50, "40–69"], [80, "70+"]].map(([v, r]) => (<span key={r} className="flex items-center gap-1.5 text-[11px] whitespace-nowrap" style={{ color: C.textMuted, ...fontBody }}><span className="w-2 h-2 rounded-full" style={{ background: scoreColor(v) }} />{scoreWord(v, lang)} {r}</span>))}</div>
          <p className="text-xs font-semibold leading-relaxed" style={{ color: C.textMuted, ...fontBody }}>{trend}</p>
          <p className="text-[11px] leading-relaxed mt-1" style={{ color: C.textFaint, ...fontBody }}>{T.hint}</p>
        </>)}
      </>)}
    </Card>
  );
}

function HomeTab({ profile, sessionsLog, injuries, plannerConfig, settings, lastPlan, goTo, onOpenPlan, onOpenPlanById, onDeleteSession, onSaveException, onClearException, onAddEntry, onRemoveEntry }) {
  const { lang } = useLang();
  const today = new Date(); const todayIso = isoLocal(today);
  const year = today.getFullYear();
  const weeklyDays = plannerConfig?.weeklyDays || emptyWeekly();
  const exceptions = plannerConfig?.exceptions || {};
  const hasPlanner = weeklyDays.some((d) => d.length > 0) || Object.keys(exceptions).length > 0;
  const [selectedDate, setSelectedDate] = useState(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const tonight = (settings && settings.sleepOn && (settings.queue || []).find((q) => q.kind === "sleep" && q.date === todayIso)) || null;

  const schedule = useMemo(() => buildYearSchedule(weeklyDays, exceptions, year, profile), [plannerConfig, profile, year]);
  const activeInjury = useMemo(() => injuries.find((i) => i.arret && i.dateDebut && i.dateDebut.slice(0, 10) <= todayIso && (!i.dateRetour || i.dateRetour.slice(0, 10) >= todayIso)), [injuries]);

  const weekSchedule = useMemo(() => {
    const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      const iso = isoLocal(d);
      const found = schedule.find((s) => s.date === iso);
      return found ? { ...found, isToday: iso === todayIso } : { date: iso, dow: i, entries: [], isToday: iso === todayIso };
    });
  }, [schedule]);

  const reminders = useMemo(() => {
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const iso = isoLocal(tomorrow);
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

  // Séances de la semaine (lundi → dimanche) : prévues, imprévues déjà faites, séances à venir. Une séance n'est comptée qu'une fois.
  const weekStats = useMemo(() => {
    const weekDates = weekSchedule.map((d) => d.date);
    const nowT = Date.now();
    let total = 0, upcoming = 0;
    const scores = [];
    weekSchedule.forEach((d) => {
      const planned = {}, logged = {}, loggedItems = [];
      (d.entries || []).filter((e) => SPORT_TYPES.includes(e.type)).forEach((e) => { const k = `${e.sport}|${e.type}`; (planned[k] = planned[k] || []).push(e); });
      sessionsLog.filter((x) => x && x.date && !x.restDay && isoLocal(new Date(x.date)) === d.date).forEach((x) => { const k = `${x.sport}|${x.eventType}`; logged[k] = (logged[k] || 0) + 1; loggedItems.push(x); if (Number.isFinite(Number(x.score))) scores.push(Number(x.score)); });
      const keys = new Set([...Object.keys(planned), ...Object.keys(logged)]);
      keys.forEach((k) => {
        const np = (planned[k] || []).length, nl = logged[k] || 0;
        total += Math.max(np, nl);
        // Séances prévues non encore faites (jour futur, ou aujourd'hui à une heure pas encore passée)
        (planned[k] || []).slice(nl).forEach((e) => {
          const [hh, mm] = String(e.heure || "23:59").split(":").map(Number);
          const t = new Date(d.date + "T00:00:00").getTime() + ((hh || 0) * 60 + (mm || 0)) * 60000;
          if (t > nowT) upcoming++;
        });
      });
    });
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const done = settings && settings.done ? settings.done : {};
    const nPlans = sessionsLog.filter((x) => x && x.date && !x.restDay && weekDates.includes(isoLocal(new Date(x.date)))).length;
    const nDone = sessionsLog.filter((x) => x && x.date && !x.restDay && weekDates.includes(isoLocal(new Date(x.date)))).reduce((a, x) => a + DONE_ITEMS.filter((k) => (done[`s:${x.date}`] || {})[k]).length, 0);
    const follow = nPlans ? Math.round((nDone / (nPlans * 4)) * 100) : null;
    const cis = weekDates.map((dt) => ((settings && settings.checkins) || {})[dt]).filter(Boolean);
    const sleep = cis.length ? (cis.reduce((a, c) => a + (Number(c.sleep) || 0), 0) / cis.length).toFixed(1) : null;
    return { total, upcoming, avg, follow, checkins: cis.length, sleep };
  }, [weekSchedule, sessionsLog, settings]);
  const todayCi = ((settings && settings.checkins) || {})[todayIso];
  const formeVal = todayCi ? readinessScore(todayCi) : null;
  const formeCol = formeVal === null ? C.text : formeVal >= 70 ? C.primary : formeVal >= 40 ? C.scoreMid : C.scoreHigh;
  const weekCount = weekStats.total;
  const avgScore = weekStats.avg;
  const live = useMemo(() => liveRecoveryNeed(new Date(), LOAD_CTX, settings || {}), [sessionsLog, plannerConfig, settings]);
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
    nextEvent: tr(lang, { fr: "Prochain événement", en: "Next event", es: "Próximo evento", pt: "Próximo evento" }),
    thisWeek: tr(lang, { fr: "Ta semaine", en: "Your week", es: "Tu semana", pt: "Sua semana" }),
    sessionsLabel: tr(lang, { fr: "Séances", en: "Sessions", es: "Sesiones", pt: "Sessões" }),
    upcomingOf: (n) => tr(lang, { fr: `dont ${n} à venir`, en: `${n} upcoming`, es: `${n} por venir`, pt: `${n} por vir` }),
    followLabel: tr(lang, { fr: "Récup suivie", en: "Plan followed", es: "Plan seguido", pt: "Plano seguido" }),
    checkinsLabel: tr(lang, { fr: "Bilans", en: "Check-ins", es: "Chequeos", pt: "Check-ins" }),
    sleepLabel: tr(lang, { fr: "Sommeil moyen", en: "Avg sleep", es: "Sueño medio", pt: "Sono médio" }),
    liveNote: tr(lang, { fr: "Mis à jour en direct : toutes tes séances (faites, imprévues, à venir), ton suivi de récup et ton bilan du jour.", en: "Updated live: all your sessions (done, unplanned, upcoming), your recovery tracking and your daily check-in.", es: "Actualizado en directo: todas tus sesiones (hechas, imprevistas, próximas), tu seguimiento de recuperación y tu chequeo del día.", pt: "Atualizado ao vivo: todas as suas sessões (feitas, imprevistas, futuras), seu acompanhamento de recuperação e seu check-in do dia." }),
    formeLabel: tr(lang, { fr: "Forme du jour", en: "Today's form", es: "Forma de hoy", pt: "Forma de hoje" }),
    doBilan: tr(lang, { fr: "Faire mon bilan du jour", en: "Do my daily check-in", es: "Hacer mi chequeo del día", pt: "Fazer meu check-in do dia" }),
    notFilled: tr(lang, { fr: "Pas encore remplie", en: "Not filled yet", es: "Aún sin rellenar", pt: "Ainda não preenchida" }),
    bannerTitle: tr(lang, { fr: "Remplis ton bilan du jour", en: "Fill in your daily check-in", es: "Rellena tu chequeo del día", pt: "Preencha seu check-in do dia" }),
    bannerSub: tr(lang, { fr: "4 touches · ça affine ton score et tes conseils", en: "4 taps · it fine-tunes your score and advice", es: "4 toques · afina tu puntuación y tus consejos", pt: "4 toques · ajusta sua pontuação e seus conselhos" }),
    liveNow: tr(lang, { fr: "Maintenant", en: "Right now", es: "Ahora", pt: "Agora" }),
    configure: tr(lang, { fr: "Configurer", en: "Set up", es: "Configurar", pt: "Configurar" }),
    configureHint: tr(lang, { fr: "Configure tes jours fixes pour voir ta semaine ici.", en: "Set up your fixed days to see your week here.", es: "Configura tus días fijos para ver tu semana aquí.", pt: "Configure seus dias fixos para ver sua semana aqui." }),
    tapDay: tr(lang, { fr: "Touche un jour pour voir le détail complet.", en: "Tap a day to see the full detail.", es: "Toca un día para ver el detalle completo.", pt: "Toque em um dia para ver o detalhe completo." }),
    remindersCard: tr(lang, { fr: "Sommeil & étirements", en: "Sleep & stretching", es: "Sueño y estiramientos", pt: "Sono e alongamentos" }),
    remindersCardSub: tr(lang, { fr: "Règle ton réveil, ton heure de coucher et tes rappels d'étirements", en: "Set your wake-up, bedtime and stretching reminders", es: "Ajusta tu despertar, hora de dormir y recordatorios de estiramientos", pt: "Ajuste seu horário de acordar, de dormir e os lembretes de alongamento" }),
    tonightTitle: (bed) => tr(lang, { fr: `Ce soir : au lit vers ${bed}`, en: `Tonight: in bed by ${bed}`, es: `Esta noche: a la cama a las ${bed}`, pt: `Hoje à noite: na cama às ${bed}` }),
    tonightSub: (h, wake, t) => tr(lang, { fr: `${h} de sommeil pour te réveiller à ${wake} · rappel à ${t}`, en: `${h} of sleep to wake up at ${wake} · reminder at ${t}`, es: `${h} de sueño para despertar a las ${wake} · aviso a las ${t}`, pt: `${h} de sono para acordar às ${wake} · lembrete às ${t}` }),
    quickRecup: tr(lang, { fr: "Séance imprévue", en: "Unplanned", es: "Imprevista", pt: "Imprevista" }),
    nutrition: tr(lang, { fr: "Nutrition", en: "Nutrition", es: "Nutrición", pt: "Nutrição" }),
    injuries: tr(lang, { fr: "Blessures", en: "Injuries", es: "Lesiones", pt: "Lesões" }),
    planning: tr(lang, { fr: "Planning", en: "Schedule", es: "Planificación", pt: "Planejamento" }),
    lastSession: tr(lang, { fr: "Dernière séance", en: "Last session", es: "Última sesión", pt: "Última sessão" }),
    recoveryNeed: tr(lang, { fr: "Besoin de récupération", en: "Recovery need", es: "Necesidad de recuperación", pt: "Necessidade de recuperação" }),
    noSessionYet: tr(lang, { fr: "Aucune séance enregistrée. Génère ton premier plan de récup.", en: "No session logged yet. Generate your first recovery plan.", es: "Aún no hay sesiones registradas. Genera tu primer plan de recuperación.", pt: "Nenhuma sessão registrada ainda. Gere seu primeiro plano de recuperação." }),
    start: tr(lang, { fr: "Commencer", en: "Get started", es: "Empezar", pt: "Começar" }),
    deleteSession: tr(lang, { fr: "Supprimer cette séance", en: "Delete this session", es: "Eliminar esta sesión", pt: "Excluir esta sessão" }),
    deleteSessionConfirm: tr(lang, { fr: "Supprimer cette séance de l'historique ? Elle sera aussi retirée du planning.", en: "Delete this session from your history? It will also be removed from your schedule.", es: "¿Eliminar esta sesión del historial? También se quitará de la planificación.", pt: "Excluir esta sessão do histórico? Ela também será removida do planejamento." }),
    scoreExplain: tr(lang, { fr: "Score de 0 à 100 calculé pour cette séance : plus il est haut, plus ton corps a besoin de temps pour récupérer.", en: "Score from 0 to 100 calculated for this session: the higher it is, the more time your body needs to recover.", es: "Puntuación de 0 a 100 calculada para esta sesión: cuanto más alta, más tiempo necesita tu cuerpo para recuperarse.", pt: "Pontuação de 0 a 100 calculada para esta sessão: quanto mais alta, mais tempo seu corpo precisa para se recuperar." }),
    viewDayPlan: tr(lang, { fr: "Voir le plan de récup du jour", en: "View today's recovery plan", es: "Ver el plan de recuperación de hoy", pt: "Ver o plano de recuperação de hoje" }),
    viewPlan: tr(lang, { fr: "Voir le plan de récup", en: "View recovery plan", es: "Ver el plan de recuperación", pt: "Ver o plano de recuperação" }),
    seeMore: tr(lang, { fr: "Voir plus", en: "See more", es: "Ver más", pt: "Ver mais" }),
    seeLess: tr(lang, { fr: "Réduire", en: "Show less", es: "Reducir", pt: "Reduzir" }),
    history: tr(lang, { fr: "Historique", en: "History", es: "Historial", pt: "Histórico" }),
    nothingYet: tr(lang, { fr: "Rien pour l'instant.", en: "Nothing yet.", es: "Nada por el momento.", pt: "Nada por enquanto." }),
    match: tr(lang, { fr: "Match / Combat", en: "Match / Fight", es: "Partido / Combate", pt: "Jogo / Luta" }),
    loisir: tr(lang, { fr: "Séance loisir", en: "Casual session", es: "Sesión libre", pt: "Sessão livre" }),
    entrainement: tr(lang, { fr: "Entraînement", en: "Training", es: "Entrenamiento", pt: "Treino" }),
  };

  return (
    <div className="px-5 pt-4 pb-24">
      <LargeHeader title={profile.name} subtitle={T.hi} right={<div className="flex gap-1">{(profile.sports || []).slice(0, 3).map((s) => <span key={s} className="text-xl">{sportIcon(s)}</span>)}</div>} />

      {activeInjury && (
        <button onClick={() => goTo("blessures")} className="w-full text-left mb-5 rounded-[22px] p-4 flex items-start gap-3" style={{ background: C.dangerSoft, border: `1px solid ${C.danger}33` }}>
          <HeartPulse size={18} style={{ color: C.danger, flexShrink: 0, marginTop: 1 }} />
          <div><p className="text-xs font-bold" style={{ color: C.danger, ...fontBody }}>{T.injuryOff(bodyPartLabel(activeInjury.part, lang))}</p><p className="text-xs mt-0.5" style={{ color: C.danger, ...fontBody }}>{T.since(fmtDate(activeInjury.dateDebut, lang))} {T.returnLabel(activeInjury.dateRetour ? T.onDate(fmtDate(activeInjury.dateRetour, lang)) : T.tbd)}</p></div>
        </button>
      )}

      {formeVal === null && (
        <button type="button" onClick={() => goTo("bilan")} className="w-full text-left mb-4 rounded-[22px] px-4 py-3.5 flex items-center gap-3" style={{ background: `linear-gradient(135deg, ${C.primary}33, ${C.surface})`, border: `1px solid ${C.primary}66` }}>
          <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: C.primary }}><Sparkles size={17} style={{ color: "#052821" }} /></span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold break-words" style={{ color: C.text, ...fontDisplay }}>{T.bannerTitle}</p>
            <p className="text-xs mt-0.5" style={{ color: C.textMuted, ...fontBody }}>{T.bannerSub}</p>
          </div>
          <ChevronRightIcon size={16} style={{ color: C.primary }} className="shrink-0" />
        </button>
      )}

      <Card className="mb-5">
        <div className="flex items-center justify-between mb-3"><SectionTitle icon={CalendarDays}>{T.thisWeek}</SectionTitle>{!hasPlanner && <button onClick={() => goTo("planning")} className="text-[11px] font-semibold" style={{ color: C.primary }}>{T.configure}</button>}</div>
        {hasPlanner ? (
          <div className="grid grid-cols-7 gap-1.5">
            {weekSchedule.map((d) => (
              <button key={d.date} onClick={() => setSelectedDate(d.date)} className="flex flex-col items-center gap-1">
                <span className="text-[11px]" style={{ color: C.textFaint, ...fontBody }}>{DAYS[lang][d.dow]}</span>
                <div className="w-full aspect-square rounded-xl flex items-center justify-center relative" style={{ background: dayColor(d) + (d.entries.length === 0 ? "22" : ""), border: d.isToday ? `1.5px solid ${C.text}` : "none" }}>
                  {d.entries[0]?.type === "rdv" ? <span className="text-xs">🩺</span> : d.entries[0]?.sport && <span className="text-xs">{sportIcon(d.entries[0].sport)}</span>}
                  {d.entries.length > 1 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px]" style={{ background: C.bgElevated, color: C.text }}>{d.entries.length}</span>}
                </div>
              </button>
            ))}
          </div>
        ) : <p className="text-xs" style={{ color: C.textFaint, ...fontBody }}>{T.configureHint}</p>}
        <div className="flex items-center gap-4 mt-4 pt-4" style={{ borderTop: `1px solid ${C.borderSoft}66` }}>
          <div className="shrink-0"><RecoveryDial score={live.score} label={T.recoveryNeed} sub={scoreWord(live.score, lang)} size={128} /></div>
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            <button type="button" onClick={() => goTo("bilan")} className="w-full text-left rounded-2xl px-3 py-2.5 flex items-center gap-2" style={{ background: C.surface, border: `1px solid ${C.border}`, minHeight: 56 }}>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] uppercase tracking-wide" style={{ color: C.textFaint, ...fontBody }}>{T.formeLabel}</p>
                <p className="text-xs font-bold break-words leading-snug" style={{ color: formeVal === null ? C.textMuted : formeCol, ...fontDisplay }}>{formeVal === null ? T.notFilled : formeWord(formeVal, lang)}</p>
              </div>
              {formeVal !== null && <span style={{ ...fontMono, color: formeCol, fontSize: 22, lineHeight: 1 }}>{formeVal}</span>}
              <ChevronRightIcon size={14} style={{ color: C.textFaint }} className="shrink-0" />
            </button>
            <button type="button" onClick={() => setSelectedDate(todayIso)} className="text-xs font-semibold text-left py-1" style={{ color: C.primary, ...fontBody }}>{T.viewDayPlan} →</button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-y-4 gap-x-2 text-center mt-4 pt-4" style={{ borderTop: `1px solid ${C.borderSoft}66` }}>
          {[
            { v: weekCount, l: T.sessionsLabel, c: C.primary, sub: weekStats.upcoming > 0 ? T.upcomingOf(weekStats.upcoming) : null },
            { v: avgScore ?? "—", l: T.avgScore, c: avgScore ? scoreColor(avgScore) : C.textFaint },
            { v: nextEvent ? `J-${nextEvent.daysAway}` : "—", l: T.nextEvent, c: C.text },
            { v: weekStats.follow === null ? "—" : `${weekStats.follow}%`, l: T.followLabel, c: C.text },
            { v: `${weekStats.checkins}/7`, l: T.checkinsLabel, c: C.text },
            { v: weekStats.sleep ? `${weekStats.sleep}/5` : "—", l: T.sleepLabel, c: C.text },
          ].map((x, i) => (
            <div key={i} className="min-w-0">
              <p style={{ ...fontMono, color: x.c, fontSize: 20 }}>{x.v}</p>
              <p className="text-[11px] uppercase tracking-wide break-words leading-tight mt-0.5" style={{ color: C.textFaint, ...fontBody }}>{x.l}</p>
              {x.sub && <p className="text-[11px] mt-0.5" style={{ color: C.textMuted, ...fontBody }}>{x.sub}</p>}
            </div>
          ))}
        </div>
      </Card>

      {reminders.length > 0 && (
        <Card className="mb-5" style={{ background: `linear-gradient(160deg, ${C.primary}22 0%, ${C.surface} 60%)` }}>
          <div className="flex items-center gap-2 mb-2"><Bell size={15} style={{ color: C.primary }} /><p className="font-bold text-sm tracking-tight" style={{ color: C.primary, ...fontDisplay }}>{T.reminderTomorrow}</p></div>
          {reminders.map((r) => <p key={r.id} className="text-xs mb-1" style={{ color: C.primary, ...fontBody }}>{r.type === "rdv" ? `${praticienLabel(r.praticien, lang)}${r.motif ? " — " + r.motif : ""}` : `${eventLabel(r.type, lang)} ${sportIcon(r.sport)}`}{r.heure && ` ${r.heure}`} {T.reminderAt(r.notifyTime)}</p>)}
          <p className="text-[11px] mt-1" style={{ color: C.primary, opacity: 0.7, ...fontBody }}>{T.reminderNote}</p>
        </Card>
      )}

      {!lastPlan && !live.any && (
        <Card className="mb-5"><p className="text-xs mb-3" style={{ color: C.textMuted, ...fontBody }}>{T.noSessionYet}</p><Btn onClick={() => goTo("recup")} icon={Sparkles} full>{T.start}</Btn></Card>
      )}

      <div className="flex justify-between gap-2 mb-7 pb-1">
        <IconTile icon={Sparkles} label={T.quickRecup} onClick={() => goTo("recup")} color={C.primary} />
        <IconTile icon={Utensils} label={T.nutrition} onClick={() => goTo("nutrition")} color={C.warn} />
        <IconTile icon={HeartPulse} label={T.injuries} onClick={() => goTo("blessures")} color={C.blessure} />
        <IconTile icon={CalendarDays} label={T.planning} onClick={() => goTo("planning")} color={C.rdv} />
      </div>

      <button onClick={() => goTo("rappels")} className="w-full text-left mb-4">
        <Card style={tonight ? { background: `linear-gradient(155deg, ${C.primary}1F, ${C.surface})` } : undefined}>
          <div className="flex items-center gap-3">
            <Moon size={20} style={{ color: C.primary }} className="shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold" style={{ color: C.text, ...fontDisplay }}>{tonight ? T.tonightTitle(tonight.bed) : T.remindersCard}</p>
              <p className="text-xs mt-0.5" style={{ color: C.textMuted, ...fontBody }}>{tonight ? T.tonightSub(fmtHoursLabel(tonight.hours), tonight.wake, tonight.time) : T.remindersCardSub}</p>
            </div>
            <ChevronRightIcon size={16} style={{ color: C.textFaint }} className="shrink-0" />
          </div>
        </Card>
      </button>

      <ScoreChart sessionsLog={sessionsLog} />

      <SectionTitle icon={TrendingUp} action={sessionsLog.length > 3 ? <button onClick={() => setShowAllHistory(!showAllHistory)} className="text-xs font-semibold py-2 pl-3" style={{ color: C.primary, ...fontBody }}>{showAllHistory ? T.seeLess : T.seeMore}</button> : null}>{T.history}</SectionTitle>
      {sessionsLog.length === 0 ? <Card><p className="text-xs" style={{ color: C.textFaint, ...fontBody }}>{T.nothingYet}</p></Card> : (
        <GroupedList>
          {[...sessionsLog].reverse().slice(0, showAllHistory ? 30 : 3).map((s, i, arr) => (
            <div key={s.id} className="flex items-center" style={{ borderBottom: i === arr.length - 1 ? "none" : `1px solid ${C.glassBorder}` }}>
              <button type="button" onClick={() => setSelectedDate(isoLocal(new Date(s.date)))} className="flex-1 min-w-0 flex items-center gap-3 pl-4 pr-2 py-3 text-left">
                <span className="text-lg shrink-0">{sportIcon(s.sport)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold break-words" style={{ color: C.text, ...fontBody }}>{s.eventType === "match" ? T.match : s.eventType === "loisir" ? T.loisir : T.entrainement}</p>
                  <p className="text-xs break-words" style={{ color: C.textFaint, ...fontBody }}>{fmtDate(s.date, lang)}</p>
                </div>
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ background: scoreColor(s.score) }} /><span style={{ ...fontMono, color: C.text, fontSize: 15 }}>{s.score}</span><span className="text-[11px] font-semibold" style={{ color: scoreColor(s.score), ...fontBody }}>{scoreWord(s.score, lang)}</span></div>
                <ChevronRightIcon size={15} style={{ color: C.textFaint }} />
              </button>
              <button type="button" aria-label={T.deleteSession} onClick={() => { if (onDeleteSession && window.confirm(T.deleteSessionConfirm)) onDeleteSession(s); }} className="px-4 py-3"><Trash2 size={16} style={{ color: C.textFaint }} /></button>
            </div>
          ))}
        </GroupedList>
      )}

      <LegalFooter className="mt-8" />

      {selectedDayObj && <DayDetailSheet date={selectedDayObj.date} entries={selectedDayObj.entries} isException={selectedDayObj.isException} auto={selectedDayObj.auto} profile={profile} onClose={() => setSelectedDate(null)} onSaveException={onSaveException} onClearException={onClearException} onAddEntry={onAddEntry} onRemoveEntry={onRemoveEntry} goTo={goTo} onOpenPlan={onOpenPlanById} />}
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
    priceNoteMonthly: tr(lang, { fr: "Puis 5,99€/mois. Résiliable à tout moment.", en: "Then €5.99/mo. Cancel anytime.", es: "Luego 5,99€/mes. Cancela cuando quieras.", pt: "Depois 5,99€/mês. Cancele quando quiser." }),
    priceNoteYearly: tr(lang, { fr: "Puis 39,99€/an. Résiliable à tout moment.", en: "Then €39.99/yr. Cancel anytime.", es: "Luego 39,99€/año. Cancela cuando quieras.", pt: "Depois 39,99€/ano. Cancele quando quiser." }),
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
    freeStaysFree: tr(lang, { fr: "Le reste de l'app (plans de récup, conseils blessures, planning de base) reste gratuit, sans limite de temps.", en: "The rest of the app (recovery plans, injury guidance, base scheduling) stays free, with no time limit.", es: "El resto de la app (planes de recuperación, orientación de lesiones, planificación básica) sigue siendo gratis, sin límite de tiempo.", pt: "O resto do app (planos de recuperação, orientação de lesões, planejamento básico) continua grátis, sem limite de tempo." }),
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
      <div className="flex flex-col items-center mb-8 mt-2">
        <div className="w-16 h-16 rounded-[20px] flex items-center justify-center mb-3" style={{ background: gradPrimary, boxShadow: `0 12px 28px -10px ${C.primary}88` }}><Crown size={28} color="#052821" /></div>
        <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: C.text, ...fontDisplay }}>{T.title}</h1>
        <p className="text-xs mt-1" style={{ color: C.textMuted, ...fontBody }}>{T.subtitle}</p>
      </div>

      {isPro ? (
        <>
          <HeroCard accent={C.primary} className="mb-4 flex flex-col items-center text-center">
            <Crown size={22} style={{ color: C.primary, marginBottom: 6 }} />
            <p className="font-bold text-sm" style={{ color: C.primary, ...fontDisplay }}>{isTrial ? T.trialActive(trialDaysLeft) : T.youArePro}</p>
            <p className="text-xs mt-2" style={{ color: C.textMuted, ...fontBody }}>{T.until(fmtDate(renewalDate, lang))}</p>
            {cancelled ? (
              <p className="text-xs mt-1 px-3" style={{ color: C.warn, ...fontBody }}>{T.cancelledNote(fmtDate(renewalDate, lang))}</p>
            ) : (
              <p className="text-xs mt-1" style={{ color: C.textMuted, ...fontBody }}>{isTrial ? T.firstPayment(fmtDate(renewalDate, lang), priceLabel(cycle)) : T.nextPayment(fmtDate(renewalDate, lang), priceLabel(cycle))}</p>
            )}
          </HeroCard>

          {!cancelled && !confirmingCancel && <Btn full variant="danger" onClick={() => setConfirmingCancel(true)} icon={X}>{T.cancelBtn}</Btn>}
          {confirmingCancel && (
            <Card className="mb-2" style={{ background: C.dangerSoft, border: `1px solid ${C.danger}44` }}>
              <p className="font-bold text-sm mb-1" style={{ color: C.danger, ...fontBody }}>{T.confirmCancelTitle}</p>
              <p className="text-xs leading-relaxed mb-3" style={{ color: C.danger, ...fontBody }}>{T.confirmCancelNote(fmtDate(renewalDate, lang))}</p>
              <div className="flex gap-2">
                <Btn small full variant="danger" onClick={() => { cancelSub(); setConfirmingCancel(false); }}>{T.confirmCancelBtn}</Btn>
                <Btn small full variant="ghost" onClick={() => setConfirmingCancel(false)}>{T.keepSub}</Btn>
              </div>
            </Card>
          )}
          {cancelled && <Btn full variant="ghost" onClick={resumeSub} icon={Sparkles}>{T.resumeBtn}</Btn>}

          <div className="mt-6 mb-8">
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
        <Card className="mb-8" style={{ background: `linear-gradient(155deg, ${C.primary}22, ${C.surface})` }}>
          <div className="mb-4"><SegmentedControl options={[{ value: "monthly", label: T.monthly }, { value: "yearly", label: T.yearly }]} value={pickCycle} onChange={setPickCycle} /></div>
          <Btn full icon={Sparkles} onClick={() => startTrial(pickCycle)}>{T.startTrial}</Btn>
          <p className="text-xs text-center mt-3" style={{ color: C.textMuted, ...fontBody }}>{pickCycle === "yearly" ? T.priceNoteYearly : T.priceNoteMonthly}</p>
          {ENABLE_DEMO_PRO && <div className="mt-4 pt-4" style={{ borderTop: `1px dashed ${C.border}` }}>
            <p className="text-[11px] leading-relaxed mb-3" style={{ color: C.textFaint, ...fontBody }}>{T.demoNote}</p>
            <Btn full small variant="ghost" onClick={() => activateDemo(pickCycle)}>{T.activateDemo}</Btn>
          </div>}
        </Card>
      )}

      <SectionTitle icon={Crown}>{T.included}</SectionTitle>
      <div className="mb-7">
        <GroupedList>
          {features.map((f, i) => (
            <div key={i} className="flex items-start gap-3.5 px-5 py-4" style={{ borderBottom: i === features.length - 1 ? "none" : `1px solid ${C.glassBorder}` }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.primarySoft }}><f.Icon size={17} style={{ color: C.primary }} /></div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap"><p className="text-sm font-semibold" style={{ color: C.text, ...fontBody }}>{f.title}</p>{f.soon && <Badge color={C.textMuted}>{T.soon}</Badge>}</div>
                <p className="text-xs leading-relaxed mt-1" style={{ color: C.textMuted, ...fontBody }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </GroupedList>
      </div>
      <p className="text-[11px] text-center leading-relaxed" style={{ color: C.textFaint, ...fontBody }}>{T.freeStaysFree}</p>
      <LegalFooter className="mt-4" />
    </div>
  );
}

function ProfileScreen({ profile, userId, accessToken, onSave, onClose, onLogout, onDeleteAccount, onOpenPro, onTutorial, onOpenReminders }) {
  const { lang } = useLang();
  const { isPro, isTrial, trialDaysLeft } = usePro();
  const [p, setP] = useState(profile);
  const [ptab, setPtab] = useState("profil");
  const profScrollRef = useRef(null);
  useEffect(() => { const el = profScrollRef.current; if (el) el.scrollTop = 0; }, [ptab]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notifStatus, setNotifStatus] = useState(
    (typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.())
      ? "default" // app native : état réel interrogé juste après, via le plugin natif
      : (typeof Notification !== "undefined" ? Notification.permission : "unsupported")
  );
  const [notifLoading, setNotifLoading] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.()) {
      (async () => {
        try {
          const { PushNotifications } = await import("@capacitor/push-notifications");
          const perm = await PushNotifications.checkPermissions();
          setNotifStatus(perm.receive === "granted" ? "granted" : perm.receive === "denied" ? "denied" : "default");
        } catch { setNotifStatus("unsupported"); }
      })();
    }
  }, []);
  const toggleNotif = async () => {
    setNotifLoading(true);
    if (notifStatus === "granted") { await unsubscribeFromPush(userId, accessToken); setNotifStatus("default"); }
    else {
      const r = await subscribeToPush(userId, accessToken);
      if (r.ok) setNotifStatus("granted");
      else if (r.reason === "denied") setNotifStatus("denied");
      else if (r.reason === "unsupported") setNotifStatus("unsupported");
      else setNotifStatus(typeof Notification !== "undefined" ? Notification.permission : "denied");
    }
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
    remindersLabel: tr(lang, { fr: "Sommeil & étirements", en: "Sleep & stretching", es: "Sueño y estiramientos", pt: "Sono e alongamentos" }),
    remindersBtn: tr(lang, { fr: "Régler mes rappels", en: "Set my reminders", es: "Ajustar mis recordatorios", pt: "Ajustar meus lembretes" }),
    tutorial: tr(lang, { fr: "Tutoriel", en: "Tutorial", es: "Tutorial", pt: "Tutorial" }),
    replayTutorial: tr(lang, { fr: "Revoir le tutoriel et les guides", en: "Replay the tutorial and guides", es: "Ver el tutorial y las guías otra vez", pt: "Rever o tutorial e os guias" }),
    title: tr(lang, { fr: "Mon profil", en: "My profile", es: "Mi perfil", pt: "Meu perfil" }),
    save: tr(lang, { fr: "Enregistrer", en: "Save", es: "Guardar", pt: "Guardar" }),
    tabProfile: tr(lang, { fr: "Profil", en: "Profile", es: "Perfil", pt: "Perfil" }),
    tabSport: tr(lang, { fr: "Sport", en: "Sport", es: "Deporte", pt: "Esporte" }),
    tabFood: tr(lang, { fr: "Aliments", en: "Food", es: "Comida", pt: "Comida" }),
    tabAccount: tr(lang, { fr: "Compte", en: "Account", es: "Cuenta", pt: "Conta" }),
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
    dietLabel: tr(lang, { fr: "Régime alimentaire", en: "Diet", es: "Régimen alimentario", pt: "Regime alimentar" }),
    allergyNote: tr(lang, { fr: "Les repas proposés sont des suggestions générales : vérifie toujours les étiquettes des produits (traces possibles). En cas d'allergie grave, demande l'avis de ton médecin.", en: "Suggested meals are general ideas: always check product labels (traces possible). With a severe allergy, ask your doctor.", es: "Las comidas propuestas son sugerencias generales: revisa siempre las etiquetas (posibles trazas). Con una alergia grave, consulta a tu médico.", pt: "As refeições propostas são sugestões gerais: confira sempre os rótulos (possíveis traços). Em caso de alergia grave, consulte seu médico." }),
    dislikedLabel: tr(lang, { fr: "Aliments à éviter", en: "Foods to avoid", es: "Alimentos a evitar", pt: "Alimentos a evitar" }),
    dislikedHint: tr(lang, { fr: "Ces aliments ne seront plus jamais proposés dans tes repas conseillés.", en: "These foods will never be suggested in your recommended meals again.", es: "Estos alimentos ya no se sugerirán en tus comidas recomendadas.", pt: "Esses alimentos não serão mais sugeridos nas suas refeições recomendadas." }),
    dislikedPh: tr(lang, { fr: "ex : brocolis, thon...", en: "e.g. broccoli, tuna...", es: "ej. brócoli, atún...", pt: "ex: brócolis, atum..." }),
    add: tr(lang, { fr: "Ajouter", en: "Add", es: "Añadir", pt: "Adicionar" }),
    emailLabel: tr(lang, { fr: "Adresse email", en: "Email address", es: "Correo electrónico", pt: "Endereço de email" }),
    emailPh: tr(lang, { fr: "nouvelle@adresse.com", en: "new@address.com", es: "nueva@direccion.com", pt: "novo@endereco.com" }),
    emailChangeBtn: tr(lang, { fr: "Changer d'adresse", en: "Change address", es: "Cambiar dirección", pt: "Alterar endereço" }),
    emailSending: tr(lang, { fr: "Envoi...", en: "Sending...", es: "Enviando...", pt: "Enviando..." }),
    emailSent: tr(lang, { fr: "✓ Email envoyé — clique sur le lien reçu pour confirmer le changement.", en: "✓ Email sent — click the link you received to confirm the change.", es: "✓ Correo enviado — haz clic en el enlace recibido para confirmar el cambio.", pt: "✓ Email enviado — clique no link recebido para confirmar a mudança." }),
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
    proCardFree: tr(lang, { fr: "Débloque le multi-sport, la nutrition avancée et plus →", en: "Unlock multi-sport, advanced nutrition and more →", es: "Desbloquea multideporte, nutrición avanzada y más →", pt: "Desbloqueie multi-esporte, nutrição avançada e mais →" }),
  };
  return (
    <div className="fixed-full z-50 flex flex-col" style={{ background: C.mesh, backgroundColor: C.bg }}>
      <div className="flex items-center justify-between px-5 pb-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)", background: "rgba(10,22,19,0.55)", backdropFilter: "blur(24px)", borderBottom: `1px solid ${C.glassBorder}` }}><h2 className="font-bold text-lg tracking-tight" style={{ color: C.text, ...fontDisplay }}>{T.title}</h2><button onClick={onClose} aria-label="Fermer" className="flex items-center justify-center" style={{ width: 44, height: 44, marginRight: -10 }}><X size={22} style={{ color: C.textMuted }} /></button></div>
      <div className="px-5 pt-3 pb-1 shrink-0" style={{ background: "rgba(10,22,19,0.40)", borderBottom: `1px solid ${C.glassBorder}` }}>
        <SegmentedControl small options={[{ value: "profil", label: T.tabProfile }, { value: "sport", label: T.tabSport }, { value: "nutrition", label: T.tabFood }, { value: "compte", label: T.tabAccount }]} value={ptab} onChange={setPtab} />
        <div className="h-3" />
      </div>
      <div ref={profScrollRef} className="flex-1 overflow-y-auto px-5 py-6">
        {ptab === "profil" && (<>
        <div className="mb-6 px-4 py-3 rounded-2xl" style={{ background: `linear-gradient(155deg, ${C.primary}26, ${C.primaryAlt}12)`, border: `1px solid ${C.primary}33`, backdropFilter: "blur(14px)" }}>
          <p className="text-xs leading-relaxed" style={{ color: C.primary, ...fontBody }}>{T.note}</p>
        </div>
        <Field label={T.firstNameShown}><TextInput value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></Field>
        <Field label={T.sexe}><SegmentedControl options={SEXES.map((s) => ({ value: s.key, label: tr(lang, s) }))} value={p.sexe} onChange={(v) => setP({ ...p, sexe: v })} /></Field>
        <Field label={T.birth}><TextInput type="date" value={p.dateNaissance} onChange={(e) => setP({ ...p, dateNaissance: e.target.value })} />{p.dateNaissance && <p className="text-xs mt-1.5" style={{ color: C.textFaint, ...fontBody }}>{T.ageToday(computeAge(p.dateNaissance))}</p>}</Field>
        <Field label={T.height}><TextInput type="number" value={p.taille} onChange={(e) => setP({ ...p, taille: e.target.value })} /></Field>
        <Field label={T.weight}><TextInput type="number" value={p.poids} onChange={(e) => setP({ ...p, poids: e.target.value })} /></Field>
        </>)}
        {ptab === "sport" && (<>
        <Field label={<span>{T.sports}{!isPro && <span className="ml-1.5"><ProBadge /></span>}</span>}>
          <SportGrid selected={p.sports} onToggle={toggleSport} />
          {!isPro && <p className="text-[11px] mt-2" style={{ color: C.textFaint, ...fontBody }}>{T.sportsFreeHint}</p>}
        </Field>
        <Field label={T.level}><div className="flex flex-wrap gap-2">{NIVEAUX.map((n) => <Pill key={n.key} active={p.niveau === n.key} onClick={() => setP({ ...p, niveau: n.key })}>{tr(lang, n)}</Pill>)}</div></Field>
        <Field label={T.equipment}>
          <div className="flex flex-col gap-2">{EQUIPEMENTS.map((e) => (<button key={e.key} onClick={() => toggleEquip(e.key)} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left" style={{ background: p.equipement.includes(e.key) ? C.primarySoft : C.surface, border: `1px solid ${p.equipement.includes(e.key) ? C.primary : C.borderSoft}66` }}><div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ background: p.equipement.includes(e.key) ? C.primary : "transparent", border: `1px solid ${p.equipement.includes(e.key) ? C.primary : C.border}` }}>{p.equipement.includes(e.key) && <Check size={11} color="#052821" />}</div><span className="text-xs" style={{ color: C.text, ...fontBody }}>{tr(lang, e)}</span></button>))}</div>
        </Field>
        </>)}
        {ptab === "nutrition" && (<>
        <Field label={T.allergiesLabel}>
          <div className="flex flex-wrap gap-2">{ALLERGENS.filter((a) => a.group === "allergy").map((a) => (<Pill key={a.key} active={(p.allergies || []).includes(a.key)} onClick={() => toggleAllergy(a.key)}>{tr(lang, a)}</Pill>))}</div>
        </Field>
        <Field label={T.dietLabel}>
          <div className="flex flex-wrap gap-2">{ALLERGENS.filter((a) => a.group === "diet").map((a) => (<Pill key={a.key} active={(p.allergies || []).includes(a.key)} onClick={() => toggleAllergy(a.key)}>{tr(lang, a)}</Pill>))}</div>
        </Field>
        <p className="text-xs leading-relaxed mb-5" style={{ color: C.textFaint, ...fontBody }}>{T.allergyNote}</p>
        <Field label={T.dislikedLabel}>
          <p className="text-xs mb-2" style={{ color: C.textFaint, ...fontBody }}>{T.dislikedHint}</p>
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
        </>)}
        {ptab === "compte" && (<>
        <button onClick={onOpenPro} className="w-full text-left mb-6 rounded-2xl p-4 flex items-center gap-3" style={{ background: gradPrimary }}>
          <Crown size={20} color="#052821" />
          <div className="flex-1">
            <p className="text-sm font-bold" style={{ color: "#052821", ...fontDisplay }}>{T.proCardTitle}{isPro && <span className="ml-1.5">{isTrial ? `· ${trialDaysLeft}j` : "· actif"}</span>}</p>
            {!isPro && <p className="text-xs" style={{ color: "#052821", ...fontBody }}>{T.proCardFree}</p>}
          </div>
          <ChevronRightIcon size={16} color="#052821" />
        </button>
        <Field label={T.language}><LanguageSwitcher /></Field>
        {onOpenReminders && <Field label={T.remindersLabel}><Btn full small variant="ghost" onClick={onOpenReminders}>{T.remindersBtn}</Btn></Field>}
        <p className="text-[10px] text-center mt-4" style={{ color: C.textFaint, ...fontMono }}>{typeof window !== "undefined" ? `${window.innerWidth}×${window.innerHeight} / ${window.screen.width}×${window.screen.height}${document.documentElement.hasAttribute("data-fullh") ? " · plein écran" : ""}` : ""}</p>
        {onTutorial && <Field label={T.tutorial}><Btn full small variant="ghost" onClick={onTutorial}>{T.replayTutorial}</Btn></Field>}
        <Field label={T.notifications}>
          {notifStatus === "unsupported" ? (
            <p className="text-xs" style={{ color: C.textFaint, ...fontBody }}>{T.notifUnsupported}</p>
          ) : notifStatus === "denied" ? (
            <p className="text-xs" style={{ color: C.textFaint, ...fontBody }}>{T.notifBlocked}</p>
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
        <Field label={T.emailLabel}>
          <div className="flex gap-2">
            <div className="flex-1"><TextInput type="email" value={newEmail} onChange={(e) => { setNewEmail(e.target.value); setEmailChangeStatus(""); }} placeholder={T.emailPh} autoComplete="email" /></div>
            <Btn small onClick={submitEmailChange} disabled={emailChangeStatus === "sending" || !newEmail}>{emailChangeStatus === "sending" ? T.emailSending : T.emailChangeBtn}</Btn>
          </div>
          {emailChangeStatus === "sent" && <p className="text-xs mt-2" style={{ color: C.primary, ...fontBody }}>{T.emailSent}</p>}
          {emailChangeStatus === "error" && <p className="text-xs mt-2" style={{ color: C.danger, ...fontBody }}>{emailChangeError}</p>}
        </Field>
          <div className="mt-8">
        <div className="mt-2"><Btn full variant="danger" onClick={onLogout} icon={LogOut}>{T.logout}</Btn></div>
        <p className="text-xs text-center mt-6" style={{ color: C.textFaint, ...fontBody }}>
          <a href={`${LEGAL_BASE}/conditions.html`} target="_blank" rel="noopener noreferrer" style={{ color: C.textMuted, textDecoration: "underline" }}>{T.legalTerms}</a>
          {" · "}
          <a href={`${LEGAL_BASE}/confidentialite.html`} target="_blank" rel="noopener noreferrer" style={{ color: C.textMuted, textDecoration: "underline" }}>{T.legalPrivacy}</a>
        </p>
        {!confirmingDelete ? (
          <button onClick={() => setConfirmingDelete(true)} className="w-full text-center mt-4 pb-2 text-xs" style={{ color: C.textFaint, ...fontBody }}>{T.deleteAccount}</button>
        ) : (
          <div className="mt-4 mb-1 p-4 rounded-2xl" style={{ background: C.dangerSoft, border: `1px solid ${C.danger}44` }}>
            <p className="font-bold text-xs mb-1" style={{ color: C.danger, ...fontBody }}>{T.confirmDeleteTitle}</p>
            <p className="text-xs leading-relaxed mb-3" style={{ color: C.danger, ...fontBody }}>{T.confirmDeleteNote}</p>
            {deleteError && <p className="text-xs leading-relaxed mb-3 font-semibold" style={{ color: C.danger, ...fontBody }}>⚠️ {deleteError}</p>}
            <div className="flex gap-2">
              <Btn small full variant="danger" onClick={confirmDelete} disabled={deleting}>{deleting ? T.deleting : T.confirmDeleteBtn}</Btn>
              <Btn small full variant="ghost" onClick={() => setConfirmingDelete(false)} disabled={deleting}>{T.cancelDelete}</Btn>
            </div>
          </div>
        )}
          </div>
        </>)}
      </div>
      <div className="px-5 pt-3 shrink-0" style={{ background: "rgba(10,22,19,0.72)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", borderTop: `1px solid ${C.glassBorder}`, paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
        <Btn full onClick={() => onSave(p)} disabled={p.sports.length === 0} icon={Check}>{T.save}</Btn>
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
  const mainScrollRef = useRef(null);
  const [recupResult, setRecupResult] = useState(null);
  const [planningView, setPlanningView] = useState(null);
  // Quand on change de page (ou qu'un plan s'affiche), on repart toujours en haut
  useEffect(() => { const el = mainScrollRef.current; if (el) el.scrollTop = 0; }, [tab, planningView, recupResult]);
  const [showProfile, setShowProfile] = useState(false);
  const [toast, setToast] = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [guide, setGuide] = useState(null);            // clé du guide affiché (ou null)
  const [guidesSeen, setGuidesSeen] = useState(null);  // { home: true, ... } ; null = pas encore chargé
  const GUIDES_KEY = authUser ? `regen:guides:${authUser.id}` : null;
  const persistGuides = (obj) => { try { if (GUIDES_KEY && typeof window !== "undefined") window.localStorage.setItem(GUIDES_KEY, JSON.stringify(obj)); } catch { /* stockage indisponible : on garde en mémoire */ } };
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2600); };
  const [lang, setLangState] = useState("fr");
  const [recoveryToken, setRecoveryToken] = useState(null);

  const curSettings = userData?.settings || defaultSettings();
  const settingsKey = JSON.stringify({ ...curSettings, queue: undefined });
  const handleSaveSettings = async (patch) => {
    const next = { ...(userData?.settings || defaultSettings()), ...patch };
    setUserData((prev) => ({ ...prev, settings: next }));
    await sbUpsert("user_settings", { user_id: authUser.id, data: next }, accessToken);
  };
  // Suivi : bilans du jour et étapes de récup cochées (stockés dans user_settings, on garde ~60 jours).
  const pruneOld = (obj, keyDate) => { const lim = Date.now() - 60 * 86400000; const out = {}; Object.keys(obj || {}).forEach((k) => { const d = new Date(keyDate(k) + "T12:00:00").getTime(); if (!Number.isFinite(d) || d >= lim) out[k] = obj[k]; }); return out; };
  const setCheckin = (dateIso, ci) => {
    const st = userData?.settings || defaultSettings();
    handleSaveSettings({ checkins: pruneOld({ ...(st.checkins || {}), [dateIso]: ci }, (k) => k) });
  };
  const toggleDone = (key, item) => {
    const st = userData?.settings || defaultSettings();
    const cur = (st.done || {})[key] || {};
    handleSaveSettings({ done: pruneOld({ ...(st.done || {}), [key]: { ...cur, [item]: !cur[item] } }, (k) => k.slice(2, 12)) });
  };
  // Recalcule la liste des rappels (coucher / étirements) quand le planning, les séances ou les réglages changent.
  useEffect(() => {
    if (screen !== "main" || !userData?.profile || !authUser) return;
    const st = userData.settings || defaultSettings();
    const queue = buildReminderQueue(userData.plannerConfig, st, userData.profile, userData.sessionsLog || [], lang);
    const bilanBody = tr(lang, { fr: "Remplis ton bilan du jour : 4 touches pour affiner ton score et tes conseils.", en: "Fill in your daily check-in: 4 taps to fine-tune your score and advice.", es: "Rellena tu chequeo del día: 4 toques para afinar tu puntuación y tus consejos.", pt: "Preencha seu check-in do dia: 4 toques para ajustar sua pontuação e seus conselhos." });
    if (JSON.stringify(queue) === JSON.stringify(st.queue || []) && st.bilanBody === bilanBody) return;
    const next = { ...st, queue, bilanBody };
    setUserData((prev) => ({ ...prev, settings: next }));
    sbUpsert("user_settings", { user_id: authUser.id, data: next }, accessToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, userData?.plannerConfig, userData?.sessionsLog, userData?.profile, settingsKey, lang]);
  // Guides : on lit ce qui a déjà été vu, puis on ouvre automatiquement celui de la page courante (1 seule fois).
  useEffect(() => {
    if (!GUIDES_KEY) { setGuidesSeen(null); return; }
    let seen = {};
    try { const raw = typeof window !== "undefined" ? window.localStorage.getItem(GUIDES_KEY) : null; if (raw) seen = JSON.parse(raw) || {}; } catch { seen = {}; }
    setGuidesSeen(seen);
  }, [GUIDES_KEY]);
  const guideKey = showProfile ? "profile" : tab === "bilan" ? "home" : tab;
  useEffect(() => {
    if (screen !== "main" || showTutorial || guide || guidesSeen === null) return;
    if (!guidesSeen[guideKey]) setGuide(guideKey);
  }, [guideKey, screen, showTutorial, guide, guidesSeen]);
  // Demande des notifications : une seule fois par appareil, à l'inscription ou à la première connexion
  // (une réinstallation de l'app efface ce repère, donc la question revient). Si c'est déjà accepté, on
  // réenregistre simplement l'appareil en silence, une fois par ouverture.
  const [notifAsk, setNotifAsk] = useState(false);
  useEffect(() => {
    if (screen !== "main" || !authUser || !accessToken || showTutorial || guide || guidesSeen === null) return;
    let doneSession = false;
    try { doneSession = window.sessionStorage.getItem("regen:notifSession") === "1"; } catch { /* ignoré */ }
    if (doneSession) return;
    try { window.sessionStorage.setItem("regen:notifSession", "1"); } catch { /* ignoré */ }
    const askedKey = `regen:notifAsked:${authUser.id}`;
    let alreadyAsked = false;
    try { alreadyAsked = window.localStorage.getItem(askedKey) === "1"; } catch { /* ignoré */ }
    const markAsked = () => { try { window.localStorage.setItem(askedKey, "1"); } catch { /* ignoré */ } };
    (async () => {
      try {
        if (window.Capacitor?.isNativePlatform?.()) {
          const { PushNotifications } = await import("@capacitor/push-notifications");
          const perm = await PushNotifications.checkPermissions();
          if (perm.receive === "denied") return;
          if (perm.receive === "granted") { await subscribeToPush(authUser.id, accessToken); return; }
          if (alreadyAsked) return;
          markAsked();
          await subscribeToPush(authUser.id, accessToken);   // ouvre la fenêtre système
          return;
        }
        if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
        if (Notification.permission === "granted") { await subscribeToPush(authUser.id, accessToken); return; }
        if (Notification.permission === "default" && !alreadyAsked) { markAsked(); setNotifAsk(true); }   // iPhone exige un geste : carte d'abord
      } catch { /* sans effet */ }
    })();
  }, [screen, authUser, accessToken, showTutorial, guide, guidesSeen]);
  const closeGuide = () => {
    if (guide) { const next = { ...(guidesSeen || {}), [guide]: true }; setGuidesSeen(next); persistGuides(next); }
    setGuide(null);
  };
  const replayTutorial = () => { setGuidesSeen({}); persistGuides({}); setShowProfile(false); setShowTutorial(true); };
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
    setUserData((prev) => ({ ...prev, profile })); setScreen("main"); setShowTutorial(true);
  };
  const handleGeneratePlan = async (plan) => {
    const row = await sbInsert("sessions_log", { user_id: authUser.id, data: plan }, accessToken);
    const saved = row ? { ...plan, id: row.id } : plan;
    // La récup après séance est aussi ajoutée au planning, pour CE jour seulement
    // (sauf si la même séance y figure déjà). N'est pas bloquée par les limites gratuites.
    const dateIso = isoLocal();
    const cfg = ensurePlanner();
    const { entries } = getDayEntries(cfg.weeklyDays, cfg.exceptions, dateIso);
    const already = entries.some((e) => SPORT_TYPES.includes(e.type) && e.sport === plan.sport && e.type === plan.eventType);
    let newCfg = null;
    if (!already) {
      const entry = { id: Date.now() + Math.random(), type: plan.eventType, sport: plan.sport, intensity: plan.intensity, label: tr(lang, { fr: "Séance imprévue (déjà faite)", en: "Unplanned session (done)", es: "Sesión imprevista (hecha)", pt: "Sessão imprevista (feita)" }), heure: plan.heure || "", notify: false, notifyTime: "20:00", muscuZones: plan.muscuZones || [], sessionId: saved.id };
      newCfg = { ...cfg, exceptions: { ...cfg.exceptions, [dateIso]: [...entries, entry] } };
    }
    setUserData((prev) => ({ ...prev, sessionsLog: [...(prev.sessionsLog || []), saved], ...(newCfg ? { plannerConfig: newCfg } : {}) }));
    setRecupResult((cur) => (cur && cur.id === plan.id ? saved : cur));
    if (newCfg) await savePlanner(newCfg);
  };
  const handleDeleteSession = async (session) => {
    if (session.id != null) await sbDelete("sessions_log", `id=eq.${session.id}`, accessToken);
    const cfg = ensurePlanner();
    const exceptions = {}; let changed = false;
    Object.entries(cfg.exceptions).forEach(([date, ents]) => {
      const rest = ents.filter((e) => e.sessionId !== session.id);
      if (rest.length !== ents.length) { changed = true; if (rest.length > 0) exceptions[date] = rest; }
      else exceptions[date] = ents;
    });
    const newCfg = changed ? { ...cfg, exceptions } : cfg;
    setUserData((prev) => ({ ...prev, sessionsLog: (prev.sessionsLog || []).filter((x) => x.id !== session.id), plannerConfig: changed ? newCfg : prev.plannerConfig }));
    setRecupResult((cur) => (cur && cur.id === session.id ? null : cur));
    showToast(tr(lang, { fr: "Séance supprimée", en: "Session deleted", es: "Sesión eliminada", pt: "Sessão excluída" }));
    if (changed) await savePlanner(newCfg);
  };
  const goToTab = (k) => { if (k === "recup") { openNewRecup(); return; } setPlanningView(null); setTab(k); };
  const openPlanningAdd = () => { setPlanningView("ajouts"); setTab("planning"); };
  const openNewRecup = () => { setRecupResult(null); openPlanningAdd(); };
  const openPlan = (session) => { setRecupResult(session); openPlanningAdd(); };
  const openPlanById = (id) => { const sess = (userData?.sessionsLog || []).find((x) => x.id === id); if (sess) openPlan(sess); };
  const handleSaveProfile = async (p) => {
    const sports = proStatus.isPro ? p.sports : p.sports.slice(0, FREE_SPORTS_MAX);
    const profile = { ...p, sports };
    await saveProfileRow(profile);
    setUserData((prev) => ({ ...prev, profile })); setShowProfile(false);
    showToast(tr(lang, { fr: "Profil enregistré ✓", en: "Profile saved ✓", es: "Perfil guardado ✓", pt: "Perfil salvo ✓" }));
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
      const monthKey = isoLocal().slice(0, 7);
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
        const monthKey = isoLocal().slice(0, 7);
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
    setAuthUser(null); setAccessToken(null); setUserData(null); setScreen("auth"); setTab("home"); setShowProfile(false); setRecupResult(null);
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
    setAuthUser(null); setAccessToken(null); setUserData(null); setScreen("auth"); setTab("home"); setShowProfile(false); setRecupResult(null);
    return { ok: true };
  };

  setLoadContext({ sessionsLog: userData?.sessionsLog || [], plannerConfig: userData?.plannerConfig || null, checkins: (userData?.settings || {}).checkins || {} });
  const lastPlan = userData?.sessionsLog?.length ? userData.sessionsLog[userData.sessionsLog.length - 1] : null;
  const NAV_KEYS = {
    home: { fr: "Accueil", en: "Home", es: "Inicio", pt: "Início" },
    rappels: { fr: "Rappels", en: "Reminders", es: "Avisos", pt: "Lembretes" },
    nutrition: { fr: "Nutrition", en: "Nutrition", es: "Nutrición", pt: "Nutrição" },
    blessures: { fr: "Blessures", en: "Injuries", es: "Lesiones", pt: "Lesões" },
    planning: { fr: "Planning", en: "Schedule", es: "Plan", pt: "Plano" },
    pro: { fr: "Pro", en: "Pro", es: "Pro", pt: "Pro" },
  };
  const NAV = [["home", Home], ["rappels", Bell], ["blessures", HeartPulse], ["planning", CalendarDays], ["pro", Crown]];
  const navActive = (tab === "nutrition" || tab === "bilan") ? "home" : tab;

  return (
    <ProContext.Provider value={{ ...proStatus, startTrial: handleStartTrial, activateDemo: handleActivateDemo, setProDemo: handleSetProDemo, cancelSub: handleCancelSub, resumeSub: handleResumeSub, openPro }}>
      <LangContext.Provider value={{ lang, setLang }}>
       <TrackCtx.Provider value={{ settings: userData?.settings || {}, setCheckin, toggleDone }}>
        <div className="app-root flex items-center justify-center" style={{ background: C.bg }}>
          <style>{FONTS}</style>
          <div className="relative w-full max-w-[480px] h-full overflow-hidden flex flex-col" style={{ background: C.mesh, backgroundColor: C.bg, paddingTop: "env(safe-area-inset-top)", ...fontBody }}>
            {booting && <div className="flex-1 flex items-center justify-center"><img src={APP_LOGO} alt="REGEN" className="w-14 h-14 rounded-2xl object-cover animate-pulse" /></div>}
            {!booting && recoveryToken && <ResetPasswordScreen token={recoveryToken} onDone={() => { setRecoveryToken(null); window.history.replaceState(null, "", window.location.pathname); }} />}
            {!booting && !recoveryToken && screen === "auth" && <AuthScreen onAuth={handleAuth} />}
            {!booting && !recoveryToken && screen === "onboarding" && <Onboarding onComplete={handleOnboardingComplete} />}
            {!booting && !recoveryToken && screen === "main" && userData?.profile && (
              <>
                <div className="flex items-center justify-between px-5 py-3.5 shrink-0" style={{ background: "rgba(10,22,19,0.55)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", borderBottom: `1px solid ${C.glassBorder}` }}>
                  <div className="flex items-center gap-2"><img src={APP_LOGO} alt="REGEN" className="w-6 h-6 rounded-lg object-cover" /><span className="font-bold text-sm tracking-tight" style={{ color: C.text, ...fontDisplay }}>REGEN</span>{proStatus.isPro && <Crown size={13} style={{ color: C.primary }} />}</div>
                  <div className="flex items-center gap-2"><button onClick={() => setGuide(guideKey)} aria-label={tr(lang, { fr: "Aide sur cette page", en: "Help on this page", es: "Ayuda sobre esta página", pt: "Ajuda sobre esta página" })} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: C.glassSoft, border: `1px solid ${C.glassBorder}` }}><HelpCircle size={16} style={{ color: C.textMuted }} /></button><button onClick={() => setShowProfile(true)} className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs" style={{ background: gradPrimary, color: "#052821", ...fontMono }}>{(userData.prenom || userData.username || "U")[0].toUpperCase()}</button></div>
                </div>
                <div ref={mainScrollRef} className="flex-1 overflow-y-auto">
                  {tab === "home" && <HomeTab profile={userData.profile} sessionsLog={userData.sessionsLog || []} injuries={userData.injuries || []} plannerConfig={userData.plannerConfig} settings={curSettings} lastPlan={lastPlan} goTo={goToTab} onOpenPlan={openPlan} onOpenPlanById={openPlanById} onDeleteSession={handleDeleteSession} onSaveException={handleSaveException} onClearException={handleClearException} onAddEntry={handleAddEntry} onRemoveEntry={handleRemoveEntry} />}
                  {tab === "nutrition" && <NutritionTab lastPlan={lastPlan} onBack={() => goToTab("home")} />}
                  {tab === "blessures" && <BlessuresTab injuries={userData.injuries || []} onAddInjury={handleAddInjury} onUpdateInjury={handleUpdateInjury} onDeleteInjury={handleDeleteInjury} onAddRdv={handleAddEntry} />}
                  {tab === "planning" && <PlanningTab profile={userData.profile} plannerConfig={userData.plannerConfig} onSetWeekly={handleSetWeekly} onSaveException={handleSaveException} onClearException={handleClearException} onAddEntry={handleAddEntry} onRemoveEntry={handleRemoveEntry} goTo={goToTab} onOpenPlanById={openPlanById} initialView={planningView} recup={{ onGenerate: handleGeneratePlan, result: recupResult, setResult: setRecupResult, sessionsLog: userData.sessionsLog || [], onAdded: () => showToast(tr(lang, { fr: "Séance ajoutée ✓ Ton plan de récup du jour est mis à jour.", en: "Session added ✓ Today's recovery plan is updated.", es: "Sesión añadida ✓ El plan de recuperación de hoy está actualizado.", pt: "Sessão adicionada ✓ O plano de recuperação de hoje foi atualizado." })) }} />}
                  {tab === "pro" && <ProTab />}
                  {tab === "bilan" && <CheckinPage onBack={() => goToTab("home")} />}
                  {tab === "rappels" && <RemindersScreen settings={curSettings} onSave={handleSaveSettings} initialView={planningView === "rappels" ? "rappels" : "sommeil"} />}
                </div>
                <div className="fixed bottom-0 left-1/2 w-full max-w-[480px] flex flex-col" style={{ pointerEvents: "none", transform: "translateX(-50%)", zIndex: 40 }}>
                  <div style={{ height: 28, background: `linear-gradient(to bottom, transparent, ${C.bg}CC)` }} />
                  <div className="flex justify-around items-center py-2.5" style={{ pointerEvents: "auto", background: "rgba(10,22,19,0.72)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", borderTop: `1px solid ${C.glassBorder}`, paddingBottom: "max(8px, calc(env(safe-area-inset-bottom) - 12px))" }}>
                    {NAV.map(([key, Icon]) => (<button key={key} onClick={() => goToTab(key)} className="flex flex-col items-center gap-0.5 px-2"><Icon size={19} style={{ color: navActive === key ? C.primary : C.textFaint }} /><span className="text-[10px] font-semibold text-center" style={{ color: navActive === key ? C.primary : C.textFaint, ...fontBody }}>{tr(lang, NAV_KEYS[key])}</span></button>))}
                  </div>
                </div>
                {showTutorial && <TutorialScreen onDone={() => setShowTutorial(false)} />}
                {guide && !showTutorial && <GuideSheet guideKey={guide} onClose={closeGuide} />}
                {notifAsk && !showTutorial && !guide && <NotifPromptSheet onAccept={async () => { setNotifAsk(false); await subscribeToPush(authUser.id, accessToken); }} onLater={() => setNotifAsk(false)} />}
                {toast && <div className="fixed left-1/2 px-4 py-2.5 rounded-full text-xs font-semibold" style={{ top: "calc(env(safe-area-inset-top) + 64px)", transform: "translateX(-50%)", zIndex: 60, background: C.surface, color: C.text, border: `1px solid ${C.primary}66`, boxShadow: "0 8px 24px rgba(0,0,0,.4)", ...fontBody }}>{toast}</div>}
                {showProfile && <ProfileScreen profile={userData.profile} userId={authUser.id} accessToken={accessToken} onSave={handleSaveProfile} onClose={() => setShowProfile(false)} onLogout={handleLogout} onDeleteAccount={handleDeleteAccount} onOpenPro={() => { setShowProfile(false); setTab("pro"); }} onTutorial={replayTutorial} onOpenReminders={() => { setShowProfile(false); goToTab("rappels"); }} />}
              </>
            )}
          </div>
        </div>
       </TrackCtx.Provider>
      </LangContext.Provider>
    </ProContext.Provider>
  );
}
