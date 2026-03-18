"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import {
  FaArrowLeft,
  FaExclamationTriangle,
  FaUser,
  FaIdCard,
  FaUserMd,
  FaPhone,
  FaMapMarkedAlt,
  FaSave,
  FaClipboardList,
} from "react-icons/fa";

type MeResp = {
  nombres: string;
  primerApellido: string;
  segundoApellido: string | null;
  username: string;
  rol: "ESPECIALISTA" | "TECNICO" | "ADMINISTRATIVO" | "FARMACIA";
  telefono: string | null;
  cedula: string;
  profesion: string | null;
};

const ZONAS = [
  { v: "NORORIENTAL", label: "Medellín" },
  { v: "NOROCCIDENTAL", label: "Valle de Aburrá Norte" },
  { v: "CENTRO_ORIENTAL", label: "Valle de Aburrá Sur" },
  { v: "CENTRO_OCCIDENTAL", label: "Oriente antioqueño" },
  { v: "SURORIENTAL", label: "Occidente / Noroccidente" },
  { v: "SUROCCIDENTAL", label: "Suroeste" },
];

const TIPOS_DOC = [
  { v: "CC", label: "Cedula de ciudadania (CC)" },
  { v: "TI", label: "Tarjeta de identidad (TI)" },
  { v: "CE", label: "Cedula de extranjeria (CE)" },
  { v: "PA", label: "Pasaporte (PA)" },
  { v: "PPT", label: "Permiso por Proteccion Temporal (PPT)" },
  { v: "RC", label: "Registro civil (RC)" },
  { v: "NUIP", label: "NUIP" },
];

const TIPOS_PACIENTE = [
  { v: "ERCA", label: "ERCA" },
  { v: "DATOS_ERRADOS", label: "Datos errados" },
  { v: "AGENDAMIENTO", label: "Agendamiento" },
  { v: "FALLECIMIENTO", label: "Fallecimientos" },
  { v: "HOSPITALIZACION", label: "Hospitalizacion" },
  { v: "ALTA_TARDIA", label: "Alta tardia" },
  { v: "RETRASO_INICIO_TRATAMIENTO", label: "Retraso en inicio de tratamiento" },
  { v: "PROBABLE_REACCION_ALERGICA", label: "Probable reaccion alergica" },
  { v: "DOBLE_PRESTADOR", label: "Doble prestador" },
  { v: "RELACIONAMIENTO", label: "Problemas de relacionamiento" },
  { v: "IMPOSIBILIDAD_CONTACTAR_PACIENTE", label: "Imposibilidad de contactar al paciente" },
  { v: "IMPOSIBILIDAD_INGRESAR_DOMICILIO", label: "Imposibilidad de ingresar al domicilio" },
  { v: "OTRA", label: "Otra" },
];

const TIPOS_PACIENTE_CON_FOTO_OBLIGATORIA = [
  "IMPOSIBILIDAD_INGRESAR_DOMICILIO",
  "PROBABLE_REACCION_ALERGICA",
];

const TIPOS_RUTA = [
  { v: "INCAPACIDAD", label: "Incapacidad" },
  { v: "ACCIDENTE", label: "Accidente" },
  { v: "CIERRE_VIAL", label: "Cierre vial" },
  { v: "NO_REALIZO_RUTA", label: "No realizo ruta" },
];

const TIPOS_FARMACIA = [
  { v: "ERROR_KARDEX", label: "Error en Kardex" },
  { v: "ERROR_REQUISICION", label: "Error en requisicion" },
  { v: "ERROR_AUTORIZACION", label: "Error en autorizacion" },
  { v: "ERROR_AUXILIAR_ASIGNADO", label: "Error en auxiliar asignado" },
  { v: "ERROR_FORMULA", label: "Error en la formula" },
  { v: "ERROR_TODOS_LOS_DOCUMENTOS", label: "Error en todos los documentos" },
];

function nombreCompleto(me: MeResp | null) {
  if (!me) return "";
  return `${me.nombres} ${me.primerApellido} ${me.segundoApellido ?? ""}`
    .replace(/\s+/g, " ")
    .trim();
}

type Coordenadas = {
  latitud: number;
  longitud: number;
};

const GEO_TIMEOUT_GRANTED_MS = 12000;
const GEO_TIMEOUT_PROMPT_MS = 60000;

type EstadoPermisoGeo = PermissionState | "UNKNOWN";

