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
  { v: "NORTE", label: "Norte" },
  { v: "SUR", label: "Sur" },
  { v: "OCCIDENTE", label: "Occidente" },
  { v: "ORIENTE", label: "Oriente" },
  { v: "ORIENTE_ANTIOQUENO", label: "Oriente Antioqueño" },
];

const TIPOS_DOC = [
  { v: "CC", label: "Cédula de ciudadanía (CC)" },
  { v: "TI", label: "Tarjeta de identidad (TI)" },
  { v: "CE", label: "Cédula de extranjería (CE)" },
  { v: "PA", label: "Pasaporte (PA)" },
  { v: "PPT", label: "Permiso por Protección Temporal (PPT)" },
  { v: "RC", label: "Registro civil (RC)" },
  { v: "NUIP", label: "NUIP" },
];

const TIPOS_PACIENTE = [
  { v: "ERCA", label: "ERCA" },
  { v: "DATOS_ERRADOS", label: "Datos errados de ubicación" },
  { v: "ACTUALIZACION_DATOS", label: "Actualización de datos" },
  { v: "AGENDAMIENTO", label: "Agendamiento" },
  { v: "FALLECIMIENTO", label: "Fallecimientos" },
  { v: "HOSPITALIZACION", label: "Hospitalización" },
  { v: "ALTA_TARDIA", label: "Alta tardía" },
  { v: "INICIO_TRATAMIENTO_PRIORITARIO", label: "Inicio de tratamiento prioritario" },
  { v: "RETRASO_INICIO_TRATAMIENTO", label: "Retraso en inicio de tratamiento" },
  { v: "PROBABLE_REACCION_ALERGICA", label: "Probable reacción alérgica" },
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
  { v: "NO_REALIZO_RUTA", label: "No realizó ruta" },
];

const TIPOS_FARMACIA = [
  { v: "ERROR_KARDEX", label: "Error en Kardex" },
  { v: "ERROR_REQUISICION", label: "Error en requisición" },
  { v: "ERROR_AUTORIZACION", label: "Error en autorización" },
  { v: "ERROR_AUXILIAR_ASIGNADO", label: "Error en auxiliar asignado" },
  { v: "ERROR_FORMULA", label: "Error en la fórmula" },
  { v: "ERROR_TODOS_LOS_DOCUMENTOS", label: "Error en todos los documentos" },
];

const CATEGORIA_LLAMADA_URGENTE = "LLAMADA_URGENTE";
const DESCRIPCION_LLAMADA_URGENTE = "Necesito una llamada urgente de apoyo.";

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
    if (!origenSeguro) return "No fue posible solicitar tu ubicación.";
    if (estadoPermiso === "denied") return "No fue posible obtener tu ubicación.";
    return "No autorizaste compartir tu ubicación.";
  }
  if (code === 2) return "No fue posible obtener tu ubicación.";
  if (code === 3) {
    if (estadoPermiso === "prompt" || estadoPermiso === "UNKNOWN") return "No recibimos respuesta de ubicación a tiempo.";
    return "No fue posible obtener tu ubicación a tiempo.";
  }
  return "No fue posible obtener tu ubicación.";
}

async function obtenerUbicacionActual(): Promise<Coordenadas | null> {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return null;
  }

  if (!("geolocation" in navigator)) {
    toast.error("No fue posible obtener tu ubicación. La novedad se guardará sin ubicación.");
    return null;
  }

  const origenSeguro = esOrigenSeguroParaGeolocalizacion();
  const estadoPermiso = await obtenerEstadoPermisoGeolocalizacion();

  if (!origenSeguro) {
    toast.error("No fue posible solicitar tu ubicación. La novedad se guardará sin ubicación.");
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
    toast.error(`${mensajeErrorGeolocalizacion(error, estadoPermiso, origenSeguro)} La novedad se guardará sin ubicación.`);
    return null;
  }
}

