'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'
import {
  Loader2, Folder, Plus, FileText, Search, LayoutGrid, Trash2,
  Settings, LogOut, ChevronLeft, ChevronRight, Star, Upload
} from 'lucide-react'
import { useWorkspaces, Workspace, Folder as FolderType } from '@/hooks/useWorkspaces'
import { cn } from '@/lib/utils'
import { SmoothReveal } from '@/components/ui/SmoothReveal'
import { PromptModal } from '@/components/ui/PromptModal'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const {
    workspaces,
    folders,
    documents,
    isLoading: dataLoading,
    createWorkspace,
    deleteWorkspace,
    createFolder,
    moveDocument,
    createDocument,
    isOperating
  } = useWorkspaces(user?.id)

  const [activeTab, setActiveTab] = useState<'projects' | 'drafts' | 'trash'>('projects')
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null)
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false)
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isNewDocMenuOpen, setIsNewDocMenuOpen] = useState(false)
  const dragCounter = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setIsSearching(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login')
      } else {
        setUser(session.user)
      }
      setAuthLoading(false)
    })
  }, [router])

  useEffect(() => {
    if (workspaces.length > 0 && !selectedWorkspace) {
      setSelectedWorkspace(workspaces[0].id)
    }
  }, [workspaces, selectedWorkspace])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleCreateDocument = (folderId?: string) => {
    // Generate an ID and route to it immediately. The editor will create it in DB on load.
    const newDocId = crypto.randomUUID()
    const url = new URL(`/editor/${newDocId}`, window.location.origin)
    if (selectedWorkspace) url.searchParams.set('ws', selectedWorkspace)
    if (folderId) url.searchParams.set('folder', folderId)
    router.push(url.toString())
  }

  const handleOpenDocument = (docId: string) => {
    router.push(`/editor/${docId}`)
  }

  if (authLoading || dataLoading) {
    return (
      <div className="min-h-screen bg-[#1E1E1E] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    )
  }

  const filteredDocs = documents.filter(doc => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (doc.name?.toLowerCase().includes(query) || doc.content?.toLowerCase().includes(query)) && !doc.is_trashed;
    }

    if (activeTab === 'trash') return doc.is_trashed
    if (activeTab === 'drafts') return !doc.is_trashed && !doc.workspace_id
    // Projects tab
    if (selectedFolder) return !doc.is_trashed && doc.folder_id === selectedFolder
    return !doc.is_trashed && doc.workspace_id === selectedWorkspace && !doc.folder_id
  })

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    dragCounter.current = 0

    if (!user) return

    const files = Array.from(e.dataTransfer.files)
    for (const file of files) {
      let text = ""
      try {
        text = await file.text()
      } catch (err) {
        console.error("Failed to read file:", err)
      }
      const workspaceId = activeTab === 'projects' ? selectedWorkspace : undefined
      const folderId = selectedFolder || undefined
      await createDocument(file.name.replace(/\.[^/.]+$/, ""), text, workspaceId, folderId)
    }
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current++
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current === 0) {
      setIsDragOver(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length || !user) return

    for (const file of files) {
      let text = ""
      try {
        text = await file.text()
      } catch (err) {
        console.error("Failed to read file:", err)
      }
      const workspaceId = activeTab === 'projects' ? selectedWorkspace : undefined
      const folderId = selectedFolder || undefined
      await createDocument(file.name.replace(/\.[^/.]+$/, ""), text, workspaceId, folderId)
    }
    if (fileInputRef.current) fileInputRef.current.value = ""
    setIsNewDocMenuOpen(false)
  }

  const handleDragEnd = async (result: DropResult) => {
    // Implement Draggable Document into Droppable Folder/Workspace logic here
    const { source, destination, draggableId } = result;
    if (!destination) return; // Dropped outside

    // Determine the target based on destination droppableId
    // IDs format: "folder-1234", "sidebar-workspace-5678", "sidebar-drafts", "sidebar-trash"
    const targetId = destination.droppableId;
    if (targetId.startsWith('folder-')) {
      const folderId = targetId.replace('folder-', '');
      // Move doc to folder
      await moveDocument(draggableId, { workspace_id: selectedWorkspace, folder_id: folderId });
    } else if (targetId === 'sidebar-drafts') {
      await moveDocument(draggableId, { workspace_id: null, folder_id: null, is_trashed: false });
    } else if (targetId === 'sidebar-trash') {
      await moveDocument(draggableId, { is_trashed: true });
    } else if (targetId.startsWith('sidebar-workspace-')) {
      const workspaceId = targetId.replace('sidebar-workspace-', '');
      // Move doc to workspace root
      await moveDocument(draggableId, { workspace_id: workspaceId, folder_id: null, is_trashed: false });
    }
    // Note: If sorting documents is needed in the future, we would handle same-droppable array reordering here.
  }

  const handleDeleteWorkspace = async (workspaceId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (window.confirm("Are you sure you want to delete this workspace? All folders and documents inside will be lost.")) {
      const success = await deleteWorkspace(workspaceId)
      if (success && selectedWorkspace === workspaceId) {
        setSelectedWorkspace(null)
        setActiveTab('drafts')
      }
    }
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="min-h-screen bg-[#1E1E1E] text-zinc-300 font-sans flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-[#252525] border-r border-[#333] flex flex-col transition-all z-10">
          {/* User Profile */}
          <div className="p-4 flex items-center gap-3 border-b border-[#333] hover:bg-white/5 cursor-pointer">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-zinc-100 truncate">{user?.email?.split('@')[0]}</div>
              <div className="text-xs text-zinc-500 truncate">Free Plan</div>
            </div>
            <Settings className="w-4 h-4 text-zinc-500 hover:text-white" />
          </div>

          {/* Global Navigation */}
          <div className="p-3 space-y-1">
            {isSearching ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-md">
                <Search className="w-4 h-4 text-zinc-400" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search docs..."
                  className="bg-transparent border-none text-sm text-white focus:outline-none w-full"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onBlur={() => !searchQuery && setIsSearching(false)}
                />
              </div>
            ) : (
              <button
                onClick={() => setIsSearching(true)}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-white/10 transition-colors"
              >
                <Search className="w-4 h-4 text-zinc-400" />
                <span className="flex-1 text-left">Search</span>
                <kbd className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-zinc-400 border border-white/5">Ctrl K</kbd>
              </button>
            )}

            <button
              onClick={() => setActiveTab('projects')}
              className={cn("w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors", activeTab === 'projects' ? 'bg-cyan-500/10 text-cyan-400' : 'hover:bg-white/10')}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>All projects</span>
            </button>

            <Droppable droppableId="sidebar-drafts" isDropDisabled={false}>
              {(provided, snapshot) => (
                <div ref={provided.innerRef} {...provided.droppableProps}>
                  <button
                    onClick={() => setActiveTab('drafts')}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-all duration-200",
                      activeTab === 'drafts' ? 'bg-cyan-500/10 text-cyan-400' : 'hover:bg-white/10',
                      snapshot.isDraggingOver && 'bg-cyan-500/20 ring-1 ring-cyan-500/50 scale-[1.02]'
                    )}
                  >
                    <FileText className="w-4 h-4" />
                    <span>Drafts</span>
                  </button>
                  <div className="hidden">{provided.placeholder}</div>
                </div>
              )}
            </Droppable>

            <Droppable droppableId="sidebar-trash" isDropDisabled={false}>
              {(provided, snapshot) => (
                <div ref={provided.innerRef} {...provided.droppableProps}>
                  <button
                    onClick={() => setActiveTab('trash')}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-all duration-200",
                      activeTab === 'trash' ? 'bg-red-500/10 text-red-400' : 'hover:bg-white/10',
                      snapshot.isDraggingOver && 'bg-red-500/20 ring-1 ring-red-500/50 scale-[1.02] text-red-400'
                    )}
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Trash</span>
                  </button>
                  <div className="hidden">{provided.placeholder}</div>
                </div>
              )}
            </Droppable>
          </div>

          {/* Workspaces List */}
          <div className="px-3 py-2 mt-4">
            <div className="text-xs font-semibold text-zinc-500 mb-2 px-3 flex justify-between items-center">
              WORKSPACES
              <Plus className="w-3 h-3 cursor-pointer hover:text-white transition-colors" onClick={() => setIsWorkspaceModalOpen(true)} />
            </div>
            <div className="space-y-1">
              {workspaces.map(ws => (
                <Droppable key={ws.id} droppableId={`sidebar-workspace-${ws.id}`} isDropDisabled={false}>
                  {(provided, snapshot) => (
                    <div ref={provided.innerRef} {...provided.droppableProps}>
                      <div
                        className={cn(
                          "w-full flex items-center px-3 py-1.5 text-sm rounded-md transition-all group duration-200 justify-between",
                          selectedWorkspace === ws.id && activeTab === 'projects' ? 'bg-white/10 text-white font-medium' : 'hover:bg-white/5 text-zinc-400',
                          snapshot.isDraggingOver && 'bg-cyan-500/20 ring-1 ring-cyan-500/50 scale-[1.02]'
                        )}
                      >
                        <button
                          onClick={() => { setActiveTab('projects'); setSelectedWorkspace(ws.id); setSelectedFolder(null); }}
                          className="flex-1 flex items-center gap-2 text-left truncate"
                        >
                          <div className={cn("w-2 h-2 rounded-full", selectedWorkspace === ws.id ? "bg-cyan-500" : "bg-zinc-600")} />
                          <span className="flex-1 truncate">{ws.name}</span>
                        </button>
                        <button
                          onClick={(e) => handleDeleteWorkspace(ws.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 hover:text-red-400 rounded-md transition-all"
                          title="Delete Workspace"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="hidden">{provided.placeholder}</div>
                    </div>
                  )}
                </Droppable>
              ))}
            </div>
          </div>

          <div className="mt-auto p-4 border-t border-[#333]">
            <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-red-500/10 hover:text-red-400 transition-colors text-zinc-400">
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col bg-[#1E1E1E] relative">
          {/* Header toolbar */}
          <header className="h-14 border-b border-[#333] flex items-center justify-between px-6">
            <div className="flex items-center gap-2 text-lg font-medium text-zinc-100">
              {activeTab === 'projects' && workspaces.find(w => w.id === selectedWorkspace)?.name}
              {activeTab === 'drafts' && "Drafts"}
              {activeTab === 'trash' && "Trash"}
            </div>

            <div className="flex items-center gap-3">
              {(activeTab === 'projects' || activeTab === 'drafts') && (
                <div className="relative">
                  <button
                    onClick={() => setIsNewDocMenuOpen(!isNewDocMenuOpen)}
                    disabled={isOperating}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isOperating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    New Document
                  </button>

                  {isNewDocMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-[#2A2A2A] border border-[#3A3A3A] rounded-md shadow-xl py-1 z-50">
                      <button
                        onClick={() => {
                          handleCreateDocument(selectedFolder || undefined)
                          setIsNewDocMenuOpen(false)
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-white/5 hover:text-white flex items-center gap-2"
                      >
                        <FileText className="w-4 h-4" />
                        Create Blank
                      </button>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-white/5 hover:text-white flex items-center gap-2"
                      >
                        <Upload className="w-4 h-4" />
                        Import File
                      </button>
                      <input
                        type="file"
                        multiple
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                        accept=".txt,.md,.json,.csv"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </header>

          {/* Dashboard Grid */}
          <div className="flex-1 overflow-y-auto p-8">
            <SmoothReveal>
              {activeTab === 'projects' && (
                <div className="mb-8">
                  {!selectedFolder ? (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold text-zinc-400">Folders</h2>
                        <button
                          onClick={() => setIsFolderModalOpen(true)}
                          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Add Folder
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                        {folders.filter(f => f.workspace_id === selectedWorkspace).map(folder => (
                          <Droppable key={folder.id} droppableId={`folder-${folder.id}`}>
                            {(provided, snapshot) => (
                              <div
                                onClick={() => setSelectedFolder(folder.id)}
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={cn("cursor-pointer bg-[#2A2A2A] border rounded-xl p-4 flex flex-col gap-3 transition-all duration-200", snapshot.isDraggingOver ? "border-blue-500/50 bg-blue-500/10 scale-[1.02] shadow-[0_0_20px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/50" : "border-[#3A3A3A] hover:border-[#555]")}
                              >
                                <div className="flex justify-between items-start">
                                  <div className="p-2 bg-white/5 rounded-lg">
                                    <Folder className={cn("w-5 h-5", snapshot.isDraggingOver ? "text-blue-400" : "text-zinc-400 group-hover:text-blue-400")} />
                                  </div>
                                </div>
                                <div>
                                  <h3 className="text-sm font-medium text-zinc-200 truncate">{folder.name}</h3>
                                  <p className="text-xs text-zinc-500 mt-1">
                                    {documents.filter(d => d.folder_id === folder.id).length} files
                                  </p>
                                </div>
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        ))}
                        {folders.filter(f => f.workspace_id === selectedWorkspace).length === 0 && (
                          <div className="col-span-full py-8 text-center text-sm text-zinc-500 border border-dashed border-[#444] rounded-xl">
                            No folders yet.
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="mb-4">
                      <button onClick={() => setSelectedFolder(null)} className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm mb-2">
                        <ChevronLeft className="w-4 h-4" /> Back to {workspaces.find(w => w.id === selectedWorkspace)?.name}
                      </button>
                      <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Folder className="w-5 h-5 text-blue-400 fill-blue-500/20" />
                        {folders.find(f => f.id === selectedFolder)?.name}
                      </h2>
                    </div>
                  )}
                </div>
              )}

              <div>
                <h2 className="text-sm font-semibold text-zinc-400 mb-4">
                  {activeTab === 'projects' ? 'Documents' : 'Files'}
                </h2>
                <div
                  className="relative rounded-xl min-h-[300px]"
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleFileDrop}
                >
                  {/* Drag Overlay restricted to Documents section */}
                  {isDragOver && (
                    <div className="absolute inset-0 z-50 bg-blue-500/10 backdrop-blur-sm border-2 border-dashed border-blue-500/50 rounded-xl flex items-center justify-center pointer-events-none transition-all duration-300">
                      <div className="text-xl font-bold text-white flex flex-col items-center gap-3 bg-[#1E1E1E] p-6 rounded-2xl shadow-2xl scale-100 animate-in zoom-in-95 duration-200 border border-white/10">
                        <FileText className="w-12 h-12 text-blue-400 drop-shadow-lg" />
                        Drop files to import
                      </div>
                    </div>
                  )}

                  <Droppable droppableId={`workspace-${selectedWorkspace || 'drafts'}`} isDropDisabled={!!selectedFolder}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 h-full"
                      >
                        {filteredDocs.map((doc, index) => (
                          <Draggable key={doc.id} draggableId={doc.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                style={provided.draggableProps.style}
                                onClick={() => handleOpenDocument(doc.id)}
                                className={cn("cursor-pointer outline-none h-min", snapshot.isDragging ? "z-50 cursor-grabbing" : "")}
                              >
                                <div className={cn(
                                  "bg-[#252525] border rounded-xl overflow-hidden group transition-all duration-200",
                                  snapshot.isDragging
                                    ? "shadow-[0_20px_50px_rgba(0,0,0,0.5)] scale-[1.03] ring-1 ring-white/10 bg-[#2a2a2a] border-[#444]"
                                    : "border-[#333] hover:border-[#555] hover:-translate-y-1 hover:shadow-xl"
                                )}>
                                  <div className="aspect-video bg-[#1A1A1A] p-4 flex items-start">
                                    <div className="text-[10px] font-mono text-zinc-600 line-clamp-4 leading-relaxed group-hover:text-zinc-500 transition-colors">
                                      {doc.content?.substring(0, 200) || "Empty document..."}
                                    </div>
                                  </div>
                                  <div className="p-3 border-t border-[#333] flex items-center justify-between">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                      <span className="text-sm font-medium text-zinc-200 truncate">{doc.name || 'Untitled'}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}

                        {filteredDocs.length === 0 && (
                          <div className="col-span-full py-12 text-center text-sm text-zinc-500 border border-dashed border-[#444] rounded-xl flex flex-col items-center gap-2">
                            <FileText className="w-8 h-8 text-zinc-600" />
                            <p>No documents found</p>
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              </div>
            </SmoothReveal>
          </div>
        </main>
      </div >

      <PromptModal
        isOpen={isWorkspaceModalOpen}
        onClose={() => setIsWorkspaceModalOpen(false)}
        onConfirm={(name) => {
          createWorkspace(name)
          setIsWorkspaceModalOpen(false)
        }}
        title="Create New Workspace"
        placeholder="Workspace Name"
      />

      <PromptModal
        isOpen={isFolderModalOpen}
        onClose={() => setIsFolderModalOpen(false)}
        onConfirm={(name) => {
          if (selectedWorkspace) createFolder(name, selectedWorkspace)
          setIsFolderModalOpen(false)
        }}
        title="Create New Folder"
        placeholder="Folder Name"
      />
    </DragDropContext >
  )
}
