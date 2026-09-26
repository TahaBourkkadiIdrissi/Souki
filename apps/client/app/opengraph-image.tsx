import { ImageResponse } from "next/og"

export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: "100%", height: "100%", padding: 88, background: "#14301B", color: "#FFFFFF" }}>
      <div style={{ fontSize: 42, fontWeight: 800, color: "#A8E1AC" }}>SOUKI</div>
      <div style={{ marginTop: 32, fontSize: 78, lineHeight: 1.08, fontWeight: 800 }}>Votre marché frais à Fès</div>
      <div style={{ marginTop: 35, fontSize: 30, color: "#D8EBDD" }}>Légumes, fruits et herbes livrés chez vous</div>
    </div>,
    size,
  )
}
