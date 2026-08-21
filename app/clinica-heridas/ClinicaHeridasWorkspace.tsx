"use client";

import { FormEvent, useState } from "react";
import toast from "react-hot-toast";
import { CATALOGOS, esOpcionValida } from "@/lib/clinicaHeridasCatalogos";
import {
  FaCamera,
  FaCheckCircle,
  FaExternalLinkAlt,
  FaNotesMedical,
  FaPlusCircle,
  FaSearch,
  FaUserCheck,
  FaUserSlash,
} from "react-icons/fa";

/**
 * Pantalla del modulo Clinica de Heridas.
 *
 * PRIVACIDAD (lado navegador):
 *   - El documento vive solo en el estado de React mientras hay un paciente
 *     abierto: hace falta para nombrar su carpeta de SharePoint la primera vez.
 *     Se borra al cerrar el paciente. No se guarda en localStorage, ni en
 *     sessionStorage, ni en cookies, ni en la URL.
 *   - La busqueda es POST; nunca GET.
 *   - Las fotos se abren por el endpoint del portal, nunca por la URL directa
 *     de SharePoint (que contiene el nombre y el documento del paciente).
 *   - Al guardar solo viaja pacienteRef: el nombre no se persiste en Neon.
 */

type TipoFoto = "PLANO_GENERAL" | "MEDIDA_VERTICAL" | "MEDIDA_HORIZONTAL" | "LATERAL";

type Foto = { id: string; tipo: TipoFoto; nombre: string };

type Seguimiento = {
  id: string;
  numero: number;
  createdAt: string;
  origen: string;
  ubicacion: string;
  diametroVerticalCm: number;
  diametroHorizontalCm: number;
  profundidadCm: number;
  fondo: string;
  lecho: string;
  tejido: string;
  exudadoCantidad: string;
  exudadoCaracteristicas: string;
  registradoPor: string;
  fotos: Foto[];
};

type Paciente = {
  nombre: string;
  pacienteRef: string;
  documentoMascarado: string;
};

// Campos parametrizados: cada uno se pinta como desplegable con las opciones
// de su catalogo, de modo que no haya variantes de grafia entre seguimientos.
const CAMPOS_HERIDA = [
  { clave: "origen", etiqueta: "Origen" },
  { clave: "ubicacion", etiqueta: "Ubicación" },
  { clave: "fondo", etiqueta: "Fondo" },
  { clave: "lecho", etiqueta: "Lecho" },
  { clave: "tejido", etiqueta: "Tejido" },
] as const;

const CAMPOS_EXUDADO = [
  { clave: "exudadoCantidad", etiqueta: "Cantidad" },
  { clave: "exudadoCaracteristicas", etiqueta: "Características" },
] as const;

const MEDIDAS_HERIDA = [
  { clave: "diametroVerticalCm", etiqueta: "Diámetro vertical (cm)" },
  { clave: "diametroHorizontalCm", etiqueta: "Diámetro horizontal (cm)" },
  { clave: "profundidadCm", etiqueta: "Profundidad (cm)" },
] as const;

const FOTOS: { tipo: TipoFoto; etiqueta: string }[] = [
  { tipo: "PLANO_GENERAL", etiqueta: "Foto plano general" },
  { tipo: "MEDIDA_VERTICAL", etiqueta: "Foto medida vertical" },
  { tipo: "MEDIDA_HORIZONTAL", etiqueta: "Foto medida horizontal" },
  { tipo: "LATERAL", etiqueta: "Foto lateral" },
];

type ClaveTexto =
  | (typeof CAMPOS_HERIDA)[number]["clave"]
  | (typeof CAMPOS_EXUDADO)[number]["clave"];
type ClaveMedida = (typeof MEDIDAS_HERIDA)[number]["clave"];

const FORM_INICIAL: Record<ClaveTexto | ClaveMedida, string> = {
  origen: "",
  ubicacion: "",
  fondo: "",
  lecho: "",
  tejido: "",
  exudadoCantidad: "",
  exudadoCaracteristicas: "",
  diametroVerticalCm: "",
  diametroHorizontalCm: "",
  profundidadCm: "",
};

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bogota",
  });
}

