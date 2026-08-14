import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { tieneAccesoClinicaHeridas } from "@/lib/roles"

type AuthenticatedRequest = NextRequest & {
  nextauth?: {
    token?: {
      rol?: string
    }
  }
}

function withSecurityHeaders(response: NextResponse) {
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)")
  return response
}

export default withAuth(
  function middleware(req: NextRequest) {
    const authReq = req as AuthenticatedRequest
    const token = authReq.nextauth?.token
    const rol = token?.rol ?? ""
    const pathname = req.nextUrl.pathname

    // El rol farmacia solo gestiona novedades propias del proceso farmaceutico.
    if (
      rol === "FARMACIA" &&
      (
        pathname.startsWith("/consentimiento") ||
        pathname.startsWith("/consentimientos") ||
        pathname.startsWith("/mis-consentimientos")
      )
    ) {
      return withSecurityHeaders(NextResponse.redirect(new URL("/novedades", req.url)))
    }

    // Modulo Clinica de Heridas: solo el rol CLINICA_HERIDAS.
    // Esta es la primera de tres barreras; la pagina y cada API route vuelven a
    // validar el rol server-side (no se confia en ocultar el menu).
    if (pathname.startsWith("/clinica-heridas") && !tieneAccesoClinicaHeridas(rol)) {
      return withSecurityHeaders(NextResponse.redirect(new URL("/", req.url)))
    }

    // Pagina de carga de consentimiento (todos)
    if (
      pathname.startsWith("/consentimiento") &&
        !["ADMINISTRATIVO", "TECNICO", "ESPECIALISTA", "MEDICO_RONDA", "CLINICA_HERIDAS"].includes(rol)
    ) {
      return withSecurityHeaders(NextResponse.redirect(new URL("/login", req.url)))
    }

    // Vista administrativa de todos los consentimientos (solo admin y tecnico)
    if (
      pathname.startsWith("/consentimientos/todos") &&
      !["ADMINISTRATIVO", "TECNICO"].includes(rol)
    ) {
      return withSecurityHeaders(NextResponse.redirect(new URL("/consentimientos", req.url)))
    }

    // Gestion de usuarios (solo admin)
    if (pathname.startsWith("/usuarios") && rol !== "ADMINISTRATIVO") {
      return withSecurityHeaders(NextResponse.redirect(new URL("/consentimiento", req.url)))
    }

    if (pathname.startsWith("/rondas") && !["MEDICO_RONDA", "TECNICO", "ADMINISTRATIVO"].includes(rol)) {
      return withSecurityHeaders(NextResponse.redirect(new URL("/", req.url)))
    }

    if (pathname.startsWith("/rondas/todas") && !["TECNICO", "ADMINISTRATIVO"].includes(rol)) {
      return withSecurityHeaders(NextResponse.redirect(new URL("/rondas", req.url)))
    }

    return withSecurityHeaders(NextResponse.next())
  },
  {
    pages: {
      signIn: "/login"
    }
  }
)

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|login).*)"
  ]
}
