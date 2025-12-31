"use client";

import { useState } from "react";
import styles from "./Consentimiento.module.css";

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
      form.reset();
    } else {
      setMensaje("❌ Error al guardar el consentimiento. Comprueba tu conexión a internet o intenta mas tarde");
       }
   } catch (error) {
    console.error(error);
    setMensaje("❌ Error de conexión con el servidor. Comprueba tu conexión a internet o intenta mas tarde");
  } finally {
    setCargando(false);
  }
};

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        {/* Logo */}
        <div className={styles.logo}>
          <img
            src="https://bukwebapp-enterprise-colombia.s3.amazonaws.com/0720f0bf-67ea-4055-87c0-0c415b591db4/generals/logo_login/logo_login.png"
            alt="Logo"
          />
        </div>
      <h1 className={styles.title}  >Consentimiento Informado</h1>

      <form onSubmit={handleSubmit}>
        {/* Cédula */}
        <div className={styles.field}>
          <label>Cédula del paciente</label>
          <input
            type="text"
            name="cedula"
            required
            className={styles.input}
          />
        </div>

        {/* Especialista */}
        <div className={styles.field}>
          <label>Nombre del especialista</label>
          <input
            type="text"
            name="especialista"
            required
            className={styles.input}
          />
        </div>

        {/* Fecha y hora */}
        <div className={styles.field}>
          <label>Fecha y hora</label>
          <input
            type="datetime-local"
            name="fechaHora"
            required
            className={styles.field}
          />
        </div>

        {/* Archivo */}
        <div className={styles.field}>
          <label>Adjuntar consentimiento (PDF o imagen)</label>
          <input
            type="file"
            name="archivo"
            accept=".pdf,image/*"
            required
            className={styles.fileInput}
          />
        </div>

        {/* Botón */}
        <button type="submit" disabled={cargando} className={styles.button}>
          {cargando ? "Guardando..." : "Enviar consentimiento"}
        </button>

        {/* Mensaje */}
        {mensaje && (
          <p className={styles.message}>{mensaje}</p>
        )}
      </form>
      </div>
    </main>
     );
}