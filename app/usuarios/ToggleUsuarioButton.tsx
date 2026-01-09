"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

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
            alert("No puedes desactivar tu propio usuario")
            return
        }

        setLoading(true)

        const res = await fetch(`/api/usuarios/${id}`, {
            method: "PATCH",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                activo: !activo
            })
        })

        setLoading(false)

        if (!res.ok) {
            alert("Error actualizando usuario")
            return
        }

        router.refresh()
    }

    return (
        <button
            onClick={toggle}
            disabled={loading}
            className="text-blue-600 underline disabled:opacity-50"
        >
            {activo ? "Desactivar" : "Activar"}
        </button>
    )
}