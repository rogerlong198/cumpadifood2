// Template do e-mail de confirmação de pedido — CompadreFood.
// Portado do projeto "loja estilo shopify" e rebrandeado (vermelho + bebida,
// entrega grátis em 1h, sem Correios/rastreio).

export type OrderEmailItem = {
  id?: number | string;
  name: string;
  image?: string;
  price: number;
  compareAtPrice?: number;
  quantity: number;
};

export type OrderEmailAddress = {
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  stateUF: string;
};

export type OrderEmailInput = {
  orderCode: string;
  customer: {
    name: string;
    email: string;
    phone?: string;
    cpf?: string;
  };
  address: OrderEmailAddress;
  items: OrderEmailItem[];
  subtotal: number;
  shipping?: number;
  total: number;
  paymentMethod: "pix" | "card";
};

const BRAND_NAME = "CompadreFood";
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://v0-del-ivery-copia-dany.vercel.app";
const BRAND_LOGO_URL = `${APP_URL}/logo.png`;

// Paleta brand (vermelho dominante + verde pra "confirmado")
const C = {
  primary: "#1a1a1a",
  dark: "#1a1a1a",
  accent: "#e8202b", // vermelho CompadreFood
  accentSoft: "#fff1f1",
  accentBorder: "#f6c9cc",
  green: "#16a34a",
  greenSoft: "#f1fff5",
  greenBorder: "#c6edcf",
  text: "#202020",
  muted: "#777777",
  mutedSoft: "#a7a7a7",
  line: "#ececec",
  lineSoft: "#f1f1f1",
  bg: "#e7e7e7",
  card: "#ffffff",
  cardSoft: "#fafafa",
  cardSofter: "#fbfbfb",
  footerLine: "#373737",
};

const formatBRL = (value: number) => `R$ ${Number(value || 0).toFixed(2).replace(".", ",")}`;

