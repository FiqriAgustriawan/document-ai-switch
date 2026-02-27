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
  collaborator: CollaboratorPresence
}

// Figma-style arrow cursor SVG
function ArrowCursor({ color }: { color: string }) {
  return (
    <svg
      width="16"
      height="20"
      viewBox="0 0 16 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: `drop-shadow(0 1px 2px rgba(0,0,0,0.5))` }}
    >
      <path
        d="M0.5 0.5L15 10.5L8 11.5L5 19L0.5 0.5Z"
        fill={color}
        stroke="white"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  )
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
      if (y < -30 || y > textarea.clientHeight + 30) continue

      positions.push({ x, y, collaborator })
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

  // Periodic recalculation for smooth updates
  useEffect(() => {
    const interval = setInterval(calculatePositions, 200)
    return () => clearInterval(interval)
  }, [calculatePositions])

  if (!textareaRef.current || cursorPositions.length === 0) return null

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 25 }}
    >
      {cursorPositions.map(({ x, y, collaborator }) => (
        <div
          key={collaborator.userId}
          className="absolute"
          style={{
            left: x,
            top: y,
            transition: 'left 150ms ease-out, top 150ms ease-out',
          }}
        >
          {/* Figma-style Arrow Cursor */}
          <ArrowCursor color={collaborator.color} />
          {/* Name label below cursor */}
          <div
            className="absolute whitespace-nowrap rounded-sm shadow-lg"
            style={{
              backgroundColor: collaborator.color,
              color: 'white',
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 8px',
              top: 16,
              left: 12,
              borderRadius: '2px 6px 6px 6px',
              letterSpacing: '0.01em',
              lineHeight: '14px',
            }}
          >
            {collaborator.displayName}
          </div>
        </div>
      ))}
    </div>
  )
}
