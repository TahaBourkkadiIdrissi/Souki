"use client"

import { useEffect, useRef } from "react"

export type VoiceOrbPhase = "idle" | "listening" | "processing"

interface VoiceOrbProps {
  phase: VoiceOrbPhase
  /** Live microphone stream — tapped for real-time amplitude while listening. */
  stream?: MediaStream | null
  /** Rendered size in CSS pixels (square). */
  size?: number
  className?: string
}

/* SOUKI palette — natural green + glassy cyan/turquoise core */
const PALETTE = {
  cyan: [80, 220, 230] as const,
  turquoise: [40, 190, 170] as const,
  green: [76, 184, 74] as const,
  deepGreen: [30, 138, 60] as const,
}

const rgba = (c: readonly [number, number, number], a: number) =>
  `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`

/**
 * VoiceOrb — a living, glass-liquid orb that reacts to the user's voice.
 *
 * - `listening`: the orb breathes with the real microphone amplitude
 *   (Web Audio AnalyserNode → RMS), emits concentric voice rings and
 *   floating particles, and morphs organically.
 * - `processing`: the voice rings dissolve and fresh produce is drawn in,
 *   orbiting and being absorbed toward the luminous sprout core — the
 *   "AI is building your basket" moment.
 * - `idle`: a calm, slow breathing glow.
 *
 * Everything is rendered on a single canvas for 60fps on mobile/PWA with
 * zero animation dependencies.
 */
