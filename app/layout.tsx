import type { Metadata } from "next"
import { Inter, Poppins } from "next/font/google"
import "./globals.css"
import Providers from "./providers"
import Navbar from "./components/Navbar"
import { Toaster } from "react-hot-toast"

// Fuentes optimizadas para el sector salud
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const poppins = Poppins({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-poppins",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Portal Administrativo | Especialistas en Casa IPS",
  description: "Sistema de gestión integral para servicios de salud domiciliaria",
  keywords: ["salud domiciliaria", "consentimientos informados", "cuidado médico", "atención en casa"],
  authors: [{ name: "Especialistas en Casa IPS" }],
  robots: "index, follow",
  viewport: "width=device-width, initial-scale=1, maximum-scale=5",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`${inter.variable} ${poppins.variable}`}>
      <head>
        {/* Favicon y meta tags adicionales */}
        <link rel="icon" type="image/png" href="/login/logo.png" />
        <link rel="apple-touch-icon" href="/login/logo.png" />
        <meta name="theme-color" content="#dc2626" />
        
        {/* Open Graph para redes sociales */}
        <meta property="og:title" content="Portal Administrativo | Especialistas en Casa IPS" />
        <meta property="og:description" content="Sistema de gestión integral para servicios de salud domiciliaria" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Especialistas en Casa IPS" />
      </head>
      
      <body
        className={`${inter.className} antialiased bg-gradient-to-b from-red-50 to-white min-h-screen`}
      >
        <Providers>
          {/* Navbar mejorado */}
          <Navbar />
          
          {/* Contenido principal con padding optimizado */}
          <main className="min-h-[calc(100vh-4rem)] pt-4 pb-8">
            {children}
          </main>
          
          {/* Toaster para notificaciones */}
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1f2937',
                color: '#f9fafb',
                borderRadius: '12px',
                padding: '16px',
                fontSize: '14px',
                fontWeight: '500',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
              },
              success: {
                style: {
                  background: '#059669',
                },
                iconTheme: {
                  primary: '#fff',
                  secondary: '#059669',
                },
              },
              error: {
                style: {
                  background: '#dc2626',
                },
                iconTheme: {
                  primary: '#fff',
                  secondary: '#dc2626',
                },
              },
              loading: {
                style: {
                  background: '#4b5563',
                },
              },
            }}
          />
        </Providers>
        
        {/* Scripts de analítica (opcional) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Prevenir zoom en input en iOS
              document.addEventListener('touchstart', function(event) {
                if (event.touches.length > 1) {
                  event.preventDefault();
                }
              }, { passive: false });
              
              let lastTouchEnd = 0;
              document.addEventListener('touchend', function(event) {
                const now = (new Date()).getTime();
                if (now - lastTouchEnd <= 300) {
                  event.preventDefault();
                }
                lastTouchEnd = now;
              }, false);
            `,
          }}
        />
      </body>
    </html>
  )
}