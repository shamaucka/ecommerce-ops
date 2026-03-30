"use client"

import { usePathname } from "next/navigation"
import Sidebar from "./Sidebar"

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLogin = pathname === "/login"

  return (
    <>
      {!isLogin && <Sidebar />}
      <main className={`flex-1 ${!isLogin ? "ml-64" : ""} p-8 overflow-auto min-h-screen`}>
        {children}
      </main>
    </>
  )
}
