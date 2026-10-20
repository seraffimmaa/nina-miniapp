// Принимает анкету из миниаппа и отправляет её Нине в личку через бота.
// Переменные окружения в Netlify: BOT_TOKEN, NINA_CHAT_ID
const crypto = require("crypto");

// Проверяем, что запрос реально пришёл из Telegram (защита от спама)
function verifyInitData(initData, botToken) {
  if (!initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const checkString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const calc = crypto.createHmac("sha256", secret).update(checkString).digest("hex");
  if (calc !== hash) return null;
  try { return JSON.parse(params.get("user") || "{}"); } catch { return {}; }
}

const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };

  const { BOT_TOKEN, NINA_CHAT_ID } = process.env;
  if (!BOT_TOKEN || !NINA_CHAT_ID) return { statusCode: 500, body: "Server not configured" };

  let d;
  try { d = JSON.parse(event.body || "{}"); } catch { return { statusCode: 400, body: "Bad JSON" }; }

  const user = verifyInitData(d.initData, BOT_TOKEN);
  if (!user) return { statusCode: 401, body: "Open the app inside Telegram" };
  if (!d.name || !d.phone) return { statusCode: 400, body: "Name and phone required" };

  const tgLink = user.username
    ? `@${esc(user.username)}`
    : `<a href="tg://user?id=${user.id}">${esc(user.first_name || "профиль")}</a>`;

  const lines = [
    "🌿 <b>Новая предзапись!</b>",
    "",
    `👤 <b>Имя:</b> ${esc(d.name)}`,
    `📞 <b>Телефон:</b> ${esc(d.phone)}`,
    `💬 <b>Telegram:</b> ${tgLink}`,
    d.area && `📍 <b>Район:</b> ${esc(d.area)}`,
    d.interest && `💆‍♀️ <b>Интересует:</b> ${esc(d.interest)}`,
    d.time &&`🕐 <b>Удобное время:</b> ${esc(d.time)}`,
    d.request && `\n📝 <b>Запрос:</b>\n${esc(d.request)}`,
    d.source && `\n🔎 <b>Откуда узнали:</b> ${esc(d.source)}`
  ].filter(Boolean);

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: NINA_CHAT_ID,
      text: lines.join("\n"),
      parse_mode: "HTML",
      disable_web_page_preview: true
    })
  });

  if (!res.ok) return { statusCode: 502, body: await res.text() };
  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