const escapeHtml = (value: string) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export function renderOrderConfirmationEmail(order: OrderEmailInput) {
  const methodLabel = order.paymentMethod === "pix" ? "Pix" : "Cartão de Crédito";
  const firstName = (order.customer.name || "").trim().split(" ")[0] || "Cliente";

  const addressLine1 = [
    order.address.street,
    order.address.number,
    order.address.complement ? `— ${order.address.complement}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const addressLine2 = [
    order.address.neighborhood,
    `${order.address.city} — ${order.address.stateUF}`,
    `CEP ${order.address.cep}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const itemRows = order.items
    .map((item) => {
      const lineTotal = item.price * item.quantity;
      const imgCell = item.image
        ? `<td width="56" style="padding:10px 12px 10px 0;vertical-align:top;">
             <img src="${escapeHtml(item.image)}" width="56" height="56" alt="" style="display:block;width:56px;height:56px;border-radius:8px;border:1px solid ${C.line};object-fit:cover;" />
           </td>`
        : `<td width="56" style="padding:10px 12px 10px 0;vertical-align:top;">
             <div style="width:56px;height:56px;border-radius:8px;border:1px solid ${C.line};background:${C.cardSoft};"></div>
           </td>`;
      return `
        <tr>
          ${imgCell}
          <td style="padding:10px 0;vertical-align:top;color:${C.text};font-size:13px;line-height:18px;">
            <strong style="display:block;color:${C.primary};font-size:13px;font-weight:700;">${escapeHtml(item.name)}</strong>
            <span style="display:inline-block;margin-top:3px;color:${C.muted};font-size:11px;">Qtd: ${item.quantity} · ${formatBRL(item.price)} un.</span>
          </td>
          <td align="right" style="padding:10px 0 10px 12px;vertical-align:top;color:${C.text};font-size:13px;font-weight:700;white-space:nowrap;">
            ${formatBRL(lineTotal)}
          </td>
        </tr>
      `;
    })
    .join("");

  const subject = `Pedido confirmado · ${order.orderCode} · ${BRAND_NAME}`;
  const shipping = order.shipping ?? 0;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    Seu pedido ${escapeHtml(order.orderCode)} foi confirmado na ${BRAND_NAME}.
  </div>

  <div style="max-width:600px;margin:0 auto;background:${C.card};">
    <!-- top accent bar -->
    <div style="background:${C.accent};height:5px;"></div>

    <!-- header / logo -->
    <div style="background:${C.card};padding:24px 32px 20px;text-align:center;border-bottom:1px solid ${C.lineSoft};">
      <img src="${BRAND_LOGO_URL}" alt="${BRAND_NAME}" height="80" style="display:inline-block;height:80px;width:auto;max-width:240px;border:0;outline:none;text-decoration:none;" />
      <p style="margin:6px 0 0;font-size:11px;color:${C.muted};letter-spacing:1.4px;text-transform:uppercase;">Bebida gelada na sua casa 🍻</p>
    </div>

    <!-- intro -->
    <div style="background:${C.cardSofter};padding:22px 30px;text-align:center;border-bottom:1px solid ${C.line};">
      <h1 style="margin:0 0 7px;font-size:19px;color:${C.primary};font-weight:700;line-height:1.25;">
        Olá, ${escapeHtml(firstName)} — recebemos seu pedido <span style="color:${C.accent};">${escapeHtml(order.orderCode)}</span>.
      </h1>
      <p style="margin:0;font-size:12px;color:${C.muted};line-height:1.45;">
        O pagamento foi confirmado e seu pedido já está sendo preparado. Chega geladinho em até 1 hora.
      </p>
    </div>

    <!-- main card -->
    <div style="padding:16px 30px;">
      <div style="background:${C.card};border-radius:15px;border:1px solid ${C.line};overflow:hidden;box-shadow:0 10px 28px rgba(0,0,0,0.08);">
        <!-- pill header -->
        <div style="background:${C.primary};padding:11px;text-align:center;">
          <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
            <tr>
              <td style="padding-right:10px;vertical-align:middle;">
                <div style="width:30px;height:30px;background:${C.green};border-radius:50%;text-align:center;line-height:30px;">
                  <span style="color:#ffffff;font-size:16px;font-weight:800;">✓</span>
                </div>
              </td>
              <td style="vertical-align:middle;">
                <span style="color:#ffffff;font-size:15px;font-weight:700;letter-spacing:0.5px;">Pagamento confirmado</span>
              </td>
            </tr>
          </table>
        </div>

        <!-- total + order code -->
        <div style="padding:18px 24px 16px;background:${C.cardSoft};">
          <div style="background:${C.card};border:1px solid ${C.line};border-radius:18px;padding:22px;text-align:center;box-shadow:0 8px 22px rgba(0,0,0,0.06);">
            <p style="margin:0 0 8px;font-size:10px;color:${C.muted};text-transform:uppercase;letter-spacing:1.4px;font-weight:700;">Total pago</p>
            <p style="margin:0 0 14px;font-size:28px;font-weight:800;color:${C.green};line-height:1.05;">${formatBRL(order.total)}</p>

            <div style="display:inline-block;background:${C.greenSoft};border:1px solid ${C.greenBorder};border-radius:999px;padding:7px 13px;margin:0 0 18px;">
              <p style="margin:0;font-size:10px;color:${C.green};font-weight:700;line-height:1.25;letter-spacing:0.3px;">
                ${methodLabel} aprovado
              </p>
            </div>

            <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:${C.primary};">Código do pedido</p>
            <div style="background:#f7f7f7;border:1px solid #dfdfdf;border-radius:11px;padding:0 12px;margin:0 0 14px;min-height:44px;line-height:44px;overflow:hidden;">
              <p style="margin:0;font-size:15px;font-family:'Courier New',monospace;color:${C.primary};line-height:44px;font-weight:700;letter-spacing:1.6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${escapeHtml(order.orderCode)}
              </p>
            </div>

            <a href="${escapeHtml(APP_URL)}" style="display:block;background:${C.accent};color:#ffffff;text-decoration:none;padding:0 18px;border-radius:999px;font-size:14px;font-weight:800;line-height:54px;min-height:54px;box-shadow:0 8px 18px rgba(232,32,43,0.28);letter-spacing:0.4px;text-transform:uppercase;">
              Voltar à loja
            </a>
          </div>
        </div>

        <!-- items -->
        <div style="padding:0 24px 4px;background:${C.cardSoft};">
          <p style="margin:0 0 6px;font-size:11px;font-weight:800;color:${C.primary};letter-spacing:1.2px;text-transform:uppercase;">Itens do pedido</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.line};">
            ${itemRows}
          </table>
        </div>

        <!-- totals -->
        <div style="padding:0 24px 16px;background:${C.cardSoft};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.line};">
            <tr>
              <td style="padding:10px 0;color:${C.muted};font-size:12px;">Subtotal</td>
              <td align="right" style="padding:10px 0;color:${C.text};font-size:12px;font-weight:600;">${formatBRL(order.subtotal)}</td>
            </tr>
            <tr>
              <td style="padding:0 0 10px;color:${C.muted};font-size:12px;">Entrega</td>
              <td align="right" style="padding:0 0 10px;color:${shipping > 0 ? C.text : C.green};font-size:12px;font-weight:700;">${shipping > 0 ? formatBRL(shipping) : "Grátis"}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-top:1px solid ${C.line};color:${C.primary};font-size:13px;font-weight:800;">Total pago</td>
              <td align="right" style="padding:10px 0;border-top:1px solid ${C.line};color:${C.green};font-size:15px;font-weight:800;">${formatBRL(order.total)}</td>
            </tr>
          </table>
        </div>

        <!-- shipping address -->
        <div style="padding:0 24px 16px;background:${C.cardSoft};">
          <p style="margin:0 0 6px;font-size:11px;font-weight:800;color:${C.primary};letter-spacing:1.2px;text-transform:uppercase;">Endereço de entrega</p>
          <div style="background:${C.card};border:1px solid ${C.line};border-radius:12px;padding:14px 16px;">
            <p style="margin:0;color:${C.text};font-size:13px;line-height:20px;">
              <strong style="display:block;font-weight:700;color:${C.primary};">${escapeHtml(order.customer.name)}</strong>
              ${addressLine1 ? `<span style="display:block;margin-top:3px;">${escapeHtml(addressLine1)}</span>` : ""}
              ${addressLine2 ? `<span style="display:block;color:${C.muted};font-size:12px;">${escapeHtml(addressLine2)}</span>` : ""}
              ${order.customer.phone ? `<span style="display:block;margin-top:6px;color:${C.muted};font-size:11px;">Telefone: ${escapeHtml(order.customer.phone)}</span>` : ""}
            </p>
          </div>
        </div>

        <!-- info band -->
        <div style="padding:0 24px 22px;background:${C.cardSoft};">
          <div style="background:${C.accentSoft};border:1px solid ${C.accentBorder};border-radius:9px;padding:12px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9a1b1b;line-height:1.45;">
              Seu pedido já está sendo preparado e sai geladinho — entrega em até 1 hora na sua casa. 🛵
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- secondary note -->
    <div style="padding:0 32px 24px;">
      <div style="background:#f7f7f7;border-radius:10px;padding:13px 16px;text-align:center;border:1px solid #eeeeee;">
        <p style="margin:0;font-size:11px;color:${C.muted};line-height:1.55;">
          Em caso de dúvidas, basta responder este e-mail.
        </p>
      </div>
    </div>

    <!-- footer -->
    <div style="background:${C.dark};padding:28px 32px;text-align:center;">
      <div style="display:inline-block;background:#ffffff;border-radius:14px;padding:10px 16px;">
        <img src="${BRAND_LOGO_URL}" alt="${BRAND_NAME}" height="64" style="display:block;height:64px;width:auto;max-width:200px;border:0;outline:none;text-decoration:none;" />
      </div>
      <div style="width:42px;height:2px;background:${C.accent};margin:10px auto 14px;"></div>
      <p style="margin:0 0 14px;font-size:11px;color:${C.mutedSoft};line-height:1.45;">
        Bebida gelada, entrega rápida.
      </p>
      <div style="border-top:1px solid ${C.footerLine};padding-top:14px;">
        <p style="margin:0;font-size:11px;color:#8a8a8a;">© ${new Date().getFullYear()} ${BRAND_NAME}. Todos os direitos reservados.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

  return { subject, html };
}

