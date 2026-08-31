// Module partagé par toutes les fonctions qui envoient un email — évite de
// dupliquer le même code (et le même style visuel) dans chacune.
// Envoi via Gmail SMTP (gratuit, jusqu'à 500 emails/jour) — pas besoin de
// nom de domaine pour l'instant.
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const GMAIL_USER = Deno.env.get("GMAIL_USER")!;
const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD")!;

export async function sendEmail(to: string, subject: string, html: string) {
  try {
    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: { username: GMAIL_USER, password: GMAIL_APP_PASSWORD },
      },
    });
    await client.send({ from: `REGEN <${GMAIL_USER}>`, to, subject, content: "Ouvre cet email dans un client compatible HTML pour le voir correctement.", html });
    await client.close();
    return true;
  } catch {
    return false;
  }
}

// Même enveloppe visuelle que les templates Supabase (fond sombre,
// dégradé teal) — juste un titre, un corps, et un bouton optionnel.
export function emailShell(icon: string, title: string, bodyHtml: string, button?: { label: string; url: string }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>REGEN</title>
<style>
  .email-bg { background-color: #070E0D !important; }
</style>
</head>
<body class="email-bg" style="margin:0;padding:0;background-color:#070E0D;">
<table role="presentation" width="100%" bgcolor="#070E0D" cellpadding="0" cellspacing="0" class="email-bg" style="background-color:#070E0D;">
  <tr>
    <td align="center" style="padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
        <tr>
          <td style="padding-bottom:32px;text-align:center;">
            <div style="display:inline-block;width:56px;height:56px;border-radius:16px;background:linear-gradient(155deg,#49E3C433,#2FB8D61A);border:1px solid #49E3C440;line-height:56px;font-size:24px;">${icon}</div>
            <div style="color:#EAF6F3;font-size:20px;font-weight:800;letter-spacing:-0.02em;margin-top:12px;">REGEN</div>
          </td>
        </tr>
        <tr>
          <td bgcolor="#101B19" style="background-color:#101B19;border:1px solid #FFFFFF14;border-radius:24px;padding:32px 28px;">
            <h1 style="color:#EAF6F3;font-size:20px;font-weight:800;margin:0 0 12px;letter-spacing:-0.01em;">${title}</h1>
            <div style="color:#9FB5B0;font-size:14px;line-height:1.6;margin:0 0 8px;">${bodyHtml}</div>
            ${button ? `
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto 8px;">
              <tr><td bgcolor="#49E3C4" style="border-radius:14px;background:linear-gradient(135deg,#49E3C4,#2FB8D6);">
                <a href="${button.url}" style="display:inline-block;padding:14px 32px;color:#052821;font-size:14px;font-weight:700;text-decoration:none;">${button.label}</a>
              </td></tr>
            </table>` : ""}
          </td>
        </tr>
        <tr>
          <td style="padding-top:24px;text-align:center;">
            <p style="color:#4A5C57;font-size:11px;margin:0;">REGEN — Ta récup, pilotée intelligemment.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
