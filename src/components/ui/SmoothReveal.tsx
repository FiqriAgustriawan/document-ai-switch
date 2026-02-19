'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SmoothRevealProps {
  children: ReactNode
  delay?: number
  className?: string
  width?: 'full' | 'auto'
}

export const SmoothReveal = ({ children, delay = 0, className, width = 'full' }: SmoothRevealProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, filter: 'blur(5px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }} // Custom easing
      className={cn(width === 'full' ? 'w-full' : 'w-auto', className)}
    >
      {children}
    </motion.div>
  )
}
