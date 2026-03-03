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
  FaSignOutAlt,
  FaBars,
  FaTimes,
  FaUserMd,
  FaHospital,
  FaChevronDown,
  FaExclamationTriangle
} from "react-icons/fa"

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
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">

            {/* Logo y Nombre de la Empresa */}
            <div className="flex items-center space-x-3">
              <Link href="/" className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg transition-colors ${
                  isScrolled ? 'bg-red-100' : 'bg-white/20'
                }`}>
                  <FaHospital className={`text-xl ${
                    isScrolled ? 'text-red-600' : 'text-white'
                  }`} />
                </div>
                <div className="hidden md:block">
                  <h1 className={`font-bold text-lg ${
                    isScrolled ? 'text-gray-800' : 'text-white'
                  }`}>
                    Especialistas en Casa
                  </h1>
                  <p className={`text-xs ${
                    isScrolled ? 'text-gray-600' : 'text-red-100'
                  }`}>
                    Sistema de consentimientos y novedades
                  </p>
                </div>
              </Link>
            </div>

            {/* Enlaces de NavegaciÃ³n - Desktop */}
            <div className="hidden md:flex items-center space-x-1">
              <Link
                href="/"
                className={`flex items-center px-4 py-2 rounded-lg transition-all ${
                  isActive('/')
                    ? isScrolled
                      ? 'bg-red-50 text-red-600 border border-red-200'
                      : 'bg-white/20 text-white'
                    : isScrolled
                      ? 'text-gray-700 hover:bg-red-50 hover:text-red-600'
                      : 'text-red-100 hover:bg-white/10'
                }`}
              >
                <FaHome className="mr-2" />
                Inicio
              </Link>

              {puedeVerConsentimientos && (
                <Link
                  href="/consentimientos"
                  className={`flex items-center px-4 py-2 rounded-lg transition-all ${
                    isConsentimientosSection
                      ? isScrolled
                        ? 'bg-red-50 text-red-600 border border-red-200'
                        : 'bg-white/20 text-white'
                      : isScrolled
                        ? 'text-gray-700 hover:bg-red-50 hover:text-red-600'
                        : 'text-red-100 hover:bg-white/10'
                  }`}
                >
                  <FaFileSignature className="mr-2" />
                  Consentimientos
                </Link>
              )}

              <Link
                href="/novedades"
                className={`flex items-center px-4 py-2 rounded-lg transition-all ${
                  isActive('/novedades')
                    ? isScrolled
                      ? 'bg-red-50 text-red-600 border border-red-200'
                      : 'bg-white/20 text-white'
                    : isScrolled
                      ? 'text-gray-700 hover:bg-red-50 hover:text-red-600'
                      : 'text-red-100 hover:bg-white/10'
                }`}
              >
                <FaExclamationTriangle className="mr-2" />
                Novedades
              </Link>

              {rol === "ADMINISTRATIVO" && (
                <Link
                  href="/usuarios"
                  className={`flex items-center px-4 py-2 rounded-lg transition-all ${
                    isActive('/usuarios')
                      ? isScrolled
                        ? 'bg-red-50 text-red-600 border border-red-200'
                        : 'bg-white/20 text-white'
                      : isScrolled
                        ? 'text-gray-700 hover:bg-red-50 hover:text-red-600'
                        : 'text-red-100 hover:bg-white/10'
                  }`}
                >
                  <FaUsers className="mr-2" />
                  Usuarios
                </Link>
              )}
            </div>

            {/* MenÃº de Usuario - Desktop */}
            <div className="hidden md:flex items-center space-x-4">

              {/* Perfil de Usuario */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                    isScrolled
                      ? 'hover:bg-red-50 text-gray-700'
                      : 'text-red-100 hover:bg-white/10'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isScrolled ? 'bg-red-100 text-red-600' : 'bg-white/20 text-white'
                  }`}>
                    <FaUserMd />
                  </div>
                  <div className="text-left hidden lg:block">
                    <p className={`text-sm font-medium truncate max-w-[150px] ${
                      isScrolled ? 'text-gray-800' : 'text-white'
                    }`}>
                      {displayName}
                    </p>
                    <p className={`text-xs truncate max-w-[150px] ${
                      isScrolled ? 'text-gray-600' : 'text-red-200'
                    }`}>
                      {rol || "Rol"}
                    </p>
                  </div>
                  <FaChevronDown className={`text-xs transition-transform ${
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
                    </div>
                    <Link
                      href="/mi-usuario"
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <FaUserCircle className="mr-3" />
                      Mi usuario
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
              className={`md:hidden p-2 rounded-lg transition-colors ${
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
          <div className="md:hidden bg-white border-t border-gray-200 shadow-lg">
            <div className="container mx-auto px-4 py-4">
              <div className="space-y-2">
                <Link
                  href="/"
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                    isActive('/')
                      ? 'bg-red-50 text-red-600 border border-red-200'
                      : 'text-gray-700 hover:bg-red-50 hover:text-red-600'
                  }`}
                >
                  <FaHome className="mr-3" />
                  Inicio
                </Link>

                {puedeVerConsentimientos && (
                  <Link
                    href="/consentimientos"
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                      isConsentimientosSection
                        ? 'bg-red-50 text-red-600 border border-red-200'
                        : 'text-gray-700 hover:bg-red-50 hover:text-red-600'
                    }`}
                  >
                    <FaFileSignature className="mr-3" />
                    Consentimientos
                  </Link>
                )}

                <Link
                  href="/novedades"
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                    isActive('/novedades')
                      ? 'bg-red-50 text-red-600 border border-red-200'
                      : 'text-gray-700 hover:bg-red-50 hover:text-red-600'
                  }`}
                >
                  <FaExclamationTriangle className="mr-3" />
                  Novedades
                </Link>

                {rol === "ADMINISTRATIVO" && (
                  <Link
                    href="/usuarios"
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                      isActive('/usuarios')
                        ? 'bg-red-50 text-red-600 border border-red-200'
                        : 'text-gray-700 hover:bg-red-50 hover:text-red-600'
                    }`}
                  >
                    <FaUsers className="mr-3" />
                    Usuarios
                  </Link>
                )}

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
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
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
