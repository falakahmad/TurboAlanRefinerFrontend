import type React from "react"
import type { Metadata } from "next"
import { Figtree } from "next/font/google"
import { GeistMono } from "geist/font/mono"
import { Instrument_Serif } from "next/font/google"
import "./globals.css"
import { FileProvider } from "@/contexts/FileContext"
import { ProcessingProvider } from "@/contexts/ProcessingContext"
import { SchemaProvider } from "@/contexts/SchemaContext"
import { AnalyticsProvider } from "@/contexts/AnalyticsContext"
import { AuthProvider } from "@/contexts/AuthContext"
import { LoadingProvider } from "@/contexts/LoadingContext"
import LoadingBar from "@/components/loading-bar"
import GlobalLoadingBar from "@/components/global-loading-bar"

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-figtree",
  display: "swap",
})

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Turbo Alan Refiner",
  description: "Advanced AI-powered text refinement platform",
  generator: "Next.js",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${figtree.variable} ${instrumentSerif.variable} ${GeistMono.variable}`}>
      <head />
      <body>
        <LoadingProvider>
          <AuthProvider>
            <FileProvider>
              <ProcessingProvider>
                <SchemaProvider>
                  <AnalyticsProvider>
                    <LoadingBar />
                    <GlobalLoadingBar />
                    {children}
                  </AnalyticsProvider>
                </SchemaProvider>
              </ProcessingProvider>
            </FileProvider>
          </AuthProvider>
        </LoadingProvider>
      </body>
    </html>
  )
}
