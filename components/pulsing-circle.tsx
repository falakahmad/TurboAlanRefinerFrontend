"use client"

import dynamic from "next/dynamic"
import { motion } from "framer-motion"

// Avoid SSR for WebGL-based components
const PulsingBorder = dynamic(
  () => import("@paper-design/shaders-react").then((m) => m.PulsingBorder),
  { ssr: false }
)

export default function PulsingCircle() {
  return (
    <div className="absolute bottom-8 right-8 z-30">
      <div className="relative w-20 h-20 flex items-center justify-center">
        {/* Pulsing Border Circle */}
        <PulsingBorder
          colors={["#BEECFF", "#E77EDC", "#FF4C3E", "#00FF88", "#FFD700", "#FF6B35", "#8A2BE2"]}
          colorBack="#00000000"
          speed={1.5}
          roundness={1}
          thickness={0.1}
          softness={0.2}
          intensity={5}
          spotSize={0.1}
          pulse={0.1}
          smoke={0.5}
          smokeSize={4}
          scale={0.65}
          rotation={0}
          frame={9161408.251009725}
          style={{
            width: "60px",
            height: "60px",
            borderRadius: "50%",
            // Pass spotsPerColor as a CSS custom property to avoid DOM prop warnings
            "--spots-per-color": "5",
          }}
        />

        <motion.svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 100 100"
          animate={{ rotate: 360 }}
          transition={{
            duration: 20,
            repeat: Number.POSITIVE_INFINITY,
            ease: "linear",
          }}
          style={{ transform: "scale(1.6)" }}
        >
          <defs>
            <path id="circle" d="M 50, 50 m -38, 0 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0" />
          </defs>
          <text className="text-sm instrument" style={{ fill: "white", color: "white" }}>
            <textPath href="#circle" startOffset="0%">
              Turbo Alan Refiner • AI Text Enhancement • Turbo Alan Refiner • AI Text Enhancement •
            </textPath>
          </text>
        </motion.svg>
      </div>
    </div>
  )
}
