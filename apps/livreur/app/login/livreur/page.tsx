"use client"
import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
export default function LoginLivreur() {
 const { login } = useAuth(); const router = useRouter()
 const [identifier,setIdentifier]=useState(""); const [password,setPassword]=useState(""); const [error,setError]=useState("");const [busy,setBusy]=useState(false)
 async function submit(event:FormEvent) {event.preventDefault();setBusy(true);setError("");try {await login(identifier,password,"LIVREUR");router.replace("/livreur")}catch(e){setError(e instanceof Error?e.message:"Connexion impossible")}finally{setBusy(false)}}
 return <main className="min-h-screen bg-[#F5F5F0] flex items-center justify-center p-6"><form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-3xl bg-white p-8 shadow-sm"><h1 className="text-2xl font-bold text-[#1E8A3C]">Souki Livreur</h1><p>Connectez-vous avec votre compte livreur.</p><label className="block">Email ou téléphone<input required autoComplete="username" value={identifier} onChange={e=>setIdentifier(e.target.value)} className="mt-2 w-full rounded-xl border p-3" /></label><label className="block">Mot de passe<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 w-full rounded-xl border p-3" /></label>{error && <p role="alert" className="text-red-700">{error}</p>}<button disabled={busy} className="w-full rounded-xl bg-[#1E8A3C] p-3 font-bold text-white disabled:opacity-50">{busy?"Connexion…":"Se connecter"}</button></form></main>
}
