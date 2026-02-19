'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { GalaxyBackground } from "@/components/ui/GalaxyBackground"
import { SmoothReveal } from "@/components/ui/SmoothReveal"
import DocumentEditor from "@/components/DocumentEditor"
import AIChat from "@/components/AIChat"
import { DocumentSidebar } from "@/components/DocumentSidebar"
import { supabase } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import { Loader2 } from 'lucide-react'
import { User } from '@supabase/supabase-js'
import { cn } from '@/lib/utils'
import { ConfirmationModal } from '@/components/ui/ConfirmationModal'

interface Document {
  id: string
  user_id: string
  content?: string
  updated_at: string
}

export default function Home() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)

  // Document State
  const [currentDocId, setCurrentDocId] = useState<string>('')
  const [documentContent, setDocumentContent] = useState<string>('')
  const [documents, setDocuments] = useState<Document[]>([])

  // Layout State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isMaximized, setIsMaximized] = useState(false)

  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [docToDelete, setDocToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // 1. Check Auth & Load Documents
  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.push('/login')
        return
      }

      setUser(session.user)

      // Fetch user's documents
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', session.user.id)
        .order('updated_at', { ascending: false })

      if (data && data.length > 0) {
        setDocuments(data)
        setCurrentDocId(data[0].id)
        setDocumentContent(data[0].content || '')
      } else {
        // Create initial document if none exists
        handleNewDocument(session.user.id)
      }

      setIsLoading(false)
    }

    init()
  }, [router])

  // 2. Handle New Document
  const handleNewDocument = async (userId: string | undefined = user?.id) => {
    if (!userId) return

    const newDocId = uuidv4() // Generate standard UUID
    const newDoc = {
      id: newDocId,
      user_id: userId,
      content: '', // Empty content
      updated_at: new Date().toISOString()
    }

    // Optimistic update
    setDocuments(prev => [newDoc, ...prev])
    setCurrentDocId(newDocId)
    setDocumentContent('')

    // Save to DB (handled by useAutoSave typically, but we init here)
    await supabase.from('documents').insert(newDoc)
  }

  // 3. Handle Select Document
  const handleSelectDocument = (docId: string) => {
    const doc = documents.find(d => d.id === docId)
    if (doc) {
      setCurrentDocId(doc.id)
      setDocumentContent(doc.content || '')
    }
  }

  // 4. Handle Delete Document (Trigger Modal)
  const handleDeleteDocument = (docId: string) => {
    setDocToDelete(docId)
    setIsDeleteModalOpen(true)
  }

  // 5. Confirm Delete (Triggered by Modal)
  const confirmDelete = async () => {
    if (!docToDelete) return

    setIsDeleting(true)
    const { error } = await supabase.from('documents').delete().eq('id', docToDelete)

    if (!error) {
      setDocuments(prev => prev.filter(d => d.id !== docToDelete))
      if (currentDocId === docToDelete) {
        // Switch to next available or create new
        const remaining = documents.filter(d => d.id !== docToDelete)
        if (remaining.length > 0) {
          handleSelectDocument(remaining[0].id)
        } else {
          handleNewDocument()
        }
      }
    }
    setIsDeleting(false)
    setIsDeleteModalOpen(false)
    setDocToDelete(null)
  }

  const handleContentUpdate = (newContent: string) => {
    setDocumentContent(newContent)
    // Update local list preview
    setDocuments(prev => prev.map(d =>
      d.id === currentDocId ? { ...d, content: newContent, updated_at: new Date().toISOString() } : d
    ))
  }

  const handleApplyChanges = (newContent: string) => {
    setDocumentContent(newContent)
  }

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
            onNewDocument={() => handleNewDocument()}
            documents={documents}
            onDeleteDocument={handleDeleteDocument}
          // Pass cleanup prop if needed or handle logic internally
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
                  <h1 className="font-mono font-bold tracking-tight text-lg bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                    AI Document Editor <span className="text-[10px] text-zinc-500 ml-2 font-normal border border-white/10 px-1.5 py-0.5 rounded">PRO</span>
                  </h1>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono text-zinc-500">
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
                    key={currentDocId} // Force remount on doc switch
                    initialContent={documentContent}
                    documentId={currentDocId}
                    userId={user.id}
                    onContentUpdate={handleContentUpdate}
                    externalContent={documentContent}
                    // Layout Controls
                    isSidebarOpen={isSidebarOpen}
                    setIsSidebarOpen={setIsSidebarOpen}
                    isMaximized={isMaximized}
                    setIsMaximized={setIsMaximized}
                  />
                </div>

                {/* Chat Panel - Hidden in Focus Mode */}
                <div className={cn("flex-[2] min-w-0 bg-black/40 transition-all duration-300 ease-in-out", isMaximized ? "w-0 flex-[0] opacity-0 overflow-hidden" : "")}>
                  <AIChat
                    documentContent={documentContent}
                    onApplyChanges={handleApplyChanges}
                  />
                </div>
              </div>
            </SmoothReveal>
          </div>
        </main>
      </div>

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false)
          setDocToDelete(null)
        }}
        onConfirm={confirmDelete}
        title="Delete Document"
        message="Are you sure you want to delete this document? This action cannot be undone."
        isLoading={isDeleting}
      />
    </div >
  )
}
