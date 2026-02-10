"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./Consentimiento.module.css";

type Modo = "adjuntar" | "firmar" | null;

type Formato = {
  id: string;
  nombre: string;
  descripcionCorta: string;
  pdfPath: string;
};

const PROCEDIMIENTOS_ENFERMERIA = [
  "Cateterismo Venoso Periférico",
  "Paso de sonda vesical Nasogástrica y/o orogástrica",
  "Curaciones",
  "Administración y aplicación de medicamentos",
  "Retiro de puntos",
  "Toma de un electrocardiograma (EKG)",
  "Retiro de Catéter PICC en Domicilio",
] as const;

type Me = {
  id: string;
  username: string;
  nombre: string;
  rol: "ADMINISTRATIVO" | "TECNICO" | "ESPECIALISTA";
};

function formatLocalDatetime(now: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const min = pad(now.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function SignaturePad({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (pngDataUrl: string | null) => void;
}) {
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const safeId = label.replace(/\s+/g, "_");
    const wrap = document.getElementById(`wrap-${safeId}`) as HTMLDivElement | null;
    const canvas = document.getElementById(`canvas-${safeId}`) as HTMLCanvasElement | null;
    if (!wrap || !canvas) return;

    const setup = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.max(1, window.devicePixelRatio || 1);

      canvas.style.width = "100%";
      canvas.style.height = "180px";

      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(180 * dpr);

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";

      if (value) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, rect.width, 180);
        };
        img.src = value;
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    const ro = new ResizeObserver(setup);
    ro.observe(wrap);
    setup();

    return () => ro.disconnect();
  }, [label]);

  const clear = () => {
    const safeId = label.replace(/\s+/g, "_");
    const canvas = document.getElementById(`canvas-${safeId}`) as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange(null);
  };

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    canvas.setPointerCapture(e.pointerId);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setIsDrawing(true);
    const { x, y } = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = e.currentTarget;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getPoint(e);
    ctx.lineTo(x, y);
    ctx.stroke();

    onChange(canvas.toDataURL("image/png"));
  };

  const end = () => setIsDrawing(false);

  const safeId = label.replace(/\s+/g, "_");

  return (
    <div className={styles.signatureBox}>
      <div className={styles.signatureHeader}>
        <span>{label}</span>
        <button type="button" className={styles.smallButton} onClick={clear}>
          Limpiar
        </button>
      </div>

      <div id={`wrap-${safeId}`} className={styles.signatureWrap}>
        <canvas
          id={`canvas-${safeId}`}
          className={styles.signatureCanvas}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        />
      </div>

      <p className={styles.signatureHint}>Firma con tu dedo (móvil) o mouse (PC).</p>
    </div>
  );
}

