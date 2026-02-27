'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, FileText, Trash2, LogOut, LayoutPanelLeft, Search, Pencil, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import {
  getUserDocuments,
  searchDocuments,
  createDocument,
  renameDocument,
  deleteDocument,
  getDocumentsPaginated,
  type DocumentSummary,
  type SortOption
} from '@/lib/documents'
import { useDebounce } from '@/hooks/useDebounce'
import { ConfirmationModal } from '@/components/ui/ConfirmationModal'

interface DocumentSidebarProps {
  userId: string
  currentDocId: string
  onSelectDocument: (docId: string) => void
  onNewDocument: (doc: DocumentSummary) => void
  onDeleteDocument: (docId: string) => void
  onTitleChange?: (docId: string, newTitle: string) => void
}

export function DocumentSidebar({
  userId,
  currentDocId,
  onSelectDocument,
  onNewDocument,
  onDeleteDocument,
  onTitleChange,
}: DocumentSidebarProps) {
  const router = useRouter()

  // Document list state
  const [documents, setDocuments] = useState<DocumentSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedQuery = useDebounce(searchQuery, 300)

  // Sort state
  const [sortOption, setSortOption] = useState<SortOption>('updated_desc')
  const [showSortMenu, setShowSortMenu] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [totalDocs, setTotalDocs] = useState(0)
  const PAGE_SIZE = 10

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  // Delete modal state
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Sign out state
  const [isSignOutLoading, setIsSignOutLoading] = useState(false)

  // ── Load documents ──────────────────────────────────────────────────────────
  const loadDocuments = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      if (debouncedQuery.trim()) {
        // Search mode
        const results = await searchDocuments(userId, debouncedQuery)
        setDocuments(results)
        setTotalPages(1)
        setTotalDocs(results.length)
        setCurrentPage(0)
      } else {
        // Paginated mode with sort
        const result = await getDocumentsPaginated(userId, sortOption, currentPage, PAGE_SIZE)
        setDocuments(result.documents)
        setTotalPages(result.totalPages)
        setTotalDocs(result.total)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      console.error('loadDocuments error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [userId, debouncedQuery, sortOption, currentPage])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  // Reset page when search or sort changes
  useEffect(() => {
    setCurrentPage(0)
  }, [debouncedQuery, sortOption])

  // ── Create document ─────────────────────────────────────────────────────────
  const handleCreate = async () => {
    try {
      const newDoc = await createDocument(userId, 'Untitled')
      const summary: DocumentSummary = {
        id: newDoc.id,
        title: newDoc.title,
        updated_at: newDoc.updated_at,
      }
      setDocuments(prev => [summary, ...prev])
      onNewDocument(summary)
      // Start inline rename immediately
      setRenamingId(newDoc.id)
      setRenameValue('Untitled')
    } catch (err: unknown) {
      console.error('Create document failed:', err)
    }
  }

  // ── Rename ──────────────────────────────────────────────────────────────────
  const startRename = (doc: DocumentSummary) => {
    setRenamingId(doc.id)
    setRenameValue(doc.title)
  }

  const submitRename = async (documentId: string) => {
    const trimmed = renameValue.trim()
    if (!trimmed) {
      setRenamingId(null)
      return
    }
    try {
      await renameDocument(documentId, trimmed)
      setDocuments(prev =>
        prev.map(d => d.id === documentId ? { ...d, title: trimmed } : d)
      )
      if (onTitleChange) {
        onTitleChange(documentId, trimmed)
      }
    } catch (err: unknown) {
      console.error('Rename failed:', err)
    } finally {
      setRenamingId(null)
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deletingId) return
    setIsDeleting(true)
    try {
      await deleteDocument(deletingId)
      setDocuments(prev => prev.filter(d => d.id !== deletingId))
      if (deletingId === currentDocId) {
        onDeleteDocument(deletingId)
      }
    } catch (err: unknown) {
      console.error('Delete failed:', err)
    } finally {
      setIsDeleting(false)
      setDeletingId(null)
    }
  }

  // ── Sign out ────────────────────────────────────────────────────────────────
  const handleSignOut = async () => {
    setIsSignOutLoading(true)
    await supabase.auth.signOut()
    router.push('/login')
  }

  // ── Sort labels ─────────────────────────────────────────────────────────────
  const sortLabels: Record<SortOption, string> = {
    updated_desc: 'Terbaru',
    updated_asc: 'Terlama',
    title_asc: 'Judul A-Z',
    title_desc: 'Judul Z-A',
  }

  return (
    <>
      <div className="h-full w-full bg-transparent flex flex-col overflow-hidden relative">
        {/* Header */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between min-w-[280px]">
          <h2 className="font-semibold text-zinc-100 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
              <FileText className="w-4 h-4 text-cyan-400" />
            </span>
            My Documents
          </h2>
        </div>

        {/* Navigation + Actions */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-w-[280px]">
          {/* Dashboard link */}
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full flex items-center gap-2 p-3 rounded-xl bg-gradient-to-r from-zinc-800 to-zinc-900 border border-white/5 text-zinc-400 hover:text-white transition-all group mb-2"
          >
            <LayoutPanelLeft className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium">Dashboard</span>
          </button>

          {/* New Document */}
          <button
            onClick={handleCreate}
            className="w-full flex items-center gap-2 p-3 rounded-xl bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/20 text-cyan-100 hover:from-cyan-600/30 hover:to-blue-600/30 transition-all group"
          >
            <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium">New Document</span>
          </button>

          {/* Search */}
          <div className="pt-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg border border-white/5 focus-within:border-cyan-500/30 transition-colors">
              <Search className="w-4 h-4 text-zinc-500 flex-shrink-0" />
              <input
                type="text"
                placeholder="Cari dokumen..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-transparent border-none text-sm text-white focus:outline-none w-full placeholder-zinc-600"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-zinc-500 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Sort dropdown */}
          <div className="flex items-center justify-between px-2 pt-2">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              {searchQuery ? `Hasil (${totalDocs})` : `Dokumen (${totalDocs})`}
            </p>
            <div className="relative">
              <button
                onClick={() => setShowSortMenu(!showSortMenu)}
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <ArrowUpDown className="w-3 h-3" />
                {sortLabels[sortOption]}
              </button>
              {showSortMenu && (
                <div className="absolute right-0 top-6 z-50 bg-[#2A2A2A] border border-[#3A3A3A] rounded-lg shadow-xl py-1 w-36">
                  {(Object.keys(sortLabels) as SortOption[]).map(option => (
                    <button
                      key={option}
                      onClick={() => {
                        setSortOption(option)
                        setShowSortMenu(false)
                      }}
                      className={cn(
                        "w-full text-left px-3 py-1.5 text-xs transition-colors",
                        sortOption === option
                          ? "text-cyan-400 bg-cyan-500/10"
                          : "text-zinc-400 hover:text-white hover:bg-white/5"
                      )}
                    >
                      {sortLabels[option]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Document list */}
          <div className="pt-1 space-y-1">
            {isLoading ? (
              <div className="py-8 text-center text-sm text-zinc-500">
                Memuat dokumen...
              </div>
            ) : error ? (
              <div className="py-8 text-center">
                <p className="text-red-400 text-sm">{error}</p>
                <button
                  onClick={loadDocuments}
                  className="mt-2 text-cyan-400 text-xs underline"
                >
                  Coba lagi
                </button>
              </div>
            ) : documents.length === 0 ? (
              <div className="py-8 text-center text-sm text-zinc-500">
                {searchQuery ? (
                  <p>Tidak ada dokumen dengan kata &quot;{searchQuery}&quot;</p>
                ) : (
                  <>
                    <FileText className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                    <p>Belum ada dokumen.</p>
                    <button
                      onClick={handleCreate}
                      className="mt-2 text-cyan-400 underline text-xs"
                    >
                      Buat dokumen pertama
                    </button>
                  </>
                )}
              </div>
            ) : (
              documents.map(doc => (
                <div
                  key={doc.id}
                  className={cn(
                    "group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors",
                    currentDocId === doc.id
                      ? "bg-white/10 text-white border-l-2 border-cyan-500"
                      : "hover:bg-white/5 text-zinc-400 hover:text-zinc-200"
                  )}
                  onClick={() => renamingId !== doc.id && onSelectDocument(doc.id)}
                >
                  {renamingId === doc.id ? (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileText className="w-4 h-4 flex-shrink-0 text-cyan-400" />
                      <input
                        type="text"
                        value={renameValue}
                        autoFocus
                        onChange={e => setRenameValue(e.target.value)}
                        onBlur={() => submitRename(doc.id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') submitRename(doc.id)
                          if (e.key === 'Escape') setRenamingId(null)
                        }}
                        className="flex-1 bg-white/10 text-white text-sm px-2 py-0.5 rounded outline-none border border-cyan-500/30 min-w-0"
                        onClick={e => e.stopPropagation()}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
                        <FileText className="w-4 h-4 flex-shrink-0" />
                        <div className="flex flex-col truncate">
                          <span className="text-sm truncate font-medium">
                            {doc.title || 'Untitled'}
                          </span>
                          <span className="text-[10px] text-zinc-600">
                            {new Date(doc.updated_at).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            startRename(doc)
                          }}
                          className="p-1.5 hover:bg-white/10 hover:text-cyan-400 rounded transition-all"
                          title="Ganti nama"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            setDeletingId(doc.id)
                          }}
                          className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded transition-all"
                          title="Hapus"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {!searchQuery && totalPages > 1 && (
            <div className="flex items-center justify-between pt-3 px-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-400 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-zinc-500">
                {currentPage + 1} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage >= totalPages - 1}
                className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-400 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Sign out */}
        <div className="p-4 border-t border-white/5 min-w-[280px]">
          <button
            onClick={handleSignOut}
            disabled={isSignOutLoading}
            className="w-full flex items-center gap-2 p-3 rounded-xl hover:bg-red-500/10 text-zinc-400 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium">{isSignOutLoading ? 'Signing out...' : 'Sign Out'}</span>
          </button>
        </div>
      </div>

      {/* Delete confirmation modal */}
      <ConfirmationModal
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={confirmDelete}
        title="Hapus Dokumen?"
        message="Dokumen ini akan dihapus permanen dan tidak bisa dipulihkan."
        isLoading={isDeleting}
      />
    </>
  )
}
