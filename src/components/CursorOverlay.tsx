'use client'

import { useEffect, useState } from 'react'
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

export function CursorOverlay({ collaborators, textareaRef, content }: CursorOverlayProps) {
  const [cursorPositions, setCursorPositions] = useState<CursorPixelPosition[]>([])

  useEffect(() => {
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
    ctx.font = `${fontSize}px ${style.fontFamily}`
    const charWidth = ctx.measureText('M').width

    const positions: CursorPixelPosition[] = []
    const lines = content.split('\n')
    const scrollTop = textarea.scrollTop
    const scrollLeft = textarea.scrollLeft

    for (const collaborator of collaborators) {
      if (!collaborator.cursor) continue
      const { line, col } = collaborator.cursor
      if (line < 1 || line > lines.length + 1) continue

      positions.push({
        x: paddingLeft + col * charWidth - scrollLeft,
        y: paddingTop + (line - 1) * lineHeight - scrollTop,
        collaborator,
      })
    }

    setCursorPositions(positions)
  }, [collaborators, content, textareaRef])

  // Also re-calculate on scroll
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const handleScroll = () => {
      // Trigger re-render by toggling a dummy state
      setCursorPositions((prev) => [...prev])
    }

    textarea.addEventListener('scroll', handleScroll)
    return () => textarea.removeEventListener('scroll', handleScroll)
  }, [textareaRef])

  if (!textareaRef.current || cursorPositions.length === 0) return null

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 10 }}
    >
      {cursorPositions.map(({ x, y, collaborator }) => (
        <div
          key={collaborator.userId}
          className="absolute flex flex-col items-start transition-all duration-150 ease-out"
          style={{ left: x, top: y }}
        >
          {/* Cursor line */}
          <div
            className="w-0.5 rounded-full"
            style={{
              height: '1.2em',
              backgroundColor: collaborator.color,
              boxShadow: `0 0 4px ${collaborator.color}40`,
            }}
          />
          {/* Name label */}
          <div
            className="text-white px-1.5 py-0.5 rounded whitespace-nowrap -mt-5 ml-1 shadow-lg"
            style={{
              backgroundColor: collaborator.color,
              fontSize: '10px',
              fontWeight: 600,
            }}
          >
            {collaborator.displayName}
          </div>
        </div>
      ))}
    </div>
  )
}
