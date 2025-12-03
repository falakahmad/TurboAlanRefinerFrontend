"use client"

import { Zap, FileText, Cloud, Settings, BarChart3, Shield } from "lucide-react"

export default function FeaturesSection() {
  const features = [
    {
      icon: Zap,
      title: "Multi-Pass Refinement",
      description: "Advanced AI processing with multiple refinement passes to achieve optimal human-like text quality.",
    },
    {
      icon: FileText,
      title: "Batch Processing",
      description: "Process multiple documents simultaneously with intelligent queue management and progress tracking.",
    },
    {
      icon: Cloud,
      title: "Google Drive Integration",
      description: "Seamlessly sync with Google Drive for easy file management and collaborative workflows.",
    },
    {
      icon: Settings,
      title: "Tunable Parameters",
      description: "Fine-tune rewrite intensity, creativity levels, and detection avoidance with precision controls.",
    },
    {
      icon: BarChart3,
      title: "Real-time Analytics",
      description: "Monitor processing metrics, detection scores, and quality improvements with detailed insights.",
    },
    {
      icon: Shield,
      title: "Detection Avoidance",
      description: "Reduce AI detection flags by up to 95% while maintaining content quality and meaning.",
    },
  ]

  return (
    <section id="features" className="py-20 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-light text-gray-900 mb-4">
            <span className="instrument italic">Powerful</span> Features
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Everything you need to create human-like text that passes detection systems
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group p-6 rounded-2xl border border-gray-100 hover:border-yellow-200 hover:shadow-lg transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <feature.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-medium text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-gray-600 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
