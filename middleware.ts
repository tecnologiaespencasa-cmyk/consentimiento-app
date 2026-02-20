import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export default withAuth(
    function middleware(req: NextRequest) {
        const authReq = req as NextRequest & {
            nextauth?: {
                token?: {
                    rol?: string
                }
            }
        }
        const token = authReq.nextauth?.token
        const rol = token?.rol
        const pathname = req.nextUrl.pathname

        // Página de carga de consentimiento (todos)
        if (
            pathname.startsWith("/consentimiento") &&
            !["ADMINISTRATIVO", "TECNICO", "ESPECIALISTA"].includes(rol)
        ) {
            return NextResponse.redirect(new URL("/login", req.url))
        }

        // Vista administrativa de todos los consentimientos (solo admin y tecnico)
        if (
            pathname.startsWith("/consentimientos/todos") &&
            !["ADMINISTRATIVO", "TECNICO"].includes(rol)
        ) {
            return NextResponse.redirect(new URL("/consentimientos", req.url))
        }

        // Gestión de usuarios (solo admin)
        if (
            pathname.startsWith("/admin/usuarios") &&
            rol !== "ADMINISTRATIVO"
        ) {
            return NextResponse.redirect(new URL("/consentimiento", req.url))
        }

        return NextResponse.next()
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
