'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

export default function HeroSection() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.1,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: 'easeOut' },
    },
  }

  return (
    <section className="relative h-screen min-h-[600px] flex items-center justify-center overflow-hidden bg-deep-graphite">
      {/* Background placeholder - Replace with hero image/video */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'linear-gradient(135deg, rgba(15, 13, 16, 0.6) 0%, rgba(21, 24, 29, 0.8) 100%)',
          backgroundColor: '#0B0D10',
        }}
      >
        {/* Placeholder for hero image/video */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-deep-graphite/30 to-deep-graphite"></div>
      </div>

      <div className="relative z-10 section-container">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="text-center max-w-3xl mx-auto"
        >
          {/* Small line above headline */}
          <motion.div variants={itemVariants} className="mb-8">
            <p className="text-sm font-medium text-mid-grey uppercase tracking-wide">
              Erfurt · Deutschlandweit · Seit 2020
            </p>
          </motion.div>

          {/* Decorative red slashes - Signature motion element */}
          <motion.div
            variants={itemVariants}
            className="flex justify-center gap-2 mb-8"
          >
            <motion.div
              className="w-1 h-16 bg-jarbou-red"
              animate={{ scaleY: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{ transformOrigin: 'bottom' }}
            />
            <motion.div
              className="w-1 h-16 bg-jarbou-red"
              animate={{ scaleY: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
              style={{ transformOrigin: 'bottom' }}
            />
          </motion.div>

          {/* Main headline */}
          <motion.h1
            variants={itemVariants}
            className="text-4xl md:text-6xl lg:text-7xl font-bold text-off-white mb-6 leading-tight"
          >
            Logistik, die messbar funktioniert.
          </motion.h1>

          {/* Supporting copy */}
          <motion.p
            variants={itemVariants}
            className="text-lg md:text-xl text-mid-grey mb-12 leading-relaxed max-w-2xl mx-auto"
          >
            Zuverlässige Zustellung, intelligente Prozesse und tägliche Qualitätssteuerung – mit eigenen Teams, moderner Flotte und transparentem Reporting.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Link
              href="/fuer-unternehmen"
              className="px-8 py-4 bg-jarbou-red text-white font-bold rounded-sm hover:bg-red-700 transition-colors text-lg w-full sm:w-auto"
            >
              Logistik anfragen
            </Link>
            <Link
              href="/karriere"
              className="px-8 py-4 border-2 border-jarbou-red text-jarbou-red font-bold rounded-sm hover:bg-jarbou-red hover:text-white transition-colors text-lg w-full sm:w-auto"
            >
              Karriere bei Jarbou
            </Link>
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <ChevronDown className="text-jarbou-red" size={32} />
      </motion.div>
    </section>
  )
}
