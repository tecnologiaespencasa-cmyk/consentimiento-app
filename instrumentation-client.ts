// Next ejecuta este archivo en el navegador antes de hidratar la app.
import { ignorarClicRepetido, iniciarNavegacion } from "@/lib/navegacionPendiente"

document.addEventListener("click", ignorarClicRepetido, true)

// Next lo llama al arrancar cada navegacion del router: clics en <Link>,
// router.push/replace y atras/adelante. Enciende el indicador de carga.
export function onRouterTransitionStart(url: string) {
  iniciarNavegacion(url)
}
