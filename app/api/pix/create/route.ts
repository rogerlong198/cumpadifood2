import { NextResponse } from "next/server"
import { generateOrderCode, kvConfigured, saveOrderSnapshot } from "@/lib/order-store"
import { qstashConfigured, scheduleDelayedCall } from "@/lib/qstash"
import type { OrderEmailInput } from "@/lib/order-email"

export const dynamic = "force-dynamic"

// Atraso (em minutos) até checar abandono e disparar o e-mail "esqueceu o carrinho".
const ABANDONED_DELAY_MIN = 30

// Status que a Pagou.ai considera como "pago"/liquidado.
// NÃO inclui "authorized": em cartão isso é só pré-autorização (limite reservado),
// não liquidado — confirmar nesse estado libera entrega sem dinheiro na conta.
function isPaidStatus(status: unknown) {
  return ["paid", "captured", "succeeded", "completed", "approved", "pago"].includes(
    String(status ?? "").toLowerCase()
  )
}

function getClientIp(request: Request) {
  const xff = request.headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0]?.trim() || "unknown"
  return request.headers.get("x-real-ip") || "unknown"
}

const isPrivateIp = (value: string) =>
  !value ||
  value === "unknown" ||
  value === "127.0.0.1" ||
  value === "::1" ||
  value === "0.0.0.0" ||
  value.startsWith("192.168.") ||
  value.startsWith("10.") ||
  /^172\.(1[6-9]|2\d|3[01])\./.test(value)

function collectErrors(input: any): string[] {
  if (!input) return []
  if (typeof input === "string") return [input]
  if (Array.isArray(input)) return input.flatMap(collectErrors)
  if (typeof input === "object") {
    const parts: string[] = []
    if (input.message) parts.push(String(input.message))
    if (input.detail) parts.push(String(input.detail))
    if (input.error && typeof input.error === "string") parts.push(input.error)
    if (input.field && input.message) parts.push(`${input.field}: ${input.message}`)
    return parts.length ? parts : [JSON.stringify(input)]
  }
  return [String(input)]
}

