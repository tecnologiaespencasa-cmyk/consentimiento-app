"use client"

import { ChangeEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import NextImage from "next/image"
import toast from "react-hot-toast"
import carnetLogo from "@/public/carnet/logo-white.png"
import {
  FaCamera,
  FaCloudUploadAlt,
  FaIdCard,
  FaSave,
  FaTrashAlt,
  FaUserMd,
} from "react-icons/fa"

type MeUser = {
  id: string
  nombreCompleto: string
  cedula: string
  profesion: string
  fotoCarnet: string | null
}

const PRESTADOR_SERVICIOS = "ESPECIALISTAS EN CASA MEDICINA DOMICILIARIA SAS"
const MAX_TARGET_BYTES = 180 * 1024

const profesionLabels: Record<string, string> = {
  AUXILIAR_ENFERMERIA: "Auxiliar de enfermería",
  ENFERMERIA: "Enfermería",
  MEDICO: "Médico",
  FISIOTERAPIA: "Fisioterapia",
  FONOAUDIOLOGIA: "Fonoaudiología",
  NUTRICION: "Nutrición",
  OTRO: "Otro",
}

type AutoFitTextProps = {
  children: string
  className: string
  maxSize: number
  minSize?: number
}

function AutoFitText({ children, className, maxSize, minSize = 11 }: AutoFitTextProps) {
  const textRef = useRef<HTMLParagraphElement>(null)

  useLayoutEffect(() => {
    const element = textRef.current
    if (!element) return

    const fitText = () => {
      let size = maxSize
      element.style.fontSize = `${size}px`

      while (element.scrollWidth > element.clientWidth && size > minSize) {
        size -= 1
        element.style.fontSize = `${size}px`
      }
    }

    fitText()
    const observer = new ResizeObserver(fitText)
    observer.observe(element)
    return () => observer.disconnect()
  }, [children, maxSize, minSize])

  return (
    <p ref={textRef} className={`whitespace-nowrap ${className}`}>
      {children}
    </p>
  )
}

function bytesToKb(dataUrl: string) {
  return Math.round(new Blob([dataUrl]).size / 1024)
}

function readImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error("No fue posible leer la imagen"))
      image.src = String(reader.result)
    }
    reader.onerror = () => reject(new Error("No fue posible leer el archivo"))
    reader.readAsDataURL(file)
  })
}

async function compressImage(file: File) {
  const image = await readImage(file)
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")

  if (!ctx) {
    throw new Error("Tu navegador no permite procesar la imagen")
  }

  let maxSide = 620
  let quality = 0.78
  let output = ""

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

    output = canvas.toDataURL("image/jpeg", quality)

    if (new Blob([output]).size <= MAX_TARGET_BYTES) {
      return output
    }

    if (quality > 0.46) {
      quality -= 0.08
    } else {
      maxSide = Math.round(maxSide * 0.82)
    }
  }

  return output
}

