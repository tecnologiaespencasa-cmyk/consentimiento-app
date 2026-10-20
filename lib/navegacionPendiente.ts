// Estado de la navegacion en curso, para el indicador de carga del portal.
//
// Vive fuera de React a proposito: Next llama `onRouterTransitionStart`
// (instrumentation-client.ts) dentro de un startTransition, y un setState ahi
// no se pintaria hasta tener lista la pagina nueva, justo lo que se quiere
// evitar. Por eso el inicio solo marca atributos en el DOM, la barra se dibuja
// con CSS (globals.css) e IndicadorNavegacion quita las marcas al cambiar la URL.

const ATRIBUTO_HTML = "data-navegando"
const ATRIBUTO_ENLACE = "data-destino-pendiente"
// Red de seguridad: si la navegacion termina sin cambiar la URL (p. ej. una
// redireccion de vuelta a la misma pagina) nada mas apagaria la barra.
const LIMITE_MS = 20_000

let destino: string | null = null
let limite: ReturnType<typeof setTimeout> | undefined

// Ruta + query de un href del mismo origen; null si sale del portal.
function resolver(href: string) {
  const url = new URL(href, location.href)
  return url.origin === location.origin ? url.pathname + url.search : null
}

function rutaActual() {
  return location.pathname + location.search
}

export function iniciarNavegacion(href: string) {
  const nueva = resolver(href)
  // Atras/adelante llega con la URL ya cambiada, y un enlace a la misma pagina
  // (o a un #ancla) no cambia la ruta: en ambos casos no hay nada que esperar.
  if (nueva === null || nueva === rutaActual()) return

  destino = nueva
  document.documentElement.setAttribute(ATRIBUTO_HTML, "")
  // Se marcan todos los enlaces al destino (p. ej. el logo y "Inicio").
  for (const enlace of document.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    if (resolver(enlace.href) === nueva) enlace.setAttribute(ATRIBUTO_ENLACE, "")
    else enlace.removeAttribute(ATRIBUTO_ENLACE)
  }
  clearTimeout(limite)
  limite = setTimeout(terminarNavegacion, LIMITE_MS)
}

export function terminarNavegacion() {
  if (destino === null) return
  destino = null
  clearTimeout(limite)
  document.documentElement.removeAttribute(ATRIBUTO_HTML)
  for (const enlace of document.querySelectorAll(`[${ATRIBUTO_ENLACE}]`)) {
    enlace.removeAttribute(ATRIBUTO_ENLACE)
  }
}

// Descarta el clic sobre un enlace cuya pagina ya se esta cargando, para que el
// doble clic (o la impaciencia) no lance otra peticion al servidor por la misma
// ruta. Cubre los dos tramos de la espera: antes de que el router pinte la URL
// nueva (`destino`) y mientras se ve el loading.tsx de esa ruta. Se registra en
// fase de captura, antes que el onClick de <Link>, que no navega si el evento ya
// trae preventDefault. Un clic a otro modulo si pasa: el usuario puede cambiar
// de idea y Next descarta la navegacion anterior.
export function ignorarClicRepetido(evento: MouseEvent) {
  const cargandoPagina = document.querySelector("[data-cargando-pagina]") !== null
  if (destino === null && !cargandoPagina) return
  if (evento.button !== 0 || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return

  const enlace = (evento.target as Element | null)?.closest?.("a[href]")
  if (!(enlace instanceof HTMLAnchorElement)) return
  if (enlace.target && enlace.target !== "_self") return

  const pedida = resolver(enlace.href)
  if (pedida === null) return
  if (pedida === destino || (cargandoPagina && pedida === rutaActual())) {
    evento.preventDefault()
  }
}
