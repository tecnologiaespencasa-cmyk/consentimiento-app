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

  // NUEVOS ESTADOS para aceptación
  const [mostrarModalAceptacion, setMostrarModalAceptacion] = useState(false);
  const [datosTemporales, setDatosTemporales] = useState<FormData | null>(null);

  const formatos: Formato[] = useMemo(
    () => [
      {
        id: "FO-HCR-13",
        nombre: "Telemedicina (FO-HCR-13)",
        descripcionCorta: "Consentimiento informado atención modalidad telemedicina",
        pdfPath: "/consentimientos/FO-HCR-13.pdf",
      },
      {
        id: "FO-HCR-21",
        nombre: "Retiro de Catéter PICC en Domicilio (FO-HCR-21)",
        descripcionCorta: "Consentimiento Informado Retiro de Catéter PICC en Domicilio",
        pdfPath: "/consentimientos/FO-HCR-21.pdf",
      },
      {
        id: "FORM-3",
        nombre: "Formato 3",
        descripcionCorta: "Otro consentimiento",
        pdfPath: "/consentimientos/FORM-3.pdf",
      },
      {
        id: "FORM-4",
        nombre: "Formato 4",
        descripcionCorta: "Otro consentimiento",
        pdfPath: "/consentimientos/FORM-4.pdf",
      },
      {
        id: "FORM-5",
        nombre: "Formato 5",
        descripcionCorta: "Otro consentimiento",
        pdfPath: "/consentimientos/FORM-5.pdf",
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
                  <h3 className={styles.sectionTitle}>Datos del especialista</h3>

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
                  <h3 className={styles.sectionTitle}>Datos del paciente</h3>

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