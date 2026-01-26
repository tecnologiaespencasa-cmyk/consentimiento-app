"use client"

import { useState } from "react"
import {
  FaUserPlus,
  FaUser,
  FaKey,
  FaIdCard,
  FaShieldAlt,
  FaEnvelope,
  FaPhone
} from "react-icons/fa"
import { toast } from "react-hot-toast"

export default function CrearUsuarioForm() {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    username: "",
    nombres: "",
    primerApellido: "",
    segundoApellido: "",
    email: "",
    telefono: "",
    password: "",
    rol: "ESPECIALISTA"
  })

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const formDataObj = new FormData()
    formDataObj.append("username", formData.username.toLowerCase().trim())
    formDataObj.append("nombres", formData.nombres.trim())
    formDataObj.append("primerApellido", formData.primerApellido.trim())
    formDataObj.append("segundoApellido", formData.segundoApellido.trim())
    formDataObj.append("email", formData.email.trim())
    formDataObj.append("telefono", formData.telefono.trim())
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
          nombres: "",
          primerApellido: "",
          segundoApellido: "",
          email: "",
          telefono: "",
          password: "",
          rol: "ESPECIALISTA"
        })
        setTimeout(() => window.location.reload(), 1200)
      } else {
        const error = await response.json().catch(() => ({}))
        toast.error(error.error || "Error al crear usuario", { id: loadingToast })
      }
    } catch {
      toast.error("Error de conexión", { id: loadingToast })
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const rolDescriptions: Record<string, string> = {
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
        {/* Usuario */}
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
              autoComplete="off"
            />
            <FaUser className="absolute left-3 top-3.5 text-gray-400" />
          </div>
        </div>

        {/* Datos personales (responsive) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FaIdCard className="inline-block mr-2 text-red-500" />
              Nombres
            </label>
            <div className="relative">
              <input
                name="nombres"
                placeholder="ej: Juan Felipe"
                value={formData.nombres}
                onChange={handleChange}
                required
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                disabled={loading}
              />
              <FaIdCard className="absolute left-3 top-3.5 text-gray-400" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FaIdCard className="inline-block mr-2 text-red-500" />
              Primer Apellido
            </label>
            <div className="relative">
              <input
                name="primerApellido"
                placeholder="ej: Pérez"
                value={formData.primerApellido}
                onChange={handleChange}
                required
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                disabled={loading}
              />
              <FaIdCard className="absolute left-3 top-3.5 text-gray-400" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FaIdCard className="inline-block mr-2 text-red-500" />
              Segundo Apellido (opcional)
            </label>
            <div className="relative">
              <input
                name="segundoApellido"
                placeholder="ej: Rodríguez"
                value={formData.segundoApellido}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                disabled={loading}
              />
              <FaIdCard className="absolute left-3 top-3.5 text-gray-400" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FaEnvelope className="inline-block mr-2 text-red-500" />
              Correo (opcional)
            </label>
            <div className="relative">
              <input
                name="email"
                placeholder="ej: juan@correo.com"
                value={formData.email}
                onChange={handleChange}
                type="email"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                disabled={loading}
              />
              <FaEnvelope className="absolute left-3 top-3.5 text-gray-400" />
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FaPhone className="inline-block mr-2 text-red-500" />
              Teléfono (opcional)
            </label>
            <div className="relative">
              <input
                name="telefono"
                placeholder="ej: 3001234567"
                value={formData.telefono}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                disabled={loading}
              />
              <FaPhone className="absolute left-3 top-3.5 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <FaKey className="inline-block mr-2 text-red-500" />
            Contraseña
          </label>
          <div className="relative">
            <input
              name="password"
              placeholder="********"
              value={formData.password}
              onChange={handleChange}
              required
              type="password"
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
              disabled={loading}
              autoComplete="new-password"
            />
            <FaKey className="absolute left-3 top-3.5 text-gray-400" />
          </div>
        </div>

        {/* Rol */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <FaShieldAlt className="inline-block mr-2 text-red-500" />
            Rol del Usuario
          </label>
          <select
            name="rol"
            value={formData.rol}
            onChange={handleChange}
            disabled={loading}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all bg-white"
          >
            <option value="ESPECIALISTA">Especialista</option>
            <option value="TECNICO">Técnico</option>
            <option value="ADMINISTRATIVO">Administrativo</option>
          </select>
          <p className="text-xs text-gray-500 mt-2">{rolDescriptions[formData.rol]}</p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white py-3 rounded-lg font-semibold transition-all duration-200 transform hover:scale-[1.01] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Creando..." : "Crear Usuario"}
        </button>
      </form>
    </div>
  )
}