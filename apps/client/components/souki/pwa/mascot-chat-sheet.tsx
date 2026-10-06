"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { Send, RotateCcw } from "lucide-react"
import { Sheet } from "@/components/souki/pwa/sheet"
import { FarmerAvatar } from "@/components/avatar/farmer-avatar"
import { API_BASE_URL } from "@/lib/api"

type Message = { role: "user" | "assistant"; content: string }
type Suggestion = { question: string; answer: string }

function formatted(text: string) {
  return text.split("\n").map((line, index) => {
    const parts: ReactNode[] = line.replace(/^[-*] /, "• ").split(/(\*\*[^*]+\*\*)/g).map((part, i) => part.startsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part)
    return <p key={index} className="min-h-2">{parts}</p>
  })
}

export function MascotChatSheet({ open, onClose, userId }: { open: boolean; onClose: () => void; userId: number }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [restored, setRestored] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const abort = useRef<AbortController | null>(null)
  const end = useRef<HTMLDivElement>(null)
  const key = `souki-chat:${userId}`

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) || "[]")
      if (Array.isArray(saved)) setMessages(saved.filter((item: Message) => ["user", "assistant"].includes(item.role) && typeof item.content === "string").slice(-20))
    } catch { /* A private browser may disable session storage. */ }
    setRestored(true)
    return () => { abort.current?.abort() }
  }, [key])

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    fetch(`${API_BASE_URL}/api/assistant/suggestions`, { credentials: "include", signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error(); return response.json() })
      .then(setSuggestions).catch(() => { if (!controller.signal.aborted) setError("Impossible de charger les questions rapides. Réessayez en rouvrant le chat.") })
    return () => controller.abort()
  }, [open])

  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }) }, [messages, busy])
  useEffect(() => {
    if (busy || !restored) return
    try { sessionStorage.setItem(key, JSON.stringify(messages.slice(-20))) } catch { /* In-memory conversation remains available. */ }
  }, [messages, busy, key, restored])

  async function send(content: string, readyAnswer?: string) {
    if (busy || !content.trim() || content.length > 500) return
    const history = messages.slice(-20)
    const next: Message[] = [...history, { role: "user", content }, { role: "assistant", content: "" }]
    setMessages(next)
    setDraft("")
    setError("")
    setBusy(true)
    const controller = new AbortController()
    abort.current = controller
    let answer = ""
    const append = (delta: string) => {
      answer += delta
      setMessages([...next.slice(0, -1), { role: "assistant", content: answer }])
    }
    const timeout = window.setTimeout(() => controller.abort(), 60000)
    try {
      if (readyAnswer) {
        append(readyAnswer)
        return
      }
      const response = await fetch(`${API_BASE_URL}/api/assistant/chat`, {
        method: "POST", credentials: "include", signal: controller.signal,
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: content, history }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(typeof data.detail === "string" ? data.detail : "Souki est momentanément indisponible.")
      }
      if (!response.body) throw new Error("Réponse indisponible.")
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let done = false
      try {
        while (!done) {
          const chunk = await reader.read()
          buffer += decoder.decode(chunk.value, { stream: !chunk.done })
          const frames = buffer.split("\n\n")
          buffer = frames.pop() || ""
          for (const frame of frames) {
            if (!frame.startsWith("data: ")) continue
            const event = JSON.parse(frame.slice(6))
            if (event.error) throw new Error(event.error)
            if (event.delta) append(event.delta)
            if (event.done) done = true
          }
          if (chunk.done && !done) throw new Error("La réponse a été interrompue. Réessayez.")
        }
      } finally { await reader.cancel() }
    } catch (reason) {
      if (controller !== abort.current) return
      setMessages(history)
      setDraft(content)
      setError(controller.signal.aborted ? "La réponse prend trop de temps. Réessayez." : reason instanceof Error ? reason.message : "Souki est momentanément indisponible.")
    } finally {
      clearTimeout(timeout)
      if (controller === abort.current) { setBusy(false); abort.current = null }
    }
  }

  if (!open) return null
  return createPortal(<Sheet open={open} onClose={onClose} title={<div className="flex items-center gap-3"><FarmerAvatar size="sm" expression={busy ? "explain" : "welcome"} />Discuter avec Souki</div>} className="flex h-[85%] max-h-[850px] flex-col" keyboardAware>
    <div role="log" aria-live="polite" aria-busy={busy} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-1 pb-4">
      <div className="rounded-2xl bg-[#EFF8EE] p-3 text-sm text-[#23482D]">Salam ! Je suis Souki 👋 Une question sur vos courses ou la livraison ?</div>
      {messages.map((message, index) => <div key={index} dir="auto" className={`max-w-[92%] rounded-2xl p-3 text-sm leading-6 break-words ${message.role === "user" ? "ml-auto bg-[#1E8A3C] text-white" : "bg-[#EFF8EE] text-[#23482D]"}`}>{formatted(message.content)}</div>)}
      {busy && <p className="text-sm text-[#57715B]">Souki écrit…</p>}
      <div ref={end} />
    </div>
    <div className="flex shrink-0 gap-2 overflow-x-auto py-2">
      {suggestions.map(item => <button disabled={busy} key={item.question} onClick={() => void send(item.question, item.answer)} className="shrink-0 rounded-full border border-green-200 px-3 py-2 text-xs text-[#24552F] disabled:opacity-50">{item.question}</button>)}
    </div>
    {error && <p role="alert" className="py-2 text-sm text-red-700">{error}</p>}
    <form className="flex shrink-0 gap-2 pt-2" onSubmit={event => { event.preventDefault(); void send(draft.trim()) }}>
      <input aria-label="Votre message à Souki" maxLength={500} value={draft} onChange={event => setDraft(event.target.value)} placeholder="Posez votre question…" className="min-w-0 flex-1 rounded-2xl border border-green-200 px-3 py-3 text-base outline-offset-2" />
      <button type="submit" disabled={busy || !draft.trim()} aria-label="Envoyer" className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#1E8A3C] text-white disabled:opacity-40"><Send className="size-5" /></button>
    </form>
    <button disabled={busy} className="mt-3 flex shrink-0 items-center justify-center gap-2 text-xs text-[#57715B] disabled:opacity-50" onClick={() => { setMessages([]); setError(""); setDraft("") }}><RotateCcw className="size-3" />Nouvelle conversation</button>
  </Sheet>, document.body)
}