export function VoiceOrb({ phase, stream, size = 220, className }: VoiceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const phaseRef = useRef<VoiceOrbPhase>(phase)
  phaseRef.current = phase

  // Web Audio analyser state
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const dataRef = useRef<Uint8Array | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)

  // Smoothed amplitude (0..1) shared across frames
  const ampRef = useRef(0)

  /* ── Attach / detach the analyser to the live stream ── */
  useEffect(() => {
    if (!stream || phase !== "listening") return

    let cancelled = false
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const audioCtx = new Ctx()
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.75
      const source = audioCtx.createMediaStreamSource(stream)
      source.connect(analyser)

      if (cancelled) {
        audioCtx.close()
        return
      }
      audioCtxRef.current = audioCtx
      analyserRef.current = analyser
      sourceRef.current = source
      dataRef.current = new Uint8Array(analyser.frequencyBinCount)
    } catch {
      // Audio analysis is a progressive enhancement; the orb still breathes on its own.
    }

    return () => {
      cancelled = true
      try {
        sourceRef.current?.disconnect()
        analyserRef.current?.disconnect()
        audioCtxRef.current?.close()
      } catch {
        /* noop */
      }
      sourceRef.current = null
      analyserRef.current = null
      audioCtxRef.current = null
      dataRef.current = null
    }
  }, [stream, phase])

  /* ── Render loop ── */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    const cx = size / 2
    const cy = size / 2
    const baseR = size * 0.3

    // Particles orbiting inside the orb
    const particles = Array.from({ length: 22 }, () => ({
      angle: Math.random() * Math.PI * 2,
      radius: baseR * (0.35 + Math.random() * 0.6),
      speed: (0.002 + Math.random() * 0.006) * (Math.random() > 0.5 ? 1 : -1),
      r: 0.6 + Math.random() * 1.8,
      drift: Math.random() * Math.PI * 2,
    }))

    // Produce that gets "assembled" during the processing phase
    const VEG = ["🍅", "🥕", "🥬", "🥒", "🍓"]
    const produce = VEG.map((emoji, i) => ({
      emoji,
      angle: (i / VEG.length) * Math.PI * 2,
      speed: 0.012 + i * 0.0015,
      orbit: baseR * 1.15,
    }))

    let raf = 0
    let t = 0
    const rings: Array<{ r: number; alpha: number }> = []
    let ringTimer = 0

    const draw = () => {
      t += 1
      const ph = phaseRef.current
      ctx.clearRect(0, 0, size, size)

      /* 1. Read amplitude (smoothed) */
      let target = 0
      const analyser = analyserRef.current
      const data = dataRef.current
      if (ph === "listening" && analyser && data) {
        analyser.getByteTimeDomainData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128
          sum += v * v
        }
        target = Math.min(1, Math.sqrt(sum / data.length) * 3.2)
      } else if (ph === "processing") {
        target = 0.4 + Math.sin(t * 0.05) * 0.18 // autonomous pulse
      } else {
        target = 0.12 + Math.sin(t * 0.03) * 0.06 // idle breathing
      }
      ampRef.current += (target - ampRef.current) * 0.18
      const amp = ampRef.current

      // Organic radius: base + voice swell + subtle wobble
      const radius = baseR * (1 + amp * 0.32) + Math.sin(t * 0.08) * 2

      /* 2. Outer halo */
      const halo = ctx.createRadialGradient(cx, cy, radius * 0.6, cx, cy, radius * 2)
      halo.addColorStop(0, rgba(PALETTE.cyan, 0.28 + amp * 0.25))
      halo.addColorStop(0.5, rgba(PALETTE.turquoise, 0.1))
      halo.addColorStop(1, rgba(PALETTE.turquoise, 0))
      ctx.fillStyle = halo
      ctx.fillRect(0, 0, size, size)

      /* 3. Glass sphere body — organic morphing blob */
      ctx.beginPath()
      const lobes = 6
      for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.08) {
        const wobble =
          Math.sin(a * lobes + t * 0.06) * (2 + amp * 7) +
          Math.cos(a * (lobes - 2) - t * 0.04) * (1.5 + amp * 4)
        const rr = radius + wobble
        const x = cx + Math.cos(a) * rr
        const y = cy + Math.sin(a) * rr
        a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.closePath()
      const body = ctx.createRadialGradient(
        cx - radius * 0.3,
        cy - radius * 0.35,
        radius * 0.1,
        cx,
        cy,
        radius * 1.1
      )
      body.addColorStop(0, rgba(PALETTE.cyan, 0.55))
      body.addColorStop(0.45, rgba(PALETTE.turquoise, 0.4))
      body.addColorStop(0.8, rgba(PALETTE.deepGreen, 0.32))
      body.addColorStop(1, rgba(PALETTE.deepGreen, 0.12))
      ctx.fillStyle = body
      ctx.shadowColor = rgba(PALETTE.cyan, 0.6)
      ctx.shadowBlur = 30 + amp * 40
      ctx.fill()
      ctx.shadowBlur = 0

      /* 4. Glass rim highlight */
      ctx.strokeStyle = rgba(PALETTE.cyan, 0.35 + amp * 0.3)
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Top-left specular reflection
      ctx.beginPath()
      ctx.ellipse(
        cx - radius * 0.32,
        cy - radius * 0.4,
        radius * 0.28,
        radius * 0.16,
        -0.6,
        0,
        Math.PI * 2
      )
      ctx.fillStyle = "rgba(255,255,255,0.35)"
      ctx.fill()

      /* 5. Concentric voice rings (listening only) */
      if (ph === "listening") {
        ringTimer += 1
        if (ringTimer % 14 === 0 && amp > 0.08) {
          rings.push({ r: radius, alpha: 0.5 })
        }
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        const ring = rings[i]
        ring.r += 1.4
        ring.alpha -= 0.012
        if (ring.alpha <= 0) {
          rings.splice(i, 1)
          continue
        }
        ctx.beginPath()
        ctx.arc(cx, cy, ring.r, 0, Math.PI * 2)
        ctx.strokeStyle = rgba(PALETTE.cyan, ring.alpha)
        ctx.lineWidth = 1.2
        ctx.stroke()
      }

      /* 6. Inner particles */
      ctx.save()
      for (const p of particles) {
        p.angle += p.speed * (1 + amp * 2)
        p.drift += 0.02
        const wob = Math.sin(p.drift) * 4
        const x = cx + Math.cos(p.angle) * (p.radius + wob)
        const y = cy + Math.sin(p.angle) * (p.radius + wob)
        ctx.beginPath()
        ctx.arc(x, y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = rgba(PALETTE.cyan, 0.5 + amp * 0.4)
        ctx.fill()
      }
      ctx.restore()

      /* 7. Luminous sprout core */
      const coreR = radius * (0.16 + amp * 0.05)
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 3)
      core.addColorStop(0, rgba(PALETTE.cyan, 0.95))
      core.addColorStop(0.4, rgba(PALETTE.green, 0.6))
      core.addColorStop(1, rgba(PALETTE.green, 0))
      ctx.fillStyle = core
      ctx.beginPath()
      ctx.arc(cx, cy, coreR * 3, 0, Math.PI * 2)
      ctx.fill()

      // Sprout glyph (two leaves + stem)
      ctx.save()
      ctx.translate(cx, cy)
      ctx.strokeStyle = "rgba(255,255,255,0.95)"
      ctx.lineWidth = 2
      ctx.lineCap = "round"
      const s = coreR * 0.9
      ctx.beginPath()
      ctx.moveTo(0, s)
      ctx.lineTo(0, -s * 0.2)
      ctx.stroke()
      ctx.beginPath()
      ctx.ellipse(-s * 0.45, -s * 0.35, s * 0.5, s * 0.28, 0.7, 0, Math.PI * 2)
      ctx.ellipse(s * 0.45, -s * 0.35, s * 0.5, s * 0.28, -0.7, 0, Math.PI * 2)
      ctx.fillStyle = "rgba(255,255,255,0.9)"
      ctx.fill()
      ctx.restore()

      /* 8. Processing — produce orbits and is absorbed into the core */
      if (ph === "processing") {
        const cycle = (t % 220) / 220 // 0..1 absorption progress
        ctx.font = `${size * 0.11}px serif`
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        produce.forEach((veg, i) => {
          veg.angle += veg.speed
          const localCycle = (cycle + i / produce.length) % 1
          const orbit = veg.orbit * (1 - localCycle) // spiral inward
          const x = cx + Math.cos(veg.angle) * orbit
          const y = cy + Math.sin(veg.angle) * orbit
          const scale = 0.6 + (1 - localCycle) * 0.6
          const alpha = Math.min(1, localCycle * 4) * (1 - Math.max(0, localCycle - 0.85) * 6)
          ctx.save()
          ctx.globalAlpha = Math.max(0, alpha)
          ctx.translate(x, y)
          ctx.scale(scale, scale)
          ctx.fillText(veg.emoji, 0, 0)
          ctx.restore()
        })
      }

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [size])

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  )
}

export default VoiceOrb
