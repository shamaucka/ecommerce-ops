import { NextResponse } from "next/server"

export async function POST() {
  const response = NextResponse.json({ ok: true })
  const expired = { maxAge: 0, path: "/" }
  response.cookies.set("admin_token", "", expired)
  response.cookies.set("admin_session", "", expired)
  return response
}
