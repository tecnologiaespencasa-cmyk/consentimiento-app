export async function sendTeamsWebhook(
  webhookUrl: string,
  title: string,
  text: string
) {
  const payload = {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    summary: title,
    themeColor: "0076D7",
    title,
    text: text.replace(/\n/g, "<br/>"),
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Teams webhook failed: ${res.status} ${t}`);
  }
}