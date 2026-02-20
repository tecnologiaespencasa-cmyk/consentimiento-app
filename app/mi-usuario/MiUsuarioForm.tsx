"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import toast from "react-hot-toast"
import { FaEnvelope, FaIdBadge, FaLock, FaPhoneAlt, FaSave, FaUser } from "react-icons/fa"

type MeUser = {
  id: string
  username: string
  rol: string
  nombreCompleto: string
  email: string | null
  telefono: string | null
}

export default function MiUsuarioForm() {
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  const [me, setMe] = useState<MeUser | null>(null)
  const [email, setEmail] = useState("")
  const [telefono, setTelefono] = useState("")

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  useEffect(() => {
    void loadMe()
  }, [])

  async function loadMe() {
    setLoading(true)
    try {
      const res = await fetch("/api/me", { cache: "no-store" })
      const data = await res.json().catch(() => null)

      if (!res.ok || !data) {
        throw new Error(data?.error || "No fue posible cargar el perfil")
      }

      const user: MeUser = {
        id: data.id,
        username: data.username,
        rol: data.rol,
        nombreCompleto: data.nombreCompleto || "",
        email: data.email ?? null,
        telefono: data.telefono ?? null,
      }

      setMe(user)
      setEmail(user.email ?? "")
      setTelefono(user.telefono ?? "")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error cargando perfil"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const profileChanged = useMemo(() => {
    if (!me) return false
    return (email.trim() || "") !== (me.email || "") || (telefono.trim() || "") !== (me.telefono || "")
  }, [email, me, telefono])

  async function onSaveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const normalizedEmail = email.trim()
    if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      toast.error("Ingresa un correo valido")
      return
    }

    if (!profileChanged) {
      toast("No hay cambios por guardar")
      return
    }

    setSavingProfile(true)
    const t = toast.loading("Guardando perfil...")

    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          telefono: telefono.trim(),
        }),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "No fue posible actualizar el perfil")
      }

      const updated: MeUser = {
        id: data.user.id,
        username: data.user.username,
        rol: data.user.rol,
        nombreCompleto: data.user.nombreCompleto || "",
        email: data.user.email ?? null,
        telefono: data.user.telefono ?? null,
      }
      setMe(updated)
      setEmail(updated.email ?? "")
      setTelefono(updated.telefono ?? "")

      toast.success("Perfil actualizado correctamente", { id: t })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error actualizando perfil"
      toast.error(message, { id: t })
    } finally {
      setSavingProfile(false)
    }
  }

  async function onChangePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!currentPassword.trim()) {
      toast.error("Debes ingresar tu contraseña actual")
      return
    }

    if (!newPassword.trim() || newPassword.length < 6) {
      toast.error("La nueva contraseña debe tener minimo 6 caracteres")
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error("La confirmacion no coincide")
      return
    }

    setSavingPassword(true)
    const t = toast.loading("Actualizando contraseña...")

    try {
      const res = await fetch("/api/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "No fue posible cambiar la contraseña")
      }

      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      toast.success("Contraseña actualizada", { id: t })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error actualizando contraseña"
      toast.error(message, { id: t })
    } finally {
      setSavingPassword(false)
    }
  }

  if (loading) {
    return (
      <div className="px-5 py-8 md:px-8">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-gray-100" />
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="h-64 animate-pulse rounded-2xl bg-gray-100" />
          <div className="h-64 animate-pulse rounded-2xl bg-gray-100" />
        </div>
      </div>
    )
  }

  if (!me) {
    return (
      <div className="px-5 py-10 text-center text-gray-600 md:px-8">
        No fue posible cargar tu informacion de usuario.
      </div>
    )
  }

  return (
    <div className="px-5 py-7 md:px-8">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-lg bg-red-100 p-2 text-red-600">
              <FaUser />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Datos de perfil</h2>
              <p className="text-sm text-gray-600">Informacion personal de tu cuenta.</p>
            </div>
          </div>

          <form onSubmit={onSaveProfile} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Nombre completo</label>
              <div className="flex items-center rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-gray-700">
                <FaIdBadge className="mr-2 text-gray-400" />
                <span className="truncate">{me.nombreCompleto || "-"}</span>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Telefono</label>
              <div className="relative">
                <FaPhoneAlt className="pointer-events-none absolute left-3 top-3.5 text-gray-400" />
                <input
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  type="tel"
                  placeholder="Ej: 3001234567"
                  className="w-full rounded-xl border border-gray-200 px-10 py-2.5 text-gray-800 outline-none transition focus:border-red-300 focus:ring-2 focus:ring-red-100"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Correo</label>
              <div className="relative">
                <FaEnvelope className="pointer-events-none absolute left-3 top-3.5 text-gray-400" />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="correo@dominio.com"
                  className="w-full rounded-xl border border-gray-200 px-10 py-2.5 text-gray-800 outline-none transition focus:border-red-300 focus:ring-2 focus:ring-red-100"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingProfile || !profileChanged}
              className="inline-flex w-full items-center justify-center rounded-xl bg-red-600 px-4 py-2.5 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FaSave className="mr-2" />
              {savingProfile ? "Guardando..." : "Guardar cambios"}
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-lg bg-red-100 p-2 text-red-600">
              <FaLock />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Cambiar contraseña</h2>
              <p className="text-sm text-gray-600">Actualiza tu credencial de acceso.</p>
            </div>
          </div>

          <form onSubmit={onChangePassword} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Contraseña actual</label>
              <input
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                type="password"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-gray-800 outline-none transition focus:border-red-300 focus:ring-2 focus:ring-red-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Nueva contraseña</label>
              <input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                type="password"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-gray-800 outline-none transition focus:border-red-300 focus:ring-2 focus:ring-red-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Confirmar nueva contraseña</label>
              <input
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                type="password"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-gray-800 outline-none transition focus:border-red-300 focus:ring-2 focus:ring-red-100"
              />
            </div>

            <button
              type="submit"
              disabled={savingPassword}
              className="inline-flex w-full items-center justify-center rounded-xl bg-gray-900 px-4 py-2.5 font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FaLock className="mr-2" />
              {savingPassword ? "Actualizando..." : "Actualizar contraseña"}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
