"use client"

import { useState, useCallback, useEffect } from "react"
import { products, categories } from "@/lib/data"
import type { Product } from "@/lib/types"
import { copaAtiva, ESQUENTA_IDS } from "@/lib/copa"
import { StoreHeader } from "@/components/delivery/store-header"
import { CopaBanner } from "@/components/delivery/copa-banner"
import { SearchBar } from "@/components/delivery/search-bar"
import { CategoryNav } from "@/components/delivery/category-nav"
import { FeaturedProductCard } from "@/components/delivery/featured-product-card"
import { CompactProductCard } from "@/components/delivery/compact-product-card"
import { ReviewsSection } from "@/components/delivery/reviews-section"
import { CartButton } from "@/components/delivery/cart-button"
import { CartDrawer } from "@/components/delivery/cart-drawer"
import { ProductDetail } from "@/components/delivery/product-detail"
import { LocationPopup } from "@/components/delivery/location-popup"
import { CouponPopup } from "@/components/delivery/coupon-popup"
import { HighlightProducts } from "@/components/delivery/category-showcase"
import { PromoTimer } from "@/components/delivery/promo-timer"
import { AboutUs } from "@/components/delivery/about-us"
import { Footer } from "@/components/delivery/footer"
import { BannerCarousel } from "@/components/delivery/banner-carousel"
import { PendingOrdersButton, PendingOrdersModal } from "@/components/delivery/pending-orders"
import { UpsellCombo } from "@/components/delivery/upsell-combo"
import { PriceFilter, sortProducts, type SortOrder } from "@/components/delivery/price-filter"
import { useCart } from "@/lib/cart-context"

