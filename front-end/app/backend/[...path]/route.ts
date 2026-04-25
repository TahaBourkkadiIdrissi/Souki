import { NextResponse, type NextRequest } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const BACKEND_PROXY_TIMEOUT_MS = 8000

const backendTarget = (
  process.env.BACKEND_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "")

function buildBackendUrl(request: NextRequest, path: string[]) {
  const targetUrl = new URL(`${backendTarget}/${path.join("/")}`)

  request.nextUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.append(key, value)
  })

  return targetUrl
}

function buildForwardHeaders(request: NextRequest) {
  const headers = new Headers(request.headers)

  headers.delete("host")
  headers.delete("connection")
  headers.delete("content-length")

  return headers
}

async function proxyRequest(request: NextRequest, path: string[]) {
  const targetUrl = buildBackendUrl(request, path)
  const headers = buildForwardHeaders(request)
  const method = request.method.toUpperCase()
  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), BACKEND_PROXY_TIMEOUT_MS)

  try {
    const body =
      method === "GET" || method === "HEAD"
        ? undefined
        : await request.text()

    const upstreamResponse = await fetch(targetUrl, {
      method,
      headers,
      body,
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
    })

    const responseHeaders = new Headers(upstreamResponse.headers)
    responseHeaders.delete("content-length")
    responseHeaders.delete("content-encoding")
    responseHeaders.delete("transfer-encoding")

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    const detail =
      error instanceof Error && error.name === "AbortError"
        ? `Proxy backend indisponible vers ${backendTarget}: delai depasse apres ${BACKEND_PROXY_TIMEOUT_MS} ms.`
        : error instanceof Error
          ? `Proxy backend indisponible vers ${backendTarget}: ${error.message}`
          : `Proxy backend indisponible vers ${backendTarget}.`

    return NextResponse.json(
      {
        detail,
      },
      { status: 502 }
    )
  } finally {
    clearTimeout(timeoutHandle)
  }
}

type RouteContext = {
  params: Promise<{
    path: string[]
  }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { path } = await context.params
  return proxyRequest(request, path)
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { path } = await context.params
  return proxyRequest(request, path)
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { path } = await context.params
  return proxyRequest(request, path)
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { path } = await context.params
  return proxyRequest(request, path)
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { path } = await context.params
  return proxyRequest(request, path)
}

export async function OPTIONS(request: NextRequest, context: RouteContext) {
  const { path } = await context.params
  return proxyRequest(request, path)
}
