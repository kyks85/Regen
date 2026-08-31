// send-account-email : envoie l'email de confirmation "passage en Pro" ou
// "abonnement annulé", selon ce que le client indique. Appelée directement
// depuis l'app, juste après l'action correspondante.
import { sendEmail, emailShell } from "../_shared/email.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
  } catch { return ""; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization") || "";
  const userToken = authHeader.replace("Bearer ", "");
  if (!userToken) {
    return new Response(JSON.stringify({ ok: false, error: "Non authentifié." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const meRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${userToken}` } });
  if (!meRes.ok) {
    return new Response(JSON.stringify({ ok: false, error: "Session invalide." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const me = await meRes.json();
  const email = me.email;
  if (!email) return new Response(JSON.stringify({ ok: false, error: "Pas d'email." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const body = await req.json().catch(() => ({}));
  const { type, cycle, trial, nextBillingDate } = body;

  if (type === "purchase") {
    const cyclePrice = cycle === "yearly" ? "39,99€/an" : "5,99€/mois";
    const html = trial
      ? emailShell("✨", "Ton essai Pro est activé !", `Profite de REGEN Pro en illimité pendant 7 jours — tous tes sports, toutes tes séances, nutrition avancée et RDV illimités.<br/><br/>Sans action de ta part, l'abonnement continuera ensuite au tarif ${cyclePrice}. Résiliable à tout moment depuis ton profil.`)
      : emailShell("✨", "Bienvenue dans REGEN Pro !", `Ton abonnement REGEN Pro (${cyclePrice}) est actif — merci pour ta confiance. Tu profites maintenant de tous tes sports, toutes tes séances, de la nutrition avancée et des RDV illimités.`);
    const ok = await sendEmail(email, trial ? "Ton essai REGEN Pro a démarré ✨" : "Bienvenue dans REGEN Pro ✨", html);
    return new Response(JSON.stringify({ ok }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (type === "cancel") {
    const endDate = nextBillingDate ? formatDate(nextBillingDate) : "";
    const html = emailShell("💔", "Ton abonnement Pro est annulé", `C'est confirmé — ton abonnement REGEN Pro ne sera pas renouvelé.${endDate ? ` Tu profites encore de tous les avantages Pro jusqu'au <strong style="color:#EAF6F3;">${endDate}</strong>.` : ""}<br/><br/>Tu peux te réabonner à tout moment depuis ton profil, si tu changes d'avis.`);
    const ok = await sendEmail(email, "Ton abonnement REGEN Pro a été annulé", html);
    return new Response(JSON.stringify({ ok }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ ok: false, error: "Type inconnu." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
