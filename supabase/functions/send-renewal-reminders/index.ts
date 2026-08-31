// send-renewal-reminders : tourne une fois par jour (cron), repère les
// abonnements Pro dont le renouvellement approche dans REMINDER_DAYS jours
// et envoie un email de rappel — une seule fois par échéance, grâce à
// email_log qui évite les doublons.
import { sendEmail, emailShell } from "../_shared/email.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const REMINDER_DAYS = 3;

function headers() {
  return { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };
}
function formatDate(iso: string) {
  try { return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso)); } catch { return ""; }
}
function isoDateOnly(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

Deno.serve(async () => {
  const targetDateISO = isoDateOnly(new Date(Date.now() + REMINDER_DAYS * 86400000));

  const subsRes = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?status=eq.pro&cancelled=eq.false&select=*`, { headers: headers() });
  const subs = await subsRes.json();
  if (!Array.isArray(subs)) return new Response(JSON.stringify({ ok: false, subs }), { headers: { "Content-Type": "application/json" } });

  let sent = 0;
  for (const sub of subs) {
    if (!sub.next_billing_date) continue;
    if (isoDateOnly(new Date(sub.next_billing_date)) !== targetDateISO) continue;

    const emailKey = `renewal-${sub.user_id}-${targetDateISO}`;
    const already = await fetch(`${SUPABASE_URL}/rest/v1/email_log?user_id=eq.${sub.user_id}&email_key=eq.${encodeURIComponent(emailKey)}&select=id`, { headers: headers() }).then((r) => r.json());
    if (Array.isArray(already) && already.length > 0) continue;

    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${sub.user_id}`, { headers: headers() });
    if (!userRes.ok) continue;
    const user = await userRes.json();
    if (!user.email) continue;

    const price = sub.cycle === "yearly" ? "39,99€" : "5,99€";
    const html = emailShell("🔔", "Ton renouvellement REGEN Pro approche", `Ton abonnement REGEN Pro sera renouvelé le <strong style="color:#EAF6F3;">${formatDate(sub.next_billing_date)}</strong> (${price}). Rien à faire si tu souhaites continuer — sinon, tu peux annuler à tout moment depuis ton profil, avant cette date.`);
    const ok = await sendEmail(user.email, "Ton abonnement REGEN Pro se renouvelle bientôt", html);
    if (ok) {
      sent++;
      await fetch(`${SUPABASE_URL}/rest/v1/email_log`, { method: "POST", headers: headers(), body: JSON.stringify({ user_id: sub.user_id, email_key: emailKey }) });
    }
  }

  return new Response(JSON.stringify({ ok: true, sent }), { headers: { "Content-Type": "application/json" } });
});
