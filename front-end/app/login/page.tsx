"use client"

import Link from "next/link"
import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { User, Users, Truck } from "lucide-react"

function PreLoginContent() {
  const searchParams = useSearchParams()
  const redirectTarget = searchParams.get("redirect")

  const roles = [
    {
      title: "Client",
      description: "Pour commander vos produits frais",
      icon: User,
      href: "/login/client",
      color: "bg-[#1E8A3C]",
      textHover: "group-[&:hover]:text-[#1E8A3C]",
      bgHover: "group-[&:hover]:bg-[#1E8A3C]",
      lightBgHover: "group-[&:hover]:bg-[#F0FAF1]",
      borderColor: "hover:border-[#4CB84A]",
      shadowColor: "hover:shadow-[#4CB84A]/10"
    },
    {
      title: "Parent",
      description: "Accédez à l'espace parent",
      icon: Users,
      href: "/login/parent",
      color: "bg-[#F5C400]",
      textHover: "group-[&:hover]:text-[#F5C400]",
      bgHover: "group-[&:hover]:bg-[#F5C400]",
      lightBgHover: "group-[&:hover]:bg-[#FFFBEB]",
      borderColor: "hover:border-[#EAB308]",
      shadowColor: "hover:shadow-[#EAB308]/10"
    },
    {
      title: "Livreur",
      description: "Gérez vos courses et livraisons",
      icon: Truck,
      href: "/login/livreur",
      color: "bg-[#F07C00]",
      textHover: "group-[&:hover]:text-[#F07C00]",
      bgHover: "group-[&:hover]:bg-[#F07C00]",
      lightBgHover: "group-[&:hover]:bg-[#FFF3E0]",
      borderColor: "hover:border-[#F07C00]",
      shadowColor: "hover:shadow-[#F07C00]/10"
    }
  ]

  const withRedirect = (href: string) =>
    redirectTarget ? `${href}?redirect=${encodeURIComponent(redirectTarget)}` : href

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Brand Visual */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#1E8A3C] to-[#4CB84A] p-12 flex-col justify-between relative overflow-hidden">
        {/* Floating vegetables decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 text-8xl rotate-12 animate-bounce" style={{ animationDuration: '3s' }}>🍅</div>
          <div className="absolute top-40 right-32 text-7xl -rotate-12 animate-bounce" style={{ animationDuration: '4s', animationDelay: '1s' }}>🥕</div>
          <div className="absolute bottom-40 left-32 text-6xl rotate-45 animate-bounce" style={{ animationDuration: '5s', animationDelay: '0.5s' }}>🥒</div>
          <div className="absolute bottom-20 right-20 text-8xl -rotate-6 animate-bounce" style={{ animationDuration: '3.5s', animationDelay: '1.5s' }}>🌽</div>
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl shadow-lg overflow-hidden flex items-center justify-center bg-white p-0.5 pointer-events-none">
              <img src="/logo3.png" alt="SOUKI" className="w-[175%] h-full max-w-none object-cover" style={{ objectPosition: "left center" }} />
            </div>
            <div>
              <span className="text-3xl font-bold text-white">SOUKI</span>
              <span className="text-lg text-white/80 ml-2">Fresh Market</span>
            </div>
          </Link>
        </div>

        {/* Central content */}
        <div className="relative z-10 flex-1 flex flex-col justify-center">
          <h1 className="text-4xl xl:text-5xl font-bold text-white mb-6 leading-tight text-balance">
            Bienvenue sur SOUKI.
          </h1>
          <p className="text-xl text-white/80 mb-8 max-w-md">
            Identifiez-vous pour accéder à votre espace dédié.
          </p>
        </div>

        {/* Bottom decoration */}
        <div className="relative z-10 text-white/60 text-sm">
          © 2026 SOUKI Fresh Market
        </div>
      </div>

      {/* Right Side - Selection */}
      <div className="flex-1 flex flex-col justify-center px-6 lg:px-12 xl:px-20 py-12 bg-white">
        <div className="max-w-md mx-auto w-full">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl shadow-sm overflow-hidden flex items-center justify-center bg-white p-0.5 pointer-events-none">
                <img src="/logo3.png" alt="SOUKI" className="w-[175%] h-full max-w-none object-cover" style={{ objectPosition: "left center" }} />
              </div>
              <span className="text-xl font-bold text-[#1E8A3C]">SOUKI Fresh Market</span>
            </Link>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-[#3D3D3D] mb-2">Connexion</h2>
            <p className="text-[#8A8A8A]">Sélectionnez votre type de profil pour continuer.</p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {roles.map((role) => {
              const Icon = role.icon
              return (
                <Link 
                  key={role.href} 
                  href={withRedirect(role.href)}
                  className={`group relative flex items-center p-4 rounded-2xl border-2 border-gray-100 bg-white transition-all duration-300 overflow-hidden ${role.borderColor} ${role.shadowColor} hover:shadow-lg`}
                >
                  <div className={`absolute inset-0 opacity-0 group-[&:hover]:opacity-5 ${role.color} transition-opacity duration-300`} />
                  
                  <div className="flex items-center gap-4 relative z-10 w-full">
                    <div className={`w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center transition-colors duration-300 ${role.lightBgHover}`}>
                      <Icon className={`w-6 h-6 text-[#8A8A8A] transition-colors duration-300 ${role.textHover}`} />
                    </div>
                    
                    <div className="flex-1">
                      <h3 className={`font-semibold text-lg text-[#3D3D3D] transition-colors duration-300 ${role.textHover}`}>
                        {role.title}
                      </h3>
                      <p className="text-sm text-[#8A8A8A]">
                        {role.description}
                      </p>
                    </div>
                    
                    <div className={`w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center transition-colors duration-300 ${role.bgHover}`}>
                      <svg 
                        className="w-4 h-4 text-[#8A8A8A] group-[&:hover]:text-white transition-colors duration-300 transform group-[&:hover]:translate-x-0.5" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor" strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>

        </div>
      </div>
    </div>
  )
}

export default function PreLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <PreLoginContent />
    </Suspense>
  )
}
