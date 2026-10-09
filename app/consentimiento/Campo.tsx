"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./Consentimiento.module.css";
import { caracteresNoPermitidos, limpiarCampo, normalizarCampo, validarCampo } from "@/lib/validacionCampos";
import type { ReglaCampo } from "@/lib/validacionCampos";

type CampoProps = {
  etiqueta: string;
  name: string;
  regla: ReglaCampo;
  opcional?: boolean;
  /** Ocupa las dos columnas de la grilla. */
  ancho?: boolean;
  type?: "text" | "tel";
  placeholder?: string;
  defaultValue?: string;
  /** Con este dato el campo es de varias lineas. */
  filas?: number;
};

/**
 * Campo de texto validado con su regla. El error se muestra debajo y ademas
 * se registra en el navegador, que no deja continuar mientras el valor no cumpla.
 */
export function Campo({
  etiqueta,
  name,
  regla,
  opcional = false,
  ancho = false,
  type = "text",
  placeholder,
  defaultValue,
  filas,
}: CampoProps) {
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);

  const revisar = useCallback(
    (el: HTMLInputElement | HTMLTextAreaElement, alSalir: boolean, componiendo = false) => {
      // Mientras el teclado compone una palabra (acentos, moviles) no se toca el valor.
      if (!componiendo) {
        const limpio = alSalir ? normalizarCampo(limpiarCampo(regla, el.value)) : limpiarCampo(regla, el.value);
        if (limpio !== el.value) el.value = limpio;
      }

      const mensaje = validarCampo(regla, el.value);
      el.setCustomValidity(mensaje);
      setError(mensaje);
      // Un signo no permitido se avisa al escribirlo; lo demas, al salir del campo.
      const signoInvalido = caracteresNoPermitidos(regla, el.value).length > 0;
      setVisible((antes) => mensaje !== "" && (alSalir || antes || signoInvalido));
    },
    [regla]
  );

  // Revisa el valor precargado y lo vuelve a revisar si cambia la regla (tipo de documento).
  useEffect(() => {
    if (ref.current) revisar(ref.current, true);
  }, [revisar]);

  const comunes = {
    name,
    required: !opcional,
    placeholder,
    defaultValue,
    // En campos numericos el largo lo recorta la regla: maxLength truncaria un numero pegado con espacios.
    maxLength: regla.numerico ? undefined : regla.max,
    "aria-invalid": visible,
    onInput: (e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      revisar(e.currentTarget, false, (e.nativeEvent as InputEvent).isComposing),
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => revisar(e.currentTarget, true),
  };

  return (
    <div className={ancho ? `${styles.field} ${styles.fieldFull}` : styles.field}>
      <label>{etiqueta}</label>
      {filas ? (
        <textarea
          {...comunes}
          ref={(el) => {
            ref.current = el;
          }}
          rows={filas}
          className={styles.fo18Textarea}
        />
      ) : (
        <input
          {...comunes}
          ref={(el) => {
            ref.current = el;
          }}
          type={type}
          inputMode={regla.numerico ? "numeric" : undefined}
          autoComplete="off"
          className={visible ? `${styles.input} ${styles.inputInvalido}` : styles.input}
        />
      )}
      {visible && <p className={styles.fieldError}>{error}</p>}
    </div>
  );
}

type CampoFechaProps = {
  etiqueta: string;
  name: string;
  rango: { min: string; max: string };
  /** Devuelve el mensaje de error o "" si la fecha sirve. */
  validar: (fecha: string) => string;
  value?: string;
  onChange?: (fecha: string) => void;
};

export function CampoFecha({ etiqueta, name, rango, validar, value, onChange }: CampoFechaProps) {
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);

  // Al escribir el año el navegador pasa por valores intermedios (0001, 0019...):
  // el error solo se muestra al salir del campo.
  const revisar = (el: HTMLInputElement, alSalir: boolean) => {
    const mensaje = validar(el.value);
    el.setCustomValidity(mensaje);
    setError(mensaje);
    setVisible((antes) => mensaje !== "" && (alSalir || antes));
  };

  return (
    <div className={styles.field}>
      <label>{etiqueta}</label>
      <input
        type="date"
        name={name}
        required
        min={rango.min}
        max={rango.max}
        aria-invalid={visible}
        className={visible ? `${styles.input} ${styles.inputInvalido}` : styles.input}
        value={value}
        onChange={(e) => {
          onChange?.(e.target.value);
          revisar(e.currentTarget, false);
        }}
        onBlur={(e) => revisar(e.currentTarget, true)}
      />
      {visible && <p className={styles.fieldError}>{error}</p>}
    </div>
  );
}
