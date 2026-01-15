"use client"

import { useState } from "react"
import { FaUserPlus, FaUser, FaKey, FaIdCard, FaShieldAlt } from "react-icons/fa"
import { toast } from "react-hot-toast"

export default function CrearUsuarioForm() {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    username: "",
    nombre: "",
    password: "",
    rol: "ESPECIALISTA"
  })

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const formDataObj = new FormData()
    formDataObj.append("username", formData.username)
    formDataObj.append("nombre", formData.nombre)
    formDataObj.append("password", formData.password)
    formDataObj.append("rol", formData.rol)

    const loadingToast = toast.loading("Creando usuario...")

    try {
      const response = await fetch("/api/usuarios", {
        method: "POST",
        body: formDataObj
      })

      if (response.ok) {
        toast.success("Usuario creado exitosamente", { id: loadingToast })
        setFormData({
          username: "",
          nombre: "",
          password: "",
          rol: "ESPECIALISTA"
        })
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      } else {
        const error = await response.json()
        toast.error(error.error || "Error al crear usuario", { id: loadingToast })
      }
    } catch (error) {
      toast.error("Error de conexión", { id: loadingToast })
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const rolDescriptions = {
    ADMINISTRATIVO: "Acceso completo a todas las funciones del sistema",
    TECNICO: "Puede ver todos los consentimientos",
    ESPECIALISTA: "Solo puede ver sus propios consentimientos"
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-red-500">
      <div className="flex items-center mb-6">
        <div className="p-3 bg-red-100 rounded-lg mr-4">
          <FaUserPlus className="text-2xl text-red-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">Crear Nuevo Usuario</h2>
          <p className="text-gray-600 text-sm">Agrega nuevos miembros al equipo</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Campo Usuario */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <FaUser className="inline-block mr-2 text-red-500" />
            Nombre de Usuario
          </label>
          <div className="relative">
            <input
              name="username"
              placeholder="ej: juan.perez"
              value={formData.username}
              onChange={handleChange}
              required
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
              disabled={loading}
            />
            <FaUser className="absolute left-3 top-3.5 text-gray-400" />
          </div>
        </div>

        {/* Campo Nombre Completo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <FaIdCard className="inline-block mr-2 text-red-500" />
            Nombre Completo
          </label>
          <div className="relative">
            <input
              name="nombre"
              placeholder="ej: Juan Pérez Rodríguez"
              value={formData.nombre}
              onChange={handleChange}
              required
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
              disabled={loading}
            />
            <FaIdCard className="absolute left-3 top-3.5 text-gray-400" />
          </div>
        </div>

        {/* Campo Contraseña */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <FaKey className="inline-block mr-2 text-red-500" />
            Contraseña
          </label>
          <div className="relative">
            <input
              name="password"
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              required
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
              disabled={loading}
            />
            <FaKey className="absolute left-3 top-3.5 text-gray-400" />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Mínimo 6 caracteres. Se recomienda usar una contraseña segura.
          </p>
        </div>

        {/* Campo Rol */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <FaShieldAlt className="inline-block mr-2 text-red-500" />
            Rol del Usuario
          </label>
          <select 
            name="rol" 
            value={formData.rol}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all appearance-none bg-white"
            disabled={loading}
          >
            <option value="ADMINISTRATIVO">Administrador</option>
            <option value="TECNICO">Técnico</option>
            <option value="ESPECIALISTA">Especialista</option>
          </select>
          <div className="mt-2 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-800">
              {rolDescriptions[formData.rol as keyof typeof rolDescriptions]}
            </p>
          </div>
        </div>

        {/* Botón de envío */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg font-semibold hover:from-red-700 hover:to-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all shadow-lg hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
              Creando...
            </>
          ) : (
            <>
              <FaUserPlus className="mr-2" />
              Crear Usuario
            </>
          )}
        </button>
      </form>

      {/* Notas importantes */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Notas importantes:</h3>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>• Todos los campos son obligatorios</li>
          <li>• El nombre de usuario debe ser único</li>
          <li>• Solo usuarios con rol Administrativo pueden crear otros usuarios</li>
          <li>• Los permisos se asignan automáticamente según el rol</li>
        </ul>
      </div>
    </div>
  )
}