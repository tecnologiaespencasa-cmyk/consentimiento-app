"use client";

import { useEffect, useMemo, useState } from "react";
import { FaBullhorn, FaFilePdf, FaImage, FaPen, FaSpinner, FaTimes } from "react-icons/fa";
import { formatBogotaDateTime } from "@/lib/bogotaDate";

type Boletin = {
  id: string;
  titulo: string;
  contenidoHtml?: string | null;
  adjuntoTipo?: "IMAGE" | "PDF" | null;
  adjuntoDriveItemId?: string | null;
  adjuntoNombre?: string | null;
  adjuntoMimeType?: string | null;
  publicado: boolean;
  createdAt: string;
  updatedAt: string;
  autor?: {
    nombres?: string | null;
    primerApellido?: string | null;
    segundoApellido?: string | null;
    username?: string | null;
  } | null;
};

function formatDateTime(iso?: string) {
  if (!iso) return "";
  return formatBogotaDateTime(iso, "es-CO", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function isNewWithinHours(iso?: string, hours = 24) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= hours * 60 * 60 * 1000;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function textToSafeHtml(text: string) {
  // Convierte texto a HTML seguro, manteniendo saltos de línea.
  return escapeHtml(text).replace(/\n/g, "<br/>");
}

export default function BoletinInformativo({ canEdit }: { canEdit: boolean }) {
  const [boletin, setBoletin] = useState<Boletin | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  // Editor
  const [titulo, setTitulo] = useState("");
  const [modo, setModo] = useState<"TEXTO" | "HTML">("TEXTO");
  const [contenido, setContenido] = useState("");

  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<
    | {
      driveItemId: string;
      fileName: string;
      mimeType: string | null;
      tipoAdjunto: "IMAGE" | "PDF";
    }
    | null
  >(null);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/boletin", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      setBoletin(data || null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const autorLabel = useMemo(() => {
    const a = boletin?.autor;
    const nombre = `${a?.nombres ?? ""} ${a?.primerApellido ?? ""} ${a?.segundoApellido ?? ""}`
      .replace(/\s+/g, " ")
      .trim();
    return nombre || a?.username || "";
  }, [boletin]);

  const previewHtml = useMemo(() => {
    if (!contenido.trim()) return "";
    return modo === "HTML" ? contenido : textToSafeHtml(contenido);
  }, [contenido, modo]);

  function openEditor() {
    setErr(null);
    setOkMsg(null);
    setOpen(true);

    setTitulo(boletin?.titulo ?? "");

    // Para editar, no intentamos "reconstruir" texto desde HTML.
    // Si el admin quiere modo TEXTO, que escriba de nuevo.
    setModo("TEXTO");
    setContenido("");

    if (boletin?.adjuntoDriveItemId && boletin?.adjuntoTipo) {
      setUploaded({
        driveItemId: boletin.adjuntoDriveItemId,
        fileName: boletin.adjuntoNombre || "adjunto",
        mimeType: boletin.adjuntoMimeType || null,
        tipoAdjunto: boletin.adjuntoTipo,
      });
    } else {
      setUploaded(null);
    }
  }

  async function handleFile(file: File) {
    setErr(null);
    setOkMsg(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/boletin/upload", {
        method: "POST",
        body: fd,
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "No se pudo subir el archivo");

      setUploaded({
        driveItemId: j.driveItemId,
        fileName: j.fileName,
        mimeType: j.mimeType ?? null,
        tipoAdjunto: j.tipoAdjunto,
      });
      setOkMsg("Adjunto cargado correctamente.");
    } catch (e: any) {
      setErr(e?.message || "Error subiendo archivo");
    } finally {
      setUploading(false);
    }
  }

  function clearAttachment() {
    setUploaded(null);
  }

  async function save() {
    setErr(null);
    setOkMsg(null);

    if (!titulo.trim()) {
      setErr("El título es obligatorio.");
      return;
    }

    const contenidoHtml = contenido.trim()
      ? modo === "HTML"
        ? contenido
        : textToSafeHtml(contenido)
      : null;

    setSaving(true);
    try {
      const payload = {
        titulo: titulo.trim(),
        contenidoHtml,
        adjuntoTipo: uploaded?.tipoAdjunto ?? null,
        adjuntoDriveItemId: uploaded?.driveItemId ?? null,
        adjuntoNombre: uploaded?.fileName ?? null,
        adjuntoMimeType: uploaded?.mimeType ?? null,
      };

      const res = await fetch("/api/boletin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "No se pudo guardar el boletín");

      setOkMsg("Boletín publicado.");
      setOpen(false);
      await load();
    } catch (e: any) {
      setErr(e?.message || "Error guardando boletín");
    } finally {
      setSaving(false);
    }
  }

  const isNew = isNewWithinHours(boletin?.updatedAt, 24);

  return (
    <div className="bg-white rounded-3xl shadow-xl p-8 mb-12 border border-red-100">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center">
          <div className="p-4 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl mr-5 shadow-lg">
            <FaBullhorn className="text-3xl text-white" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-black text-gray-800">Boletín informativo</h2>
              {isNew && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                  Nuevo
                </span>
              )}
            </div>
            <p className="text-gray-600">
              {loading
                ? "Cargando…"
                : boletin
                  ? `Actualizado: ${formatDateTime(boletin.updatedAt)}${autorLabel ? ` • Por: ${autorLabel}` : ""}`
                  : "No hay boletín publicado todavía"}
            </p>
          </div>
        </div>

        {canEdit && (
          <button
            onClick={openEditor}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 transition"
          >
            <FaPen />
            Editar
          </button>
        )}
      </div>

      {/* Contenido */}
      <div className="mt-8">
        {loading ? (
          <div className="h-24 bg-gray-50 rounded-2xl animate-pulse" />
        ) : !boletin ? (
          <div className="p-5 bg-gray-50 border border-gray-200 rounded-2xl text-gray-600">
            Aquí aparecerán los comunicados internos (imagen, PDF o mensaje tipo correo) publicados por el área administrativa.
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-900">{boletin.titulo}</h3>

            {boletin.contenidoHtml && (
              <div
                className="text-gray-700 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: boletin.contenidoHtml }}
              />
            )}

            {boletin.adjuntoDriveItemId && boletin.adjuntoTipo === "IMAGE" && (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                  <FaImage />
                  <span>{boletin.adjuntoNombre || "Imagen"}</span>
                </div>
                <img
                  src={`/api/boletin/archivo/${encodeURIComponent(boletin.adjuntoDriveItemId)}`}
                  alt={boletin.adjuntoNombre || "Boletín"}
                  className="w-full max-h-[520px] object-contain rounded-xl"
                />
              </div>
            )}

            {boletin.adjuntoDriveItemId && boletin.adjuntoTipo === "PDF" && (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-gray-700">
                  <FaFilePdf className="text-red-600" />
                  <div>
                    <p className="font-semibold">{boletin.adjuntoNombre || "Documento"}</p>
                    <p className="text-xs text-gray-500">PDF</p>
                  </div>
                </div>
                <a
                  href={`/api/boletin/archivo/${encodeURIComponent(boletin.adjuntoDriveItemId)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver PDF
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal editor */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-gray-800">Publicar boletín</h3>
                <p className="text-sm text-gray-600">
                  Visible para todos los usuarios. Solo Administrativos pueden editar.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-2 rounded-xl hover:bg-gray-100 text-gray-600"
                aria-label="Cerrar"
              >
                <FaTimes />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {(err || okMsg) && (
                <div
                  className={`p-4 rounded-2xl border ${err
                    ? "bg-red-50 border-red-200 text-red-700"
                    : "bg-green-50 border-green-200 text-green-700"
                    }`}
                >
                  {err ?? okMsg}
                </div>
              )}

              <div>
                <label className="text-sm font-semibold text-gray-700">Título</label>
                <input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  className="mt-1 w-full border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-200"
                  placeholder="Ej: Cambios de ruta / Recordatorio operativo / Aviso importante"
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-semibold text-gray-700">Contenido (tipo correo)</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModo("TEXTO")}
                    className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition ${modo === "TEXTO"
                      ? "bg-red-600 text-white border-red-600"
                      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                      }`}
                  >
                    Texto
                  </button>
                  <button
                    type="button"
                    onClick={() => setModo("HTML")}
                    className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition ${modo === "HTML"
                      ? "bg-red-600 text-white border-red-600"
                      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                      }`}
                  >
                    HTML
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <textarea
                    value={contenido}
                    onChange={(e) => setContenido(e.target.value)}
                    className="w-full min-h-[200px] border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-200"
                    placeholder={
                      modo === "HTML"
                        ? "Puedes pegar HTML simple (sin scripts)."
                        : "Escribe el comunicado como si fuera un correo."
                    }
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    {modo === "TEXTO"
                      ? "El texto se publica con saltos de línea (seguro)."
                      : "Modo HTML: úsalo solo si necesitas formato avanzado."}
                  </p>
                </div>

                <div>
                  <div className="text-sm font-semibold text-gray-700 mb-2">Vista previa</div>
                  <div className="min-h-[200px] border border-gray-200 rounded-2xl p-4 bg-gray-50">
                    {previewHtml ? (
                      <div
                        className="text-gray-700 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: previewHtml }}
                      />
                    ) : (
                      <div className="text-gray-500">Sin contenido</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t pt-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-gray-800">Adjuntar imagen o PDF</h4>
                    <p className="text-xs text-gray-500">
                      El archivo se sube a SharePoint y se muestra dentro del portal.
                    </p>
                  </div>

                  {uploaded && (
                    <button
                      type="button"
                      onClick={clearAttachment}
                      className="text-sm font-semibold text-red-600 hover:text-red-700"
                    >
                      Quitar adjunto
                    </button>
                  )}
                </div>

                <div className="mt-3">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleFile(f);
                    }}
                    className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-red-600 file:text-white hover:file:bg-red-700"
                  />
                </div>

                {uploading && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                    <FaSpinner className="animate-spin" />
                    Subiendo archivo…
                  </div>
                )}

                {uploaded && !uploading && (
                  <div className="mt-3 p-4 rounded-2xl border border-gray-200 bg-white flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {uploaded.tipoAdjunto === "PDF" ? (
                        <FaFilePdf className="text-red-600" />
                      ) : (
                        <FaImage className="text-amber-600" />
                      )}
                      <div>
                        <p className="font-semibold text-gray-800">{uploaded.fileName}</p>
                        <p className="text-xs text-gray-500">{uploaded.tipoAdjunto}</p>
                      </div>
                    </div>
                    <a
                      href={`/api/boletin/archivo/${uploaded.driveItemId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-2 rounded-xl border bg-gray-50 hover:bg-gray-100 transition text-sm font-semibold"
                    >
                      Ver
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t flex items-center justify-end gap-3">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition font-semibold"
                disabled={saving || uploading}
              >
                Cancelar
              </button>
              <button
                onClick={save}
                className="px-4 py-2 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 transition disabled:opacity-60"
                disabled={saving || uploading}
              >
                {saving ? (
                  <span className="inline-flex items-center gap-2">
                    <FaSpinner className="animate-spin" />
                    Publicando…
                  </span>
                ) : (
                  "Guardar y publicar"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