export default function MiCarnet() {
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const [me, setMe] = useState<MeUser | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)

  useEffect(() => {
    void loadMe()
  }, [])

  async function loadMe() {
    setLoading(true)
    try {
      const res = await fetch("/api/me", { cache: "no-store" })
      const data = await res.json().catch(() => null)

      if (!res.ok || !data) {
        throw new Error(data?.error || "No fue posible cargar el carné")
      }

      const user: MeUser = {
        id: data.id,
        nombreCompleto: data.nombreCompleto || "",
        cedula: data.cedula || "",
        profesion: data.profesion || "",
        fotoCarnet: data.fotoCarnet ?? null,
      }

      setMe(user)
      setPhoto(user.fotoCarnet)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error cargando carné"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const photoChanged = useMemo(() => {
    return (photo || "") !== (me?.fotoCarnet || "")
  }, [me?.fotoCarnet, photo])

  async function onFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""

    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error("Selecciona un archivo de imagen")
      return
    }

    setCompressing(true)
    const t = toast.loading("Optimizando foto...")

    try {
      const optimized = await compressImage(file)
      setPhoto(optimized)
      toast.success(`Foto optimizada a ${bytesToKb(optimized)} KB`, { id: t })
    } catch (error) {
      const message = error instanceof Error ? error.message : "No fue posible optimizar la foto"
      toast.error(message, { id: t })
    } finally {
      setCompressing(false)
    }
  }

  async function savePhoto() {
    if (!photoChanged) {
      toast("No hay cambios por guardar")
      return
    }

    setSaving(true)
    const t = toast.loading("Guardando foto...")

    try {
      const res = await fetch("/api/me/carnet", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fotoCarnet: photo }),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "No fue posible guardar la foto")
      }

      setMe((current) => (current ? { ...current, fotoCarnet: data.fotoCarnet ?? null } : current))
      setPhoto(data.fotoCarnet ?? null)
      toast.success("Foto del carné actualizada", { id: t })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error guardando foto"
      toast.error(message, { id: t })
    } finally {
      setSaving(false)
    }
  }

  const profesionLabel = me ? profesionLabels[me.profesion] || me.profesion : ""
  const canInteract = !loading && !saving && !compressing
  const nameParts = me?.nombreCompleto.trim().split(/\s+/).filter(Boolean) || []
  const givenName = nameParts[0] || "NOMBRE"
  const familyName = nameParts.slice(1).join(" ") || "APELLIDO"

  if (loading) {
    return (
      <div className="grid gap-7 px-5 py-7 md:grid-cols-[minmax(300px,420px)_1fr] md:px-8">
        <div className="aspect-[2/3] animate-pulse rounded-2xl bg-gray-100" />
        <div className="h-72 animate-pulse rounded-2xl bg-gray-100" />
      </div>
    )
  }

  if (!me) {
    return (
      <div className="px-5 py-10 text-center text-gray-600 md:px-8">
        No fue posible cargar tu carné.
      </div>
    )
  }

  return (
    <div className="grid gap-7 px-5 py-7 md:grid-cols-[minmax(300px,420px)_1fr] md:px-8">
      <section className="mx-auto w-full max-w-[390px]">
        <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl">
          <div className="absolute right-0 top-0 h-[64%] w-[62%] bg-gray-100 [clip-path:polygon(30%_0,100%_0,100%_100%,0_82%)]" />
          <div className="absolute left-0 top-0 h-24 w-24 bg-red-600 [clip-path:polygon(0_0,100%_0,0_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-[50%] bg-gradient-to-b from-transparent via-red-600/80 to-red-800" />
          <div className="absolute inset-x-0 bottom-0 h-[31%] bg-red-600" />
          <div className="absolute bottom-0 right-0 h-[28%] w-[45%] opacity-20 [background-image:linear-gradient(30deg,transparent_45%,white_46%,white_48%,transparent_49%)] [background-size:22px_38px]" />

          <div className="relative z-10 h-full px-7 py-8">
            <p className="absolute right-7 top-6 text-[10px] font-bold uppercase text-gray-500">
              Personal de salud
            </p>

            <div className="grid h-[61%] grid-cols-[minmax(0,1fr)_43%] gap-4 pt-16">
              <div className="min-w-0 pt-4">
                <AutoFitText
                  className="font-black uppercase leading-none text-red-600"
                  maxSize={32}
                >
                  {givenName}
                </AutoFitText>
                <AutoFitText
                  className="mt-1 font-bold uppercase leading-tight text-gray-500"
                  maxSize={18}
                >
                  {familyName}
                </AutoFitText>
                <div className="mt-3 h-1 w-full bg-red-600" />
                <p className="mt-3 text-base font-black uppercase text-gray-900">
                  {profesionLabel}
                </p>
              </div>

              <div className="relative flex items-start justify-center">
                <div className="relative h-[82%] min-h-60 w-full overflow-hidden rounded-lg border border-white/80 bg-gray-200 shadow-xl">
                  {photo ? (
                    <NextImage
                      src={photo}
                      alt="Foto del carné"
                      fill
                      sizes="180px"
                      unoptimized
                      className="object-cover object-center"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-gray-200 text-gray-500">
                      <FaUserMd className="text-5xl" />
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-red-700/55 to-transparent" />
                </div>
              </div>
            </div>

            <div className="absolute left-0 top-[55%] z-20">
              <div className="flex max-w-[285px] items-center rounded-r-full bg-red-600 py-2 pl-7 pr-8 text-white shadow-lg">
                <span className="mr-3 border-r border-white/40 pr-3 text-[10px] font-bold uppercase">CC</span>
                <span className="truncate text-xl font-black">{me.cedula || "CEDULA"}</span>
              </div>
            </div>

            <div className="absolute inset-x-7 bottom-1 z-20 text-white">
              <p className="text-[10px] font-bold uppercase text-white/75">
                Prestador de servicios
              </p>
              <p className="mt-1 text-xs font-extrabold leading-snug text-white">
                {PRESTADOR_SERVICIOS}
              </p>
              <div className="mt-3 border-t border-white/25 pt-2">
                <NextImage
                  src={carnetLogo}
                  alt="Especialistas en Casa"
                  className="mx-auto h-auto w-[76%] max-w-[250px] drop-shadow-[0_0_9px_rgba(255,255,255,0.3)]"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-lg bg-red-100 p-2 text-red-600">
            <FaIdCard />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Foto del carné</h2>
            <p className="text-sm text-gray-600">
              Los datos del carné vienen de tu usuario. Solo puedes cambiar la foto.
            </p>
          </div>
        </div>

        <div className="mb-5 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <dl className="grid gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="font-semibold text-gray-500">Nombre completo</dt>
              <dd className="mt-1 text-gray-900">{me.nombreCompleto || "-"}</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-500">Profesión</dt>
              <dd className="mt-1 text-gray-900">{profesionLabel || "-"}</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-500">Cédula</dt>
              <dd className="mt-1 text-gray-900">{me.cedula || "-"}</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-500">Prestador de servicios</dt>
              <dd className="mt-1 text-gray-900">{PRESTADOR_SERVICIOS}</dd>
            </div>
          </dl>
        </div>

        <input
          ref={uploadInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileSelected}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={onFileSelected}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={!canInteract}
            onClick={() => cameraInputRef.current?.click()}
            className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FaCamera className="mr-2" />
            Tomar foto
          </button>
          <button
            type="button"
            disabled={!canInteract}
            onClick={() => uploadInputRef.current?.click()}
            className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-3 font-semibold text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FaCloudUploadAlt className="mr-2" />
            Subir foto
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled={!canInteract || !photoChanged}
            onClick={() => void savePhoto()}
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-red-600 px-4 py-3 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FaSave className="mr-2" />
            {saving ? "Guardando..." : "Guardar foto"}
          </button>
          <button
            type="button"
            disabled={!canInteract || !photo}
            onClick={() => setPhoto(null)}
            className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-4 py-3 font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FaTrashAlt className="mr-2" />
            Quitar
          </button>
        </div>

        {photo && (
          <p className="mt-3 text-xs text-gray-500">
            Peso actual aproximado: {bytesToKb(photo)} KB.
          </p>
        )}
      </section>
    </div>
  )
}
