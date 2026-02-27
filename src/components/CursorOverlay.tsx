'use client'

import { useCallback, useEffect, useState } from 'react'
import type { CollaboratorPresence, PointerCursor, TypingCursor } from '@/hooks/useCollaboration'

interface CursorOverlayProps {
  collaborators: CollaboratorPresence[]
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
}

interface RenderedCursor {
  collaborator: CollaboratorPresence
  left: number   // px
  top: number    // px
  isTyping: boolean
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
      style={{ filter: `drop-shadow(0 1px 3px rgba(0,0,0,0.6))` }}
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

// Typing I-beam cursor — sized to match monospace text
function TypingCursor({ color, lineHeight }: { color: string; lineHeight: number }) {
  return (
    <div className="relative flex flex-col items-center">
      {/* Top serif */}
      <div style={{ backgroundColor: color, width: 6, height: 1.5, borderRadius: 1 }} />
      {/* Vertical bar */}
      <div
        className="animate-pulse"
        style={{
          backgroundColor: color,
          width: 2,
          height: Math.max(lineHeight - 4, 14),
          boxShadow: `0 0 8px ${color}90`,
        }}
      />
      {/* Bottom serif */}
      <div style={{ backgroundColor: color, width: 6, height: 1.5, borderRadius: 1 }} />
    </div>
  )
}

export function CursorOverlay({ collaborators, textareaRef }: CursorOverlayProps) {
  const [cursors, setCursors] = useState<RenderedCursor[]>([])
  const [lineHeight, setLineHeight] = useState(24)

  const calculate = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return

    const parent = ta.parentElement
    if (!parent) return

    const style = window.getComputedStyle(ta)
    const fontSize = parseFloat(style.fontSize)
    const lh = parseFloat(style.lineHeight) || fontSize * 1.5
    setLineHeight(lh)

    const paddingTop = parseFloat(style.paddingTop)
    const paddingLeft = parseFloat(style.paddingLeft)

    // Measure char width for monospace
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.font = `${style.fontWeight} ${fontSize}px ${style.fontFamily}`
    const charWidth = ctx.measureText('M').width

    const parentRect = parent.getBoundingClientRect()
    const scrollTop = ta.scrollTop
    const scrollLeft = ta.scrollLeft

    const results: RenderedCursor[] = []

    for (const collab of collaborators) {
      if (!collab.cursor) continue

      let left: number
      let top: number
      let isTyping: boolean

      if (collab.cursor.mode === 'typing') {
        const tc = collab.cursor as TypingCursor
        // Calculate pixel position from line/col using local textarea metrics
        left = paddingLeft + tc.col * charWidth - scrollLeft
        top = paddingTop + (tc.line - 1) * lh - scrollTop
        isTyping = true
      } else {
        const pc = collab.cursor as PointerCursor
        // Percentage-based position relative to parent
        left = (pc.x / 100) * parentRect.width
        top = (pc.y / 100) * parentRect.height
        isTyping = false
      }

      // Only show if visible within the pane
      if (top < -40 || top > parentRect.height + 40) continue
      if (left < -40 || left > parentRect.width + 40) continue

      results.push({ collaborator: collab, left, top, isTyping })
    }

    setCursors(results)
  }, [collaborators, textareaRef])

  // Recalculate on collaborators change
  useEffect(() => {
    calculate()
  }, [calculate])

  // Recalculate on scroll
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    const handleScroll = () => calculate()
    ta.addEventListener('scroll', handleScroll)
    return () => ta.removeEventListener('scroll', handleScroll)
  }, [textareaRef, calculate])

  // Periodic updates for smooth animation
  useEffect(() => {
    const id = setInterval(calculate, 150)
    return () => clearInterval(id)
  }, [calculate])

  if (cursors.length === 0) return null

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 50 }}
    >
      {cursors.map(({ collaborator, left, top, isTyping }) => (
        <div
          key={collaborator.userId}
          className="absolute"
          style={{
            left,
            top,
            transition: 'left 80ms ease-out, top 80ms ease-out',
            willChange: 'left, top',
          }}
        >
          {/* Cursor icon */}
          {isTyping ? (
            <TypingCursor color={collaborator.color} lineHeight={lineHeight} />
          ) : (
            <ArrowCursor color={collaborator.color} />
          )}

          {/* Name label */}
          <div
            className="absolute whitespace-nowrap shadow-xl"
            style={{
              backgroundColor: collaborator.color,
              color: 'white',
              fontSize: '10px',
              fontWeight: 700,
              padding: '1px 6px',
              top: isTyping ? lineHeight + 2 : 18,
              left: isTyping ? -2 : 10,
              borderRadius: isTyping ? '3px' : '2px 5px 5px 5px',
              letterSpacing: '0.02em',
              lineHeight: '14px',
            }}
          >
            {collaborator.displayName}
            {isTyping && (
              <span className="ml-1 opacity-60 text-[8px]">typing</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