export default function RegistrarNovedadForm() {
  const [me, setMe] = useState<MeResp | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [saving, setSaving] = useState(false);

  const [telefono, setTelefono] = useState("");
  const [zona, setZona] = useState("");
  const [categoria, setCategoria] = useState<"PACIENTE" | "RUTA" | "PROCESO_FARMACEUTICO" | "LLAMADA_URGENTE">("PACIENTE");
  const [esClinicaHeridas, setEsClinicaHeridas] = useState(false);

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
  const [adjuntoFarmacia, setAdjuntoFarmacia] = useState<File | null>(null);
  const adjuntoFarmaciaInputRef = useRef<HTMLInputElement | null>(null);

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
    if (categoria === CATEGORIA_LLAMADA_URGENTE && esClinicaHeridas) {
      setEsClinicaHeridas(false);
    }
  }, [categoria, esClinicaHeridas]);

  useEffect(() => {
    if (!(categoria === "PACIENTE" && TIPOS_PACIENTE_CON_FOTO_OBLIGATORIA.includes(tipoPaciente))) {
      setFotoIngresoDomicilio(null);
      if (fotoInputRef.current) fotoInputRef.current.value = "";
    }

    if (!(categoria === "RUTA" && (tipoRuta === "ACCIDENTE" || tipoRuta === "CIERRE_VIAL"))) {
      setFotoRutaEvidencia(null);
      if (fotoRutaInputRef.current) fotoRutaInputRef.current.value = "";
    }

    if (categoria !== "PROCESO_FARMACEUTICO") {
      setAdjuntoFarmacia(null);
      if (adjuntoFarmaciaInputRef.current) adjuntoFarmaciaInputRef.current.value = "";
    }
  }, [categoria, tipoPaciente, tipoRuta]);

  const profesionLabel = useMemo(() => {
    const p = me?.profesion;
    if (!p) return "";
    const map: Record<string, string> = {
      AUXILIAR_ENFERMERIA: "Auxiliar de enfermería",
      ENFERMERIA: "Enfermería",
      MEDICO: "Médico",
      ESPECIALISTA: "Especialista",
    };
    return map[p] ?? p;
  }, [me?.profesion]);

  const canSubmit = useMemo(() => {
    const requiereFotoDomicilio =
      categoria === "PACIENTE" && TIPOS_PACIENTE_CON_FOTO_OBLIGATORIA.includes(tipoPaciente);
    const requiereFotoRuta =
      categoria === "RUTA" && (tipoRuta === "ACCIDENTE" || tipoRuta === "CIERRE_VIAL");
    const requiereZona = categoria === "PACIENTE" || categoria === "RUTA";
    const esLlamadaUrgente = categoria === CATEGORIA_LLAMADA_URGENTE;

    if (!me) return false;
    if (requiereZona && !zona) return false;
    if (!esLlamadaUrgente && !descripcion.trim()) return false;
    if (esLlamadaUrgente) return !!telefono.trim();
    if (categoria === "PACIENTE") {
      return !!pacienteNombre.trim() && !!pacienteDocumento.trim() && (!requiereFotoDomicilio || !!fotoIngresoDomicilio);
    }
    if (categoria === "RUTA") {
      return !requiereFotoRuta || !!fotoRutaEvidencia;
    }
    if (categoria === "PROCESO_FARMACEUTICO") {
      return !!pacienteNombre.trim() && !!pacienteDocumento.trim() && !!pacienteTipoDoc && !!tipoFarmacia;
    }
    return true;
  }, [me, zona, descripcion, categoria, telefono, pacienteNombre, pacienteTipoDoc, pacienteDocumento, tipoPaciente, fotoIngresoDomicilio, tipoRuta, fotoRutaEvidencia, tipoFarmacia]);

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
      const esLlamadaUrgente = categoria === CATEGORIA_LLAMADA_URGENTE;
      const payload = new FormData();
      payload.append("telefono", telefono.trim());
      if ((categoria === "PACIENTE" || categoria === "RUTA") && zona) {
        payload.append("zona", zona);
      }
      payload.append("categoria", categoria);
      payload.append("esClinicaHeridas", !esLlamadaUrgente && esClinicaHeridas ? "true" : "false");
      payload.append("descripcion", esLlamadaUrgente ? DESCRIPCION_LLAMADA_URGENTE : descripcion.trim());
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
      } else if (categoria === "PROCESO_FARMACEUTICO") {
        payload.append("pacienteNombre", pacienteNombre.trim());
        payload.append("pacienteTipoDoc", pacienteTipoDoc);
        payload.append("pacienteDocumento", pacienteDocumento.trim());
        payload.append("tipoFarmacia", tipoFarmacia);
        if (adjuntoFarmacia) {
          payload.append("adjuntoFarmacia", adjuntoFarmacia);
        }
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
      setZona("");
      setCategoria(esRolFarmacia ? "PROCESO_FARMACEUTICO" : "PACIENTE");
      setEsClinicaHeridas(false);
      setPacienteNombre("");
      setPacienteTipoDoc("CC");
      setPacienteDocumento("");
      setTipoPaciente("ERCA");
      setFotoIngresoDomicilio(null);
      if (fotoInputRef.current) fotoInputRef.current.value = "";
      setTipoRuta("INCAPACIDAD");
      setTipoFarmacia("ERROR_KARDEX");
      setAdjuntoFarmacia(null);
      if (adjuntoFarmaciaInputRef.current) adjuntoFarmaciaInputRef.current.value = "";
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
              No se pudo cargar tu información. Intenta recargar la página.
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
                    Cédula
                  </label>
                  <input
                    value={me.cedula ?? ""}
                    readOnly
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <FaUserMd className="inline-block mr-2 text-red-500" />
                    Profesión
                  </label>
                  <input
                    value={profesionLabel ?? ""}
                    readOnly
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <FaPhone className="inline-block mr-2 text-red-500" />
                    Teléfono (editable)
                  </label>
                  <input
                    value={telefono ?? ""}
                    onChange={(e) => setTelefono(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="ej: 3001234567"
                    disabled={saving}
                  />
                </div>
              </div>

              {/* Categoria */}
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
                <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <label className="block text-sm font-semibold text-gray-700">
                    <FaClipboardList className="inline-block mr-2 text-red-500" />
                    Datos de la novedad
                  </label>
                  {categoria !== CATEGORIA_LLAMADA_URGENTE ? (
                    <label className="inline-flex items-center gap-2 rounded-2xl border-2 border-red-200 bg-red-50 px-3 py-2.5 text-sm font-bold text-red-800 shadow-sm">
                      <input
                        type="checkbox"
                        checked={esClinicaHeridas}
                        onChange={(e) => setEsClinicaHeridas(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-2 focus:ring-red-500"
                        disabled={saving}
                      />
                      ¿Esta novedad es de clínica de heridas?
                    </label>
                  ) : null}
                </div>
                <div className="flex flex-col md:flex-row gap-3">
                  {esRolFarmacia ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setCategoria("PROCESO_FARMACEUTICO")}
                        className={`px-4 py-3 rounded-2xl border transition-all text-left ${
                          categoria === "PROCESO_FARMACEUTICO"
                            ? "bg-white border-red-300 shadow-sm"
                            : "bg-white/60 border-gray-200 hover:bg-white"
                        }`}
                      >
                        <p className="font-extrabold text-gray-900 flex items-center gap-2">
                          <FaClipboardList className="text-red-500" />
                          Novedad en proceso farmacéutico
                        </p>
                        <p className="text-xs text-gray-600">Error en documentos trazadores en farmacia.</p>
                      </button>
                    </>
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
                        <p className="font-extrabold text-gray-900 flex items-center gap-2">
                          <FaUser className="text-red-500" />
                          Novedad con un paciente
                        </p>
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
                        <p className="font-extrabold text-gray-900 flex items-center gap-2">
                          <FaMapMarkedAlt className="text-red-500" />
                          Novedad en la ruta
                        </p>
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
                          <p className="font-extrabold text-gray-900 flex items-center gap-2">
                            <FaClipboardList className="text-red-500" />
                            Novedad en proceso farmacéutico
                          </p>
                          <p className="text-xs text-gray-600">Error en documentos trazadores en farmacia.</p>
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => setCategoria(CATEGORIA_LLAMADA_URGENTE)}
                        className={`px-4 py-3 rounded-2xl border transition-all text-left ${
                          categoria === CATEGORIA_LLAMADA_URGENTE
                            ? "bg-white border-red-300 shadow-sm"
                            : "bg-white/60 border-gray-200 hover:bg-white"
                        }`}
                      >
                        <p className="font-extrabold text-gray-900 flex items-center gap-2">
                          <FaPhone className="text-red-500" />
                          Llamada urgente
                        </p>
                        <p className="text-xs text-gray-600">Necesito una llamada urgente de apoyo.</p>
                      </button>
                    </>
                  )}
                </div>

                {categoria === "PACIENTE" || categoria === "RUTA" ? (
                  <div className="mt-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      <FaMapMarkedAlt className="inline-block mr-2 text-red-500" />
                      Zona (selecciona una)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {ZONAS.map((z) => {
                        const checked = zona === z.v;
                        return (
                          <button
                            type="button"
                            key={z.v}
                            onClick={() => setZona(checked ? "" : z.v)}
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
                        value={pacienteNombre ?? ""}
                        onChange={(e) => setPacienteNombre(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                        placeholder="Ej: Maria Gomez"
                        disabled={saving}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de documento</label>
                      <select
                        value={pacienteTipoDoc ?? "CC"}
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
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Número de documento</label>
                      <input
                        value={pacienteDocumento ?? ""}
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
                ) : categoria === CATEGORIA_LLAMADA_URGENTE ? (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    Comprueba que tu número de celular sea el correcto en la parte superior o, en caso contrario, puedes editarlo.
                  </div>
                ) : (
                  <div className="mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre del paciente</label>
                        <input
                          value={pacienteNombre ?? ""}
                          onChange={(e) => setPacienteNombre(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                          placeholder="Ej: Maria Gomez"
                          disabled={saving}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de documento</label>
                        <select
                          value={pacienteTipoDoc ?? "CC"}
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
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Número de documento</label>
                        <input
                          value={pacienteDocumento ?? ""}
                          onChange={(e) => setPacienteDocumento(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                          placeholder="Ej: 43830559"
                          disabled={saving}
                        />
                      </div>
                    </div>
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
                    <div className="mt-4">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Adjunto (opcional: imagen o PDF)
                      </label>
                      <input
                        ref={adjuntoFarmaciaInputRef}
                        type="file"
                        accept="image/*,application/pdf,.pdf"
                        onChange={(e) => setAdjuntoFarmacia(e.target.files?.[0] ?? null)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                        disabled={saving}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Descripcion */}
              {categoria !== CATEGORIA_LLAMADA_URGENTE ? (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Descripción de la novedad</label>
                  <textarea
                    value={descripcion ?? ""}
                    onChange={(e) => setDescripcion(e.target.value)}
                    rows={5}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="Describe lo ocurrido con el mayor detalle posible..."
                    disabled={saving}
                  />
                  <div className="mt-2 text-xs text-gray-500">
                    Se enviará el detalle de la novedad al personal administrativo encargado para su gestión.
                  </div>
                </div>
              ) : null}

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
