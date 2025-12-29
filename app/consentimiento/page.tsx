"use client";

import { useState } from "react";

export default function ConsentimientoPage() {
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  setMensaje(null);
  setCargando(true);

  const form = e.currentTarget; // 👈 guardamos referencia segura
  const formData = new FormData(form);

  try {
    const response = await fetch("/api/consentimiento", {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      setMensaje("✅ Consentimiento guardado correctamente");
      form.reset(); // ✅ ahora nunca será null
    } else {
      setMensaje("❌ Error al guardar el consentimiento");
    }
  } catch (error) {
    console.error(error);
    setMensaje("❌ Error de conexión con el servidor");
  } finally {
    setCargando(false);
  }
};


  return (
    <main style={{ maxWidth: 500, margin: "40px auto" }}>
      <h1>Consentimiento Informado</h1>

      <form onSubmit={handleSubmit}>
        {/* Cédula */}
        <div style={{ marginBottom: 12 }}>
          <label>Cédula del paciente</label>
          <input
            type="text"
            name="cedula"
            required
            style={{ width: "100%" }}
          />
        </div>

        {/* Especialista */}
        <div style={{ marginBottom: 12 }}>
          <label>Nombre del especialista</label>
          <input
            type="text"
            name="especialista"
            required
            style={{ width: "100%" }}
          />
        </div>

        {/* Fecha y hora */}
        <div style={{ marginBottom: 12 }}>
          <label>Fecha y hora</label>
          <input
            type="datetime-local"
            name="fechaHora"
            required
            style={{ width: "100%" }}
          />
        </div>

        {/* Archivo */}
        <div style={{ marginBottom: 12 }}>
          <label>Adjuntar consentimiento (PDF o imagen)</label>
          <input
            type="file"
            name="archivo"
            accept=".pdf,image/*"
            required
          />
        </div>

        {/* Botón */}
        <button type="submit" disabled={cargando}>
          {cargando ? "Guardando..." : "Enviar"}
        </button>

        {/* Mensaje */}
        {mensaje && (
          <p style={{ marginTop: 16, fontWeight: "bold" }}>{mensaje}</p>
        )}
      </form>
    </main>
  );
}