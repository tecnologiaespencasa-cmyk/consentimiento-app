"use client"

import { useState } from "react"

export default function CrearUsuarioForm() {
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setLoading(true)

        const formData = new FormData(e.currentTarget)

        await fetch("/api/usuarios", {
            method: "POST",
            body: formData
        })

        window.location.reload()
    }

    return (
        <form onSubmit={handleSubmit} className="border p-4 space-y-3">
            <h2 className="font-semibold">Crear nuevo usuario</h2>

            <input
                name="username"
                placeholder="Usuario"
                required
                className="border p-2 w-full"
            />

            <input
                name="nombre"
                placeholder="Nombre completo"
                required
                className="border p-2 w-full"
            />

            <input
                name="password"
                type="password"
                placeholder="Contraseña"
                required
                className="border p-2 w-full"
            />

            <select name="rol" className="border p-2 w-full">
                <option value="ADMINISTRATIVO">ADMINISTRATIVO</option>
                <option value="TECNICO">TECNICO</option>
                <option value="ESPECIALISTA">ESPECIALISTA</option>
            </select>

            <button
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2"
            >
                Crear usuario
            </button>
        </form>
    )
}