function esOrigenSeguroParaGeolocalizacion() {
  if (typeof window === "undefined") return false;
  const { protocol, hostname } = window.location;
  return protocol === "https:" || hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

async function obtenerEstadoPermisoGeolocalizacion(): Promise<EstadoPermisoGeo> {
  if (typeof navigator === "undefined" || !("permissions" in navigator)) {
    return "UNKNOWN";
  }

  try {
    const permisos = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    return permisos.state;
  } catch {
    return "UNKNOWN";
  }
}

function mensajeErrorGeolocalizacion(
  error: unknown,
  estadoPermiso: EstadoPermisoGeo,
  origenSeguro: boolean
) {
  const code = typeof error === "object" && error && "code" in error
    ? Number((error as { code?: unknown }).code)
    : null;

  if (code === 1) {
    if (!origenSeguro) return "No fue posible solicitar tu ubicacion.";
    if (estadoPermiso === "denied") return "No fue posible obtener tu ubicacion.";
    return "No autorizaste compartir tu ubicacion.";
  }
  if (code === 2) return "No fue posible obtener tu ubicacion.";
  if (code === 3) {
    if (estadoPermiso === "prompt" || estadoPermiso === "UNKNOWN") return "No recibimos respuesta de ubicacion a tiempo.";
    return "No fue posible obtener tu ubicacion a tiempo.";
  }
  return "No fue posible obtener tu ubicacion.";
}

async function obtenerUbicacionActual(): Promise<Coordenadas | null> {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return null;
  }

  if (!("geolocation" in navigator)) {
    toast.error("No fue posible obtener tu ubicacion. La novedad se guardara sin ubicacion.");
    return null;
  }

  const origenSeguro = esOrigenSeguroParaGeolocalizacion();
  const estadoPermiso = await obtenerEstadoPermisoGeolocalizacion();

  if (!origenSeguro) {
    toast.error("No fue posible solicitar tu ubicacion. La novedad se guardara sin ubicacion.");
    return null;
  }

  const timeoutMs =
    estadoPermiso === "granted"
      ? GEO_TIMEOUT_GRANTED_MS
      : GEO_TIMEOUT_PROMPT_MS;

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 0,
      });
    });

    return {
      latitud: Number(position.coords.latitude.toFixed(8)),
      longitud: Number(position.coords.longitude.toFixed(8)),
    };
  } catch (error: unknown) {
    toast.error(`${mensajeErrorGeolocalizacion(error, estadoPermiso, origenSeguro)} La novedad se guardara sin ubicacion.`);
    return null;
  }
}

