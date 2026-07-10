import { Check, Package, Truck, Home, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

interface TimelineStep {
  id: string
  label: string
  time?: string
  status: "completed" | "active" | "pending"
}

interface OrderTimelineProps {
  steps: TimelineStep[]
  vertical?: boolean
  className?: string
}

const stepIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  ordered: Package,
  confirmed: Check,
  preparing: Clock,
  enroute: Truck,
  delivered: Home,
}

export function OrderTimeline({
  steps,
  vertical = false,
  className,
}: OrderTimelineProps) {
  return (
    <div
      className={cn(
        "flex",
        vertical ? "flex-col gap-0" : "flex-row items-center justify-between",
        className
      )}
    >
      {steps.map((step, index) => {
        const Icon = stepIcons[step.id] || Package
        const isLast = index === steps.length - 1

        return (
          <div
            key={step.id}
            className={cn(
              "flex",
              vertical ? "flex-row gap-4" : "flex-col items-center gap-2",
              !vertical && "flex-1"
            )}
          >
            {/* Vertical layout */}
            {vertical && (
              <div className="flex flex-col items-center">
                {/* key={status} : rejoue le pop quand l'etape passe a "completed" */}
                <div
                  key={step.status}
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all",
                    step.status === "completed" &&
                      "bg-[#1E8A3C] border-[#1E8A3C] text-white animate-souki-success-pop",
                    step.status === "active" &&
                      "bg-[#F07C00] border-[#F07C00] text-white animate-pulse",
                    step.status === "pending" &&
                      "bg-white border-gray-300 text-gray-400"
                  )}
                >
                  {step.status === "completed" ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                {!isLast && (
                  <div
                    className={cn(
                      "w-0.5 h-12",
                      step.status === "completed" ? "bg-[#1E8A3C]" : "bg-gray-200"
                    )}
                  />
                )}
              </div>
            )}

            {/* Content */}
            <div className={cn(vertical ? "pt-1 pb-6" : "text-center")}>
              {!vertical && (
                <>
                  <div
                    key={step.status}
                    className={cn(
                      "w-10 h-10 mx-auto rounded-full flex items-center justify-center border-2 transition-all mb-2",
                      step.status === "completed" &&
                        "bg-[#1E8A3C] border-[#1E8A3C] text-white animate-souki-success-pop",
                      step.status === "active" &&
                        "bg-[#F07C00] border-[#F07C00] text-white animate-pulse",
                      step.status === "pending" &&
                        "bg-white border-gray-300 text-gray-400"
                    )}
                  >
                    {step.status === "completed" ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  {!isLast && (
                    <div
                      className={cn(
                        "absolute top-5 left-1/2 w-full h-0.5",
                        step.status === "completed" ? "bg-[#1E8A3C]" : "bg-gray-200"
                      )}
                    />
                  )}
                </>
              )}
              <p
                className={cn(
                  "font-medium text-sm",
                  step.status === "completed" && "text-[#1E8A3C]",
                  step.status === "active" && "text-[#F07C00]",
                  step.status === "pending" && "text-gray-400"
                )}
              >
                {step.label}
              </p>
              {step.time && (
                <p className="text-xs text-[#8A8A8A] mt-0.5">{step.time}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
