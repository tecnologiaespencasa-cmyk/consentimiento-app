"use client";

import { useState } from "react";

export default function ConsentimientoPage() {
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMensaje(null);

    const formData = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/consentimiento", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error();

      setMensaje("✅ Consentimiento guardado correctamente");
      e.currentTarget.reset();
    } catch {
      setMensaje("❌ Error al guardar el consentimiento");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center">
      {/* HEADER */}
      <header className="w-full bg-white shadow-md py-4 flex justify-center">
        <img
          src="https://media.licdn.com/dms/image/v2/D5616AQG6F-vet15myg/profile-displaybackgroundimage-shrink_200_800/profile-displaybackgroundimage-shrink_200_800/0/1665575367807?e=2147483647&v=beta&t=Kc2dOqB7r17StLmF3_Vf2el9jFGNErLVwSQem-Fz1rY"
          alt="Logo"
          className="h-16 object-contain"
        />
      </header>

      {/* CARD */}
      <main className="w-full max-w-xl mt-10 bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-semibold text-gray-800 mb-6 text-center">
          Registro de Consentimiento Informado
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Cédula del paciente
            </label>
            <input
              name="cedula"
              required
              className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-600 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Nombre del especialista
            </label>
            <input
              name="especialista"
              required
              className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-600 focus:ring-blue-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Fecha
              </label>
              <input
                type="date"
                name="fecha"
                required
                className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-600 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Hora
              </label>
              <input
                type="time"
                name="hora"
                required
                className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-600 focus:ring-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Adjuntar consentimiento (PDF o imagen)
            </label>
            <input
              type="file"
              name="archivo"
              accept="application/pdf,image/*"
              required
              className="mt-1 block w-full text-sm text-gray-600
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:bg-blue-600 file:text-white
                hover:file:bg-blue-700"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-md font-semibold hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? "Guardando..." : "Guardar consentimiento"}
          </button>

          {mensaje && (
            <p className="text-center font-medium text-gray-700">{mensaje}</p>
          )}
        </form>
      </main>

      {/* FOOTER */}
      <footer className="mt-10 text-sm text-gray-500">
        © {new Date().getFullYear()} · Consentimientos Informados
      </footer>
    </div>
  );
}
