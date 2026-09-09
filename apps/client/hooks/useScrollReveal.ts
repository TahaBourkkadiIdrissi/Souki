"use client"

import { useEffect, useRef } from "react"

/**
 * Custom hook that uses IntersectionObserver to add a `revealed` class
 * to elements with the `data-reveal` attribute when they enter the viewport.
 *
 * Usage in component:
 *   const revealRef = useScrollReveal<HTMLDivElement>()
 *   return <div ref={revealRef} data-reveal="up" data-delay="1">...</div>
 *
 * data-reveal values: "up" | "scale" | "fade" | "left" | "right"
 * data-delay values: "1" | "2" | "3" | "4"  (maps to stagger delays)
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  options?: { threshold?: number; rootMargin?: string }
) {
  const ref = useRef<T>(null)

  useEffect(() => {
    // Use document.body as fallback to handle hydration mismatch recovery
    // where ref.current may point to a stale DOM node
    const root = ref.current ?? document.body

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement
            el.classList.add("revealed")
            observer.unobserve(el)
          }
        })
      },
      {
        threshold: options?.threshold ?? 0.12,
        rootMargin: options?.rootMargin ?? "0px 0px -40px 0px",
      }
    )

    const observeElements = () => {
      const elements = root.querySelectorAll<HTMLElement>("[data-reveal]")
      elements.forEach((el) => {
        if (!el.classList.contains("revealed")) {
          observer.observe(el)
        }
      })
    }

    // Initial observation
    observeElements()

    // Re-observe after a short delay to catch elements added after hydration recovery
    const rafId = requestAnimationFrame(() => {
      observeElements()
    })
    const timeoutId = window.setTimeout(() => {
      observeElements()
    }, 300)

    // Also watch for dynamically added elements
    const mutationObserver = new MutationObserver(() => {
      observeElements()
    })
    mutationObserver.observe(root, { childList: true, subtree: true })

    return () => {
      cancelAnimationFrame(rafId)
      clearTimeout(timeoutId)
      observer.disconnect()
      mutationObserver.disconnect()
    }
  }, [options?.threshold, options?.rootMargin])

  return ref
}
