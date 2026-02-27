'use client'

import { useEffect, useState, useCallback } from 'react'
import type { CollaboratorPresence } from '@/hooks/useCollaboration'

interface CursorOverlayProps {
  collaborators: CollaboratorPresence[]
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  content: string
}

interface CursorPixelPosition {
  x: number
  y: number
  lineHeight: number
  collaborator: CollaboratorPresence
}

export function CursorOverlay({ collaborators, textareaRef, content }: CursorOverlayProps) {
  const [cursorPositions, setCursorPositions] = useState<CursorPixelPosition[]>([])

  const calculatePositions = useCallback(() => {
    if (!textareaRef.current) return

    const textarea = textareaRef.current
    const style = window.getComputedStyle(textarea)
    const fontSize = parseFloat(style.fontSize)
    const lineHeight = parseFloat(style.lineHeight) || fontSize * 1.5
    const paddingTop = parseFloat(style.paddingTop)
    const paddingLeft = parseFloat(style.paddingLeft)

    // Measure character width using canvas (monospace font)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.font = `${style.fontWeight} ${fontSize}px ${style.fontFamily}`
    const charWidth = ctx.measureText('M').width

    const positions: CursorPixelPosition[] = []
    const lines = content.split('\n')
    const scrollTop = textarea.scrollTop
    const scrollLeft = textarea.scrollLeft

    for (const collaborator of collaborators) {
      if (!collaborator.cursor) continue
      const { line, col } = collaborator.cursor
      if (line < 1 || line > lines.length + 1) continue

      const x = paddingLeft + col * charWidth - scrollLeft
      const y = paddingTop + (line - 1) * lineHeight - scrollTop

      // Only show if within visible area
      if (y < -lineHeight || y > textarea.clientHeight + lineHeight) continue

      positions.push({ x, y, lineHeight, collaborator })
    }

    setCursorPositions(positions)
  }, [collaborators, content, textareaRef])

  // Recalculate on collaborators/content change
  useEffect(() => {
    calculatePositions()
  }, [calculatePositions])

  // Recalculate on scroll
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const handleScroll = () => calculatePositions()
    textarea.addEventListener('scroll', handleScroll)
    return () => textarea.removeEventListener('scroll', handleScroll)
  }, [textareaRef, calculatePositions])

  // Recalculate on window resize
  useEffect(() => {
    const handleResize = () => calculatePositions()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [calculatePositions])

  if (!textareaRef.current || cursorPositions.length === 0) return null

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 20 }}
    >
      {cursorPositions.map(({ x, y, lineHeight: lh, collaborator }) => (
        <div
          key={collaborator.userId}
          className="absolute transition-all duration-150 ease-out"
          style={{ left: x, top: y }}
        >
          {/* Cursor line — blinking animation */}
          <div
            className="rounded-full animate-pulse"
            style={{
              width: 2,
              height: lh,
              backgroundColor: collaborator.color,
              boxShadow: `0 0 8px ${collaborator.color}80, 0 0 2px ${collaborator.color}`,
            }}
          />
          {/* Name label */}
          <div
            className="absolute whitespace-nowrap rounded-md shadow-xl border border-white/10"
            style={{
              backgroundColor: collaborator.color,
              color: 'white',
              fontSize: '10px',
              fontWeight: 700,
              padding: '1px 6px',
              top: -18,
              left: 4,
              letterSpacing: '0.02em',
            }}
          >
            {collaborator.displayName}
          </div>
        </div>
      ))}
    </div>
  )
}
