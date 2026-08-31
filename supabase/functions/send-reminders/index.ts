import webpush from "npm:web-push@3.6.7";
import { sendFcmMessage } from "../_shared/fcm.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;

webpush.setVapidDetails("mailto:contact@regen-app.fr", VAPID_PUBLIC, VAPID_PRIVATE);

function headers() {
  return { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };
}
function currentHHMM() {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
}
function tomorrowISOParis() {
  const now = new Date(Date.now() + 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

const SPORT_LABELS: Record<string, string> = {
  football: "football", rugby: "rugby", basket: "basketball", handball: "handball",
  volley: "volleyball", boxe: "boxe", mma: "MMA / grappling", tennis: "tennis",
  running: "course à pied", cyclisme: "cyclisme", natation: "natation",
  muscu: "musculation", autre: "sport",
};
const PRATICIEN_LABELS: Record<string, string> = {
  medecin_generaliste: "médecin généraliste", medecin_sport: "médecin du sport",
  kine: "kinésithérapeute", osteo: "ostéopathe", podologue: "podologue",
  nutritionniste: "nutritionniste", autre_praticien: "praticien",
};

function buildMessageBody(entry: any) {
  if (entry.type === "rdv") {
    const praticienLabel = PRATICIEN_LABELS[entry.praticien] || "praticien";
    return `RDV : ${praticienLabel} demain${entry.heure ? " à " + entry.heure : ""}`;
  }
  const sportLabel = SPORT_LABELS[entry.sport] || "sport";
  return `Séance de ${sportLabel} demain${entry.heure ? " à " + entry.heure : ""}`;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  const nowHHMM = currentHHMM();
  const tomorrowISO = tomorrowISOParis();
  const dow = (new Date(tomorrowISO).getDay() + 6) % 7;

  const [plannerRes, subsRes, nativeRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/planner_config?select=*`, { headers: headers() }),
    fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?select=*`, { headers: headers() }),
    fetch(`${SUPABASE_URL}/rest/v1/push_tokens_native?select=*`, { headers: headers() }),
  ]);
  const planners = await plannerRes.json();
  const subs = await subsRes.json();
  const nativeTokens = await nativeRes.json();

  if (!Array.isArray(planners) || !Array.isArray(subs)) {
    return new Response(JSON.stringify({ ok: false, plannerStatus: plannerRes.status, subsStatus: subsRes.status }), { headers: { "Content-Type": "application/json" } });
  }

  let sent = 0;

  for (const planner of planners) {
    const userSubs = subs.filter((s: any) => s.user_id === planner.user_id);
    const userNative = Array.isArray(nativeTokens) ? nativeTokens.filter((t: any) => t.user_id === planner.user_id) : [];
    if (userSubs.length === 0 && userNative.length === 0) continue;

    const exceptionEntries = planner.exceptions?.[tomorrowISO];
    const entries = exceptionEntries !== undefined ? exceptionEntries : (planner.weekly_days?.[dow] || []);
    const due = force
      ? (entries || []).filter((e: any) => e.notify && e.type !== "blessure")
      : (entries || []).filter((e: any) => e.notify && e.type !== "blessure" && (e.notifyTime || "20:00") === nowHHMM);
    if (due.length === 0) continue;

    for (const entry of due) {
      const entryKey = `${tomorrowISO}-${entry.id}`;
      if (!force) {
        const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/notification_log?user_id=eq.${planner.user_id}&entry_key=eq.${encodeURIComponent(entryKey)}&select=id`, { headers: headers() });
        const already = await checkRes.json();
        if (Array.isArray(already) && already.length > 0) continue;
      }

      const body = buildMessageBody(entry);

      // Web push (navigateur / PWA installée depuis Safari-Chrome)
      for (const sub of userSubs) {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify({ title: "REGEN", body, url: "/" }));
          sent++;
        } catch (err: any) {
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?id=eq.${sub.id}`, { method: "DELETE", headers: headers() });
          }
        }
      }

      // Notifications natives (vraie app iOS/Android via Capacitor + Firebase)
      for (const nt of userNative) {
        const result = await sendFcmMessage(nt.token, "REGEN", body);
        if (result.ok) {
          sent++;
        } else if (result.status === 404 || result.status === 400) {
          // Jeton invalide/périmé (désinstallation, etc.) — on le retire.
          await fetch(`${SUPABASE_URL}/rest/v1/push_tokens_native?id=eq.${nt.id}`, { method: "DELETE", headers: headers() });
        }
      }

      if (!force) await fetch(`${SUPABASE_URL}/rest/v1/notification_log`, { method: "POST", headers: headers(), body: JSON.stringify({ user_id: planner.user_id, entry_key: entryKey }) });
    }
  }

  return new Response(JSON.stringify({ ok: true, sent, nowHHMM }), { headers: { "Content-Type": "application/json" } });
});