// E-mail de carrinho abandonado: mesmo visual do de confirmação, mas com tom de
// lembrete e um CTA pra finalizar o pedido. Enviado pelo /api/abandoned/check
// quando o pedido não foi pago dentro do prazo.
export function renderAbandonedCartEmail(order: OrderEmailInput) {
  const firstName = (order.customer.name || "").trim().split(" ")[0] || "Cliente";
  const checkoutUrl = `${APP_URL}/checkout`;

  const itemRows = order.items
    .map((item) => {
      const lineTotal = item.price * item.quantity;
      const imgCell = item.image
        ? `<td width="56" style="padding:10px 12px 10px 0;vertical-align:top;">
             <img src="${escapeHtml(item.image)}" width="56" height="56" alt="" style="display:block;width:56px;height:56px;border-radius:8px;border:1px solid ${C.line};object-fit:cover;" />
           </td>`
        : `<td width="56" style="padding:10px 12px 10px 0;vertical-align:top;">
             <div style="width:56px;height:56px;border-radius:8px;border:1px solid ${C.line};background:${C.cardSoft};"></div>
           </td>`;
      return `
        <tr>
          ${imgCell}
          <td style="padding:10px 0;vertical-align:top;color:${C.text};font-size:13px;line-height:18px;">
            <strong style="display:block;color:${C.primary};font-size:13px;font-weight:700;">${escapeHtml(item.name)}</strong>
            <span style="display:inline-block;margin-top:3px;color:${C.muted};font-size:11px;">Qtd: ${item.quantity} · ${formatBRL(item.price)} un.</span>
          </td>
          <td align="right" style="padding:10px 0 10px 12px;vertical-align:top;color:${C.text};font-size:13px;font-weight:700;white-space:nowrap;">
            ${formatBRL(lineTotal)}
          </td>
        </tr>
      `;
    })
    .join("");

  const subject = `${firstName}, você esqueceu sua gelada 🍺 · ${BRAND_NAME}`;
  const shipping = order.shipping ?? 0;
  const amber = "#b45309";
  const amberSoft = "#fff7ed";
  const amberBorder = "#fed7aa";

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    Você deixou itens no carrinho da ${BRAND_NAME}. Finalize antes que a gelada acabe!
  </div>

  <div style="max-width:600px;margin:0 auto;background:${C.card};">
    <div style="background:${C.accent};height:5px;"></div>

    <div style="background:${C.card};padding:24px 32px 20px;text-align:center;border-bottom:1px solid ${C.lineSoft};">
      <img src="${BRAND_LOGO_URL}" alt="${BRAND_NAME}" height="80" style="display:inline-block;height:80px;width:auto;max-width:240px;border:0;outline:none;text-decoration:none;" />
      <p style="margin:6px 0 0;font-size:11px;color:${C.muted};letter-spacing:1.4px;text-transform:uppercase;">Bebida gelada na sua casa 🍻</p>
    </div>

    <div style="background:${C.cardSofter};padding:22px 30px;text-align:center;border-bottom:1px solid ${C.line};">
      <h1 style="margin:0 0 7px;font-size:19px;color:${C.primary};font-weight:700;line-height:1.25;">
        Ei, ${escapeHtml(firstName)} — sua gelada ficou no carrinho! 🛒
      </h1>
      <p style="margin:0;font-size:12px;color:${C.muted};line-height:1.45;">
        Você começou um pedido mas não finalizou o pagamento. Os itens ainda estão te esperando — é só concluir.
      </p>
    </div>

    <div style="padding:16px 30px;">
      <div style="background:${C.card};border-radius:15px;border:1px solid ${C.line};overflow:hidden;box-shadow:0 10px 28px rgba(0,0,0,0.08);">
        <div style="background:${amber};padding:11px;text-align:center;">
          <span style="color:#ffffff;font-size:15px;font-weight:700;letter-spacing:0.5px;">⏳ Pedido não finalizado</span>
        </div>

        <div style="padding:18px 24px 16px;background:${C.cardSoft};">
          <div style="background:${C.card};border:1px solid ${C.line};border-radius:18px;padding:22px;text-align:center;box-shadow:0 8px 22px rgba(0,0,0,0.06);">
            <p style="margin:0 0 8px;font-size:10px;color:${C.muted};text-transform:uppercase;letter-spacing:1.4px;font-weight:700;">Total do carrinho</p>
            <p style="margin:0 0 16px;font-size:28px;font-weight:800;color:${C.accent};line-height:1.05;">${formatBRL(order.total)}</p>

            <a href="${escapeHtml(checkoutUrl)}" style="display:block;background:${C.accent};color:#ffffff;text-decoration:none;padding:0 18px;border-radius:999px;font-size:14px;font-weight:800;line-height:54px;min-height:54px;box-shadow:0 8px 18px rgba(232,32,43,0.28);letter-spacing:0.4px;text-transform:uppercase;">
              Finalizar meu pedido
            </a>
          </div>
        </div>

        <div style="padding:0 24px 4px;background:${C.cardSoft};">
          <p style="margin:0 0 6px;font-size:11px;font-weight:800;color:${C.primary};letter-spacing:1.2px;text-transform:uppercase;">Itens que ficaram</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.line};">
            ${itemRows}
          </table>
        </div>

        <div style="padding:0 24px 16px;background:${C.cardSoft};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.line};">
            <tr>
              <td style="padding:10px 0;color:${C.muted};font-size:12px;">Subtotal</td>
              <td align="right" style="padding:10px 0;color:${C.text};font-size:12px;font-weight:600;">${formatBRL(order.subtotal)}</td>
            </tr>
            <tr>
              <td style="padding:0 0 10px;color:${C.muted};font-size:12px;">Entrega</td>
              <td align="right" style="padding:0 0 10px;color:${shipping > 0 ? C.text : C.green};font-size:12px;font-weight:700;">${shipping > 0 ? formatBRL(shipping) : "Grátis"}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-top:1px solid ${C.line};color:${C.primary};font-size:13px;font-weight:800;">Total</td>
              <td align="right" style="padding:10px 0;border-top:1px solid ${C.line};color:${C.accent};font-size:15px;font-weight:800;">${formatBRL(order.total)}</td>
            </tr>
          </table>
        </div>

        <div style="padding:0 24px 22px;background:${C.cardSoft};">
          <div style="background:${amberSoft};border:1px solid ${amberBorder};border-radius:9px;padding:12px;text-align:center;">
            <p style="margin:0;font-size:12px;color:${amber};line-height:1.45;">
              Gelada é o tipo de coisa que não pode faltar. Finalize agora e receba em até 1 hora. 🛵
            </p>
          </div>
        </div>
      </div>
    </div>

    <div style="padding:0 32px 24px;">
      <div style="background:#f7f7f7;border-radius:10px;padding:13px 16px;text-align:center;border:1px solid #eeeeee;">
        <p style="margin:0;font-size:11px;color:${C.muted};line-height:1.55;">
          Em caso de dúvidas, basta responder este e-mail.
        </p>
      </div>
    </div>

    <div style="background:${C.dark};padding:28px 32px;text-align:center;">
      <div style="display:inline-block;background:#ffffff;border-radius:14px;padding:10px 16px;">
        <img src="${BRAND_LOGO_URL}" alt="${BRAND_NAME}" height="64" style="display:block;height:64px;width:auto;max-width:200px;border:0;outline:none;text-decoration:none;" />
      </div>
      <div style="width:42px;height:2px;background:${C.accent};margin:10px auto 14px;"></div>
      <p style="margin:0 0 14px;font-size:11px;color:${C.mutedSoft};line-height:1.45;">
        Bebida gelada, entrega rápida.
      </p>
      <div style="border-top:1px solid ${C.footerLine};padding-top:14px;">
        <p style="margin:0;font-size:11px;color:#8a8a8a;">© ${new Date().getFullYear()} ${BRAND_NAME}. Todos os direitos reservados.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

  return { subject, html };
}
