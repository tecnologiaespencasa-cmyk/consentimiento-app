import { getGraphToken } from "./graphAuth";

type SendMailArgs = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
};

export async function sendGraphMail({ to, subject, text, html }: SendMailArgs) {
  const sender = process.env.GRAPH_SENDER_EMAIL;
  if (!sender) throw new Error("Falta env GRAPH_SENDER_EMAIL");

  const token = await getGraphToken();

  const toList = Array.isArray(to) ? to : [to];

  const payload = {
    message: {
      subject,
      body: {
        contentType: html ? "HTML" : "Text",
        content: html ?? text,
      },
      toRecipients: toList.map((addr) => ({
        emailAddress: { address: addr },
      })),
    },
    saveToSentItems: true,
  };

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Error enviando correo (Graph): ${res.status} ${t}`);
  }
}
