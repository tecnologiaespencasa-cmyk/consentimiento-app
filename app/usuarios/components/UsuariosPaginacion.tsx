import Link from "next/link"

function buildUrl({
  page,
  q,
  rol,
  estado,
}: {
  page: number
  q: string
  rol: string
  estado: string
}) {
  const p = new URLSearchParams()
  if (q?.trim()) p.set("q", q.trim())
  if (rol) p.set("rol", rol)
  if (estado) p.set("estado", estado)
  p.set("page", String(page))
  return `/usuarios?${p.toString()}`
}

export default function UsuariosPaginacion({
  page,
  totalPages,
  q,
  rol,
  estado,
}: {
  page: number
  totalPages: number
  q: string
  rol: string
  estado: string
}) {
  const prev = Math.max(1, page - 1)
  const next = Math.min(totalPages, page + 1)

  return (
    <div className="flex items-center gap-2">
      <Link
        href={buildUrl({ page: prev, q, rol, estado })}
        className={`px-3 py-2 rounded-lg border font-semibold ${
          page === 1 ? "pointer-events-none opacity-50" : "hover:bg-white"
        }`}
      >
        ← Anterior
      </Link>

      <span className="text-sm text-gray-600 px-2">
        {page} / {totalPages}
      </span>

      <Link
        href={buildUrl({ page: next, q, rol, estado })}
        className={`px-3 py-2 rounded-lg border font-semibold ${
          page === totalPages ? "pointer-events-none opacity-50" : "hover:bg-white"
        }`}
      >
        Siguiente →
      </Link>
    </div>
  )
}