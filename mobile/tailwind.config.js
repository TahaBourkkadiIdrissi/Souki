/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        "green-market": "#1E8A3C",
        "green-fresh": "#4CB84A",
        "orange-cta": "#F07C00",
        "yellow-badge": "#F5C400",
        "blue-trust": "#1A4F8A",
        "bg-card": "#F0FAF1",
        "bg-section": "#F5F5F0",
        "text-body": "#3D3D3D",
        "text-muted": "#8A8A8A",
        background: "#FFFFFF",
        foreground: "#3D3D3D",
        card: "#F0FAF1",
        "card-foreground": "#3D3D3D",
        popover: "#FFFFFF",
        "popover-foreground": "#3D3D3D",
        primary: "#1E8A3C",
        "primary-foreground": "#FFFFFF",
        secondary: "#4CB84A",
        "secondary-foreground": "#FFFFFF",
        muted: "#F5F5F0",
        "muted-foreground": "#8A8A8A",
        accent: "#F07C00",
        "accent-foreground": "#FFFFFF",
        destructive: "#DC2626",
        "destructive-foreground": "#FFFFFF",
        border: "#E5E7EB",
        input: "#E5E7EB",
        ring: "#1E8A3C",
        "chart-1": "#1E8A3C",
        "chart-2": "#4CB84A",
        "chart-3": "#F07C00",
        "chart-4": "#F5C400",
        "chart-5": "#1A4F8A",
        sidebar: "#1E8A3C",
        "sidebar-foreground": "#FFFFFF",
        "sidebar-primary": "#FFFFFF",
        "sidebar-primary-foreground": "#1E8A3C",
        "sidebar-accent": "rgba(255, 255, 255, 0.1)",
        "sidebar-accent-foreground": "#FFFFFF",
        "sidebar-border": "rgba(255, 255, 255, 0.2)",
        "sidebar-ring": "#4CB84A"
      },
      borderRadius: {
        sm: "12px",
        md: "14px",
        lg: "16px",
        xl: "20px"
      },
      fontFamily: {
        sans: ["Inter", "System"],
        heading: ["Poppins", "System"]
      },
      boxShadow: {
        soft: "0 8px 32px rgba(0,0,0,0.10)",
        nav: "0 4px 30px rgba(0,0,0,0.03)"
      },
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1536px"
      }
    }
  },
  plugins: []
}
