"use client"

import { signIn } from "next-auth/react"
import { useCallback, useEffect, useRef, useState } from "react"
import Script from "next/script"
import { FaUser, FaLock, FaStethoscope, FaShieldAlt, FaHome } from "react-icons/fa"
import Image from "next/image"
import styles from "./login.module.css"

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? ""

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare global {
  interface Window {
    grecaptcha?: {
      render: (container: HTMLElement, params: Record<string, unknown>) => number
      reset: (id?: number) => void
      getResponse: (id?: number) => string
    }
  }
}

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const [captchaRequired, setCaptchaRequired] = useState(false)
  const [captchaToken, setCaptchaToken] = useState("")
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const [retryAfter, setRetryAfter] = useState(0)

  const captchaRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<number | null>(null)

  const blocked = retryAfter > 0
  const captchaConfigured = RECAPTCHA_SITE_KEY.length > 0

  // Consulta asesora al backend para saber si toca CAPTCHA o si hay bloqueo.
  const runPrecheck = useCallback(async (user: string) => {
    try {
      const res = await fetch("/api/auth/login-precheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user }),
      })
      if (!res.ok) return
      const data = (await res.json()) as {
        captchaRequired?: boolean
        blocked?: boolean
        retryAfterSeconds?: number
      }
      setCaptchaRequired(Boolean(data.captchaRequired) && captchaConfigured)
      if (data.blocked && data.retryAfterSeconds) {
        setRetryAfter(data.retryAfterSeconds)
      }
    } catch {
      // silencioso: es solo orientativo
    }
  }, [captchaConfigured])

  // Evalua por IP al cargar la pagina.
  useEffect(() => {
    runPrecheck("")
  }, [runPrecheck])

  // Cuenta regresiva del bloqueo temporal.
  useEffect(() => {
    if (retryAfter <= 0) return
    const t = setInterval(() => {
      setRetryAfter((s) => (s <= 1 ? 0 : s - 1))
    }, 1000)
    return () => clearInterval(t)
  }, [retryAfter])

  // Renderiza el widget de reCAPTCHA cuando hace falta y el script esta listo.
  useEffect(() => {
    if (!captchaRequired || !scriptLoaded || !captchaConfigured) return
    if (widgetIdRef.current !== null) return
    if (!captchaRef.current || !window.grecaptcha) return

    widgetIdRef.current = window.grecaptcha.render(captchaRef.current, {
      sitekey: RECAPTCHA_SITE_KEY,
      callback: (token: string) => setCaptchaToken(token),
      "expired-callback": () => setCaptchaToken(""),
    })
  }, [captchaRequired, scriptLoaded, captchaConfigured])

  const resetCaptcha = () => {
    setCaptchaToken("")
    if (widgetIdRef.current !== null && window.grecaptcha) {
      window.grecaptcha.reset(widgetIdRef.current)
    }
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return m > 0 ? `${m} min ${sec.toString().padStart(2, "0")} s` : `${sec} s`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (blocked) {
      setError(`Demasiados intentos. Intenta de nuevo en ${formatTime(retryAfter)}.`)
      return
    }

    if (captchaRequired && !captchaToken) {
      setError("Por favor confirma que no eres un robot.")
      return
    }

    setIsLoading(true)

    const res = await signIn("credentials", {
      username,
      password,
      captchaToken,
      redirect: false,
    })

    setIsLoading(false)

    if (res?.error) {
      setError("Usuario o contraseña incorrectos")
      resetCaptcha()
      // Reevalua estado: puede activarse CAPTCHA o bloqueo tras este fallo.
      runPrecheck(username)
    } else {
      window.location.href = "/"
    }
  }

  return (
    <div className={styles.container}>
      {captchaConfigured && (
        <Script
          src="https://www.google.com/recaptcha/api.js?render=explicit"
          strategy="afterInteractive"
          onLoad={() => setScriptLoaded(true)}
        />
      )}
      <div className={styles.loginWrapper}>

        {/* Panel IZQUIERDO - Formulario Login (primero en móviles) */}
        <div className={styles.loginPanel}>
          <div className={styles.loginContainer}>

            {/* Header del Login */}
            <div className={styles.loginHeader}>
              <div className={styles.logoMobileWrapper}>
                {/* Logo Principal */}
                <Image
                  src="/login/logo.png"
                  alt="Especialistas en Casa"
                  width={240}
                  height={240}
                  priority
                />
              </div>
              <h2 className={styles.loginTitle}>Portal Administrativo</h2>
              <p className={styles.loginSubtitle}>Acceso exclusivo para personal autorizado</p>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit}>
              {/* Mensaje de Error */}
              {error && (
                <div className={styles.errorAlert}>
                  <div className={styles.errorContent}>
                    <svg className={styles.errorIcon} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span className={styles.errorMessage}>{error}</span>
                  </div>
                </div>
              )}

              {/* Campo Usuario */}
              <div className={styles.formGroup}>
                <label className={`${styles.formLabel} ${styles.iconLabel}`}>
                  <FaUser className={styles.iconRed} />
                  Usuario
                </label>
                <div className={styles.inputWrapper}>
                  <input
                    type="text"
                    placeholder="Ingrese su usuario"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onBlur={(e) => runPrecheck(e.target.value)}
                    className={styles.inputField}
                    required
                    disabled={isLoading}
                    autoComplete="username"
                    maxLength={50}
                  />
                  <FaUser className={styles.inputIcon} />
                </div>
              </div>

              {/* Campo Contraseña */}
              <div className={styles.formGroup}>
                <label className={`${styles.formLabel} ${styles.iconLabel}`}>
                  <FaLock className={styles.iconRed} />
                  Contraseña
                </label>
                <div className={styles.inputWrapper}>
                  <input
                    type="password"
                    placeholder="Ingrese su contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={styles.inputField}
                    required
                    disabled={isLoading}
                    autoComplete="current-password"
                    maxLength={200}
                  />
                  <FaLock className={styles.inputIcon} />
                </div>
              </div>

              {/* reCAPTCHA (solo tras varios intentos fallidos) */}
              {captchaRequired && captchaConfigured && (
                <div className={styles.formGroup}>
                  <div ref={captchaRef} />
                </div>
              )}

              {/* Botón de Submit */}
              <button
                type="submit"
                disabled={isLoading || blocked}
                className={styles.submitButton}
              >
                <span className={styles.buttonContent}>
                  {isLoading ? (
                    <>
                      <svg className={styles.spinner} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Verificando...
                    </>
                  ) : blocked ? `Bloqueado (${formatTime(retryAfter)})` : "Iniciar Sesión"}
                </span>
              </button>

              {/* Información de Soporte */}
              <div className={styles.supportInfo}>
                <p className={styles.supportText}>
                  ¿Necesita ayuda? Contactanos a {" "}
                  <span className={styles.supportNumber}>info@especialistasencasa.com</span>
                </p>
              </div>
            </form>
          </div>
        </div>

        {/* Panel DERECHO - Información de la Empresa (segundo en móviles) */}
        <div className={styles.infoPanel}>

            <div className={styles.desktopLogoText}>
              <h1 className={styles.desktopLogoTitle}>Especialistas en casa</h1>
              <p className={styles.desktopLogoTagline}>Salud Domiciliaria</p>
            </div>

          {/* Tarjeta de Información */}
          <div className={styles.infoCard}>
            <div className={styles.infoCardContent}>
              <p className={styles.infoDescription}>
                GENERAMOS EXPERIENCIAS EXTRAORDINARIAS EN SALUD
              </p>
            </div>
          </div>

          {/* Cita Inspiradora */}
          <div className={styles.quote}>
            TU HACES PARTE DE ELLO.
          </div>

          {/* Características */}
          <div className={styles.features}>
            <div className={styles.featureItem}>
              <div className={styles.featureIcon}>
                <FaStethoscope />
              </div>
              <div className={styles.featureContent}>
                <h3>Atención Especializada</h3>
                <p>Auxiliares, Enfermeros, Médicos y especialistas certificados</p>
              </div>
            </div>

            <div className={styles.featureItem}>
              <div className={styles.featureIcon}>
                <FaShieldAlt />
              </div>
              <div className={styles.featureContent}>
                <h3>Seguridad Garantizada</h3>
                <p>Protección de datos de pacientes</p>
              </div>
            </div>

            <div className={styles.featureItem}>
              <div className={styles.featureIcon}>
                <FaHome />
              </div>
              <div className={styles.featureContent}>
                <h3>Cobertura Domiciliaria</h3>
                <p>Servicio en toda el área metropolitana y alrededores</p>
              </div>
            </div>
          </div>

          {/* Footer  */}
          <div className={styles.footer}>
            <p className={styles.footerText}>
              © 2026 Especialistas en Casa IPS.<br className="md:hidden" /> Salud Domiciliaria.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
