'use client'

import type { CollaboratorPresence } from '@/hooks/useCollaboration'

interface CursorOverlayProps {
  collaborators: CollaboratorPresence[]
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

// Typing mode I-beam cursor
function TypingCursor({ color }: { color: string }) {
  return (
    <div className="relative flex flex-col items-center">
      {/* Top serif */}
      <div
        style={{ backgroundColor: color, width: 8, height: 2, borderRadius: 1 }}
      />
      {/* Vertical bar (blinking) */}
      <div
        className="animate-pulse"
        style={{
          backgroundColor: color,
          width: 2,
          height: 20,
          boxShadow: `0 0 6px ${color}80`,
        }}
      />
      {/* Bottom serif */}
      <div
        style={{ backgroundColor: color, width: 8, height: 2, borderRadius: 1 }}
      />
    </div>
  )
}

export function CursorOverlay({ collaborators }: CursorOverlayProps) {
  const activeCursors = collaborators.filter((c) => c.cursor !== null)

  if (activeCursors.length === 0) return null

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 50 }}
    >
      {activeCursors.map((collaborator) => {
        if (!collaborator.cursor) return null
        const { x, y, mode } = collaborator.cursor
        const isTyping = mode === 'typing'

        return (
          <div
            key={collaborator.userId}
            className="absolute"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              transition: 'left 100ms ease-out, top 100ms ease-out',
              willChange: 'left, top',
            }}
          >
            {/* Cursor icon based on mode */}
            {isTyping ? (
              <TypingCursor color={collaborator.color} />
            ) : (
              <ArrowCursor color={collaborator.color} />
            )}

            {/* Name label */}
            <div
              className="absolute whitespace-nowrap shadow-xl"
              style={{
                backgroundColor: collaborator.color,
                color: 'white',
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                top: isTyping ? 26 : 18,
                left: isTyping ? -4 : 10,
                borderRadius: isTyping ? '4px' : '2px 6px 6px 6px',
                letterSpacing: '0.01em',
                lineHeight: '16px',
              }}
            >
              {collaborator.displayName}
              {isTyping && (
                <span className="ml-1 opacity-70 text-[9px]">typing</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
