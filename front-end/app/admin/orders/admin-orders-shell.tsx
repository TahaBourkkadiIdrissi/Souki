"use client"

import dynamic from "next/dynamic"

const AdminOrdersClient = dynamic(() => import("./admin-orders-client"), {
  ssr: false,
  loading: () => (
    <main className="min-h-screen bg-[#FAFAF8] px-4 py-8 text-[#3D3D3D] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="h-8 w-64 animate-pulse rounded bg-gray-200" />
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-2xl border border-gray-200 bg-white" />
          ))}
        </div>
      </div>
    </main>
  ),
})

export function AdminOrdersShell() {
  return <AdminOrdersClient />
}
