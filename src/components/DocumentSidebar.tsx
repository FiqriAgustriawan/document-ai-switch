'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, FileText, Trash2, LogOut, ChevronLeft, ChevronRight, LayoutPanelLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

interface Document {
  id: string
  title?: string
  updated_at: string
  content?: string
}

interface DocumentSidebarProps {
  userId: string
  currentDocId: string
  onSelectDocument: (docId: string) => void
  onNewDocument: () => void
  documents: Document[]
  onDeleteDocument: (docId: string) => void
  isOpen?: boolean // Optional for backward compatibility/internal state
}

export function DocumentSidebar({
  userId,
  currentDocId,
  onSelectDocument,
  onNewDocument,
  documents,
  onDeleteDocument,
  isOpen = true // Default true
}: DocumentSidebarProps) {
  const router = useRouter()
  // Internal state removed/ignored if controlled. But to keep it simple, let's just use the prop.
  // const [isOpen, setIsOpen] = useState(true) -> Removed in favor of prop
  const [isSignOutLoading, setIsSignOutLoading] = useState(false)

  const handleSignOut = async () => {
    setIsSignOutLoading(true)
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* Mobile Toggle - Handled by Parent or specific UI */}
      {/* <button
        className="md:hidden fixed bottom-4 right-4 z-50 p-3 rounded-full bg-cyan-600 text-white shadow-lg"
        onClick={() => setIsOpen(!isOpen)}
      >
        <LayoutPanelLeft className="w-6 h-6" />
      </button> */}

      <motion.div
        initial={false}
        animate={{ width: 280, opacity: 1 }} // Fixed because parent controls container width
        className={cn(
          "h-full w-full bg-transparent flex flex-col overflow-hidden transition-all duration-300 relative"
        )}
      >
        <div className="p-4 border-b border-white/5 flex items-center justify-between min-w-[280px]">
          <h2 className="font-semibold text-zinc-100 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
              <FileText className="w-4 h-4 text-cyan-400" />
            </span>
            My Documents
          </h2>
          {/* <button onClick={() => setIsOpen(false)} className="md:hidden text-zinc-500">
            <ChevronLeft />
          </button> */}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-w-[280px]">
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full flex items-center gap-2 p-3 rounded-xl bg-gradient-to-r from-zinc-800 to-zinc-900 border border-white/5 text-zinc-400 hover:text-white transition-all group mb-4"
          >
            <LayoutPanelLeft className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium">Dashboard</span>
          </button>

          <button
            onClick={() => {
              const newId = crypto.randomUUID()
              router.push(`/editor/${newId}`)
            }}
            className="w-full flex items-center gap-2 p-3 rounded-xl bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/20 text-cyan-100 hover:from-cyan-600/30 hover:to-blue-600/30 transition-all group"
          >
            <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium">New Document</span>
          </button>

          <div className="pt-4 space-y-1">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider px-2 mb-2">Recent</p>
            {documents.map((doc) => (
              <div
                key={doc.id}
                className={cn(
                  "group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors",
                  currentDocId === doc.id ? "bg-white/10 text-white" : "hover:bg-white/5 text-zinc-400 hover:text-zinc-200"
                )}
                onClick={() => router.push(`/editor/${doc.id}`)}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <FileText className="w-4 h-4 flex-shrink-0" />
                  <div className="flex flex-col truncate">
                    <span className="text-sm truncate font-medium">
                      {doc.content?.slice(0, 20) || 'Untitled Document'}
                    </span>
                    <span className="text-[10px] text-zinc-600">
                      {new Date(doc.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteDocument(doc.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

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
      </motion.div>

      {/* Desktop Toggle (when closed) - Handled by Parent now */}
      {/* {!isOpen && (
        <button
          className="hidden md:flex absolute top-4 left-4 z-50 p-2 rounded-lg bg-black/40 border border-white/10 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
          onClick={() => setIsOpen(true)}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )} */}
    </>
  )
}
