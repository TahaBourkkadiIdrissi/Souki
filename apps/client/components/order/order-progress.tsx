import { Check, PackageCheck, ShoppingBasket, Truck, TriangleAlert } from "lucide-react"

import type { CommandeHistoriqueDTO } from "@/lib/api"
import {
  getOrderProgress,
  getOrderStatusClassName,
  getOrderStatusLabel,
  ORDER_PROGRESS_STEPS,
  type OrderStepState,
} from "@/lib/order-status"
import { cn } from "@/lib/utils"
import { useLocale } from "@/contexts/locale-context"

const STEP_ICONS = [ShoppingBasket, PackageCheck, Truck, Check] as const

function formatMoment(value?: string | null, dateLocale = "fr-MA") {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(dateLocale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function getStepMoment(order: CommandeHistoriqueDTO, index: number, state: OrderStepState, dateLocale = "fr-MA") {
  if (index === 0) return formatMoment(order.date_commande, dateLocale)
  if (index === 2) return formatMoment(order.enroute_at, dateLocale)
  if (index === 3) return formatMoment(order.delivered_at, dateLocale)
  return state === "complete" ? "Étape terminée" : null
}

export function OrderProgress({ order }: { order: CommandeHistoriqueDTO }) {
  const { t, dateLocale } = useLocale()
  const progress = getOrderProgress(order.statut)

  return (
    <section aria-label={t("Avancement de la commande")} className="rounded-[28px] border border-[#D7EBD9] bg-white p-5 shadow-[0_24px_70px_-44px_rgba(30,65,41,0.42)] sm:p-7">
      <div className="flex flex-col gap-4 border-b border-[#E7F0E8] pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#6F8070]">Commande N-{order.id}</p>
          <h2 className="mt-1 text-2xl font-black text-[#264129]">{t("Votre panier est entre de bonnes mains")}</h2>
        </div>
        <span className={cn("w-fit rounded-full border px-3 py-1.5 text-sm font-bold", getOrderStatusClassName(order.statut))}>
          {t(getOrderStatusLabel(order.statut))}
        </span>
      </div>

      {progress.issueMessage ? (
        <div className="mt-5 flex gap-3 rounded-2xl border border-[#F1C6C6] bg-[#FFF7F7] p-4 text-[#8F2019]" role="status">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="text-sm font-semibold leading-6">{t(progress.issueMessage)}</p>
        </div>
      ) : null}

      <ol className="mt-7 grid gap-0 md:grid-cols-4">
        {ORDER_PROGRESS_STEPS.map((step, index) => {
          const state = progress.stepStates[index]
          const Icon = STEP_ICONS[index]
          const moment = getStepMoment(order, index, state, dateLocale)
          const isLast = index === ORDER_PROGRESS_STEPS.length - 1

          return (
            <li key={step.key} aria-current={state === "current" ? "step" : undefined} className="relative grid grid-cols-[48px_1fr] gap-3 pb-7 last:pb-0 md:block md:pb-0 md:pr-4">
              {!isLast ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute left-6 top-12 h-[calc(100%-3rem)] w-0.5 -translate-x-1/2 md:left-12 md:right-0 md:top-6 md:h-0.5 md:w-auto md:translate-x-0",
                    state === "complete" ? "bg-[#4CB84A]" : "bg-[#DFE8E0]"
                  )}
                />
              ) : null}
              <span
                className={cn(
                  "relative z-[1] flex h-12 w-12 items-center justify-center rounded-2xl border-2",
                  state === "complete" && "border-[#1E8A3C] bg-[#1E8A3C] text-white",
                  state === "current" && "border-[#F07C00] bg-[#FFF7EE] text-[#B85E00]",
                  state === "upcoming" && "border-[#DFE8E0] bg-[#F7FAF7] text-[#93A095]"
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="pt-0.5 md:mt-4 md:pr-3">
                <h3 className={cn("text-sm font-black", state === "upcoming" ? "text-[#849086]" : "text-[#264129]")}>{t(step.title)}</h3>
                <p className="mt-1 text-xs font-medium leading-5 text-[#6F8070]">{t(step.description)}</p>
                {moment ? <p className="mt-2 text-xs font-bold text-[#1E8A3C]">{t(moment)}</p> : null}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
