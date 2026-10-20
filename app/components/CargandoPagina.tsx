// Lo que muestran los loading.tsx mientras el servidor arma la pagina (sesion y
// consultas a la BD). Next lo pinta apenas se hace clic en el enlace y lo
// reemplaza por la pagina real cuando llega. Aparece con un leve retraso
// (.cargando-pagina en globals.css) para no parpadear en las paginas rapidas.
// `data-cargando-pagina` lo usa lib/navegacionPendiente.ts para ignorar clics
// repetidos al mismo enlace mientras tanto.
export default function CargandoPagina() {
  return (
    <div data-cargando-pagina className="cargando-pagina container mx-auto px-4 py-16">
      <div
        role="status"
        className="mx-auto flex max-w-sm flex-col items-center gap-4 rounded-2xl border border-red-100 bg-white/90 px-8 py-10 text-center shadow-lg"
      >
        <span
          aria-hidden="true"
          className="h-10 w-10 rounded-full border-4 border-red-100 border-t-[#e80214] animate-spin motion-reduce:animate-none"
        />
        <div>
          <p className="font-semibold text-[#0a4b7a]">Cargando…</p>
          <p className="mt-1 text-sm text-gray-500">Un momento, por favor.</p>
        </div>
      </div>
    </div>
  )
}
