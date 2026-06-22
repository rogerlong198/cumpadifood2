// Persistência do pedido pro fluxo webhook: guardamos o snapshot completo no KV
// na criação do PIX (chave = txid), e o webhook da Pagou.ai lê de volta quando o
// pagamento confirma — assim o e-mail sai mesmo se o cliente fechar a aba.

import { kvClaimOnce, kvConfigured, kvDel, kvGetJSON, kvSetJSON } from "./kv"
import type { OrderEmailInput } from "./order-email"

export { kvConfigured }

// 3 dias de folga entre criar o PIX e a confirmação/reprocessamento do webhook.
const ORDER_TTL_SECONDS = 60 * 60 * 24 * 3

const orderKey = (txid: string) => `order:${txid}`
const emailLockKey = (txid: string) => `order-email:${txid}`
const abandonLockKey = (txid: string) => `abandon-sent:${txid}`
const paidKey = (txid: string) => `paid:${txid}`

// Gera um código de pedido no mesmo formato do front (XX000000000XX). Usado só
// quando é o webhook que dispara o e-mail (aba fechada) — o cliente vê só o e-mail.
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"
function randomLetters(count: number): string {
  let out = ""
  for (let i = 0; i < count; i += 1) {
    out += LETTERS[Math.floor(Math.random() * LETTERS.length)]
  }
  return out
}
export function generateOrderCode(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = Math.imul(31, hash) + seed.charCodeAt(i)
    hash |= 0
  }
  const number = String(Math.abs(hash + Date.now()) % 1000000000).padStart(9, "0")
  return `${randomLetters(2)}${number}${randomLetters(2)}`
}

export async function saveOrderSnapshot(txid: string, order: OrderEmailInput): Promise<void> {
  await kvSetJSON(orderKey(txid), order, ORDER_TTL_SECONDS)
}

export async function getOrderSnapshot(txid: string): Promise<OrderEmailInput | null> {
  return kvGetJSON<OrderEmailInput>(orderKey(txid))
}

// true = você ganhou o direito de enviar o e-mail desse pedido.
// false = já foi reservado/enviado por outro caminho (front ou webhook).
export async function claimOrderEmail(txid: string): Promise<boolean> {
  return kvClaimOnce(emailLockKey(txid), ORDER_TTL_SECONDS)
}

// Libera a trava caso o envio falhe, pra um retry (webhook ou front) tentar de novo.
export async function releaseOrderEmail(txid: string): Promise<void> {
  await kvDel(emailLockKey(txid))
}

// Marca o pedido como pago (flag independente do envio do e-mail). Chamado no
// webhook e na rota de e-mail, ambos disparados só após pagamento confirmado.
export async function markOrderPaid(txid: string): Promise<void> {
  await kvSetJSON(paidKey(txid), 1, ORDER_TTL_SECONDS)
}

// true se o pedido foi pago. Usado pelo check de abandono pra NÃO incomodar
// quem já pagou.
export async function isOrderPaid(txid: string): Promise<boolean> {
  return (await kvGetJSON(paidKey(txid))) != null
}

// Trava do e-mail de abandono: garante envio único por pedido.
export async function claimAbandonEmail(txid: string): Promise<boolean> {
  return kvClaimOnce(abandonLockKey(txid), ORDER_TTL_SECONDS)
}