export default function ConsentimientoPage() {
  const [modo, setModo] = useState<Modo>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [archivoNombre, setArchivoNombre] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [fechaAuto, setFechaAuto] = useState<string>(() => formatLocalDatetime(new Date()));
  const [firmaPaciente, setFirmaPaciente] = useState<string | null>(null);
  const [firmaEspecialista, setFirmaEspecialista] = useState<string | null>(null);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [formatoSeleccionado, setFormatoSeleccionado] = useState<Formato | null>(null);
  const esFO18 = formatoSeleccionado?.id === "FO-HCR-18";
  const esFO11 = formatoSeleccionado?.id === "FO-HCR-11";


  type TerapiaKey = "fisica" | "fonoaudiologia" | "respiratoria" | "ocupacional";

  const [terapias18, setTerapias18] = useState<Record<TerapiaKey, boolean>>({
    fisica: false,
    fonoaudiologia: false,
    respiratoria: false,
    ocupacional: false,
  });

  // Procedimientos (checkbox múltiples) por terapia
  const [proc18, setProc18] = useState<Record<TerapiaKey, Record<string, boolean>>>({
    fisica: {
      evaluacion: false,
      medios_fisicos: false,
      ejercicios_cardiovasculares: false,
      propiocepcion: false,
      fuerza: false,
      equilibrio: false,
      flexibilidad: false,
    },
    fonoaudiologia: {
      evaluacion: false,
      trastornos_comunicacion: false,
      trastornos_habla: false,
      dificultades_lenguaje: false,
      problemas_voz: false,
      trastornos_deglucion: false,
    },
    respiratoria: {
      aspiracion_secreciones: false,
      nebulizacion_inhalatoria: false,
      higiene_bronquial: false,
      rehabilitacion_pulmonar: false,
      cuidados_traqueostomia: false,
      manejo_traqueostomia: false,
      educacion_apoyo: false,
    },
    ocupacional: {
      evaluacion: false,
      motricidad_fina: false,
      motricidad_gruesa: false,
      avd: false,
      sensoriales: false,
      rehabilitacion_funcional: false,
    },
  });

  // “Otro procedimiento” por terapia
  const [otroProc18, setOtroProc18] = useState<Record<TerapiaKey, { activo: boolean; descripcion: string }>>({
    fisica: { activo: false, descripcion: "" },
    fonoaudiologia: { activo: false, descripcion: "" },
    respiratoria: { activo: false, descripcion: "" },
    ocupacional: { activo: false, descripcion: "" },
  });

  // Escala 1/3/5
  const [entendimiento18, setEntendimiento18] = useState<1 | 3 | 5 | null>(null);


  // NUEVOS ESTADOS para aceptación
  const [mostrarModalAceptacion, setMostrarModalAceptacion] = useState(false);
  const [datosTemporales, setDatosTemporales] = useState<FormData | null>(null);

  // ==================
  // FO-HCR-11 (Alta voluntaria) - estados
  // ==================
  const [calidadPaciente11, setCalidadPaciente11] = useState<"SI" | "NO" | "">("");
  const [calidadResponsable11, setCalidadResponsable11] = useState<"SI" | "NO" | "">("");
  const [riesgosAlta11, setRiesgosAlta11] = useState("");
  const [observaciones11, setObservaciones11] = useState("");


  const formatos: Formato[] = useMemo(
    () => [
      {
        id: "FO-HCR-01",
        nombre: "Procedimientos de Enfermería",
        descripcionCorta: "Consentimiento Informado Procedimientos de Enfermería",
        pdfPath: "/consentimientos/FO-HCR-01.pdf",
      },
      {
        id: "FO-HCR-18",
        nombre: "Terapias",
        descripcionCorta: "Consentimiento informado integrado para terapias",
        pdfPath: "/consentimientos/FO-HCR-18.pdf",
      },
      {
        id: "FO-HCR-13",
        nombre: "Telemedicina",
        descripcionCorta: "Consentimiento informado atención modalidad telemedicina",
        pdfPath: "/consentimientos/FO-HCR-13.pdf",
      },
      {
        id: "FO-HCR-19",
        nombre: "Parada cardiaca",
        descripcionCorta: "Consentimiento Informado intervención en caso de paro cardiorrespiratorio",
        pdfPath: "/consentimientos/FO-HCR-19.pdf",
      },
      {
        id: "FO-HCR-20",
        nombre: "Retiro y cambio de traqueostomia",
        descripcionCorta: "Consentimiento Informado retiro y cambio de traqueostomia",
        pdfPath: "/consentimientos/FO-HCR-20.pdf",
      },
      {
        id: "FO-HCR-21",
        nombre: "Retiro de Catéter PICC en Domicilio",
        descripcionCorta: "Consentimiento Informado Retiro de Catéter PICC en Domicilio",
        pdfPath: "/consentimientos/FO-HCR-21.pdf",
      },
      {
        id: "FO-HCR-22",
        nombre: "Atencion Domiciliaria",
        descripcionCorta: "Consentimiento Informado General Atencion Domiciliaria",
        pdfPath: "/consentimientos/FO-HCR-22.pdf",
      },
      {
        id: "FO-HCR-06",
        nombre: "Psicología",
        descripcionCorta: "Consentimiento Informado Psicología",
        pdfPath: "/consentimientos/FO-HCR-06.pdf",
      },
      {
        id: "FO-HCR-11",
        nombre: "Alta Voluntaria",
        descripcionCorta: "Formato Alta Voluntaria",
        pdfPath: "/consentimientos/FO-HCR-11.pdf",
      },
      {
        id: "FO-HCR-07",
        nombre: "Nutrición - NPT",
        descripcionCorta: "Consentimiento Informado nutrición - NPT",
        pdfPath: "/consentimientos/FO-HCR-07.pdf",
      },
    ],
    []
  );

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/me", { method: "GET" });
        if (!r.ok) return;
        const data = (await r.json()) as Me;
        setMe(data);
      } catch {
        // noop
      }
    })();
  }, []);

  useEffect(() => {
    const t = setInterval(() => setFechaAuto(formatLocalDatetime(new Date())), 60_000);
    return () => clearInterval(t);
  }, []);

  const handleAdjuntarSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMensaje(null);
    setCargando(true);

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch("/api/consentimientos", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        setMensaje("✅ Consentimiento guardado correctamente");
        form.reset();
        setArchivoNombre(null);
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

  const handleFirmarSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMensaje(null);
    setCargando(true);

    if (!formatoSeleccionado) {
      setMensaje("❌ Debes seleccionar un formato de consentimiento");
      setCargando(false);
      return;
    }

    if (!firmaPaciente) {
      setMensaje("❌ Falta la firma del paciente");
      setCargando(false);
      return;
    }

    if (!firmaEspecialista) {
      setMensaje("❌ Falta la firma del personal de la salud");
      setCargando(false);
      return;
    }

    const form = e.currentTarget;
    const formData = new FormData(form);

    // Campos especiales: FO-HCR-01 (Procedimientos de Enfermería)
    if (formatoSeleccionado.id === "FO-HCR-01") {
      const diagnostico = String(formData.get("diagnostico") ?? "").trim();
      const procedimiento = String(formData.get("procedimiento") ?? "").trim();

      if (!diagnostico) {
        setMensaje("❌ Falta el diagnóstico");
        setCargando(false);
        return;
      }

      if (!procedimiento) {
        setMensaje("❌ Debes seleccionar el procedimiento a realizar");
        setCargando(false);
        return;
      }
    }

    if (formatoSeleccionado.id === "FO-HCR-18") {
      const algunaTerapia = Object.values(terapias18).some(Boolean);
      if (!algunaTerapia) {
        setMensaje("❌ Debes seleccionar al menos un tipo de terapia");
        setCargando(false);
        return;
      }

      if (entendimiento18 === null) {
        setMensaje("❌ Debes seleccionar el nivel de entendimiento (1, 3 o 5)");
        setCargando(false);
        return;
      }

      // Si “otro procedimiento” está activo, exigir texto
      for (const k of Object.keys(otroProc18) as TerapiaKey[]) {
        if (otroProc18[k].activo && !otroProc18[k].descripcion.trim()) {
          setMensaje(`❌ Falta describir el "Otro procedimiento" para ${k}`);
          setCargando(false);
          return;
        }
      }

      formData.append("terapiasJson", JSON.stringify(terapias18));
      formData.append("procedimientosJson", JSON.stringify(proc18));
      formData.append("otrosJson", JSON.stringify(otroProc18));
      formData.append("entendimiento", String(entendimiento18));
    }

    if (formatoSeleccionado.id === "FO-HCR-11") {
      if (!calidadPaciente11) {
        setMensaje("❌ Debes seleccionar SI o NO en 'Como paciente'");
        setCargando(false);
        return;
      }

      if (!calidadResponsable11) {
        setMensaje("❌ Debes seleccionar SI o NO en 'Como responsable del paciente'");
        setCargando(false);
        return;
      }

      if (!riesgosAlta11.trim()) {
        setMensaje("❌ El campo 'riesgos del alta voluntaria' es obligatorio");
        setCargando(false);
        return;
      }

      if (!observaciones11.trim()) {
        setMensaje("❌ El campo 'Observaciones' es obligatorio");
        setCargando(false);
        return;
      }

      formData.append("calidadPaciente11", calidadPaciente11);
      formData.append("calidadResponsable11", calidadResponsable11);
      formData.append("riesgosAlta11", riesgosAlta11.trim());
      formData.append("observaciones11", observaciones11.trim());
    }



    formData.set("fechaHora", fechaAuto);
    formData.append("formatoId", formatoSeleccionado.id);
    formData.append("firmaPacientePngBase64", firmaPaciente);
    formData.append("firmaEspecialistaPngBase64", firmaEspecialista);

    // NUEVO: Guardar datos temporalmente y mostrar modal de aceptación
    setDatosTemporales(formData);
    setMostrarModalAceptacion(true);
    setCargando(false);
  };

  // NUEVA FUNCIÓN: Enviar consentimiento con estado de aceptación
  const enviarConsentimientoFinal = async (aceptado: boolean) => {
    if (!datosTemporales) return;

    setCargando(true);
    setMensaje(null);
    setMostrarModalAceptacion(false);

    // Agregar el estado de aceptación al FormData
    datosTemporales.append("aceptado", aceptado ? "true" : "false");

    try {
      const response = await fetch("/api/consentimientos/firmados", {
        method: "POST",
        body: datosTemporales,
      });

      if (response.ok) {
        const data = await response.json();
        const mensaje = aceptado
          ? "✅ Consentimiento ACEPTADO y guardado correctamente"
          : "✅ Consentimiento RECHAZADO y registrado correctamente";
        setMensaje(mensaje);

        // Resetear formulario
        const form = document.querySelector("form");
        if (form) form.reset();

        setFormatoSeleccionado(null);
        setFirmaPaciente(null);
        setFirmaEspecialista(null);
        setDatosTemporales(null);
      } else {
        const txt = await response.text().catch(() => "");
        setMensaje(`❌ Error al guardar el consentimiento. ${txt ? `(${txt})` : ""}`.trim());
      }
    } catch (error) {
      console.error(error);
      setMensaje("❌ Error de conexión con el servidor");
    } finally {
      setCargando(false);
    }
  };

  const resetFlujoFirmar = () => {
    setFormatoSeleccionado(null);
    setFirmaPaciente(null);
    setFirmaEspecialista(null);
    setPdfModalOpen(false);
    setDatosTemporales(null);
  };

  return (
    <main className={styles.page}>
      {/* NUEVO: MODAL DE ACEPTACIÓN DEL CONSENTIMIENTO */}
      {mostrarModalAceptacion && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <h2 className={styles.modalTitle}>Confirmación del Consentimiento</h2>
            <p className={styles.modalText}>
              Por favor, confirme si el paciente <strong>ACEPTA</strong> o <strong>NO ACEPTA</strong>
              el procedimiento descrito en el consentimiento informado.
            </p>

            <div className={styles.modalButtons}>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => enviarConsentimientoFinal(true)}
                disabled={cargando}
                style={{
                  backgroundColor: '#059669',
                  borderColor: '#059669'
                }}
              >
                ✅ SÍ, ACEPTO EL CONSENTIMIENTO
              </button>

              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => enviarConsentimientoFinal(false)}
                disabled={cargando}
                style={{
                  backgroundColor: '#dc2626',
                  borderColor: '#dc2626'
                }}
              >
                ❌ NO ACEPTO EL CONSENTIMIENTO
              </button>

              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => {
                  setMostrarModalAceptacion(false);
                  setDatosTemporales(null);
                }}
                disabled={cargando}
              >
                Cancelar y volver
              </button>
            </div>

            <p className={styles.miniHint} style={{ marginTop: '1rem', textAlign: 'center' }}>
              <strong>Nota:</strong> Las firmas se colocarán en la sección correspondiente del PDF.
            </p>
          </div>
        </div>
      )}

      {/* MODAL INICIAL */}
      {modo === null && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <h2 className={styles.modalTitle}>Consentimiento informado</h2>
            <p className={styles.modalText}>
              ¿Quieres adjuntar un documento ya previamente diligenciado o firmar uno nuevo?
            </p>

            <div className={styles.modalButtons}>
              <button className={styles.secondaryButton} onClick={() => setModo("firmar")} type="button">
                Firmar consentimiento
              </button>

              <button className={styles.primaryButton} onClick={() => setModo("adjuntar")} type="button">
                Adjuntar consentimiento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PDF VIEWER */}
      {pdfModalOpen && formatoSeleccionado && (
        <div className={styles.pdfOverlay} role="dialog" aria-modal="true">
          <div className={styles.pdfCard}>
            <div className={styles.pdfHeader}>
              <div>
                <div className={styles.pdfTitle}>Vista previa del consentimiento</div>
                <div className={styles.pdfSubTitle}>{formatoSeleccionado.nombre}</div>
              </div>

              <button
                type="button"
                className={styles.pdfClose}
                onClick={() => setPdfModalOpen(false)}
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <div className={styles.pdfBody}>
              <iframe
                className={styles.pdfFrame}
                src={formatoSeleccionado.pdfPath}
                title="Consentimiento PDF"
              />
            </div>

            <div className={styles.pdfFooter}>
              <a className={styles.pdfDownload} href={formatoSeleccionado.pdfPath} target="_blank" rel="noreferrer">
                Abrir en pestaña nueva
              </a>
              <button type="button" className={styles.primaryButton} onClick={() => setPdfModalOpen(false)}>
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.card}>
        <div className={styles.logo}>
          <img src="/login/logo.png" alt="Logo" width={240} height={240} />
        </div>

        <h1 className={styles.title}>Consentimiento Informado</h1>

        {modo !== null && (
          <button
            className={styles.linkButton}
            onClick={() => {
              setModo(null);
              setMensaje(null);
              resetFlujoFirmar();
            }}
            type="button"
          >
            ← Volver
          </button>
        )}

        {/* MODO ADJUNTAR */}
        {modo === "adjuntar" && (
          <form onSubmit={handleAdjuntarSubmit}>
            <div className={styles.field}>
              <label>Cédula del paciente</label>
              <input type="text" name="cedula" required className={styles.input} />
            </div>

            <div className={styles.field}>
              <label>Fecha y hora</label>
              <div className={styles.dateWrapper}>
                <input type="datetime-local" name="fechaHora" required className={styles.input} defaultValue={fechaAuto} />
                <span className={styles.dateIcon}>📅</span>
              </div>
            </div>

            <div className={styles.field}>
              <label>Adjuntar consentimiento (PDF o imagen)</label>
              <div className={styles.fileWrapper}>
                <input
                  type="file"
                  name="archivo"
                  accept=".pdf,image/*"
                  required
                  className={styles.fileInput}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    setArchivoNombre(file ? file.name : null);
                  }}
                />
                <div className={styles.fileFake}>
                  {archivoNombre ? `📄 Archivo seleccionado: ${archivoNombre}` : "📎 Seleccionar un archivo"}
                </div>
              </div>
            </div>

            <button type="submit" disabled={cargando} className={styles.button}>
              {cargando ? "Guardando..." : "Enviar consentimiento"}
            </button>

            {mensaje && <p className={styles.message}>{mensaje}</p>}
          </form>
        )}

        {/* MODO FIRMAR */}
        {modo === "firmar" && (
          <>
            {!formatoSeleccionado ? (
              <div className={styles.formatoList}>
                <p className={styles.helperText}>Selecciona el formato de consentimiento:</p>

                {formatos.map((f) => (
                  <button
                    key={f.id}
                    className={styles.formatoItem}
                    onClick={() => setFormatoSeleccionado(f)}
                    type="button"
                  >
                    <div className={styles.formatoTitle}>{f.nombre}</div>
                    <div className={styles.formatoDesc}>{f.descripcionCorta}</div>
                  </button>
                ))}
              </div>
            ) : (
              <form onSubmit={handleFirmarSubmit}>
                {/* Plantilla seleccionada + botón Ver PDF */}
                <div className={styles.section}>
                  <div className={styles.templateRow}>
                    <div>
                      <div className={styles.templateLabel}>Plantilla seleccionada</div>
                      <div className={styles.templateName}>{formatoSeleccionado.nombre}</div>
                      <div className={styles.templateHint}>
                        Puedes leer el consentimiento original antes de firmar.
                      </div>
                    </div>

                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => setPdfModalOpen(true)}
                    >
                      Ver consentimiento (PDF)
                    </button>
                  </div>
                </div>

                {/* Datos del especialista autollenados */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Datos del personal de la salud</h3>

                  <div className={styles.grid2}>
                    <div className={styles.field}>
                      <label>Nombre</label>
                      <input
                        type="text"
                        className={styles.input}
                        value={me?.nombre ?? ""}
                        readOnly
                        placeholder="Cargando..."
                      />
                    </div>

                    <div className={styles.field}>
                      <label>Usuario</label>
                      <input
                        type="text"
                        className={styles.input}
                        value={me?.username ?? ""}
                        readOnly
                        placeholder="Cargando..."
                      />
                    </div>
                  </div>
                </div>

                {/* Fecha actual autollenada */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Fecha y hora</h3>
                  <div className={styles.field}>
                    <label>Fecha y hora actual</label>
                    <div className={styles.dateWrapper}>
                      <input type="datetime-local" name="fechaHora" className={styles.input} value={fechaAuto} readOnly />
                      <span className={styles.dateIcon}>📅</span>
                    </div>
                    <p className={styles.miniHint}>(El PDF se genera con fecha/hora del servidor)</p>
                  </div>
                </div>

                {/* Datos del paciente manuales */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Datos del paciente o acudiente</h3>

                  <div className={styles.grid2}>
                    <div className={styles.field}>
                      <label>Primer apellido</label>
                      <input type="text" name="pacientePrimerApellido" required className={styles.input} />
                    </div>

                    <div className={styles.field}>
                      <label>Segundo apellido</label>
                      <input type="text" name="pacienteSegundoApellido" required className={styles.input} />
                    </div>

                    <div className={styles.field}>
                      <label>Nombres</label>
                      <input type="text" name="pacienteNombres" required className={styles.input} />
                    </div>

                    <div className={styles.field}>
                      <label>N° documento</label>
                      <input type="text" name="cedula" required className={styles.input} />
                    </div>

                    <div className={styles.field}>
                      <label>Edad</label>
                      <input type="number" name="pacienteEdad" required className={styles.input} min={0} max={150} />
                    </div>

                    <div className={styles.field}>
                      <label>Teléfono</label>
                      <input type="tel" name="pacienteTelefono" required className={styles.input} />
                    </div>
                  </div>
                </div>
                {esFO18 && (
                  <section className={styles.fo18Card}>
                    <div className={styles.fo18Header}>
                      <h3 className={styles.fo18Title}>Terapias</h3>
                      <p className={styles.fo18Subtitle}>
                        Selecciona el tipo de terapia y los procedimientos. Puedes marcar varios.
                      </p>
                    </div>

                    {/* Terapias */}
                    <div className={styles.fo18Section}>
                      <div className={styles.fo18SectionTitle}>Tipo de terapia</div>

                      <div className={styles.fo18TherapyGrid}>
                        {[
                          { key: "fisica", label: "Terapia Física (Fisioterapia)" },
                          { key: "fonoaudiologia", label: "Terapia del Lenguaje (Fonoaudiología)" },
                          { key: "respiratoria", label: "Terapia Respiratoria" },
                          { key: "ocupacional", label: "Terapia Ocupacional" },
                        ].map((t) => (
                          <label key={t.key} className={styles.fo18TherapyItem}>
                            <input
                              className={styles.fo18Checkbox}
                              type="checkbox"
                              checked={terapias18[t.key as keyof typeof terapias18]}
                              onChange={(e) =>
                                setTerapias18((s) => ({ ...s, [t.key]: e.target.checked }))
                              }
                            />
                            <span>{t.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className={styles.fo18Divider} />

                    {/* Procedimientos por terapia */}
                    <div className={styles.fo18Section}>
                      <div className={styles.fo18SectionTitle}>Procedimientos</div>

                      {terapias18.fisica && (
                        <div className={styles.fo18TherapyCard}>
                          <div className={styles.fo18TherapyCardTitle}>Fisioterapia</div>

                          <div className={styles.fo18ProcGrid}>
                            {Object.entries(proc18.fisica).map(([k, v]) => (
                              <label key={k} className={styles.fo18ProcItem}>
                                <input
                                  className={styles.fo18Checkbox}
                                  type="checkbox"
                                  checked={v}
                                  onChange={(e) =>
                                    setProc18((s) => ({
                                      ...s,
                                      fisica: { ...s.fisica, [k]: e.target.checked },
                                    }))
                                  }
                                />
                                <span>{k.replaceAll("_", " ")}</span>
                              </label>
                            ))}
                          </div>

                          <div className={styles.fo18OtherRow}>
                            <label className={styles.fo18ProcItem}>
                              <input
                                className={styles.fo18Checkbox}
                                type="checkbox"
                                checked={otroProc18.fisica.activo}
                                onChange={(e) =>
                                  setOtroProc18((s) => ({
                                    ...s,
                                    fisica: { ...s.fisica, activo: e.target.checked },
                                  }))
                                }
                              />
                              <span>Otro procedimiento</span>
                            </label>

                            <input
                              className={styles.fo18OtherInput}
                              value={otroProc18.fisica.descripcion}
                              onChange={(e) =>
                                setOtroProc18((s) => ({
                                  ...s,
                                  fisica: { ...s.fisica, descripcion: e.target.value },
                                }))
                              }
                              placeholder="Describe el procedimiento…"
                              disabled={!otroProc18.fisica.activo}
                            />
                          </div>
                        </div>
                      )}

                      {terapias18.fonoaudiologia && (
                        <div className={styles.fo18TherapyCard}>
                          <div className={styles.fo18TherapyCardTitle}>Fonoaudiología</div>

                          <div className={styles.fo18ProcGrid}>
                            {Object.entries(proc18.fonoaudiologia).map(([k, v]) => (
                              <label key={k} className={styles.fo18ProcItem}>
                                <input
                                  className={styles.fo18Checkbox}
                                  type="checkbox"
                                  checked={v}
                                  onChange={(e) =>
                                    setProc18((s) => ({
                                      ...s,
                                      fonoaudiologia: {
                                        ...s.fonoaudiologia,
                                        [k]: e.target.checked,
                                      },
                                    }))
                                  }
                                />
                                <span>{k.replaceAll("_", " ")}</span>
                              </label>
                            ))}
                          </div>

                          {/* <div className={styles.fo18OtherRow}>
                            <label className={styles.fo18ProcItem}>
                              <input
                                className={styles.fo18Checkbox}
                                type="checkbox"
                                checked={otroProc18.fonoaudiologia.activo}
                                onChange={(e) =>
                                  setOtroProc18((s) => ({
                                    ...s,
                                    fonoaudiologia: {
                                      ...s.fonoaudiologia,
                                      activo: e.target.checked,
                                    },
                                  }))
                                }
                              />
                              <span>Otro procedimiento</span>
                            </label>

                            <input
                              className={styles.fo18OtherInput}
                              value={otroProc18.fonoaudiologia.descripcion}
                              onChange={(e) =>
                                setOtroProc18((s) => ({
                                  ...s,
                                  fonoaudiologia: {
                                    ...s.fonoaudiologia,
                                    descripcion: e.target.value,
                                  },
                                }))
                              }
                              placeholder="Describe el procedimiento…"
                              disabled={!otroProc18.fonoaudiologia.activo}
                            />
                          </div> */}
                        </div>
                      )}

                      {terapias18.respiratoria && (
                        <div className={styles.fo18TherapyCard}>
                          <div className={styles.fo18TherapyCardTitle}>Terapia Respiratoria</div>

                          <div className={styles.fo18ProcGrid}>
                            {Object.entries(proc18.respiratoria).map(([k, v]) => (
                              <label key={k} className={styles.fo18ProcItem}>
                                <input
                                  className={styles.fo18Checkbox}
                                  type="checkbox"
                                  checked={v}
                                  onChange={(e) =>
                                    setProc18((s) => ({
                                      ...s,
                                      respiratoria: { ...s.respiratoria, [k]: e.target.checked },
                                    }))
                                  }
                                />
                                <span>{k.replaceAll("_", " ")}</span>
                              </label>
                            ))}
                          </div>

                          <div className={styles.fo18OtherRow}>
                            <label className={styles.fo18ProcItem}>
                              <input
                                className={styles.fo18Checkbox}
                                type="checkbox"
                                checked={otroProc18.respiratoria.activo}
                                onChange={(e) =>
                                  setOtroProc18((s) => ({
                                    ...s,
                                    respiratoria: {
                                      ...s.respiratoria,
                                      activo: e.target.checked,
                                    },
                                  }))
                                }
                              />
                              <span>Otro procedimiento</span>
                            </label>

                            <input
                              className={styles.fo18OtherInput}
                              value={otroProc18.respiratoria.descripcion}
                              onChange={(e) =>
                                setOtroProc18((s) => ({
                                  ...s,
                                  respiratoria: {
                                    ...s.respiratoria,
                                    descripcion: e.target.value,
                                  },
                                }))
                              }
                              placeholder="Describe el procedimiento…"
                              disabled={!otroProc18.respiratoria.activo}
                            />
                          </div>
                        </div>
                      )}

                      {terapias18.ocupacional && (
                        <div className={styles.fo18TherapyCard}>
                          <div className={styles.fo18TherapyCardTitle}>Terapia Ocupacional</div>

                          <div className={styles.fo18ProcGrid}>
                            {Object.entries(proc18.ocupacional).map(([k, v]) => (
                              <label key={k} className={styles.fo18ProcItem}>
                                <input
                                  className={styles.fo18Checkbox}
                                  type="checkbox"
                                  checked={v}
                                  onChange={(e) =>
                                    setProc18((s) => ({
                                      ...s,
                                      ocupacional: { ...s.ocupacional, [k]: e.target.checked },
                                    }))
                                  }
                                />
                                <span>{k.replaceAll("_", " ")}</span>
                              </label>
                            ))}
                          </div>

                          <div className={styles.fo18OtherRow}>
                            <label className={styles.fo18ProcItem}>
                              <input
                                className={styles.fo18Checkbox}
                                type="checkbox"
                                checked={otroProc18.ocupacional.activo}
                                onChange={(e) =>
                                  setOtroProc18((s) => ({
                                    ...s,
                                    ocupacional: { ...s.ocupacional, activo: e.target.checked },
                                  }))
                                }
                              />
                              <span>Otro procedimiento</span>
                            </label>

                            <input
                              className={styles.fo18OtherInput}
                              value={otroProc18.ocupacional.descripcion}
                              onChange={(e) =>
                                setOtroProc18((s) => ({
                                  ...s,
                                  ocupacional: {
                                    ...s.ocupacional,
                                    descripcion: e.target.value,
                                  },
                                }))
                              }
                              placeholder="Describe el procedimiento…"
                              disabled={!otroProc18.ocupacional.activo}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className={styles.fo18Divider} />

                    {/* Entendimiento */}
                    <div className={styles.fo18Section}>
                      <div className={styles.fo18SectionTitle}>Entendimiento del consentimiento (Paciente)</div>
                      <p className={styles.fo18Subtitle}>
                        Apreciado usuario califique en una escala de 1, 3 o 5 el entendiiento referente al consentimiento informado:
                      </p>

                      <div className={styles.fo18RadioRow}>
                        {[
                          { v: 1 as const, label: "1 — No comprendido" },
                          { v: 3 as const, label: "3 — Medianamente comprendido" },
                          { v: 5 as const, label: "5 — Comprendido completamente" },
                        ].map((opt) => (
                          <label key={opt.v} className={styles.fo18RadioItem}>
                            <input
                              type="radio"
                              checked={entendimiento18 === opt.v}
                              onChange={() => setEntendimiento18(opt.v)}
                            />
                            <span>{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </section>
                )}


                {esFO11 && (
                  <section className={styles.fo18Card}>
                    <div className={styles.fo18Header}>
                      <h3 className={styles.fo18Title}>Alta voluntaria</h3>
                      <p className={styles.fo18Subtitle}>
                        Completa los campos obligatorios para generar el consentimiento.
                      </p>
                    </div>

                    {/* Calidad */}
                    <div className={styles.fo18Section}>
                      <div className={styles.fo18SectionTitle}>CALIDAD EN LA QUE SE OTORGA ESTA ALTA VOLUNTARIA</div>

                      <div className={styles.fo18TherapyCard}>
                        <div className={styles.fo18TherapyCardTitle}>Como paciente</div>

                        <div className={styles.fo18RadioRow} style={{ gridTemplateColumns: "repeat(2, minmax(0,1fr))" }}>
                          {[
                            { v: "SI" as const, label: "SI" },
                            { v: "NO" as const, label: "NO" },
                          ].map((opt) => (
                            <label key={opt.v} className={styles.fo18RadioItem}>
                              <input
                                type="radio"
                                checked={calidadPaciente11 === opt.v}
                                onChange={() => setCalidadPaciente11(opt.v)}
                              />
                              <span>{opt.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className={styles.fo18TherapyCard}>
                        <div className={styles.fo18TherapyCardTitle}>
                          Como responsable del paciente
                          <div className={styles.fo18Subtitle}>
                            (Padre o Madre si es menor; representante legal, familiar representante u otras personas que figuren como tales en la Historia Clínica.)
                          </div>
                        </div>

                        <div className={styles.fo18RadioRow} style={{ gridTemplateColumns: "repeat(2, minmax(0,1fr))" }}>
                          {[
                            { v: "SI" as const, label: "SI" },
                            { v: "NO" as const, label: "NO" },
                          ].map((opt) => (
                            <label key={opt.v} className={styles.fo18RadioItem}>
                              <input
                                type="radio"
                                checked={calidadResponsable11 === opt.v}
                                onChange={() => setCalidadResponsable11(opt.v)}
                              />
                              <span>{opt.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className={styles.fo18Divider} />

                    {/* Textos obligatorios */}
                    <div className={styles.fo18Section}>
                      <div className={styles.fo18SectionTitle}>Se me ha explicado que los riesgos del alta voluntaria son:</div>
                      <textarea
                        className={styles.fo18Textarea}
                        value={riesgosAlta11}
                        onChange={(e) => setRiesgosAlta11(e.target.value)}
                        placeholder="Escriba aquí los riesgos..."
                        required
                        rows={6}
                      />
                    </div>

                    <div className={styles.fo18Section}>
                      <div className={styles.fo18SectionTitle}>Observaciones</div>
                      <textarea
                        className={styles.fo18Textarea}
                        value={observaciones11}
                        onChange={(e) => setObservaciones11(e.target.value)}
                        placeholder="Escriba aquí las observaciones..."
                        required
                        rows={6}
                      />
                    </div>
                  </section>
                )}



                {/* Campos especiales FO-HCR-01 */}
                {formatoSeleccionado.id === "FO-HCR-01" && (
                  <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>Procedimiento de Enfermería</h3>

                    <div className={styles.field}>
                      <label>Diagnóstico</label>
                      <input
                        type="text"
                        name="diagnostico"
                        required
                        className={styles.input}
                        placeholder="Escribe el diagnóstico indicado en la historia clínica"
                      />
                    </div>

                    <div className={styles.field}>
                      <label>Procedimiento a realizar</label>
                      <select name="procedimiento" required className={styles.input} defaultValue="">
                        <option value="" disabled>
                          Selecciona una opción
                        </option>
                        {PROCEDIMIENTOS_ENFERMERIA.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                      <p className={styles.miniHint}>
                        (Se marcará una “X” en el PDF en la opción seleccionada)
                      </p>
                    </div>
                  </div>
                )}

                {/* Firmas */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Firmas</h3>

                  <SignaturePad label="Firma del paciente o acudiente" value={firmaPaciente} onChange={setFirmaPaciente} />
                  <SignaturePad label="Firma del personal de la salud" value={firmaEspecialista} onChange={setFirmaEspecialista} />
                </div>

                <div className={styles.actionsRow}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => setFormatoSeleccionado(null)}
                    disabled={cargando}
                  >
                    Cambiar formato
                  </button>

                  <button type="submit" disabled={cargando} className={styles.primaryButton}>
                    {cargando ? "Procesando..." : "Continuar a confirmación"}
                  </button>
                </div>

                {mensaje && <p className={styles.message}>{mensaje}</p>}
              </form>
            )}
          </>
        )}
      </div>
    </main>
  );
}