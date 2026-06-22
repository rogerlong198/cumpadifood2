import { NextResponse } from "next/server"
import { claimOrderEmail, getOrderSnapshot, kvConfigured, markOrderPaid, releaseOrderEmail } from "@/lib/order-store"
import { sendOrderEmail, validateOrderInput } from "@/lib/send-order-email"

export const dynamic = "force-dynamic"

// Mesmos status liquidados das rotas de pagamento. "authorized" fica de fora
// (pré-autorização de cartão = dinheiro ainda não capturado).
function isPaidStatus(status: unknown) {
  return ["paid", "captured", "succeeded", "completed", "approved", "pago"].includes(
    String(status ?? "").toLowerCase()
  )
}

// A Pagou.ai pode mandar o payload em formatos diferentes; extraímos txid+status
// de forma tolerante.
function extract(body: any): { txid: string | null; status: string | null } {
  const t = body?.data ?? body?.transaction ?? body ?? {}
  const txid = t?.id ?? t?.transactionId ?? t?.txid ?? body?.id ?? body?.txid ?? null
  const status = t?.status ?? body?.status ?? null
  return { txid: txid ? String(txid) : null, status: status ? String(status) : null }
}

export async function POST(request: Request) {
  // 1) Segurança: se houver segredo configurado, exige que bata (query ?secret=
  //    ou header). Sem segredo configurado, processa mesmo assim (best effort).
  const secret = process.env.PAGOUAI_WEBHOOK_SECRET
  if (secret) {
    const url = new URL(request.url)
    const provided =
      url.searchParams.get("secret") ||
      request.headers.get("x-webhook-secret") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      ""
    if (provided !== secret) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
    }
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: true }) // ack mesmo sem corpo válido
  }

  const { txid, status } = extract(body)

  // Sempre 200 pra Pagou não ficar reenviando — a lógica é best effort.
  if (!txid || !isPaidStatus(status)) {
    return NextResponse.json({ ok: true, handled: false, reason: "ignorado" })
  }
  if (!kvConfigured()) {
    console.warn("[WEBHOOK] KV não configurado; nada a processar.")
    return NextResponse.json({ ok: true, handled: false, reason: "sem-kv" })
  }

  try {
    // Marca como pago já — independe do snapshot/e-mail. Impede o e-mail de abandono.
    await markOrderPaid(txid).catch(() => {})

    const order = await getOrderSnapshot(txid)
    if (!order) {
      console.warn(`[WEBHOOK] Sem snapshot pro txid ${txid}.`)
      return NextResponse.json({ ok: true, handled: false, reason: "sem-snapshot" })
    }

    const invalid = validateOrderInput(order)
    if (invalid) {
      console.error(`[WEBHOOK] Snapshot inválido (${txid}): ${invalid}`)
      return NextResponse.json({ ok: true, handled: false, reason: "snapshot-invalido" })
    }

    // Trava de e-mail único: se o front já enviou, claim devolve false.
    const won = await claimOrderEmail(txid)
    if (!won) {
      return NextResponse.json({ ok: true, handled: false, reason: "ja-enviado" })
    }

    const result = await sendOrderEmail(order)
    if (!result.ok) {
      console.error(`[WEBHOOK] Falha ao enviar e-mail (${txid}):`, result.error)
      // Libera a trava pra um retry do webhook poder tentar de novo.
      await releaseOrderEmail(txid).catch(() => {})
      return NextResponse.json({ ok: true, handled: false, reason: "email-falhou" })
    }

    return NextResponse.json({ ok: true, handled: true })
  } catch (e) {
    console.error("[WEBHOOK] Erro inesperado:", e)
    return NextResponse.json({ ok: true, handled: false, reason: "erro" })
  }
}
