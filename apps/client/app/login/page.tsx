import { redirect } from "next/navigation"
export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const query = new URLSearchParams()
  for (const key of ["redirect", "ref", "access_error"]) {
    const value = params[key]
    if (typeof value === "string") query.set(key, value)
  }
  redirect(`/login/client${query.size ? `?${query}` : ""}`)
}