export default function ClinicaHeridasWorkspace() {
  const [documentoBusqueda, setDocumentoBusqueda] = useState("");
  const [documentoSesion, setDocumentoSesion] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const [seguimientos, setSeguimientos] = useState<Seguimiento[]>([]);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [form, setForm] = useState(FORM_INICIAL);
  const [archivos, setArchivos] = useState<Partial<Record<TipoFoto, File>>>({});
  // Progreso del guardado: alimenta el modal de carga. El alta del seguimiento
  // y cada foto son peticiones separadas, asi que el usuario ve en que paso va.
  const [progreso, setProgreso] = useState<{
    titulo: string;
    hechos: number;
    total: number;
  } | null>(null);

  const seguimientoActual = seguimientos.find((s) => s.id === seleccionado) ?? null;
  const ultimo = seguimientos.length ? seguimientos[seguimientos.length - 1] : null;
  const proximoNumero = (ultimo?.numero ?? 0) + 1;

  function cerrarPaciente() {
    setPaciente(null);
    setNoEncontrado(false);
    setSeguimientos([]);
    setSeleccionado(null);
    setCreando(false);
    setForm(FORM_INICIAL);
    setArchivos({});
    setDocumentoBusqueda("");
    setDocumentoSesion("");
  }

  async function buscar(event: FormEvent) {
    event.preventDefault();
    if (buscando) return;

    const valor = documentoBusqueda.trim();
    if (!valor) {
      toast.error("Ingresa el documento del paciente.");
      return;
    }

    setBuscando(true);
    setPaciente(null);
    setNoEncontrado(false);
    setSeguimientos([]);
    setSeleccionado(null);
    setCreando(false);

    try {
      const respuesta = await fetch("/api/clinica-heridas/buscar-paciente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ documento: valor }),
      });
      const datos = await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(datos?.error || "No fue posible realizar la consulta. Intente nuevamente.");
      }

      if (datos.encontrado === true) {
        setPaciente(datos.paciente);
        // Se conserva en memoria mientras el paciente este abierto: es lo que
        // da nombre a su carpeta de SharePoint la primera vez.
        setDocumentoSesion(valor);
        const historico: Seguimiento[] = datos.seguimientos ?? [];
        setSeguimientos(historico);
        setSeleccionado(historico.length ? historico[historico.length - 1].id : null);
        toast.success(
          historico.length
            ? `Paciente encontrado con ${historico.length} seguimiento(s).`
            : "Paciente encontrado.",
        );
      } else {
        setNoEncontrado(true);
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No fue posible realizar la consulta. Intente nuevamente.",
      );
    } finally {
      setDocumentoBusqueda("");
      setBuscando(false);
    }
  }

  /**
   * Abre el formulario del siguiente seguimiento precargando el anterior.
   *
   * Solo se arrastran los valores que siguen perteneciendo al catalogo: un
   * seguimiento antiguo puede tener texto libre de antes de parametrizar los
   * campos, y precargarlo dejaria el desplegable visualmente vacio pero con un
   * valor invalido en el estado. En ese caso se deja en blanco para que el
   * profesional elija una opcion valida.
   */
  function nuevoSeguimiento() {
    if (ultimo) {
      const heredar = (clave: ClaveTexto) =>
        esOpcionValida(clave, ultimo[clave]) ? ultimo[clave] : "";
      setForm({
        origen: heredar("origen"),
        ubicacion: heredar("ubicacion"),
        fondo: heredar("fondo"),
        lecho: heredar("lecho"),
        tejido: heredar("tejido"),
        exudadoCantidad: heredar("exudadoCantidad"),
        exudadoCaracteristicas: heredar("exudadoCaracteristicas"),
        // Las medidas siempre se toman de nuevo: son el objeto del seguimiento.
        diametroVerticalCm: "",
        diametroHorizontalCm: "",
        profundidadCm: "",
      });
    } else {
      setForm(FORM_INICIAL);
    }
    setArchivos({});
    setCreando(true);
    setSeleccionado(null);
  }

  async function guardar(event: FormEvent) {
    event.preventDefault();
    if (guardando || !paciente) return;

    // Un paso por el alta del seguimiento y uno por cada foto seleccionada.
    const pendientes = FOTOS.filter(({ tipo }) => archivos[tipo]);
    const totalPasos = 1 + pendientes.length;

    setGuardando(true);
    setProgreso({ titulo: "Registrando el seguimiento...", hechos: 0, total: totalPasos });
    try {
      const respuesta = await fetch("/api/clinica-heridas/seguimientos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pacienteRef: paciente.pacienteRef,
          // Solo para nombrar la carpeta de SharePoint; no se guardan en Neon.
          pacienteNombre: paciente.nombre,
          documento: documentoSesion,
          ...form,
        }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        throw new Error(datos?.error || "No fue posible guardar el seguimiento.");
      }

      const seguimientoId: string = datos.seguimiento.id;
      const numero: number = datos.seguimiento.numero;

      // Las fotos se suben una a una: cada archivo va directo a SharePoint y en
      // Neon solo queda su referencia.
      const subidas: Foto[] = [];
      let fallidas = 0;
      let hechos = 1;
      for (const { tipo, etiqueta } of pendientes) {
        const archivo = archivos[tipo];
        if (!archivo) continue;
        setProgreso({ titulo: `Subiendo ${etiqueta.toLowerCase()}...`, hechos, total: totalPasos });
        const cuerpo = new FormData();
        cuerpo.append("seguimientoId", seguimientoId);
        cuerpo.append("tipo", tipo);
        cuerpo.append("archivo", archivo);
        cuerpo.append("pacienteNombre", paciente.nombre);
        cuerpo.append("documento", documentoSesion);

        const subida = await fetch("/api/clinica-heridas/fotos", { method: "POST", body: cuerpo });
        if (subida.ok) {
          const datosFoto = await subida.json();
          subidas.push(datosFoto.foto);
        } else {
          fallidas += 1;
          const detalle = await subida.json().catch(() => null);
          toast.error(`${etiqueta}: ${detalle?.error ?? "no se pudo subir."}`);
        }
        hechos += 1;
        setProgreso({ titulo: `Subiendo ${etiqueta.toLowerCase()}...`, hechos, total: totalPasos });
      }

      const nuevo: Seguimiento = {
        id: seguimientoId,
        numero,
        createdAt: new Date().toISOString(),
        origen: form.origen.toUpperCase(),
        ubicacion: form.ubicacion.toUpperCase(),
        diametroVerticalCm: Number(form.diametroVerticalCm),
        diametroHorizontalCm: Number(form.diametroHorizontalCm),
        profundidadCm: Number(form.profundidadCm),
        fondo: form.fondo.toUpperCase(),
        lecho: form.lecho.toUpperCase(),
        tejido: form.tejido.toUpperCase(),
        exudadoCantidad: form.exudadoCantidad.toUpperCase(),
        exudadoCaracteristicas: form.exudadoCaracteristicas.toUpperCase(),
        registradoPor: "",
        fotos: subidas,
      };

      setSeguimientos((prev) => [...prev, nuevo]);
      setSeleccionado(seguimientoId);
      setCreando(false);
      setArchivos({});
      if (fallidas === 0) toast.success(`Seguimiento ${numero} registrado.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible guardar el seguimiento.");
    } finally {
      setGuardando(false);
      setProgreso(null);
    }
  }

  const puedeGuardar =
    Boolean(paciente) &&
    CAMPOS_HERIDA.every(({ clave }) => form[clave].trim().length > 0) &&
    CAMPOS_EXUDADO.every(({ clave }) => form[clave].trim().length > 0) &&
    MEDIDAS_HERIDA.every(({ clave }) => form[clave].trim().length > 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 via-white to-white pb-12">
      <header className="relative overflow-hidden bg-gradient-to-br from-red-800 via-red-700 to-red-600 text-white">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full border-[28px] border-white/10" />
        <div className="absolute -bottom-20 right-1/4 h-44 w-44 rounded-full bg-white/5" />
        <div className="container relative mx-auto px-4 py-9 md:py-11">
          <div className="flex items-center gap-4 md:gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/25 bg-white/15 shadow-lg backdrop-blur-sm md:h-20 md:w-20">
              <FaNotesMedical className="text-3xl md:text-4xl" />
            </div>
            <div>
              <h1 className="mt-1 text-3xl font-black tracking-tight md:text-4xl">
                Clínica de Heridas
              </h1>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto max-w-7xl px-4 py-8 space-y-6">
        {/* Busqueda ---------------------------------------------------------- */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-extrabold text-slate-800">Buscar paciente</h2>
          <p className="mt-1 text-sm text-slate-500">
            Ingresa el número de documento del paciente.
          </p>

          <form onSubmit={buscar} className="mt-5 flex flex-col gap-4 md:flex-row md:items-end">
            <div className="md:max-w-sm md:flex-1">
              <label className="block text-sm font-bold text-slate-700">
                Documento
                <span className="mt-1.5 block font-normal">
                  <input
                    value={documentoBusqueda}
                    onChange={(e) => setDocumentoBusqueda(e.target.value)}
                    disabled={buscando}
                    autoComplete="off"
                    inputMode="numeric"
                    maxLength={30}
                    placeholder="Número de documento"
                    className="input"
                  />
                </span>
              </label>
            </div>
            <button
              type="submit"
              disabled={buscando}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-700 px-6 py-3 font-bold text-white shadow-md transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FaSearch />
              {buscando ? "Buscando..." : "Buscar paciente"}
            </button>
          </form>
        </section>

        {noEncontrado && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-center gap-3">
              <span className="rounded-2xl bg-amber-100 p-3 text-2xl text-amber-700">
                <FaUserSlash />
              </span>
              <p className="font-bold text-amber-800">
                Paciente no encontrado en Clínica de Heridas.
              </p>
            </div>
          </section>
        )}

        {paciente && (
          <>
            {/* Paciente --------------------------------------------------- */}
            <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-2xl bg-emerald-100 p-3 text-2xl text-emerald-700">
                  <FaUserCheck />
                </span>
                <div>
                  <p className="font-extrabold text-emerald-700">Paciente encontrado</p>
                  <p className="mt-1 text-xl font-black text-slate-900">{paciente.nombre}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Documento: <span className="font-mono">{paciente.documentoMascarado}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={cerrarPaciente}
                  className="ml-auto rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Buscar otro paciente
                </button>
              </div>
            </section>

            {/* Navegacion entre seguimientos ------------------------------ */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-800">Seguimientos</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {seguimientos.length === 0
                      ? "Este paciente aún no tiene seguimientos registrados."
                      : `${seguimientos.length} seguimiento(s) registrados.`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={nuevoSeguimiento}
                  disabled={creando}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FaPlusCircle /> Nuevo seguimiento {proximoNumero}
                </button>
              </div>

              {seguimientos.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {seguimientos.map((seguimiento) => (
                    <button
                      key={seguimiento.id}
                      type="button"
                      onClick={() => {
                        setSeleccionado(seguimiento.id);
                        setCreando(false);
                      }}
                      className={`rounded-xl border px-4 py-2 text-sm font-bold transition-colors ${
                        seleccionado === seguimiento.id && !creando
                          ? "border-red-200 bg-red-50 text-red-700"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      Seguimiento {seguimiento.numero}
                      <span className="ml-2 font-normal text-slate-400">
                        {formatearFecha(seguimiento.createdAt)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Detalle de un seguimiento existente ------------------------ */}
            {seguimientoActual && !creando && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg font-extrabold text-slate-800">
                    Seguimiento {seguimientoActual.numero}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {formatearFecha(seguimientoActual.createdAt)}
                    {seguimientoActual.registradoPor ? ` · ${seguimientoActual.registradoPor}` : ""}
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Dato etiqueta="Origen" valor={seguimientoActual.origen} />
                  <Dato etiqueta="Ubicación" valor={seguimientoActual.ubicacion} />
                  <Dato etiqueta="Fondo" valor={seguimientoActual.fondo} />
                  <Dato etiqueta="Lecho" valor={seguimientoActual.lecho} />
                  <Dato etiqueta="Tejido" valor={seguimientoActual.tejido} />
                  <Dato
                    etiqueta="Diámetro vertical"
                    valor={`${seguimientoActual.diametroVerticalCm} cm`}
                  />
                  <Dato
                    etiqueta="Diámetro horizontal"
                    valor={`${seguimientoActual.diametroHorizontalCm} cm`}
                  />
                  <Dato etiqueta="Profundidad" valor={`${seguimientoActual.profundidadCm} cm`} />
                </div>

                <h3 className="mt-6 font-extrabold text-slate-800">Exudado</h3>
                <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Dato etiqueta="Cantidad" valor={seguimientoActual.exudadoCantidad} />
                  <Dato etiqueta="Características" valor={seguimientoActual.exudadoCaracteristicas} />
                </div>

                <h3 className="mt-6 font-extrabold text-slate-800">Fotos</h3>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                  {FOTOS.map(({ tipo, etiqueta }) => {
                    const foto = seguimientoActual.fotos.find((f) => f.tipo === tipo);
                    return (
                      <div
                        key={tipo}
                        className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm"
                      >
                        <p className="font-bold text-slate-700">{etiqueta}</p>
                        {foto ? (
                          <a
                            href={`/api/clinica-heridas/fotos/${foto.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex items-center gap-2 font-semibold text-red-700 hover:text-red-800"
                          >
                            <FaExternalLinkAlt className="text-xs" /> Abrir imagen
                          </a>
                        ) : (
                          <p className="mt-2 text-slate-400">Sin imagen</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Formulario del nuevo seguimiento --------------------------- */}
            {creando && (
              <form onSubmit={guardar} className="space-y-6">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-lg font-extrabold text-slate-800">
                      Características de la herida
                    </h2>
                    <p className="text-sm text-slate-500">
                      Seguimiento {proximoNumero}
                      {ultimo ? " · datos precargados del seguimiento anterior" : ""}
                    </p>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {CAMPOS_HERIDA.map(({ clave, etiqueta }) => (
                      <Campo key={clave} etiqueta={etiqueta}>
                        <Desplegable
                          clave={clave}
                          valor={form[clave]}
                          onChange={(valor) => setForm((prev) => ({ ...prev, [clave]: valor }))}
                        />
                      </Campo>
                    ))}
                  </div>

                  <h3 className="mt-6 font-extrabold text-slate-800">Exudado</h3>
                  <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {CAMPOS_EXUDADO.map(({ clave, etiqueta }) => (
                      <Campo key={clave} etiqueta={etiqueta}>
                        <Desplegable
                          clave={clave}
                          valor={form[clave]}
                          onChange={(valor) => setForm((prev) => ({ ...prev, [clave]: valor }))}
                        />
                      </Campo>
                    ))}
                  </div>

                  <h3 className="mt-6 font-extrabold text-slate-800">
                    Medidas <span className="text-sm font-normal text-slate-500">(se toman en cada seguimiento)</span>
                  </h3>
                  <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {MEDIDAS_HERIDA.map(({ clave, etiqueta }) => (
                      <Campo key={clave} etiqueta={etiqueta}>
                        <input
                          required
                          type="number"
                          min={0}
                          max={200}
                          step={0.1}
                          value={form[clave]}
                          onChange={(e) => setForm((prev) => ({ ...prev, [clave]: e.target.value }))}
                          placeholder="0.0"
                          className="input"
                        />
                      </Campo>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm">
                  <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-800">
                    <FaCamera className="text-red-700" /> Fotos de la herida
                    <span className="text-sm font-normal text-slate-500">(opcionales)</span>
                  </h2>
                  <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {FOTOS.map(({ tipo, etiqueta }) => (
                      <Campo key={tipo} etiqueta={etiqueta}>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) =>
                            setArchivos((prev) => {
                              const siguiente = { ...prev };
                              const archivo = e.target.files?.[0];
                              if (archivo) siguiente[tipo] = archivo;
                              else delete siguiente[tipo];
                              return siguiente;
                            })
                          }
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-red-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-red-700"
                        />
                      </Campo>
                    ))}
                  </div>
                </section>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setCreando(false)}
                    disabled={guardando}
                    className="rounded-xl border border-slate-200 px-5 py-3 font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={guardando || !puedeGuardar}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-700 to-red-700 px-6 py-3 font-bold text-white shadow-md transition-colors hover:from-red-800 hover:to-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FaCheckCircle />
                    {guardando ? "Guardando..." : `Guardar seguimiento ${proximoNumero}`}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>

      {/* Modal de carga: bloquea la pantalla mientras se registra el
          seguimiento y se suben sus fotos, que son peticiones sucesivas. */}
      {progreso && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-4"
          role="dialog"
          aria-modal="true"
          aria-busy="true"
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-red-100 bg-white shadow-2xl">
            <div className="bg-gradient-to-r from-red-700 to-red-800 px-5 py-4">
              <h3 className="text-lg font-semibold text-white">
                Registrando seguimiento {proximoNumero}
              </h3>
            </div>

            <div className="px-5 py-5">
              <div className="flex items-center gap-3">
                <span className="h-8 w-8 shrink-0 animate-spin rounded-full border-2 border-red-200 border-t-red-700" />
                <p className="text-sm font-semibold text-slate-700" aria-live="polite">
                  {progreso.titulo}
                </p>
              </div>

              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-red-700 transition-all duration-300"
                  style={{ width: `${Math.round((progreso.hechos / progreso.total) * 100)}%` }}
                />
              </div>

              <p className="mt-2 text-xs text-slate-500">
                Paso {Math.min(progreso.hechos + 1, progreso.total)} de {progreso.total}. No cierres
                ni recargues esta ventana.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Desplegable de un campo clinico. Las opciones salen del catalogo compartido
 * con el servidor, que vuelve a validarlas al guardar.
 */
function Desplegable({
  clave,
  valor,
  onChange,
}: {
  clave: ClaveTexto;
  valor: string;
  onChange: (valor: string) => void;
}) {
  return (
    <select
      required
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      className={`input ${valor ? "" : "text-slate-400"}`}
    >
      <option value="">Selecciona una opción</option>
      {CATALOGOS[clave].map((opcion) => (
        <option key={opcion} value={opcion} className="text-slate-800">
          {opcion}
        </option>
      ))}
    </select>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-bold text-slate-700">
      {etiqueta}
      <span className="mt-1.5 block font-normal">{children}</span>
    </label>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{etiqueta}</p>
      <p className="mt-1 font-semibold text-slate-800">{valor}</p>
    </div>
  );
}
