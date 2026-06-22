// Envio do e-mail de confirmação de pedido via Resend.
// Versão "só disparo" (sem KV/webhook): envia direto, chamada pelo front quando
// o pagamento confirma.

import { Resend } from "resend";
import { renderOrderConfirmationEmail, renderAbandonedCartEmail, type OrderEmailInput } from "./order-email";

export type SendOrderEmailResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string; status: number };

export function isValidEmail(value: unknown) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// Retorna null se o pedido for válido, ou uma mensagem de erro caso contrário.
export function validateOrderInput(order: Partial<OrderEmailInput>): string | null {
  if (!order?.orderCode || !order?.customer || !isValidEmail(order.customer.email)) {
    return "Dados do pedido incompletos.";
  }
  if (!Array.isArray(order.items) || order.items.length === 0) {
    return "Pedido sem itens.";
  }
  if (!order.address) {
    return "Endereço ausente.";
  }
  return null;
}

export async function sendOrderEmail(order: OrderEmailInput): Promise<SendOrderEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[ORDER EMAIL] RESEND_API_KEY ausente.");
    return { ok: false, error: "Servidor de e-mail não configurado.", status: 500 };
  }

  const fromAddress = process.env.RESEND_FROM_EMAIL;
  if (!fromAddress) {
    console.error("[ORDER EMAIL] RESEND_FROM_EMAIL ausente.");
    return { ok: false, error: "Remetente de e-mail não configurado.", status: 500 };
  }

  // Cliente sempre; loja (STORE_EMAIL) recebe cópia se configurado.
  const to = [order.customer.email, process.env.STORE_EMAIL].filter(Boolean) as string[];

  try {
    const { subject, html } = renderOrderConfirmationEmail(order);
    const resend = new Resend(apiKey);

    const result = await resend.emails.send({
      from: fromAddress,
      to,
      subject,
      html,
      replyTo: process.env.RESEND_REPLY_TO || undefined,
    });

    if (result.error) {
      console.error("[ORDER EMAIL] Resend error:", result.error);
      return { ok: false, error: result.error.message || "Falha ao enviar e-mail.", status: 502 };
    }

    return { ok: true, id: result.data?.id ?? null };
  } catch (err: any) {
    console.error("[ORDER EMAIL] Falha inesperada:", err);
    return { ok: false, error: err?.message || "Falha ao enviar e-mail.", status: 500 };
  }
}

// E-mail de carrinho abandonado — só pro cliente (sem cópia pra loja).
export async function sendAbandonedCartEmail(order: OrderEmailInput): Promise<SendOrderEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !fromAddress) {
    console.error("[ABANDONED EMAIL] RESEND_API_KEY ou RESEND_FROM_EMAIL ausente.");
    return { ok: false, error: "Servidor de e-mail não configurado.", status: 500 };
  }

  try {
    const { subject, html } = renderAbandonedCartEmail(order);
    const resend = new Resend(apiKey);

    const result = await resend.emails.send({
      from: fromAddress,
      to: [order.customer.email],
      subject,
      html,
      replyTo: process.env.RESEND_REPLY_TO || undefined,
    });

    if (result.error) {
      console.error("[ABANDONED EMAIL] Resend error:", result.error);
      return { ok: false, error: result.error.message || "Falha ao enviar e-mail.", status: 502 };
    }

    return { ok: true, id: result.data?.id ?? null };
  } catch (err: any) {
    console.error("[ABANDONED EMAIL] Falha inesperada:", err);
    return { ok: false, error: err?.message || "Falha ao enviar e-mail.", status: 500 };
  }
}
