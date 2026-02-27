'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { type Document } from '@/lib/documents'
import { type Permission } from '@/lib/sharing'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Eye, Pencil, FileText, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import DocumentEditor from '@/components/DocumentEditor'
import { PresenceIndicator } from '@/components/PresenceIndicator'
import { useCollaboration } from '@/hooks/useCollaboration'
import { useThrottle } from '@/hooks/useThrottle'
import { useDebouncedCallback } from '@/hooks/useDebounce'

interface SharedDocumentViewProps {
  document: Document
  permission: Permission
}

export function SharedDocumentView({ document: initialDocument, permission }: SharedDocumentViewProps) {
  const router = useRouter()
  const isViewOnly = permission === 'view'
  const [documentContent, setDocumentContent] = useState(initialDocument.content || '')
  const [showMarkdown, setShowMarkdown] = useState(true)

  // For edit mode, check if user is logged in
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string>('')
  const [authChecked, setAuthChecked] = useState(false)

  // Prevent infinite broadcast loop
  const isReceivingRemoteChange = useRef(false)

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setUserId(session.user.id)
        setUserEmail(session.user.email || '')
      }
      setAuthChecked(true)
    }
    checkAuth()
  }, [])

  // ── Collaboration Hook ─────────────────────────────────────────────────
  const {
    collaborators,
    typingUsers,
    isConnected,
    broadcastContentChange,
    updateCursor,
  } = useCollaboration({
    documentId: initialDocument.id,
    userId: userId ?? 'anon-viewer',
    displayName: userEmail ? userEmail.split('@')[0] : 'Viewer',
    onContentChange: (newContent: string) => {
      isReceivingRemoteChange.current = true
      setDocumentContent(newContent)
      setTimeout(() => { isReceivingRemoteChange.current = false }, 0)
    },
  })

  // ── Throttled cursor + Debounced broadcast ─────────────────────────────
  const throttledUpdateCursor = useThrottle(updateCursor, 100)
  const debouncedBroadcast = useDebouncedCallback(
    (content: string) => broadcastContentChange(content),
    300
  )

  const handleContentUpdate = useCallback((newContent: string) => {
    setDocumentContent(newContent)
    if (!isReceivingRemoteChange.current) {
      debouncedBroadcast(newContent)
    }
  }, [debouncedBroadcast])

  const handleCursorMove = useCallback((x: number, y: number) => {
    throttledUpdateCursor(x, y)
  }, [throttledUpdateCursor])

  // Edit mode requires login
  if (!isViewOnly && authChecked && !userId) {
    const returnUrl = typeof window !== 'undefined' ? window.location.pathname : ''
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-zinc-100">
        <div className="text-center max-w-md mx-4">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-6">
            <Pencil className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold mb-3">Login Diperlukan</h1>
          <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
            Dokumen ini dibagikan dalam mode edit. Kamu harus login untuk mengedit dokumen ini.
          </p>
          <button
            onClick={() => router.push(`/login?returnUrl=${encodeURIComponent(returnUrl)}`)}
            className="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl font-medium text-sm hover:from-cyan-500 hover:to-blue-500 transition-all shadow-lg"
          >
            Login untuk Edit
          </button>
        </div>
      </div>
    )
  }

  if (!authChecked && !isViewOnly) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a] text-zinc-100">
      {/* Shared document banner */}
      <div className={`px-6 py-3 flex items-center justify-between text-sm border-b ${isViewOnly
        ? 'bg-zinc-900 border-zinc-800 text-zinc-300'
        : 'bg-blue-950 border-blue-900 text-blue-200'
        }`}>
        <div className="flex items-center gap-3">
          {isViewOnly ? (
            <Eye className="w-4 h-4 text-zinc-400" />
          ) : (
            <Pencil className="w-4 h-4 text-blue-400" />
          )}
          <span>
            {isViewOnly
              ? `Melihat dokumen "${initialDocument.title}" (hanya baca)`
              : `Mengedit dokumen "${initialDocument.title}" yang dibagikan`
            }
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Presence Indicator */}
          <PresenceIndicator
            collaborators={collaborators}
            isConnected={isConnected}
            typingUsers={typingUsers}
          />

          {isViewOnly && (
            <button
              onClick={() => setShowMarkdown(!showMarkdown)}
              className="text-xs px-3 py-1 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
            >
              {showMarkdown ? 'Raw Text' : 'Markdown'}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {isViewOnly ? (
          // View-only mode — live content updates via broadcast
          <div className="h-full overflow-y-auto">
            {showMarkdown ? (
              <div className="max-w-4xl mx-auto p-8 prose prose-invert prose-sm">
                <h1 className="text-3xl font-bold mb-6 text-zinc-100">{initialDocument.title}</h1>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {documentContent}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="max-w-4xl mx-auto p-8">
                <h1 className="text-3xl font-bold mb-6 text-zinc-100">{initialDocument.title}</h1>
                <pre className="whitespace-pre-wrap font-mono text-sm text-zinc-300 leading-relaxed">
                  {documentContent}
                </pre>
              </div>
            )}

            {!documentContent && (
              <div className="flex flex-col items-center justify-center h-full text-center text-zinc-500">
                <FileText className="w-12 h-12 mb-4 text-zinc-600" />
                <p>Dokumen ini masih kosong.</p>
              </div>
            )}
          </div>
        ) : (
          // Edit mode (user is logged in) — full collaboration
          userId && (
            <DocumentEditor
              key={initialDocument.id}
              initialContent={documentContent}
              documentId={initialDocument.id}
              userId={userId}
              onContentUpdate={handleContentUpdate}
              externalContent={documentContent}
              onCursorMove={handleCursorMove}
              collaborators={collaborators}
            />
          )
        )}
      </div>
    </div>
  )
}
