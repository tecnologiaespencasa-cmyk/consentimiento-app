"use client";

import { useState } from "react";

export default function ConsentimientoPage() {
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMensaje(null);
    setCargando(true);
    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch("/api/consentimiento", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        setMensaje("✅ Consentimiento guardado correctamente");
        form.reset();
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
    <main
      style={{
        minHeight: "100vh",
        background: "#f4f6f8",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          background: "#ffffff",
          padding: 30,
          borderRadius: 10,
          width: "100%",
          maxWidth: 480,
          boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
        }}
      >
        {/* LOGO */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <img
            src="https://media.licdn.com/dms/image/v2/D5616AQG6F-vet15myg/profile-displaybackgroundimage-shrink_200_800/profile-displaybackgroundimage-shrink_200_800/0/1665575367807?e=2147483647&v=beta&t=Kc2dOqB7r17StLmF3_Vf2el9jFGNErLVwSQem-Fz1rY"
            alt="Logo"
            style={{ maxWidth: "100%", height: "auto" }}
          />
        </div>

        <h1 style={{ textAlign: "center", marginBottom: 24 }}>
          Consentimiento Informado
        </h1>

        <form onSubmit={handleSubmit}>
          {/* Cédula */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 6 }}>
              Cédula del paciente
            </label>
            <input
              type="text"
              name="cedula"
              required
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 6,
                border: "1px solid #ccc",
              }}
            />
          </div>

          {/* Especialista */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 6 }}>
              Nombre del especialista
            </label>
            <input
              type="text"
              name="especialista"
              required
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 6,
                border: "1px solid #ccc",
              }}
            />
          </div>

          {/* Fecha y hora */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 6 }}>
              Fecha y hora
            </label>
            <input
              type="datetime-local"
              name="fechaHora"
              required
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 6,
                border: "1px solid #ccc",
              }}
            />
          </div>

          {/* Archivo */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", marginBottom: 6 }}>
              Adjuntar consentimiento (PDF o imagen)
            </label>
            <input
              type="file"
              name="archivo"
              accept=".pdf,image/*"
              required
            />
          </div>

          {/* Botón */}
          <button
            type="submit"
            disabled={cargando}
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 6,
              border: "none",
              background: cargando ? "#999" : "#2563eb",
              color: "#fff",
              fontSize: 16,
              cursor: cargando ? "not-allowed" : "pointer",
            }}
          >
            {cargando ? "Guardando..." : "Enviar"}
          </button>

          {/* Mensaje */}
          {mensaje && (
            <p
              style={{
                marginTop: 16,
                fontWeight: "bold",
                textAlign: "center",
              }}
            >
              {mensaje}
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
