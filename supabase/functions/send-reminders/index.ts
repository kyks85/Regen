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
function todayISOParis() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
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

  // ---- Rappels préparés par l'app (coucher, étirements) ----
  // L'app range dans user_settings.data.queue la liste des rappels des 14 prochains jours
  // ({ date, time, kind, body }). Ici on envoie seulement ceux dont l'heure est arrivée.
  let sentQueue = 0;
  if (!force) {
    const settingsRes = await fetch(`${SUPABASE_URL}/rest/v1/user_settings?select=*`, { headers: headers() });
    const settingsRows = await settingsRes.json();
    const todayISO = todayISOParis();
    if (Array.isArray(settingsRows)) {
      for (const row of settingsRows) {
        // Bilan du jour : à 12h, si l'utilisateur ne l'a pas encore rempli aujourd'hui.
        if (nowHHMM === "12:00" && row?.data?.bilanOn !== false && !["sleep", "sore", "stress", "energy"].every((k) => Number((row?.data?.checkins || {})[todayISO]?.[k]) >= 1)) {
          const bSubs = subs.filter((x: any) => x.user_id === row.user_id);
          const bNative = Array.isArray(nativeTokens) ? nativeTokens.filter((t: any) => t.user_id === row.user_id) : [];
          const bKey = `bilan-${todayISO}`;
          if (bSubs.length > 0 || bNative.length > 0) {
            const chk = await fetch(`${SUPABASE_URL}/rest/v1/notification_log?user_id=eq.${row.user_id}&entry_key=eq.${encodeURIComponent(bKey)}&select=id`, { headers: headers() });
            const seen = await chk.json();
            if (!(Array.isArray(seen) && seen.length > 0)) {
              const bBody = row?.data?.bilanBody || "Remplis ton bilan du jour : 4 touches pour affiner ton score et tes conseils.";
              for (const sub of bSubs) {
                try {
                  await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify({ title: "REGEN", body: bBody, url: "/" }));
                  sentQueue++;
                } catch (err: any) {
                  if (err?.statusCode === 410 || err?.statusCode === 404) {
                    await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?id=eq.${sub.id}`, { method: "DELETE", headers: headers() });
                  }
                }
              }
              for (const nt of bNative) {
                const result = await sendFcmMessage(nt.token, "REGEN", bBody);
                if (result.ok) sentQueue++;
                else if (result.status === 404 || result.status === 400) {
                  await fetch(`${SUPABASE_URL}/rest/v1/push_tokens_native?id=eq.${nt.id}`, { method: "DELETE", headers: headers() });
                }
              }
              await fetch(`${SUPABASE_URL}/rest/v1/notification_log`, { method: "POST", headers: headers(), body: JSON.stringify({ user_id: row.user_id, entry_key: bKey }) });
            }
          }
        }
        const queue = row?.data?.queue;
        if (!Array.isArray(queue)) continue;
        const due = queue.filter((q: any) => q && q.date === todayISO && q.time === nowHHMM && q.body);
        if (due.length === 0) continue;
        const userSubs = subs.filter((x: any) => x.user_id === row.user_id);
        const userNative = Array.isArray(nativeTokens) ? nativeTokens.filter((t: any) => t.user_id === row.user_id) : [];
        if (userSubs.length === 0 && userNative.length === 0) continue;
        for (const q of due) {
          const entryKey = `q-${q.date}-${q.kind}-${q.time}`;
          const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/notification_log?user_id=eq.${row.user_id}&entry_key=eq.${encodeURIComponent(entryKey)}&select=id`, { headers: headers() });
          const already = await checkRes.json();
          if (Array.isArray(already) && already.length > 0) continue;
          for (const sub of userSubs) {
            try {
              await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify({ title: "REGEN", body: q.body, url: "/" }));
              sentQueue++;
            } catch (err: any) {
              if (err?.statusCode === 410 || err?.statusCode === 404) {
                await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?id=eq.${sub.id}`, { method: "DELETE", headers: headers() });
              }
            }
          }
          for (const nt of userNative) {
            const result = await sendFcmMessage(nt.token, "REGEN", q.body);
            if (result.ok) {
              sentQueue++;
            } else if (result.status === 404 || result.status === 400) {
              await fetch(`${SUPABASE_URL}/rest/v1/push_tokens_native?id=eq.${nt.id}`, { method: "DELETE", headers: headers() });
            }
          }
          await fetch(`${SUPABASE_URL}/rest/v1/notification_log`, { method: "POST", headers: headers(), body: JSON.stringify({ user_id: row.user_id, entry_key: entryKey }) });
        }
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, sent, sentQueue, nowHHMM }), { headers: { "Content-Type": "application/json" } });
});
