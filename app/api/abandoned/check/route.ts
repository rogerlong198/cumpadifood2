import { NextResponse } from "next/server"
import {
  claimAbandonEmail,
  getOrderSnapshot,
  isOrderPaid,
  kvConfigured,
} from "@/lib/order-store"
import { sendAbandonedCartEmail, validateOrderInput } from "@/lib/send-order-email"

export const dynamic = "force-dynamic"

// Chamado pelo QStash ~30 min após a criação do PIX. Se o pedido NÃO foi pago,
// dispara o e-mail de carrinho abandonado (uma única vez).
async function handle(request: Request) {
  const secret = process.env.PAGOUAI_WEBHOOK_SECRET
  const url = new URL(request.url)
  if (secret) {
    const provided =
      url.searchParams.get("secret") ||
      request.headers.get("x-webhook-secret") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      ""
    if (provided !== secret) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
    }
  }

  const txid = url.searchParams.get("txid")?.trim()
  if (!txid) return NextResponse.json({ ok: true, handled: false, reason: "sem-txid" })
  if (!kvConfigured()) return NextResponse.json({ ok: true, handled: false, reason: "sem-kv" })

  try {
    if (await isOrderPaid(txid)) {
      return NextResponse.json({ ok: true, handled: false, reason: "ja-pago" })
    }

    const order = await getOrderSnapshot(txid)
    if (!order) return NextResponse.json({ ok: true, handled: false, reason: "sem-snapshot" })

    const invalid = validateOrderInput(order)
    if (invalid) return NextResponse.json({ ok: true, handled: false, reason: "snapshot-invalido" })

    // Trava: nunca manda 2x.
    const won = await claimAbandonEmail(txid)
    if (!won) return NextResponse.json({ ok: true, handled: false, reason: "ja-enviado" })

    const result = await sendAbandonedCartEmail(order)
    if (!result.ok) {
      console.error(`[ABANDONED CHECK] Falha ao enviar (${txid}):`, result.error)
    }
    return NextResponse.json({ ok: true, handled: result.ok })
  } catch (e) {
    console.error("[ABANDONED CHECK] Erro inesperado:", e)
    return NextResponse.json({ ok: true, handled: false, reason: "erro" })
  }
}

export async function POST(request: Request) {
  return handle(request)
}

export async function GET(request: Request) {
  return handle(request)
}
