import type { Metadata } from "next"
import "./globals.css"
import LayoutShell from "./LayoutShell"

export const metadata: Metadata = {
  title: "Painel | Tess Quadros",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="flex bg-zinc-50 text-zinc-900 min-h-screen" style={{ fontFamily: "'Maison', sans-serif" }}>
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  )
}
