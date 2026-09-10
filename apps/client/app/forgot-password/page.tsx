"use client"

import { FormEvent, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react"

import { API_BASE_URL } from "@/lib/api"

const GENERIC_MESSAGE =
  "Si un compte correspond à cette adresse, un lien de réinitialisation a été envoyé."

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError("")

    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.detail || "La demande n'a pas pu être envoyée.")
      }
      setMessage(data.message || GENERIC_MESSAGE)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "La demande n'a pas pu être envoyée."
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F6F6F4] px-6 py-12">
      <section className="w-full max-w-md rounded-3xl border border-gray-100 bg-white p-8 shadow-xl shadow-black/5">
        <Link href="/login/client" className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-[#1A4F8A] hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Retour à la connexion
        </Link>

        <div className="mb-8 flex items-center gap-3">
          <Image src="/logo3.png" alt="SOUKI" width={48} height={48} className="h-12 w-12 rounded-xl object-cover" />
          <div>
            <p className="text-xl font-bold text-[#1E8A3C]">SOUKI</p>
            <p className="text-sm text-[#8A8A8A]">Récupération du compte</p>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-[#3D3D3D]">Mot de passe oublié ?</h1>
        <p className="mt-3 text-sm leading-6 text-[#6F6F6F]">
          Saisissez l’adresse e-mail utilisée pour votre compte. Le lien reçu sera valable pendant 15 minutes.
        </p>

        {message ? (
          <div className="mt-7 rounded-2xl border border-green-200 bg-green-50 p-5 text-sm leading-6 text-green-800">
            <CheckCircle2 className="mb-3 h-6 w-6" />
            <p>{message}</p>
            <p className="mt-2 text-green-700">Pensez à vérifier le dossier des courriers indésirables.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-[#3D3D3D]">Adresse e-mail</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8A8A8A]" />
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="votre@email.com"
                  className="w-full rounded-xl border-2 border-gray-200 py-3 pl-12 pr-4 outline-none transition-colors focus:border-[#4CB84A]"
                />
              </div>
            </div>

            {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-xl bg-[#1E8A3C] py-3.5 font-semibold text-white shadow-lg shadow-[#1E8A3C]/20 transition-colors hover:bg-[#166E2B] disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Envoyer le lien"}
            </button>
          </form>
        )}
      </section>
    </main>
  )
}
