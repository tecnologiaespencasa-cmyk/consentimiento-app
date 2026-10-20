"use client"

import { useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { terminarNavegacion } from "@/lib/navegacionPendiente"

// Barra de carga superior del portal. La enciende instrumentation-client.ts al
// iniciar cada navegacion; aqui se apaga en cuanto el router pinta la URL nueva,
// sea la pagina final o su loading.tsx. La animacion es solo CSS (globals.css).
export default function IndicadorNavegacion() {
  const pathname = usePathname()
  const busqueda = useSearchParams().toString()

  useEffect(() => {
    terminarNavegacion()
  }, [pathname, busqueda])

  return <div className="barra-navegacion" aria-hidden="true" />
}
