"use client"

import { Upload, Cog, Download, CheckCircle } from "lucide-react"

export default function HowItWorksSection() {
  const steps = [
    {
      icon: Upload,
      title: "Upload Your Content",
      description: "Upload text files or connect your Google Drive for seamless file management.",
    },
    {
      icon: Cog,
      title: "Configure Settings",
      description: "Adjust refinement parameters, intensity levels, and detection avoidance settings.",
    },
    {
      icon: CheckCircle,
      title: "AI Processing",
      description: "Our advanced AI performs multiple refinement passes to optimize your content.",
    },
    {
      icon: Download,
      title: "Download Results",
      description: "Get your refined text with detailed analytics and quality metrics.",
    },
  ]

  return (
    <section id="how-it-works" className="py-20 px-6 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-light text-gray-900 mb-4">
            <span className="instrument italic">How</span> It Works
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Simple, powerful workflow to transform your AI-generated text into human-like content
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <div key={index} className="text-center group">
              <div className="relative mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-300">
                  <step.icon className="w-8 h-8 text-white" />
                </div>
                <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gray-900 text-white text-xs flex items-center justify-center font-medium">
                  {index + 1}
                </div>
              </div>
              <h3 className="text-xl font-medium text-gray-900 mb-2">{step.title}</h3>
              <p className="text-gray-600 leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
