"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import { signOut, useSession } from "next-auth/react"
import {
  FaHome,
  FaFileSignature,
  FaUsers,
  FaUserCircle,
  FaIdCard,
  FaSignOutAlt,
  FaBars,
  FaTimes,
  FaUserMd,
  FaHospital,
  FaChevronDown,
  FaExclamationTriangle,
  FaClipboardList,
  FaNotesMedical
} from "react-icons/fa"

// La barra de navegacion no comparte el `.container` de 1280px del resto del
// portal: al tener que alojar hasta seis enlaces mas la marca y el usuario,
// aprovecha el ancho de pantalla hasta este limite. El tope evita que en
// monitores muy anchos los extremos queden absurdamente separados.
const ANCHO_NAVBAR = "mx-auto w-full max-w-[1800px] px-4 lg:px-6"

function nombreCorto(nombres?: string, primerApellido?: string) {
  const n = (nombres ?? "").trim()
  const a1 = (primerApellido ?? "").trim()
  if (!n && !a1) return "Usuario"

  // SOLO primer nombre + primer apellido
  const primerNombre = n.split(/\s+/)[0]
  return `${primerNombre} ${a1}`.trim()
}

export default function Navbar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showSignOutModal, setShowSignOutModal] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  // Usar useSession para obtener datos de autenticaciÃ³n
  const { data: session, status } = useSession()
  const isLoading = status === "loading"

  // Efecto para detectar scroll
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Mostrar spinner mientras carga
  if (isLoading) {
    return (
      <nav className="sticky top-0 z-50 bg-gradient-to-r from-red-700 to-red-800 h-16">
        <div className="container mx-auto px-4 h-full flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
        </div>
      </nav>
    )
  }

  // No mostrar navbar si no hay sesiÃ³n
  if (!session?.user) return null

  // âœ… Campos nuevos en sesiÃ³n
  const user = session.user as {
    nombres?: string
    primerApellido?: string
    rol?: string
    username?: string
  }
  const { nombres, primerApellido, rol, username } = user

  // Nombre corto (Pedro Perez)
  const displayName = nombreCorto(nombres, primerApellido) || username || "Usuario"

  // FunciÃ³n para verificar si el enlace estÃ¡ activo
  const isActive = (path: string) => pathname === path
  const isConsentimientosSection =
    pathname === "/consentimiento" ||
    pathname === "/mis-consentimientos" ||
    pathname === "/consentimientos" ||
    pathname.startsWith("/consentimientos/")
  const puedeVerConsentimientos = rol !== "FARMACIA"
  const puedeVerRondas = ["MEDICO_RONDA", "TECNICO", "ADMINISTRATIVO"].includes(rol ?? "")
  const isRondasSection = pathname === "/rondas" || pathname.startsWith("/rondas/")
  // Ocultar el modulo es solo comodidad visual: el acceso real lo deciden el
  // middleware, la pagina server-side y cada API route.
  const puedeVerClinicaHeridas = ["CLINICA_HERIDAS", "ADMINISTRATIVO", "TECNICO"].includes(rol ?? "")
  const isClinicaHeridasSection = pathname === "/clinica-heridas" || pathname.startsWith("/clinica-heridas/")

  // Enlaces visibles para este rol. Una sola definicion alimenta el navbar de
  // escritorio y el menu movil, para que no puedan quedar desincronizados.
  const enlaces = [
    { href: "/", label: "Inicio", Icon: FaHome, activo: isActive("/"), visible: true },
    {
      href: "/consentimientos",
      label: "Consentimientos",
      Icon: FaFileSignature,
      activo: isConsentimientosSection,
      visible: puedeVerConsentimientos
    },
    { href: "/novedades", label: "Novedades", Icon: FaExclamationTriangle, activo: isActive("/novedades"), visible: true },
    { href: "/rondas", label: "Rondas", Icon: FaClipboardList, activo: isRondasSection, visible: puedeVerRondas },
    {
      href: "/clinica-heridas",
      label: "Clínica de Heridas",
      Icon: FaNotesMedical,
      activo: isClinicaHeridasSection,
      visible: puedeVerClinicaHeridas
    },
    { href: "/usuarios", label: "Usuarios", Icon: FaUsers, activo: isActive("/usuarios"), visible: rol === "ADMINISTRATIVO" }
  ].filter((enlace) => enlace.visible)

  // La barra usa su propio contenedor (ANCHO_NAVBAR), mas amplio que el
  // `.container` de 1280px que comparte el resto de paginas, para aprovechar
  // las pantallas grandes sin alterar el ancho de lectura del contenido.
  //
  // Aun asi el numero de enlaces depende del rol, asi que la densidad se adapta
  // a cuantos haya: con muchos enlaces el espaciado se compacta y los textos
  // accesorios -- subtitulo de la marca, nombre y rol -- solo aparecen cuando
  // hay ancho real para ellos. Los enlaces nunca parten de linea.
  const compacto = enlaces.length >= 5
  // Los umbrales de 1500/1700 px son explicitos en vez de usar `2xl`: la barra
  // de desplazamiento resta unos pixeles al ancho que ven las media queries, y
  // asi el salto de tamaño ocurre donde de verdad hay hueco medido.
  const claseEnlace = compacto
    ? "px-2.5 py-2 text-sm xl:px-3 min-[1500px]:text-base min-[1700px]:px-4"
    : "px-4 py-2 text-base"
  const claseIcono = compacto ? "mr-1.5 shrink-0 min-[1500px]:mr-2" : "mr-2 shrink-0"
  // Orden de prioridad al repartir el ancho sobrante en modo compacto:
  // primero el nombre y el rol del usuario, despues el nombre de la empresa y
  // por ultimo el subtitulo, que es la linea mas ancha de todas.
  const claseUsuario = "hidden xl:block"
  const claseMarca = compacto ? "hidden min-[1400px]:block" : "hidden md:block"
  const claseSubtitulo = compacto ? "hidden min-[1700px]:block" : "hidden xl:block"

  // Estilo de un enlace segun si esta activo y si la barra esta desplazada.
  const estiloEnlace = (activo: boolean) =>
    activo
      ? isScrolled
        ? "bg-red-50 text-red-700 border border-red-200"
        : "bg-white/20 text-white"
      : isScrolled
        ? "text-gray-700 hover:bg-red-50 hover:text-red-700"
        : "text-red-100 hover:bg-white/10"

  async function confirmSignOut() {
    if (isSigningOut) return
    setIsSigningOut(true)
    await signOut({ callbackUrl: "/login" })
  }

  return (
    <>
      {/* Navbar Principal */}
      <nav className={`sticky top-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-white/95 backdrop-blur-md shadow-lg border-b border-red-100'
          : 'bg-gradient-to-r from-red-700 to-red-800'
      }`}>
        <div className={ANCHO_NAVBAR}>
          <div className="flex items-center justify-between h-16 gap-2">

            {/* Logo y Nombre de la Empresa */}
            {/* min-w-0 permite que el bloque de marca ceda espacio en vez de
                empujar la navegacion fuera de la barra. */}
            <div className="flex items-center min-w-0 shrink">
              <Link href="/" className="flex items-center space-x-3 min-w-0">
                <div className={`p-2 rounded-lg transition-colors shrink-0 ${
                  isScrolled ? 'bg-red-100' : 'bg-white/20'
                }`}>
                  <FaHospital className={`text-xl ${
                    isScrolled ? 'text-red-600' : 'text-white'
                  }`} />
                </div>
                <div className={`${claseMarca} min-w-0`}>
                  <h1 className={`font-bold text-lg min-[1700px]:text-xl leading-tight whitespace-nowrap ${
                    isScrolled ? 'text-gray-800' : 'text-white'
                  }`}>
                    Especialistas en Casa
                  </h1>
                  <p className={`text-xs min-[1700px]:text-sm truncate ${claseSubtitulo} ${
                    isScrolled ? 'text-gray-600' : 'text-red-100'
                  }`}>
                    Sistema de consentimientos y novedades
                  </p>
                </div>
              </Link>
            </div>

            {/* Enlaces de NavegaciÃ³n - Desktop */}
            {/* shrink-0 + whitespace-nowrap: la navegacion nunca se parte en
                varias lineas; si no cabe, lo que cede es el bloque de marca. */}
            <div className="hidden lg:flex items-center gap-0.5 shrink-0">
              {enlaces.map(({ href, label, Icon, activo }) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center rounded-lg transition-all whitespace-nowrap ${claseEnlace} ${estiloEnlace(activo)}`}
                >
                  <Icon className={claseIcono} />
                  {label}
                </Link>
              ))}
            </div>

            {/* MenÃº de Usuario - Desktop */}
            <div className="hidden lg:flex items-center shrink-0">

              {/* Perfil de Usuario */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  title={`${displayName} - ${rol || "Rol"}`}
                  className={`flex items-center gap-2 px-2 py-2 rounded-lg transition-colors ${
                    isScrolled
                      ? 'hover:bg-red-50 text-gray-700'
                      : 'text-red-100 hover:bg-white/10'
                  }`}
                >
                  <div className={`w-8 h-8 min-[1700px]:w-9 min-[1700px]:h-9 shrink-0 rounded-full flex items-center justify-center ${
                    isScrolled ? 'bg-red-100 text-red-600' : 'bg-white/20 text-white'
                  }`}>
                    <FaUserMd />
                  </div>
                  {/* Mientras no quepa, el nombre queda accesible en el tooltip
                      del avatar y en el desplegable. */}
                  <div className={`text-left ${claseUsuario}`}>
                    <p className={`text-sm min-[1500px]:text-[15px] font-medium truncate max-w-[170px] ${
                      isScrolled ? 'text-gray-800' : 'text-white'
                    }`}>
                      {displayName}
                    </p>
                    <p className={`text-xs truncate max-w-[170px] ${
                      isScrolled ? 'text-gray-600' : 'text-red-200'
                    }`}>
                      {rol || "Rol"}
                    </p>
                  </div>
                  <FaChevronDown className={`text-xs shrink-0 transition-transform ${
                    showUserMenu ? 'rotate-180' : ''
                  }`} />
                </button>

                {/* Dropdown del Usuario */}
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {displayName}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{rol || "Rol"}</p>
                    </div>
                    <Link
                      href="/mi-usuario"
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <FaUserCircle className="mr-3" />
                      Mi usuario
                    </Link>
                    <Link
                      href="/mi-carnet"
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <FaIdCard className="mr-3" />
                      Mi carné
                    </Link>
                    <button
                      type="button"
                      className="w-full text-left flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      onClick={() => {
                        setShowUserMenu(false)
                        setShowSignOutModal(true)
                      }}
                    >
                      <FaSignOutAlt className="mr-3" />
                      Cerrar Sesion
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* BotÃ³n del MenÃº MÃ³vil */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              aria-label={isOpen ? "Cerrar menu" : "Abrir menu"}
              className={`lg:hidden p-2 rounded-lg shrink-0 transition-colors ${
                isScrolled
                  ? 'text-gray-700 hover:bg-red-50'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              {isOpen ? <FaTimes className="text-xl" /> : <FaBars className="text-xl" />}
            </button>
          </div>
        </div>

        {/* MenÃº MÃ³vil */}
        {isOpen && (
          <div className="lg:hidden bg-white border-t border-gray-200 shadow-lg">
            <div className={`${ANCHO_NAVBAR} py-4`}>
              <div className="space-y-2">
                {enlaces.map(({ href, label, Icon, activo }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                      activo
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'text-gray-700 hover:bg-red-50 hover:text-red-700'
                    }`}
                  >
                    <Icon className="mr-3 shrink-0" />
                    {label}
                  </Link>
                ))}

                {/* InformaciÃ³n del Usuario en MÃ³vil */}
                <div className="pt-4 mt-4 border-t border-gray-200">
                  <div className="flex items-center px-4 py-3">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mr-3">
                      <FaUserMd className="text-red-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-800 truncate">
                        {displayName}
                      </p>
                      <p className="text-xs text-gray-600">
                        {rol || "Rol"}
                      </p>
                    </div>
                  </div>
                </div>

                <Link
                  href="/mi-usuario"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <FaUserCircle className="mr-3" />
                  Mi usuario
                </Link>

                <Link
                  href="/mi-carnet"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <FaIdCard className="mr-3" />
                  Mi carné
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false)
                    setShowSignOutModal(true)
                  }}
                  className="w-full text-left flex items-center px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <FaSignOutAlt className="mr-3" />
                  Cerrar Sesion
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Efecto overlay cuando el menÃº mÃ³vil estÃ¡ abierto */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {showSignOutModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-red-100 overflow-hidden">
            <div className="bg-gradient-to-r from-red-700 to-red-800 px-5 py-4">
              <h3 className="text-white font-semibold text-lg">Cerrar sesion</h3>
            </div>

            <div className="px-5 py-5">
              <p className="text-sm text-gray-700">
                Deseas cerrar tu sesion ahora?
              </p>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSignOutModal(false)}
                  disabled={isSigningOut}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void confirmSignOut()}
                  disabled={isSigningOut}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-60"
                >
                  {isSigningOut ? "Cerrando..." : "Cerrar sesion"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
