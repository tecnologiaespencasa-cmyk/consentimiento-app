"use client"

import { signIn } from "next-auth/react"
import { useState } from "react"
import { FaUser, FaLock, FaHospital, FaStethoscope, FaShieldAlt } from "react-icons/fa"

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    const res = await signIn("credentials", {
      username,
      password,
      redirect: false
    })

    setIsLoading(false)

    if (res?.error) {
      setError("Usuario o contraseña incorrectos")
    } else {
      window.location.href = "/"
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-blue-50 p-4">
      <div className="flex flex-col md:flex-row w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Panel izquierdo - Información de la empresa */}
        <div className="md:w-2/5 bg-gradient-to-br from-teal-600 to-blue-700 text-white p-8 md:p-12 flex flex-col justify-center">
          <div className="flex items-center mb-8">
            <div className="mr-4 bg-white/20 p-3 rounded-full">
              <FaHospital className="text-3xl" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Especialistas</h1>
              <h2 className="text-2xl font-semibold">En Casa</h2>
            </div>
          </div>
          
          <p className="text-teal-100 text-xl font-medium mb-2">Salud Domiciliaria</p>
          <p className="text-white/80 mb-8">
            Portal administrativo para la gestión integral de servicios de salud en el hogar
          </p>
          
          <div className="space-y-6 mt-8">
            <div className="flex items-center">
              <div className="mr-4 bg-white/20 p-2 rounded-lg">
                <FaStethoscope />
              </div>
              <div>
                <p className="font-semibold">Cuidado especializado</p>
                <p className="text-sm text-white/70">Atención médica en la comodidad del hogar</p>
              </div>
            </div>
            
            <div className="flex items-center">
              <div className="mr-4 bg-white/20 p-2 rounded-lg">
                <FaShieldAlt />
              </div>
              <div>
                <p className="font-semibold">Acceso seguro</p>
                <p className="text-sm text-white/70">Protección de datos médicos confidenciales</p>
              </div>
            </div>
          </div>
          
          <div className="mt-12 pt-6 border-t border-white/20">
            <p className="text-sm text-white/60">© 2026 Especialistas en Casa IPS. Todos los derechos reservados.</p>
          </div>
        </div>
        
        {/* Panel derecho - Formulario de login */}
        <div className="md:w-3/5 p-8 md:p-12">
          <div className="max-w-md mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">Portal Administrativo</h2>
              <p className="text-gray-600">Acceso exclusivo para personal autorizado</p>
            </div>
            
            <form onSubmit={handleSubmit}>
              {error && (
                <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded">
                  <div className="flex">
                    <svg className="w-5 h-5 text-red-500 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span>{error}</span>
                  </div>
                </div>
              )}
              
              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-medium mb-2">
                  <FaUser className="inline mr-2 text-gray-400" />
                  Usuario
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Ingrese su usuario"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-12 p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                    required
                  />
                  <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                    <FaUser />
                  </div>
                </div>
              </div>
              
              <div className="mb-8">
                <label className="block text-gray-700 text-sm font-medium mb-2">
                  <FaLock className="inline mr-2 text-gray-400" />
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="Ingrese su contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                    required
                  />
                  <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                    <FaLock />
                  </div>
                </div>
              </div>
              
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-teal-600 to-blue-600 text-white py-4 px-6 rounded-xl font-semibold hover:from-teal-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-all shadow-lg hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Verificando...
                  </span>
                ) : "Iniciar Sesión"}
              </button>
              
              <div className="mt-8 pt-6 border-t border-gray-200">
                <p className="text-center text-gray-600 text-sm">
                  ¿Necesita ayuda? Contacte con el lider de tecnología 
                  <span className="text-teal-600 font-medium"> ESPECIALISTAS EN CASA</span>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}