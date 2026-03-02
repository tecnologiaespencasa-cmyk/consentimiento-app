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
  telefono: string | null;
  cedula: string;
  profesion: string | null;
};

const ZONAS = [
  { v: "NORORIENTAL", label: "Zona Nororiental" },
  { v: "NOROCCIDENTAL", label: "Zona Noroccidental" },
  { v: "CENTRO_ORIENTAL", label: "Zona Centro Oriental" },
  { v: "CENTRO_OCCIDENTAL", label: "Zona Centro Occidental" },
  { v: "SURORIENTAL", label: "Zona Suroriental" },
  { v: "SUROCCIDENTAL", label: "Zona Suroccidental" },
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
  { v: "DATOS_ERRADOS", label: "Datos errados" },
  { v: "AGENDAMIENTO", label: "Agendamiento" },
  { v: "FALLECIMIENTO", label: "Fallecimientos" },
  { v: "HOSPITALIZACION", label: "Hospitalización" },
  { v: "DOBLE_PRESTADOR", label: "Doble prestador" },
  { v: "RELACIONAMIENTO", label: "Problemas de relacionamiento" },
  { v: "IMPOSIBILIDAD_CONTACTAR_PACIENTE", label: "Imposibilidad de contactar al paciente" },
  { v: "IMPOSIBILIDAD_INGRESAR_DOMICILIO", label: "Imposibilidad de ingresar al domicilio" },
];

const TIPOS_RUTA = [
  { v: "INCAPACIDAD", label: "Incapacidad" },
  { v: "ACCIDENTE", label: "Accidente" },
  { v: "CIERRE_VIAL", label: "Cierre vial" },
  { v: "NO_REALIZO_RUTA", label: "No realizó ruta" },
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

const GEO_TIMEOUT_MS = 12000;

function mensajeErrorGeolocalizacion(error: unknown) {
  const code = typeof error === "object" && error && "code" in error
    ? Number((error as { code?: unknown }).code)
    : null;

  if (code === 1) return "No autorizaste compartir tu ubicacion.";
  if (code === 2) return "No fue posible obtener la ubicacion actual.";
  if (code === 3) return "La consulta de ubicacion supero el tiempo limite.";
  return "Ocurrio un error obteniendo tu ubicacion.";
}

async function obtenerUbicacionActual(): Promise<Coordenadas | null> {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return null;
  }

  if (!window.isSecureContext) {
    toast.error("La geolocalizacion requiere una conexion segura (HTTPS). Se guardara sin ubicacion.");
    return null;
  }

  if (!("geolocation" in navigator)) {
    toast.error("Este dispositivo no soporta geolocalizacion. Se guardara sin ubicacion.");
    return null;
  }

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: GEO_TIMEOUT_MS,
        maximumAge: 0,
      });
    });

    return {
      latitud: Number(position.coords.latitude.toFixed(8)),
      longitud: Number(position.coords.longitude.toFixed(8)),
    };
  } catch (error: unknown) {
    toast.error(`${mensajeErrorGeolocalizacion(error)} Se guardara sin ubicacion.`);
    return null;
  }
}

export default function RegistrarNovedadForm() {
  const [me, setMe] = useState<MeResp | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [saving, setSaving] = useState(false);

  const [telefono, setTelefono] = useState("");
  const [zonas, setZonas] = useState<string[]>([]);
  const [categoria, setCategoria] = useState<"PACIENTE" | "RUTA">("PACIENTE");

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

  const [descripcion, setDescripcion] = useState("");

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
    if (!(categoria === "PACIENTE" && tipoPaciente === "IMPOSIBILIDAD_INGRESAR_DOMICILIO")) {
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
      AUXILIAR_ENFERMERIA: "Auxiliar de enfermería",
      ENFERMERIA: "Enfermería",
      MEDICO: "Médico",
      ESPECIALISTA: "Especialista",
    };
    return map[p] ?? p;
  }, [me?.profesion]);

  const canSubmit = useMemo(() => {
    const requiereFotoDomicilio =
      categoria === "PACIENTE" && tipoPaciente === "IMPOSIBILIDAD_INGRESAR_DOMICILIO";
    const requiereFotoRuta =
      categoria === "RUTA" && (tipoRuta === "ACCIDENTE" || tipoRuta === "CIERRE_VIAL");

    if (!me) return false;
    if (zonas.length === 0) return false;
    if (!descripcion.trim()) return false;
    if (categoria === "PACIENTE") {
      return !!pacienteNombre.trim() && !!pacienteDocumento.trim() && (!requiereFotoDomicilio || !!fotoIngresoDomicilio);
    }
    if (categoria === "RUTA") {
      return !requiereFotoRuta || !!fotoRutaEvidencia;
    }
    return true;
  }, [me, zonas, descripcion, categoria, pacienteNombre, pacienteDocumento, tipoPaciente, fotoIngresoDomicilio, tipoRuta, fotoRutaEvidencia]);

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
      zonas.forEach((z) => payload.append("zonas", z));
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

        if (tipoPaciente === "IMPOSIBILIDAD_INGRESAR_DOMICILIO" && fotoIngresoDomicilio) {
          payload.append("fotoIngresoDomicilio", fotoIngresoDomicilio);
        }
      } else {
        payload.append("tipoRuta", tipoRuta);
        if ((tipoRuta === "ACCIDENTE" || tipoRuta === "CIERRE_VIAL") && fotoRutaEvidencia) {
          payload.append("fotoRutaEvidencia", fotoRutaEvidencia);
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

      toast.success("Novedad registrada con éxito. Se notificó al área administrativa.", { id: t });

      // reset parcial
      setZonas([]);
      setCategoria("PACIENTE");
      setPacienteNombre("");
      setPacienteTipoDoc("CC");
      setPacienteDocumento("");
      setTipoPaciente("ERCA");
      setFotoIngresoDomicilio(null);
      if (fotoInputRef.current) fotoInputRef.current.value = "";
      setTipoRuta("INCAPACIDAD");
      setFotoRutaEvidencia(null);
      if (fotoRutaInputRef.current) fotoRutaInputRef.current.value = "";
      setDescripcion("");
    } catch (e: any) {
      toast.error(e?.message || "Error guardando", { id: t });
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
                    value={me.cedula}
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
                    value={profesionLabel}
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
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="ej: 3001234567"
                    disabled={saving}
                  />
                </div>
              </div>

              {/* Zonas */}
              <div>
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

              {/* Categoría */}
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  <FaClipboardList className="inline-block mr-2 text-red-500" />
                  Datos de la novedad
                </label>
                <div className="flex flex-col md:flex-row gap-3">
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
                </div>

                {/* Campos condicionales */}
                {categoria === "PACIENTE" ? (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre del paciente</label>
                      <input
                        value={pacienteNombre}
                        onChange={(e) => setPacienteNombre(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                        placeholder="Ej: María Gómez"
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
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Número de documento</label>
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
                    {tipoPaciente === "IMPOSIBILIDAD_INGRESAR_DOMICILIO" ? (
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
                ) : (
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
                )}
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Descripción de la novedad</label>
                <textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Describe lo ocurrido con el mayor detalle posible..."
                  disabled={saving}
                />
                <div className="mt-2 text-xs text-gray-500">
                  Se enviará el detalle de la novedad al personal administrativo encargado para su gestión.
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  El sistema intentara capturar tu ubicacion actual al guardar la novedad.
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
