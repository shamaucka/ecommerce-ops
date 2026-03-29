import type { Metadata } from "next"
import "./globals.css"
import Sidebar from "./Sidebar"

export const metadata: Metadata = {
  title: "Painel | Tess Quadros",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="flex bg-zinc-50 text-zinc-900 min-h-screen" style={{ fontFamily: "'Maison', sans-serif" }}>
        <Sidebar />
        <main className="flex-1 ml-64 p-8 overflow-auto min-h-screen">{children}</main>
      </body>
    </html>
  )
}