export async function POST(request: Request) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  const { value, phone, email, name, cpf, title } = body ?? {}

  if (!value || value <= 0) {
    return NextResponse.json({ error: "Valor da transação inválido." }, { status: 400 })
  }
  if (!name || name.trim() === "") {
    return NextResponse.json({ error: "O Nome é obrigatório." }, { status: 400 })
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "E-mail inválido." }, { status: 400 })
  }

  const phoneDigits = (phone || "").replace(/\D/g, "")
  if (phoneDigits.length < 10 || phoneDigits.length > 11) {
    return NextResponse.json({ error: "Telefone deve ter 10 ou 11 dígitos (com DDD)." }, { status: 400 })
  }

  const cpfDigits = (cpf || "").replace(/\D/g, "")
  if (cpfDigits.length !== 11) {
    return NextResponse.json({ error: "CPF inválido. Deve conter 11 dígitos." }, { status: 400 })
  }

  const rawKey = process.env.PAGOUAI_SECRET_KEY
  if (!rawKey) {
    console.error("[PIX API] Chave PAGOUAI_SECRET_KEY ausente no ambiente.")
    return NextResponse.json({ error: "Erro interno: Gateway não configurado." }, { status: 500 })
  }

  const secretKey = rawKey.trim().replace(/^Bearer\s+/i, "")
  const amountCents = Math.round(Number(value) * 100)
  const endpoint = "https://api.pagou.ai/v2/transactions"
  const externalRef = `order_${Date.now()}_${cpfDigits.slice(0, 4)}`

  // Pagou.ai v2 exige IP do comprador. Em local/dev caímos num IP público BR.
  const ip = getClientIp(request)
  const buyerIp = isPrivateIp(ip) ? "177.71.248.55" : ip

  const payload: Record<string, any> = {
    external_ref: externalRef,
    amount: amountCents,
    currency: "BRL",
    method: "pix",
    ip_address: buyerIp,
    buyer: {
      name: name.trim(),
      email: email.trim(),
      phone: phoneDigits,
      ip_address: buyerIp,
      document: { number: cpfDigits, type: "CPF" },
    },
    products: [
      {
        name: title || "Pedido CompadreFood",
        quantity: 1,
        price: amountCents,
      },
    ],
  }

  try {
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secretKey}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    })

    const raw = await upstream.text()
    let data: any = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }

    if (!upstream.ok) {
      const errorParts = [
        ...collectErrors(data?.errors),
        ...collectErrors(data?.validation_errors),
        ...collectErrors(data?.error),
        ...collectErrors(data?.detail),
        ...collectErrors(data?.message),
      ].filter(Boolean)
      const detail = errorParts.length ? errorParts.join(" | ") : raw || "Erro desconhecido no gateway"
      console.error(`[PIX API] Erro (${upstream.status}):`, raw)

      if (upstream.status === 401) {
        return NextResponse.json({ error: "Chave de autenticação inválida na Pagou.ai." }, { status: 401 })
      }
      return NextResponse.json({ error: detail, gateway: data ?? raw }, { status: 502 })
    }

    const transaction = data?.data ?? data ?? {}
    const pix = transaction?.pix ?? {}
    const qrCode = pix.qr_code ?? pix.qrcode ?? pix.qrCode ?? ""
    const qrCodeImage = pix.url ?? null

    if (!qrCode) {
      console.error("[PIX API] Resposta de sucesso, mas sem QR Code:", raw)
      return NextResponse.json({ error: "Gateway não retornou QR Code PIX válido." }, { status: 502 })
    }

    const expiresAt = pix.expiration_date ?? new Date(Date.now() + 10 * 60 * 1000).toISOString()
    const txid = transaction?.id ?? data?.id ?? data?.transactionId ?? null

    // Persiste o pedido no KV (chave = txid) pro webhook poder mandar o e-mail
    // mesmo se o cliente fechar a aba. Best effort: nunca derruba o PIX.
    const order = body?.order
    if (
      txid &&
      kvConfigured() &&
      order?.customer?.email &&
      Array.isArray(order?.items) &&
      order.items.length > 0 &&
      order?.address
    ) {
      try {
        const snapshot: OrderEmailInput = {
          orderCode: generateOrderCode(String(txid)),
          paymentMethod: "pix",
          customer: order.customer,
          address: order.address,
          items: order.items,
          subtotal: Number(order.subtotal) || Number(value),
          shipping: Number(order.shipping) || 0,
          total: Number(order.total) || Number(value),
        }
        await saveOrderSnapshot(String(txid), snapshot)

        // Agenda o e-mail de carrinho abandonado: se em ABANDONED_DELAY_MIN o
        // pedido não estiver pago, o QStash chama /api/abandoned/check.
        if (qstashConfigured()) {
          const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "")
          const secret = process.env.PAGOUAI_WEBHOOK_SECRET || ""
          if (appUrl) {
            const callback = `${appUrl}/api/abandoned/check?txid=${encodeURIComponent(String(txid))}&secret=${encodeURIComponent(secret)}`
            await scheduleDelayedCall(callback, ABANDONED_DELAY_MIN * 60)
          }
        }
      } catch (e) {
        console.error("[PIX API] Falha ao salvar snapshot / agendar abandono:", e)
      }
    }

    return NextResponse.json({
      txid,
      qrCode,
      qrCodeImage,
      expiresAt,
      status: transaction?.status ?? "pending",
      paid: isPaidStatus(transaction?.status),
      amount: value,
      phone: phoneDigits,
    })
  } catch (err) {
    console.error("[PIX API] Falha na rede/comunicação:", err)
    return NextResponse.json({ error: "Falha de comunicação com o servidor de pagamento." }, { status: 502 })
  }
}
