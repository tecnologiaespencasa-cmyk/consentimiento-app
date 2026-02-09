"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { FaToggleOn, FaToggleOff, FaUserCheck, FaUserSlash } from "react-icons/fa"
import { toast } from "react-hot-toast"

type Props = {
  id: string
  activo: boolean
  isSelf: boolean
}

export default function ToggleUsuarioButton({
  id,
  activo,
  isSelf
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function toggle() {
    if (isSelf) {
      toast.error("No puedes modificar tu propio estado", {
        icon: '⚠️'
      })
      return
    }

    const confirmMessage = activo 
      ? "¿Desactivar este usuario? No podrá acceder al sistema."
      : "¿Activar este usuario? Podrá acceder al sistema normalmente."

    if (!confirm(confirmMessage)) {
      return
    }

    setLoading(true)
    const loadingToast = toast.loading(activo ? "Desactivando usuario..." : "Activando usuario...")

    try {
      const res = await fetch(`/api/usuarios/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          activo: !activo
        })
      })

      if (!res.ok) {
        throw new Error("Error actualizando usuario")
      }

      toast.success(
        activo ? "Usuario desactivado exitosamente" : "Usuario activado exitosamente",
        { id: loadingToast }
      )
      
      router.refresh()
    } catch (error) {
      toast.error("Error al actualizar el usuario", { id: loadingToast })
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading || isSelf}
      className={`inline-flex items-center px-4 py-2 rounded-lg font-medium transition-all ${
        activo 
          ? 'bg-red-100 text-red-700 hover:bg-red-200' 
          : 'bg-green-100 text-green-700 hover:bg-green-200'
      } ${isSelf ? 'opacity-50 cursor-not-allowed' : ''}`}
      title={isSelf ? "No puedes modificar tu propio estado" : activo ? "Desactivar usuario" : "Activar usuario"}
    >
      {loading ? (
        <>
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div>
          {activo ? "Desactivando..." : "Activando..."}
        </>
      ) : (
        <>
          {activo ? (
            <>
              <FaUserSlash className="mr-2" />
              Desactivar
            </>
          ) : (
            <>
              <FaUserCheck className="mr-2" />
              Activar
            </>
          )}
        </>
      )}
    </button>
  )
}