function DeliveryApp() {
  const { addCombo } = useCart()
  const [activeCategory, setActiveCategory] = useState("ofertas")
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [showLocationPopup, setShowLocationPopup] = useState(false)
  const [userAddress, setUserAddress] = useState<string | null>(null)
  const [showPendingOrders, setShowPendingOrders] = useState(false)
  const [openCombo, setOpenCombo] = useState(false)
  const [categoryFilters, setCategoryFilters] = useState<Record<string, SortOrder>>({})
  const [copaOn, setCopaOn] = useState(false)

  useEffect(() => {
    setCopaOn(copaAtiva())
  }, [])

  // Conversão de "Visualização de página" no Google Ads — dispara a cada
  // carregamento da home.
  useEffect(() => {
    const w = window as Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void }
    if (typeof w.gtag !== "function") {
      w.dataLayer = w.dataLayer || []
      w.gtag = function gtag() {
        w.dataLayer?.push(arguments)
      }
    }
    w.gtag("event", "conversion", { send_to: "AW-18249151503/vtPFCMC6ncQcEI_o7_1D" })
  }, [])

  const esquentaProducts = ESQUENTA_IDS
    .map((id) => products.find((p) => p.id === id))
    .filter(Boolean) as Product[]

  // As 5 cervejas mais consumidas no Brasil (ranking 2025), na ordem: Brahma,
  // Heineken, Skol, Amstel, Budweiser. Flutuam pro topo da categoria Cervejas.
  const TOP5_CERVEJAS_IDS = ["27", "34", "62", "24", "36"]
  const prioritizeTop5 = (list: Product[]) => {
    const top = TOP5_CERVEJAS_IDS
      .map((id) => list.find((p) => p.id === id))
      .filter(Boolean) as Product[]
    const rest = list.filter((p) => !TOP5_CERVEJAS_IDS.includes(p.id))
    return [...top, ...rest]
  }

  useEffect(() => {
    // Verifica se ja tem endereco salvo
    const savedAddress = localStorage.getItem("delivery_address")
    if (savedAddress) {
      setUserAddress(savedAddress)
    } else {
      // Mostra popup apos 1 segundo
      const timer = setTimeout(() => {
        setShowLocationPopup(true)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleLocationSet = (address: string) => {
    setUserAddress(address)
    localStorage.setItem("delivery_address", address)
    setShowLocationPopup(false)
  }

  const handleCategoryChange = useCallback((categoryId: string) => {
    const scrollToProducts = () => {
      const productsSection = document.getElementById("products-section")
      if (productsSection) {
        productsSection.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    }

    if (categoryId === activeCategory) {
      scrollToProducts()
      return
    }

    setIsTransitioning(true)
    setTimeout(() => {
      setActiveCategory(categoryId)
      setIsTransitioning(false)
      scrollToProducts()
    }, 150)
  }, [activeCategory])

  const featuredProducts = products.filter((p) => p.category === "ofertas")
  const otherCategories = categories.filter((c) => c.id !== "ofertas")

  return (
    <div className="min-h-screen bg-background pb-24">
      <StoreHeader
        userAddress={userAddress}
        onChangeAddress={() => setShowLocationPopup(true)}
      />
      <CopaBanner />
      <SearchBar onProductSelect={(product) => setSelectedProduct(product)} />
      <CategoryNav
        activeCategory={activeCategory}
        onCategoryChange={handleCategoryChange}
      />

      <BannerCarousel 
        onBannerClick={handleCategoryChange} 
        onComboClick={() => setOpenCombo(true)}
      />

      <main id="products-section" className={`max-w-lg mx-auto px-4 py-6 transition-all duration-300 ${isTransitioning ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}`}>
        {activeCategory === "ofertas" ? (
          <>
            {copaOn && esquentaProducts.length > 0 && (
              <section className="mb-8">
                <div className="-mx-4 mb-4 bg-gradient-to-r from-[#007a2f] via-[#009c3b] to-[#007a2f] px-4 py-3">
                  <h2 className="flex items-center gap-2 text-lg font-black text-white">⚽ Esquenta do Jogo</h2>
                  <p className="text-xs font-bold text-[#ffdf00]">Gelada + petisco pra ver o Brasil — receba antes do apito 🍺</p>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scroll-pl-4 scrollbar-hide snap-x snap-mandatory">
                  <button
                    type="button"
                    onClick={() => setOpenCombo(true)}
                    className="flex-shrink-0 w-[42vw] max-w-[180px] snap-start bg-card rounded-xl overflow-hidden border-2 border-[#ffdf00] shadow-sm text-left cursor-pointer
                      hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
                  >
                    <div className="relative aspect-square w-full overflow-hidden bg-secondary/30">
                      <img src="/banners/monte-combo.png" alt="Monte seu combo da torcida" className="w-full h-full object-cover" />
                    </div>
                    <div className="p-3">
                      <h3 className="font-bold text-sm text-foreground leading-tight">Combo da Torcida ⚽</h3>
                      <span className="mt-1 block text-xs font-semibold text-[#e23744]">Clique e monte · até 30% OFF</span>
                    </div>
                  </button>
                  {esquentaProducts.map((product, index) => (
                    <div key={product.id} className="flex-shrink-0 w-[42vw] max-w-[180px] snap-start">
                      <FeaturedProductCard
                        product={product}
                        index={index}
                        onClick={() => setSelectedProduct(product)}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="mb-8">
              <div className="flex flex-col gap-2 mb-4">
                <h2 className="text-lg font-bold text-foreground">
                  Ofertas do Dia
                </h2>
                <PromoTimer />
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scroll-pl-4 scrollbar-hide snap-x snap-mandatory">
                {featuredProducts.map((product, index) => (
                  <div key={product.id} className="flex-shrink-0 w-[42vw] max-w-[180px] snap-start">
                    <FeaturedProductCard
                      product={product}
                      index={index}
                      onClick={() => setSelectedProduct(product)}
                    />
                  </div>
                ))}
              </div>
            </section>

            <HighlightProducts onProductSelect={(p) => setSelectedProduct(p)} onComboClick={() => setOpenCombo(true)} />

            {otherCategories.map((category, catIndex) => {
              const categoryProducts = products.filter(
                (p) => p.category === category.id
              )
              if (categoryProducts.length === 0) return null

              const isHorizontal = true
              const currentFilter = categoryFilters[category.id] || "default"
              // Em Cervejas, as 5 mais consumidas do Brasil ficam no topo.
              const baseProducts = category.id === "cervejas" ? prioritizeTop5(categoryProducts) : categoryProducts
              const sortedProducts = sortProducts(baseProducts, currentFilter) as Product[]

              return (
                <div key={category.id}>
                  <section className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-bold text-foreground">
                        {category.name}
                      </h2>
                      <PriceFilter
                        value={currentFilter}
                        onChange={(val) => setCategoryFilters(prev => ({ ...prev, [category.id]: val }))}
                      />
                    </div>
                    {isHorizontal ? (
                      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scroll-pl-4 scrollbar-hide snap-x snap-mandatory">
                        {sortedProducts.map((product, index) => (
                          <div key={product.id} className="flex-shrink-0 w-[42vw] max-w-[180px] snap-start">
                            <FeaturedProductCard
                              product={product}
                              index={index}
                              onClick={() => setSelectedProduct(product)}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {sortedProducts.map((product, index) => (
                          <CompactProductCard
                            key={product.id}
                            product={product}
                            index={index}
                            onClick={() => setSelectedProduct(product)}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              )
            })}
          </>
        ) : (
          <section>
            {activeCategory !== "ofertas" ? (
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-foreground">
                  {categories.find((c) => c.id === activeCategory)?.name}
                </h2>
                <PriceFilter
                  value={categoryFilters[activeCategory] || "default"}
                  onChange={(val) => setCategoryFilters(prev => ({ ...prev, [activeCategory]: val }))}
                />
              </div>
            ) : (
              <h2 className="text-lg font-bold text-foreground mb-4">
                {categories.find((c) => c.id === activeCategory)?.name}
              </h2>
            )}
            <div className="space-y-3">
              {(sortProducts(
                activeCategory === "cervejas"
                  ? prioritizeTop5(products.filter((p) => p.category === "cervejas"))
                  : products.filter((p) => p.category === activeCategory),
                categoryFilters[activeCategory] || "default"
              ) as Product[]).map((product, index) => (
                  <CompactProductCard
                    key={product.id}
                    product={product}
                    index={index}
                    onClick={() => setSelectedProduct(product)}
                  />
                ))}
            </div>
          </section>
        )}

        <AboutUs />
        <ReviewsSection />

        {/* Footer */}
        <Footer />
      </main>

      <PendingOrdersButton onClick={() => setShowPendingOrders(true)} />
      <CartButton onClick={() => setIsCartOpen(true)} isCartOpen={isCartOpen} />
      <CartDrawer 
        isOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)} 
        onNavigateToCategory={handleCategoryChange}
      />

      {selectedProduct && (
        <ProductDetail
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onSelectProduct={(p) => setSelectedProduct(p)}
        />
      )}

      {showPendingOrders && (
        <PendingOrdersModal onClose={() => setShowPendingOrders(false)} />
      )}

      {showLocationPopup && (
        <LocationPopup
          onClose={() => setShowLocationPopup(false)}
          onLocationSet={handleLocationSet}
        />
      )}

      {/* Popup do cupom COPA — aparece a cada reload da home, sem brigar com o de localização */}
      <CouponPopup suppressed={showLocationPopup} />

      {openCombo && (
        <UpsellCombo
          startOpen
          onAddCombo={(comboItems, comboPrice) => {
            addCombo(comboItems, comboPrice)
            setOpenCombo(false)
          }}
          onCancelEdit={() => setOpenCombo(false)}
        />
      )}
    </div>
  )
}

export default function Page() {
  return <DeliveryApp />
}
