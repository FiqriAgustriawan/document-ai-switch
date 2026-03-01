'use client'

import { useState, useEffect, use, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { GalaxyBackground } from "@/components/ui/GalaxyBackground"
import { SmoothReveal } from "@/components/ui/SmoothReveal"
import DocumentEditor from "@/components/DocumentEditor"
import AIChat from "@/components/AIChat"
import { DocumentSidebar } from "@/components/DocumentSidebar"
import { supabase } from '@/lib/supabase'
import { Loader2, Share2, History, Save } from 'lucide-react'
import { User } from '@supabase/supabase-js'
import { cn } from '@/lib/utils'
import { ShareDialog } from '@/components/ShareDialog'
import { PresenceIndicator } from '@/components/PresenceIndicator'
import { useCollaboration } from '@/hooks/useCollaboration'
import { useThrottle } from '@/hooks/useThrottle'
import { useDebouncedCallback } from '@/hooks/useDebounce'
import { useAutoSnapshot } from '@/hooks/useAutoSnapshot'
import { VersionTimeline } from '@/components/VersionTimeline'
import { DiffModal } from '@/components/DiffModal'
import type { DocumentSummary } from '@/lib/documents'

interface DocumentData {
  id: string
  user_id: string
  title: string
  content: string
  updated_at: string
}

export default function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)

  // Document State
  const [currentDocId, setCurrentDocId] = useState<string>('')
  const [currentTitle, setCurrentTitle] = useState<string>('Untitled')
  const [documentContent, setDocumentContent] = useState<string>('')

  // Layout State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isMaximized, setIsMaximized] = useState(false)

  // Share Dialog State
  const [isShareOpen, setIsShareOpen] = useState(false)

  // Version History State
  const [showHistory, setShowHistory] = useState(false)
  const [compareVersions, setCompareVersions] = useState<{ a: string; b: string } | null>(null)

  // ── Prevent infinite broadcast loop ────────────────────────────────────
  const isReceivingRemoteChange = useRef(false)

  // ── Collaboration Hook ─────────────────────────────────────────────────
  const {
    collaborators,
    typingUsers,
    isConnected,
    broadcastContentChange,
    updateCursor,
    updateTypingCursor,
  } = useCollaboration({
    documentId: currentDocId,
    userId: user?.id ?? '',
    displayName: user?.email?.split('@')[0] ?? 'Anonymous',
    onContentChange: (newContent: string) => {
      // Received content from another user
      isReceivingRemoteChange.current = true
      setDocumentContent(newContent)
      setTimeout(() => { isReceivingRemoteChange.current = false }, 0)
    },
  })

  // ── Throttled cursor update (max 10/sec) ───────────────────────────────
  const throttledUpdateCursor = useThrottle(updateCursor, 100)

  // ── Debounced broadcast (300ms after typing stops) ─────────────────────
  const debouncedBroadcast = useDebouncedCallback(
    (content: string) => broadcastContentChange(content),
    300
  )

  // 1. Check Auth & Load Document
  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.push('/login')
        return
      }

      setUser(session.user)

      // Fetch the specific document from URL
      const { data: doc } = await supabase
        .from('documents')
        .select('*')
        .eq('id', id)
        .single()

      if (doc) {
        setCurrentDocId(doc.id)
        setCurrentTitle(doc.title || 'Untitled')
        setDocumentContent(doc.content || '')
      } else {
        // Document doesn't exist — create it
        const newDoc = {
          id,
          user_id: session.user.id,
          title: 'Untitled',
          content: '',
          updated_at: new Date().toISOString(),
        }

        // Read workspace/folder from query params if coming from Dashboard
        const searchParams = new URLSearchParams(window.location.search)
        const wsId = searchParams.get('ws')
        const folderId = searchParams.get('folder')

        const insertData: Record<string, unknown> = { ...newDoc }
        if (wsId) insertData.workspace_id = wsId
        if (folderId) insertData.folder_id = folderId

        const { error: insertError } = await supabase.from('documents').insert(insertData)
        if (insertError) {
          console.error('Failed to create document:', insertError)
        }

        setCurrentDocId(id)
        setCurrentTitle('Untitled')
        setDocumentContent('')
      }

      setIsLoading(false)
    }

    init()
  }, [router, id])

  // 2. Handle sidebar selecting a different document
  const handleSelectDocument = useCallback((docId: string) => {
    router.push(`/editor/${docId}`)
  }, [router])

  // 3. Handle new document from sidebar
  const handleNewDocument = useCallback((doc: DocumentSummary) => {
    router.push(`/editor/${doc.id}`)
  }, [router])

  // 4. Handle document deletion from sidebar
  const handleDeleteDocument = useCallback((deletedId: string) => {
    if (deletedId === currentDocId) {
      router.push('/dashboard')
    }
  }, [currentDocId, router])

  // 5. Handle title change from sidebar rename
  const handleTitleChange = useCallback((docId: string, newTitle: string) => {
    if (docId === currentDocId) {
      setCurrentTitle(newTitle)
    }
  }, [currentDocId])

  // 6. Handle content update from editor (local changes only)
  const handleContentUpdate = useCallback((newContent: string) => {
    setDocumentContent(newContent)
    // Only broadcast if this is a LOCAL change, not a remote one
    if (!isReceivingRemoteChange.current) {
      debouncedBroadcast(newContent)
    }
  }, [debouncedBroadcast])

  // 7. Handle AI changes
  const handleApplyChanges = useCallback((newContent: string) => {
    setDocumentContent(newContent)
    debouncedBroadcast(newContent)
  }, [debouncedBroadcast])

  // 8. Handle cursor move (throttled)
  const handleCursorMove = useCallback((x: number, y: number) => {
    throttledUpdateCursor(x, y)
  }, [throttledUpdateCursor])

  // 9. Handle typing cursor move (throttled)
  const throttledUpdateTypingCursor = useThrottle(updateTypingCursor, 100)
  const handleTypingCursorMove = useCallback((line: number, col: number) => {
    throttledUpdateTypingCursor(line, col)
  }, [throttledUpdateTypingCursor])

  // 10. Auto-snapshot hook (every 30s)
  const { saveNamedVersion } = useAutoSnapshot({
    documentId: currentDocId,
    content: documentContent,
    userId: user?.id ?? '',
  })

  // 11. Handle manual version save
  const handleSaveVersion = useCallback(async () => {
    const label = prompt('Version label (optional):')
    if (label === null) return // cancelled
    try {
      await saveNamedVersion(label || '')
    } catch (err) {
      console.error('Save version failed:', err)
    }
  }, [saveNamedVersion])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="relative h-screen flex font-sans text-zinc-100 selection:bg-cyan-500/30 selection:text-cyan-100 overflow-hidden bg-black">
      <GalaxyBackground />

      <div className="relative z-10 flex w-full h-full">
        {/* Sidebar */}
        <div className={cn("transition-all duration-300 ease-in-out border-r border-white/5 bg-black/40 backdrop-blur-xl", isMaximized ? "w-0 overflow-hidden border-none opacity-0" : isSidebarOpen ? "w-[280px]" : "w-0 overflow-hidden border-none opacity-0")}>
          <DocumentSidebar
            userId={user.id}
            currentDocId={currentDocId}
            onSelectDocument={handleSelectDocument}
            onNewDocument={handleNewDocument}
            onDeleteDocument={handleDeleteDocument}
            onTitleChange={handleTitleChange}
          />
        </div>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col p-2 sm:p-4 gap-4 min-w-0 transition-all duration-300">
          {/* Header - Hidden in Focus Mode */}
          <div className={cn("transition-all duration-300 ease-in-out overflow-hidden", isMaximized ? "h-0 opacity-0 mb-0" : "h-auto opacity-100 mb-0")}>
            <SmoothReveal width="full" className="flex-none">
              <header className="flex items-center justify-between px-6 py-3 rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)] animate-pulse" />
                  <h1 className="font-mono font-bold tracking-tight text-lg bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent truncate max-w-[300px]">
                    {currentTitle}
                  </h1>
                </div>
                <div className="flex items-center gap-3 text-xs font-mono text-zinc-500">
                  {/* Presence Indicator */}
                  <PresenceIndicator
                    collaborators={collaborators}
                    isConnected={isConnected}
                    typingUsers={typingUsers}
                  />

                  {/* Save Version Button */}
                  <button
                    onClick={handleSaveVersion}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 hover:border-emerald-500/30 hover:bg-emerald-500/10 text-zinc-400 hover:text-emerald-400 transition-all"
                    title="Save named version"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Save</span>
                  </button>

                  {/* History Button */}
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all",
                      showHistory
                        ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-400"
                        : "border-white/10 hover:border-cyan-500/30 hover:bg-cyan-500/10 text-zinc-400 hover:text-cyan-400"
                    )}
                    title="Version history"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">History</span>
                  </button>

                  {/* Share Button */}
                  <button
                    onClick={() => setIsShareOpen(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 hover:border-cyan-500/30 hover:bg-cyan-500/10 text-zinc-400 hover:text-cyan-400 transition-all"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Share</span>
                  </button>
                  <span className="hidden sm:inline">User: {user.email}</span>
                </div>
              </header>
            </SmoothReveal>
          </div>

          {/* Workspace */}
          <div className="flex-1 min-h-0 w-full">
            <SmoothReveal delay={0.2} className="h-full">
              <div className="flex flex-row h-full rounded-xl border border-white/10 bg-black/20 backdrop-blur-sm overflow-hidden shadow-2xl gap-1">
                {/* Editor Panel */}
                <div className={cn("flex-[3] min-w-0 border-r border-white/5 relative transition-all duration-300", isMaximized ? "flex-[1]" : "")}>
                  <DocumentEditor
                    key={currentDocId}
                    initialContent={documentContent}
                    documentId={currentDocId}
                    userId={user.id}
                    onContentUpdate={handleContentUpdate}
                    externalContent={documentContent}
                    isSidebarOpen={isSidebarOpen}
                    setIsSidebarOpen={setIsSidebarOpen}
                    isMaximized={isMaximized}
                    setIsMaximized={setIsMaximized}
                    onCursorMove={handleCursorMove}
                    onTypingCursorMove={handleTypingCursorMove}
                    collaborators={collaborators}
                  />
                </div>

                {/* Chat Panel - Hidden in Focus Mode */}
                <div className={cn("flex-[2] min-w-0 bg-black/40 transition-all duration-300 ease-in-out", isMaximized ? "w-0 flex-[0] opacity-0 overflow-hidden" : "")}>
                  <AIChat
                    documentContent={documentContent}
                    onApplyChanges={handleApplyChanges}
                  />
                </div>

                {/* Version History Panel */}
                <div className={cn(
                  "transition-all duration-300 ease-in-out border-l border-white/5 overflow-hidden",
                  showHistory ? "w-[280px] flex-shrink-0" : "w-0"
                )}>
                  {showHistory && (
                    <VersionTimeline
                      documentId={currentDocId}
                      userId={user.id}
                      onCompare={(a, b) => {
                        setCompareVersions({ a, b })
                      }}
                      onContentRestore={(newContent) => {
                        setDocumentContent(newContent)
                      }}
                      onClose={() => setShowHistory(false)}
                    />
                  )}
                </div>
              </div>
            </SmoothReveal>
          </div>
        </main>
      </div>

      {/* Share Dialog */}
      {isShareOpen && (
        <ShareDialog
          documentId={currentDocId}
          ownerId={user.id}
          onClose={() => setIsShareOpen(false)}
        />
      )}

      {/* Diff Modal */}
      {compareVersions && (
        <DiffModal
          versionIdA={compareVersions.a}
          versionIdB={compareVersions.b}
          onClose={() => setCompareVersions(null)}
        />
      )}
    </div>
  )
}
