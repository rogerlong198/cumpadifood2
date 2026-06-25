import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// "authorized" fica de fora de propósito: é só pré-autorização (limite reservado),
// não captura/liquidação. Confirmar nesse estado = entrega sem dinheiro liquidado.
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

  const { value, name, email, cpf, phone, token, installments, title, address, browser } = body ?? {}

  if (!value || value <= 0)
    return NextResponse.json({ error: "Valor da transação inválido." }, { status: 400 })
  if (!name?.trim())
    return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 })
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return NextResponse.json({ error: "E-mail inválido." }, { status: 400 })
  if (!token || typeof token !== "string" || !token.startsWith("pgct_"))
    return NextResponse.json(
      { error: "Token de cartão ausente ou inválido. Atualize a página e tente novamente." },
      { status: 400 }
    )

  const phoneDigits = (phone || "").replace(/\D/g, "")
  if (phoneDigits.length < 10 || phoneDigits.length > 11)
    return NextResponse.json({ error: "Telefone deve ter 10 ou 11 dígitos." }, { status: 400 })

  const cpfDigits = (cpf || "").replace(/\D/g, "")
  if (cpfDigits.length !== 11)
    return NextResponse.json({ error: "CPF inválido." }, { status: 400 })

  const rawKey = process.env.PAGOUAI_SECRET_KEY
  if (!rawKey) {
    console.error("[CARD API] Chave PAGOUAI_SECRET_KEY ausente.")
    return NextResponse.json({ error: "Gateway não configurado." }, { status: 500 })
  }

  const secretKey = rawKey.trim().replace(/^Bearer\s+/i, "")
  const amountCents = Math.round(Number(value) * 100)
  const installmentCount = Math.max(1, Math.min(12, parseInt(installments) || 1))
  const externalRef = `order_${Date.now()}_${cpfDigits.slice(0, 4)}`

  const ip = getClientIp(request)
  const buyerIp = isPrivateIp(ip) ? "177.71.248.55" : ip

  const billingAddress = address
    ? {
        zipCode: String(address.zip_code || "").replace(/\D/g, ""),
        street: String(address.street || "").trim(),
        number: String(address.number || "").trim(),
        complement: address.complement ? String(address.complement).trim() : undefined,
        neighborhood: String(address.neighborhood || "").trim(),
        city: String(address.city || "").trim(),
        state: String(address.state || "").trim().toUpperCase(),
        country: (address.country || "BR").toUpperCase(),
      }
    : undefined

  // Browser fingerprint para EMV 3DS 2.x.
  const browserInfo = browser
    ? {
        accept_header: "application/json",
        user_agent: String(browser.userAgent || ""),
        language: String(browser.language || "pt-BR"),
        color_depth: Number(browser.colorDepth) || 24,
        screen_width: Number(browser.screenWidth) || 1920,
        screen_height: Number(browser.screenHeight) || 1080,
        timezone_offset: Number(browser.timezoneOffset) || 0,
        java_enabled: Boolean(browser.javaEnabled),
        javascript_enabled: browser.javascriptEnabled !== false,
      }
    : undefined

  const payload: Record<string, any> = {
    external_ref: externalRef,
    amount: amountCents,
    currency: "BRL",
    method: "credit_card",
    token,
    installments: installmentCount,
    ip_address: buyerIp,
    buyer: {
      name: name.trim(),
      email: email.trim(),
      phone: phoneDigits,
      ip_address: buyerIp,
      document: { type: "CPF", number: cpfDigits },
      ...(billingAddress ? { address: billingAddress } : {}),
    },
    products: [
      {
        name: title || "Pedido combo escolhido",
        price: amountCents,
        quantity: 1,
      },
    ],
  }

  if (browserInfo) {
    payload.browser = browserInfo
  }

  try {
    const upstream = await fetch("https://api.pagou.ai/v2/transactions", {
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
        ...collectErrors(data?.error),
        ...collectErrors(data?.detail),
        ...collectErrors(data?.message),
      ].filter(Boolean)
      const detail = errorParts.length ? errorParts.join(" | ") : raw || "Erro desconhecido no gateway"
      console.error(`[CARD API] Erro (${upstream.status}):`, raw)

      if (upstream.status === 401)
        return NextResponse.json({ error: "Chave de autenticação inválida." }, { status: 401 })

      return NextResponse.json({ error: detail, gateway: data ?? raw }, { status: 502 })
    }

    const transaction = data?.data ?? data ?? {}
    const status = transaction?.status ?? "unknown"
    const transactionId = transaction?.id ?? transaction?.transactionId ?? null
    const approved = isPaidStatus(status)
    const nextAction = transaction?.next_action ?? null

    return NextResponse.json({
      transaction,
      status,
      next_action: nextAction,
      txid: transactionId,
      approved,
      message: approved
        ? "Pagamento aprovado! ✅"
        : nextAction
        ? "Autenticação adicional do banco em andamento…"
        : status === "refused" || status === "failed"
        ? "Cartão recusado. Verifique os dados ou tente outro cartão."
        : "Pagamento em análise.",
    })
  } catch (err) {
    console.error("[CARD API] Falha de comunicação:", err)
    return NextResponse.json({ error: "Falha de comunicação com o servidor de pagamento." }, { status: 502 })
  }
}
