"use client"

import { useEffect, useState } from "react"
import { X, Copy, Check } from "lucide-react"
import { useCart } from "@/lib/cart-context"

const COUPON_CODE = "COPA"

// Popup promocional da home: aparece a cada carregamento da página.
// `suppressed` evita brigar com o popup de localização (some enquanto ele
// estiver aberto e reaparece quando o usuário fecha).
export function CouponPopup({ suppressed = false, delayMs = 900 }: { suppressed?: boolean; delayMs?: number }) {
  const { applyCoupon } = useCart()
  const [show, setShow] = useState(false)
  const [closed, setClosed] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setShow(true), delayMs)
    return () => clearTimeout(t)
  }, [delayMs])

  const visible = show && !closed && !suppressed
  if (!visible) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(COUPON_CODE)
    } catch {
      // alguns navegadores bloqueiam o clipboard; segue aplicando o cupom
    }
    applyCoupon(COUPON_CODE) // já deixa aplicado no carrinho
    setCopied(true)
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 animate-in fade-in"
      onClick={() => setClosed(true)}
    >
      <div
        className="relative w-full max-w-[330px] overflow-hidden rounded-2xl bg-card shadow-2xl animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setClosed(true)}
          aria-label="Fechar"
          className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/70"
        >
          <X className="h-5 w-5" />
        </button>

        <img
          src="/popup-cupom-copa.png"
          alt="5% OFF — use o cupom COPA"
          className="block w-full"
        />

        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-2 rounded-xl border-2 border-dashed border-[#009c3b] bg-[#009c3b]/5 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Seu cupom</p>
              <p className="text-xl font-black tracking-widest text-[#007a2f]">{COUPON_CODE}</p>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold text-white transition ${
                copied ? "bg-[#007a2f]" : "bg-[#009c3b] hover:bg-[#007a2f]"
              }`}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" /> Copiado
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" /> Copiar
                </>
              )}
            </button>
          </div>

          {copied ? (
            <p className="text-center text-xs font-semibold text-[#007a2f]">
              ✓ Cupom aplicado! É só finalizar o pedido. 🍺
            </p>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              Copie e use no carrinho pra garantir <span className="font-bold text-foreground">5% de desconto</span>.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
