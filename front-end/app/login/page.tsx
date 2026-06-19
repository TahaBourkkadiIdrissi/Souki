import { Suspense } from "react"
import PreLoginContent from "./PreLoginContent"

export default function PreLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <PreLoginContent />
    </Suspense>
  )
}
