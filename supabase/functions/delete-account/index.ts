// delete-account : supprime TOUT ce qui concerne le compte de l'utilisateur
// qui appelle cette fonction — ses données ET sa ligne d'authentification
// (email/mot de passe), grâce à la clé service_role utilisée uniquement ici,
// côté serveur, jamais exposée dans le code de l'app.
import { sendEmail, emailShell } from "../_shared/email.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Indispensable : cette fonction est appelée DIRECTEMENT depuis le
// navigateur (contrairement à send-reminders, appelée par un serveur), donc
// il faut explicitement autoriser cet appel — sans ça, le navigateur bloque
// la requête avant même qu'elle parte, avec une erreur "Load failed".
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function serviceHeaders() {
  return { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };
}

Deno.serve(async (req) => {
  // Le navigateur envoie d'abord une requête de vérification (preflight)
  // avant la vraie requête — il faut y répondre correctement.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") || "";
  const userToken = authHeader.replace("Bearer ", "");
  if (!userToken) {
    return new Response(JSON.stringify({ ok: false, error: "Non authentifié." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Identifie précisément QUI appelle, à partir de son propre jeton — pour
  // être certain qu'on ne supprime jamais que SON PROPRE compte, jamais un
  // autre.
  const meRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${userToken}` } });
  if (!meRes.ok) {
    return new Response(JSON.stringify({ ok: false, error: "Session invalide." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const me = await meRes.json();
  const userId = me.id;
  const email = me.email;

  // Envoyé AVANT la suppression — après, l'adresse ne sera plus rattachée
  // à rien de récupérable.
  if (email) {
    await sendEmail(email, "Ton compte REGEN a été supprimé", emailShell(
      "👋",
      "Ton compte a bien été supprimé",
      "Toutes tes données (profil, séances, planning, abonnement) ont été définitivement effacées. Si c'est une erreur ou que tu changes d'avis, tu peux recréer un compte à tout moment avec cette même adresse email.",
    ));
  }

  // Supprime toutes les données liées, table par table.
  const tables = ["profiles", "sessions_log", "planner_config", "injuries", "subscriptions", "push_subscriptions", "notification_log"];
  for (const table of tables) {
    const column = table === "profiles" ? "id" : "user_id";
    await fetch(`${SUPABASE_URL}/rest/v1/${table}?${column}=eq.${userId}`, { method: "DELETE", headers: serviceHeaders() });
  }

  // Supprime enfin la ligne d'authentification elle-même (email/mot de passe).
  const deleteRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: serviceHeaders() });
  if (!deleteRes.ok) {
    const errBody = await deleteRes.text().catch(() => "");
    return new Response(JSON.stringify({ ok: false, error: "Échec de la suppression du compte.", detail: errBody }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
