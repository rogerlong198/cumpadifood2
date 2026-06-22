import { NextResponse } from "next/server"
import { type OrderEmailInput } from "@/lib/order-email"
import { sendOrderEmail, validateOrderInput } from "@/lib/send-order-email"
import { claimOrderEmail, kvConfigured, markOrderPaid, releaseOrderEmail } from "@/lib/order-store"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  const { txid, ...order } = body ?? {}
  const validationError = validateOrderInput(order as Partial<OrderEmailInput>)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 })
  }

  // Com txid + KV: trava por txid pra nunca duplicar com o webhook. Se o webhook
  // já enviou, claim devolve false e a gente sai sem reenviar.
  if (txid && kvConfigured()) {
    try {
      // Pagamento confirmado (esta rota só é chamada após aprovação). Marca pago
      // pra cancelar o e-mail de carrinho abandonado.
      await markOrderPaid(String(txid)).catch(() => {})

      const won = await claimOrderEmail(String(txid))
      if (!won) {
        return NextResponse.json({ ok: true, deduped: true })
      }
      const result = await sendOrderEmail(order as OrderEmailInput)
      if (!result.ok) {
        await releaseOrderEmail(String(txid)).catch(() => {})
        return NextResponse.json({ error: result.error }, { status: result.status })
      }
      return NextResponse.json({ ok: true, id: result.id ?? null })
    } catch (e) {
      // Falha no KV não pode perder a venda: cai no envio direto.
      console.error("[ORDER EMAIL] Falha no lock KV, enviando direto:", e)
    }
  }

  // Sem txid/KV (ou KV indisponível): envio direto, como antes.
  const result = await sendOrderEmail(order as OrderEmailInput)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ ok: true, id: result.id ?? null })
}
