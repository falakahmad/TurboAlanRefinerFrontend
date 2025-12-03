import { NextResponse } from "next/server"

export async function POST() {
  const res = NextResponse.json({ ok: true })
  // Clear auth cookie used by middleware
  res.cookies.set("refiner_auth", "", { path: "/", httpOnly: true, secure: true, sameSite: "lax", maxAge: 0 })
  return res
}