export default function RegistrarNovedadForm() {
  const [me, setMe] = useState<MeResp | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [saving, setSaving] = useState(false);

  const [telefono, setTelefono] = useState("");
  const [zonas, setZonas] = useState<string[]>([]);
  const [categoria, setCategoria] = useState<"PACIENTE" | "RUTA" | "PROCESO_FARMACEUTICO">("PACIENTE");

  // paciente
  const [pacienteNombre, setPacienteNombre] = useState("");
  const [pacienteTipoDoc, setPacienteTipoDoc] = useState("CC");
  const [pacienteDocumento, setPacienteDocumento] = useState("");
  const [tipoPaciente, setTipoPaciente] = useState("ERCA");
  const [fotoIngresoDomicilio, setFotoIngresoDomicilio] = useState<File | null>(null);
  const fotoInputRef = useRef<HTMLInputElement | null>(null);

  // ruta
  const [tipoRuta, setTipoRuta] = useState("INCAPACIDAD");
  const [fotoRutaEvidencia, setFotoRutaEvidencia] = useState<File | null>(null);
  const fotoRutaInputRef = useRef<HTMLInputElement | null>(null);
  const [tipoFarmacia, setTipoFarmacia] = useState("ERROR_KARDEX");

  const [descripcion, setDescripcion] = useState("");
  const esRolFarmacia = me?.rol === "FARMACIA";
  const puedeReportarProcesoFarmaceutico =
    me?.rol === "FARMACIA" || me?.rol === "TECNICO" || me?.rol === "ADMINISTRATIVO";

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me");
        if (!res.ok) throw new Error("No se pudo cargar el perfil");
        const data = (await res.json()) as MeResp;
        setMe(data);
        setTelefono((data.telefono ?? "").toString());
      } catch (e: any) {
        toast.error(e?.message || "Error cargando datos");
      } finally {
        setLoadingMe(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!me) return;

    if (esRolFarmacia && categoria !== "PROCESO_FARMACEUTICO") {
      setCategoria("PROCESO_FARMACEUTICO");
      return;
    }

    if (!puedeReportarProcesoFarmaceutico && categoria === "PROCESO_FARMACEUTICO") {
      setCategoria("PACIENTE");
    }
  }, [me, esRolFarmacia, puedeReportarProcesoFarmaceutico, categoria]);

  useEffect(() => {
    if (!(categoria === "PACIENTE" && TIPOS_PACIENTE_CON_FOTO_OBLIGATORIA.includes(tipoPaciente))) {
      setFotoIngresoDomicilio(null);
      if (fotoInputRef.current) fotoInputRef.current.value = "";
    }

    if (!(categoria === "RUTA" && (tipoRuta === "ACCIDENTE" || tipoRuta === "CIERRE_VIAL"))) {
      setFotoRutaEvidencia(null);
      if (fotoRutaInputRef.current) fotoRutaInputRef.current.value = "";
    }
  }, [categoria, tipoPaciente, tipoRuta]);

  const profesionLabel = useMemo(() => {
    const p = me?.profesion;
    if (!p) return "";
    const map: Record<string, string> = {
      AUXILIAR_ENFERMERIA: "Auxiliar de enfermeria",
      ENFERMERIA: "Enfermeria",
      MEDICO: "Medico",
      ESPECIALISTA: "Especialista",
    };
    return map[p] ?? p;
  }, [me?.profesion]);

  const canSubmit = useMemo(() => {
    const requiereFotoDomicilio =
      categoria === "PACIENTE" && TIPOS_PACIENTE_CON_FOTO_OBLIGATORIA.includes(tipoPaciente);
    const requiereFotoRuta =
      categoria === "RUTA" && (tipoRuta === "ACCIDENTE" || tipoRuta === "CIERRE_VIAL");
    const requiereZona = categoria !== "PROCESO_FARMACEUTICO";

    if (!me) return false;
    if (requiereZona && zonas.length === 0) return false;
    if (!descripcion.trim()) return false;
    if (categoria === "PACIENTE") {
      return !!pacienteNombre.trim() && !!pacienteDocumento.trim() && (!requiereFotoDomicilio || !!fotoIngresoDomicilio);
    }
    if (categoria === "RUTA") {
      return !requiereFotoRuta || !!fotoRutaEvidencia;
    }
    if (categoria === "PROCESO_FARMACEUTICO") {
      return !!tipoFarmacia;
    }
    return true;
  }, [me, zonas, descripcion, categoria, pacienteNombre, pacienteDocumento, tipoPaciente, fotoIngresoDomicilio, tipoRuta, fotoRutaEvidencia, tipoFarmacia]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) {
      toast.error("Revisa los campos obligatorios");
      return;
    }

    setSaving(true);
    const t = toast.loading("Guardando novedad...");
    try {
      const coordenadas = await obtenerUbicacionActual();
      const payload = new FormData();
      payload.append("telefono", telefono.trim());
      if (categoria !== "PROCESO_FARMACEUTICO") {
        zonas.forEach((z) => payload.append("zonas", z));
      }
      payload.append("categoria", categoria);
      payload.append("descripcion", descripcion.trim());
      if (coordenadas) {
        payload.append("ubicacionLatitud", String(coordenadas.latitud));
        payload.append("ubicacionLongitud", String(coordenadas.longitud));
      }

      if (categoria === "PACIENTE") {
        payload.append("pacienteNombre", pacienteNombre.trim());
        payload.append("pacienteTipoDoc", pacienteTipoDoc);
        payload.append("pacienteDocumento", pacienteDocumento.trim());
        payload.append("tipoPaciente", tipoPaciente);

        if (TIPOS_PACIENTE_CON_FOTO_OBLIGATORIA.includes(tipoPaciente) && fotoIngresoDomicilio) {
          payload.append("fotoIngresoDomicilio", fotoIngresoDomicilio);
        }
      } else if (categoria === "RUTA") {
        payload.append("tipoRuta", tipoRuta);
        if ((tipoRuta === "ACCIDENTE" || tipoRuta === "CIERRE_VIAL") && fotoRutaEvidencia) {
          payload.append("fotoRutaEvidencia", fotoRutaEvidencia);
        }
      } else {
        payload.append("tipoFarmacia", tipoFarmacia);
      }

      const res = await fetch("/api/novedades", {
        method: "POST",
        body: payload,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "No se pudo guardar");
      }

      toast.success("Novedad guardada correctamente.", { id: t });

      // reset parcial
      setZonas([]);
      setCategoria(esRolFarmacia ? "PROCESO_FARMACEUTICO" : "PACIENTE");
      setPacienteNombre("");
      setPacienteTipoDoc("CC");
      setPacienteDocumento("");
      setTipoPaciente("ERCA");
      setFotoIngresoDomicilio(null);
      if (fotoInputRef.current) fotoInputRef.current.value = "";
      setTipoRuta("INCAPACIDAD");
      setTipoFarmacia("ERROR_KARDEX");
      setFotoRutaEvidencia(null);
      if (fotoRutaInputRef.current) fotoRutaInputRef.current.value = "";
      setDescripcion("");
    } catch {
      toast.error("No fue posible guardar la novedad. Intenta nuevamente.", { id: t });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-white">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
          <Link
            href="/novedades"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 shadow-sm hover:bg-gray-50"
          >
            <FaArrowLeft /> Volver
          </Link>
          <div className="flex items-center gap-2 text-gray-800">
            <FaExclamationTriangle className="text-red-600" />
            <h1 className="text-xl md:text-2xl font-extrabold">Registrar una novedad</h1>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          {loadingMe ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
            </div>
          ) : !me ? (
            <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-700">
              No se pudo cargar tu informacion. Intenta recargar la pagina.
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-6">
              {/* Prestador */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <FaUser className="inline-block mr-2 text-red-500" />
                    Nombre prestador de servicios
                  </label>
                  <input
                    value={nombreCompleto(me)}
                    readOnly
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <FaIdCard className="inline-block mr-2 text-red-500" />
                    Cedula
                  </label>
                  <input
                    value={me.cedula}
                    readOnly
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <FaUserMd className="inline-block mr-2 text-red-500" />
                    Profesion
                  </label>
                  <input
                    value={profesionLabel}
                    readOnly
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <FaPhone className="inline-block mr-2 text-red-500" />
                    Telefono (editable)
                  </label>
                  <input
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="ej: 3001234567"
                    disabled={saving}
                  />
                </div>
              </div>

              {/* Categoria */}
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  <FaClipboardList className="inline-block mr-2 text-red-500" />
                  Datos de la novedad
                </label>
                <div className="flex flex-col md:flex-row gap-3">
                  {esRolFarmacia ? (
                    <button
                      type="button"
                      onClick={() => setCategoria("PROCESO_FARMACEUTICO")}
                      className="px-4 py-3 rounded-2xl border border-red-300 bg-white shadow-sm text-left"
                    >
                      <p className="font-extrabold text-gray-900">Novedad en proceso farmaceutico</p>
                      <p className="text-xs text-gray-600">Error en documentos trazadores en farmacia.</p>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setCategoria("PACIENTE")}
                        className={`px-4 py-3 rounded-2xl border transition-all text-left ${
                          categoria === "PACIENTE"
                            ? "bg-white border-red-300 shadow-sm"
                            : "bg-white/60 border-gray-200 hover:bg-white"
                        }`}
                      >
                        <p className="font-extrabold text-gray-900">Novedad con un paciente</p>
                        <p className="text-xs text-gray-600">Incluye datos del paciente y tipo de novedad.</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCategoria("RUTA")}
                        className={`px-4 py-3 rounded-2xl border transition-all text-left ${
                          categoria === "RUTA"
                            ? "bg-white border-red-300 shadow-sm"
                            : "bg-white/60 border-gray-200 hover:bg-white"
                        }`}
                      >
                        <p className="font-extrabold text-gray-900">Novedad en la ruta</p>
                        <p className="text-xs text-gray-600">Incapacidad, accidente, cierre vial, etc.</p>
                      </button>

                      {puedeReportarProcesoFarmaceutico ? (
                        <button
                          type="button"
                          onClick={() => setCategoria("PROCESO_FARMACEUTICO")}
                          className={`px-4 py-3 rounded-2xl border transition-all text-left ${
                            categoria === "PROCESO_FARMACEUTICO"
                              ? "bg-white border-red-300 shadow-sm"
                              : "bg-white/60 border-gray-200 hover:bg-white"
                          }`}
                        >
                          <p className="font-extrabold text-gray-900">Novedad en proceso farmaceutico</p>
                          <p className="text-xs text-gray-600">Error en documentos trazadores en farmacia.</p>
                        </button>
                      ) : null}
                    </>
                  )}
                </div>

                {categoria !== "PROCESO_FARMACEUTICO" ? (
                  <div className="mt-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      <FaMapMarkedAlt className="inline-block mr-2 text-red-500" />
                      Zona (puedes seleccionar varias)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {ZONAS.map((z) => {
                        const checked = zonas.includes(z.v);
                        return (
                          <button
                            type="button"
                            key={z.v}
                            onClick={() =>
                              setZonas((prev) =>
                                checked ? prev.filter((x) => x !== z.v) : [...prev, z.v]
                              )
                            }
                            className={`text-left px-4 py-3 rounded-2xl border transition-all ${
                              checked
                                ? "bg-red-50 border-red-300 text-red-700"
                                : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-sm">{z.label}</span>
                              <span
                                className={`text-xs px-2 py-1 rounded-full ${
                                  checked ? "bg-red-100" : "bg-gray-100"
                                }`}
                              >
                                {checked ? "Seleccionada" : "Seleccionar"}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {/* Campos condicionales */}
                {categoria === "PACIENTE" ? (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre del paciente</label>
                      <input
                        value={pacienteNombre}
                        onChange={(e) => setPacienteNombre(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                        placeholder="Ej: Maria Gomez"
                        disabled={saving}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de documento</label>
                      <select
                        value={pacienteTipoDoc}
                        onChange={(e) => setPacienteTipoDoc(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                        disabled={saving}
                      >
                        {TIPOS_DOC.map((t) => (
                          <option key={t.v} value={t.v}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Numero de documento</label>
                      <input
                        value={pacienteDocumento}
                        onChange={(e) => setPacienteDocumento(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                        placeholder="Ej: 43830559"
                        disabled={saving}
                      />
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de novedad</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {TIPOS_PACIENTE.map((t) => (
                          <button
                            key={t.v}
                            type="button"
                            onClick={() => setTipoPaciente(t.v)}
                            className={`px-3 py-2 rounded-xl border text-sm text-left transition-all ${
                              tipoPaciente === t.v
                                ? "bg-red-50 border-red-300 text-red-700"
                                : "bg-white border-gray-200 hover:bg-gray-50"
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {TIPOS_PACIENTE_CON_FOTO_OBLIGATORIA.includes(tipoPaciente) ? (
                      <div className="md:col-span-4">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Foto de evidencia (obligatoria)
                        </label>
                        <input
                          ref={fotoInputRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => setFotoIngresoDomicilio(e.target.files?.[0] ?? null)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                          disabled={saving}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : categoria === "RUTA" ? (
                  <div className="mt-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de novedad</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      {TIPOS_RUTA.map((t) => (
                        <button
                          key={t.v}
                          type="button"
                          onClick={() => setTipoRuta(t.v)}
                          className={`px-3 py-2 rounded-xl border text-sm text-left transition-all ${
                            tipoRuta === t.v
                              ? "bg-red-50 border-red-300 text-red-700"
                              : "bg-white border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    {(tipoRuta === "ACCIDENTE" || tipoRuta === "CIERRE_VIAL") ? (
                      <div className="mt-4">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Foto de evidencia (obligatoria)
                        </label>
                        <input
                          ref={fotoRutaInputRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => setFotoRutaEvidencia(e.target.files?.[0] ?? null)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                          disabled={saving}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de novedad</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {TIPOS_FARMACIA.map((t) => (
                        <button
                          key={t.v}
                          type="button"
                          onClick={() => setTipoFarmacia(t.v)}
                          className={`px-3 py-2 rounded-xl border text-sm text-left transition-all ${
                            tipoFarmacia === t.v
                              ? "bg-red-50 border-red-300 text-red-700"
                              : "bg-white border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Descripcion */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Descripcion de la novedad</label>
                <textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Describe lo ocurrido con el mayor detalle posible..."
                  disabled={saving}
                />
                <div className="mt-2 text-xs text-gray-500">
                  Se enviara el detalle de la novedad al personal administrativo encargado para su gestion.
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <Link
                  href="/novedades/mis"
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50"
                >
                  Ver mis novedades
                </Link>
                <button
                  type="submit"
                  disabled={!canSubmit || saving}
                  className={`inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-extrabold transition-all ${
                    !canSubmit || saving
                      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                      : "bg-red-600 text-white hover:bg-red-700"
                  }`}
                >
                  <FaSave />
                  Guardar novedad
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
