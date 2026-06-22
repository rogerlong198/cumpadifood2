"use client"

import Image from "next/image"
import { MapPin } from "lucide-react"

export function AboutUs() {
  return (
    <section className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-lg font-bold text-foreground mb-4">Sobre Nós</h2>
      
      <div className="bg-card rounded-xl overflow-hidden border border-border shadow-sm">
        <div className="relative w-full h-48">
          <Image
            src="/store-front-compadrefood.jpg"
            alt="Fachada CompadreFood Distribuidora"
            fill
            className="object-cover"
          />
        </div>
        
        <div className="p-4 space-y-3">
          <h3 className="font-bold text-foreground text-lg">CompadreFood Distribuidora</h3>
          
          <p className="text-sm text-muted-foreground leading-relaxed">
            Fundada desde 2022, a CompadreFood é uma distribuidora comprometida em trabalhar 
            com as melhores marcas de bebidas de extrema qualidade. Oferecemos preços imbatíveis 
            e garantimos satisfação em cada pedido.
          </p>
          
          
        </div>
      </div>
    </section>
  )
}
