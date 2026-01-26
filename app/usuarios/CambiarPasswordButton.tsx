"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "react-hot-toast"
import { FaKey, FaTimes } from "react-icons/fa"

type Props = {
  id: string
  username: string
  isSelf: boolean
}

export default function CambiarPasswordButton({ id, username, isSelf }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  async function onSave() {
    if (!newPassword || newPassword.length < 6) {
      toast.error("La contraseña debe tener mínimo 6 caracteres")
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden")
      return
    }

    setLoading(true)
    const t = toast.loading("Actualizando contraseña...")

    try {
      const res = await fetch(`/api/usuarios/${id}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Error actualizando contraseña")
      }

      toast.success("Contraseña actualizada", { id: t })
      setOpen(false)
      setNewPassword("")
      setConfirmPassword("")
      router.refresh()
    } catch (e: any) {
      toast.error(e?.message || "Error actualizando contraseña", { id: t })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center px-4 py-2 rounded-lg font-medium transition-all bg-blue-100 text-blue-700 hover:bg-blue-200`}
        title={isSelf ? "Cambiar tu contraseña" : "Cambiar contraseña del usuario"}
      >
        <FaKey className="mr-2" />
        Contraseña
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Actualizar contraseña</h3>
                <p className="text-sm text-gray-600">
                  Usuario: <span className="font-semibold">{username}</span>
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100"
                aria-label="Cerrar"
              >
                <FaTimes />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nueva contraseña
                </label>
                <input
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  type="password"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Confirmar contraseña
                </label>
                <input
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  type="password"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Repite la contraseña"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setOpen(false)}
                  disabled={loading}
                  className="w-1/2 py-3 rounded-lg border border-gray-300 font-semibold hover:bg-gray-50 disabled:opacity-60"
                >
                  Cancelar
                </button>

                <button
                  onClick={onSave}
                  disabled={loading}
                  className="w-1/2 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
                >
                  {loading ? "Guardando..." : "Guardar"}
                </button>
              </div>

              <p className="text-xs text-gray-500">
                * Esta acción solo está disponible para administradores.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}