"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { FarmerAvatar } from "@/components/avatar/farmer-avatar"
import { markOnboardingCompleted } from "@/lib/onboarding"
import { isPwaStandalone } from "@/lib/pwa"

type OnboardingStep = {
  expression: "welcome" | "explain" | "celebrate"
  title: string
  description: string
  gradient: string
}

const steps: OnboardingStep[] = [
  {
    expression: "welcome",
    title: "Bienvenue sur SOUKI",
    description:
      "Votre marché frais livré à domicile. Des produits du marché de gros de Fès, directement chez vous.",
    gradient: "from-[#1B4332] via-[#1E8A3C] to-[#4CB84A]",
  },
  {
    expression: "explain",
    title: "Comment ça marche",
    description:
      "Commandez ce soir avant 20h, recevez vos produits frais le lendemain matin entre 8h et 13h.",
    gradient: "from-[#145C28] via-[#1E8A3C] to-[#3DA63F]",
  },
  {
    expression: "explain",
    title: "Panier Intelligent",
    description:
      "Notre IA compose votre panier selon votre budget et vos habitudes. Commandez aussi par la voix !",
    gradient: "from-[#1B4332] via-[#145C28] to-[#1E8A3C]",
  },
  {
    expression: "celebrate",
    title: "C'est parti !",
    description:
      "Votre marché frais vous attend. Découvrez nos produits et laissez-vous guider.",
    gradient: "from-[#1E8A3C] via-[#4CB84A] to-[#6FCF6A]",
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [direction, setDirection] = useState<"left" | "right">("left")
  const [isAnimating, setIsAnimating] = useState(false)
  const touchStartRef = useRef<number | null>(null)
  const touchEndRef = useRef<number | null>(null)

  const isLastStep = currentStep === steps.length - 1

  const completeOnboarding = useCallback(() => {
    markOnboardingCompleted()
    const destination = isPwaStandalone() ? "/pwa-welcome" : "/"
    router.push(destination)
  }, [router])

  const goToStep = useCallback(
    (step: number, dir: "left" | "right") => {
      if (isAnimating) return
      setDirection(dir)
      setIsAnimating(true)
      setTimeout(() => {
        setCurrentStep(step)
        setIsAnimating(false)
      }, 250)
    },
    [isAnimating]
  )

  const handleNext = useCallback(() => {
    if (isLastStep) {
      completeOnboarding()
    } else {
      goToStep(currentStep + 1, "left")
    }
  }, [currentStep, isLastStep, completeOnboarding, goToStep])

  const handleSkip = useCallback(() => {
    completeOnboarding()
  }, [completeOnboarding])

  // Touch/swipe handling
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0].clientX
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndRef.current = e.touches[0].clientX
  }

  const handleTouchEnd = () => {
    if (touchStartRef.current === null || touchEndRef.current === null) return
    const diff = touchStartRef.current - touchEndRef.current
    const threshold = 50

    if (diff > threshold && currentStep < steps.length - 1) {
      goToStep(currentStep + 1, "left")
    } else if (diff < -threshold && currentStep > 0) {
      goToStep(currentStep - 1, "right")
    }

    touchStartRef.current = null
    touchEndRef.current = null
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && currentStep < steps.length - 1) {
        goToStep(currentStep + 1, "left")
      } else if (e.key === "ArrowLeft" && currentStep > 0) {
        goToStep(currentStep - 1, "right")
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [currentStep, goToStep])

  const step = steps[currentStep]

  return (
    <div
      className={`min-h-dvh flex flex-col items-center justify-between bg-gradient-to-b ${step.gradient} transition-all duration-500 ease-in-out`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Skip button */}
      {!isLastStep && (
        <div className="w-full flex justify-end p-6 pt-safe">
          <button
            onClick={handleSkip}
            className="text-white/70 text-sm font-medium hover:text-white transition-colors"
          >
            Passer
          </button>
        </div>
      )}
      {isLastStep && <div className="w-full p-6 pt-safe" />}

      {/* Content area */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 w-full max-w-md">
        {/* Avatar */}
        <div
          className={`mb-8 transition-all duration-300 ease-out ${
            isAnimating
              ? direction === "left"
                ? "opacity-0 -translate-x-8"
                : "opacity-0 translate-x-8"
              : "opacity-100 translate-x-0"
          }`}
        >
          <FarmerAvatar size="xl" expression={step.expression} />
        </div>

        {/* Decorative elements for celebrate page */}
        {step.expression === "celebrate" && !isAnimating && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-[15%] left-[10%] w-2 h-2 rounded-full bg-yellow-300 animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="absolute top-[20%] right-[15%] w-3 h-3 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "200ms" }} />
            <div className="absolute top-[30%] left-[20%] w-1.5 h-1.5 rounded-full bg-green-200 animate-bounce" style={{ animationDelay: "400ms" }} />
            <div className="absolute top-[25%] right-[25%] w-2 h-2 rounded-full bg-yellow-200 animate-bounce" style={{ animationDelay: "100ms" }} />
            <div className="absolute top-[35%] left-[30%] w-2.5 h-2.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: "300ms" }} />
            <div className="absolute top-[18%] right-[35%] w-1.5 h-1.5 rounded-full bg-green-300 animate-bounce" style={{ animationDelay: "500ms" }} />
          </div>
        )}

        {/* Text */}
        <div
          className={`text-center transition-all duration-300 ease-out ${
            isAnimating
              ? direction === "left"
                ? "opacity-0 -translate-x-8"
                : "opacity-0 translate-x-8"
              : "opacity-100 translate-x-0"
          }`}
        >
          <h1 className="text-3xl font-bold text-white font-poppins mb-4">
            {step.title}
          </h1>
          <p className="text-white/80 text-base leading-relaxed max-w-xs mx-auto">
            {step.description}
          </p>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="w-full flex flex-col items-center gap-6 px-8 pb-12 pb-safe">
        {/* Dot indicators */}
        <div className="flex gap-2">
          {steps.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                if (index !== currentStep) {
                  goToStep(index, index > currentStep ? "left" : "right")
                }
              }}
              className={`rounded-full transition-all duration-300 ${
                index === currentStep
                  ? "w-8 h-2.5 bg-white"
                  : "w-2.5 h-2.5 bg-white/30"
              }`}
              aria-label={`Go to step ${index + 1}`}
            />
          ))}
        </div>

        {/* Action button */}
        <button
          onClick={handleNext}
          className="w-full max-w-xs py-4 rounded-full bg-white text-[#1E8A3C] font-semibold text-lg shadow-lg hover:shadow-xl active:scale-[0.97] transition-all duration-200"
        >
          {isLastStep ? "Commencer" : "Suivant"}
        </button>
      </div>
    </div>
  )
}
