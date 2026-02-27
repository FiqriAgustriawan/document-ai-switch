'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useRealtimeDocument } from '@/hooks/useRealtimeDocument'
import { useUndoRedo } from '@/hooks/useUndoRedo'
import { Loader2, Eye, EyeOff, Mic, MicOff } from 'lucide-react'
import { CursorOverlay } from '@/components/CursorOverlay'
import type { CollaboratorPresence } from '@/hooks/useCollaboration'
import Prism from 'prismjs'
import 'prismjs/components/prism-markdown'
import 'prismjs/themes/prism-tomorrow.css' // Dark theme
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { marked } from 'marked'
import { asBlob } from 'html-docx-js-typescript'
import { saveAs } from 'file-saver'

interface DocumentEditorProps {
  initialContent: string
  documentId: string
  userId: string
  onContentUpdate: (content: string) => void
  externalContent?: string | null
  isSidebarOpen?: boolean
  setIsSidebarOpen?: (isOpen: boolean) => void
  isMaximized?: boolean
  setIsMaximized?: (max: boolean) => void
  onCursorMove?: (x: number, y: number) => void
  collaborators?: CollaboratorPresence[]
}

export default function DocumentEditor({
  initialContent,
  documentId,
  userId,
  onContentUpdate,
  externalContent,
  isSidebarOpen,
  setIsSidebarOpen,
  isMaximized,
  setIsMaximized,
  onCursorMove,
  collaborators = []
}: DocumentEditorProps) {
  // Hooks
  const { state: content, setState: setContent, undo, redo, canUndo, canRedo } = useUndoRedo(initialContent)
  const { isSaving, saveError } = useAutoSave({ documentId, content, userId })

  const [lineCount, setLineCount] = useState(1)
  const [showPreview, setShowPreview] = useState(false)
  const [isListening, setIsListening] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const preRef = useRef<HTMLPreElement>(null)
  const lineNumbersRef = useRef<HTMLDivElement>(null)

  // Search State
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<number[]>([])

  // Realtime hook
  const { status } = useRealtimeDocument({
    documentId,
    onContentUpdate: (newContent) => {
      if (newContent !== content) {
        setContent(newContent)
        onContentUpdate(newContent)
      }
    }
  })

  // Handle external updates
  useEffect(() => {
    if (externalContent !== undefined && externalContent !== null && externalContent !== content) {
      setContent(externalContent)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalContent])

  // Update line count & Highlights
  useEffect(() => {
    const lines = content.split('\n').length
    setLineCount(lines)
  }, [content])

  // Voice to Text Logic
  const toggleListening = () => {
    if (isListening) {
      // Logic to stop handled by onend usually, but we can force stop if we stored the instance
      // For simplicity, we just rely on the toggle to start, and auto-stop after speech
      // To strictly toggle, we need to keep ref to recognition. 
      // Simplified: Just start listening. 
      setIsListening(false)
      return
    }

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition
      const recognition = new (SpeechRecognition as new () => SpeechRecognition)()
      recognition.lang = 'id-ID' // Indonesian support
      recognition.continuous = false
      recognition.interimResults = false

      recognition.onstart = () => setIsListening(true)
      recognition.onend = () => setIsListening(false)
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript
        const newContent = content + (content ? ' ' : '') + transcript
        setContent(newContent)
        onContentUpdate(newContent)
      }
      recognition.start()
    } else {
      alert('Browser Anda tidak mendukung Voice Recognition.')
    }
  }

  // Search Logic
  useEffect(() => {
    if (!searchQuery) {
      setSearchResults([])
      return
    }
    const regex = new RegExp(searchQuery, 'gi')
    const matches = []
    let match
    while ((match = regex.exec(content)) !== null) {
      matches.push(match.index)
    }
    setSearchResults(matches)
  }, [searchQuery, content])

  // Sync Scroll Logic
  const handleScroll = () => {
    if (textareaRef.current) {
      const { scrollTop, scrollLeft } = textareaRef.current
      if (lineNumbersRef.current) {
        lineNumbersRef.current.scrollTop = scrollTop
      }
      if (preRef.current) {
        preRef.current.scrollTop = scrollTop
        preRef.current.scrollLeft = scrollLeft
      }
    }
  }

  // Free mouse cursor tracking (Figma-style)
  const editorPaneRef = useRef<HTMLDivElement>(null)
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onCursorMove || !editorPaneRef.current) return
    const rect = editorPaneRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    onCursorMove(x, y)
  }

  // Handle Text Change
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value
    setContent(newContent)
    onContentUpdate(newContent)
  }

  // Handle Download (Markdown)
  const handleDownloadMd = () => {
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `document-${documentId.slice(0, 6)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Handle Download (TXT)
  const handleDownloadTxt = () => {
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `document-${documentId.slice(0, 6)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // PDF Export (Native Print)
  const handlePrint = () => {
    window.print()
  }

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        undo()
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
        e.preventDefault()
        redo()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        // Auto-save handles this
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        if (!showSearch) setShowSearch(true)
        setTimeout(() => document.getElementById('search-input')?.focus(), 100)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault()
        setShowPreview(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  // Handle Download (HTML)
  const handleDownloadHtml = async () => {
    const htmlContent = await marked.parse(content)
    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Document-${documentId.slice(0, 6)}</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 2rem; color: #333; }
          pre { background: #f4f4f4; padding: 1rem; border-radius: 4px; overflow-x: auto; }
          code { font-family: monospace; background: #f4f4f4; padding: 0.2rem 0.4rem; border-radius: 4px; }
          blockquote { border-left: 4px solid #ccc; margin: 0; padding-left: 1rem; color: #666; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
          th { background: #f4f4f4; }
          img { max-width: 100%; height: auto; }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
      </html>
    `
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' })
    saveAs(blob, `document-${documentId.slice(0, 6)}.html`)
  }

  // Handle Download (DOCX)
  const handleDownloadDocx = async () => {
    const htmlContent = await marked.parse(content)
    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Times New Roman', serif; font-size: 12pt; }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
      </html>
    `
    // Convert HTML to DOCX Blob
    asBlob(fullHtml).then((blob) => {
      saveAs(blob as Blob, `document-${documentId.slice(0, 6)}.docx`)
    })
  }

  // Hydration fix
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Highlight logic
  const getHighlightedText = (text: string) => {
    try {
      return Prism.highlight(text, Prism.languages.markdown, 'markdown')
    } catch (e) {
      return text
    }
  }

  const displayContent = content + '\n'

  if (!mounted) {
    return (
      <div className="relative flex flex-col h-full w-full overflow-hidden rounded-xl border border-white/10 bg-black/40 backdrop-blur-md shadow-2xl">
        <div className="flex-1 w-full bg-transparent" />
      </div>
    )
  }

  return (
    <div className="relative flex flex-col h-full w-full overflow-hidden rounded-xl border border-white/5 bg-[#050505]/90 backdrop-blur-3xl shadow-2xl transition-all duration-500 hover:border-white/10 hover:shadow-cyan-500/5">

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/5 backdrop-blur-xl z-20 overflow-x-auto">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {/* Mac-style Window Controls */}
            <div className="flex gap-1.5 mr-2 group">
              <button
                onClick={() => {
                  if (setIsMaximized) setIsMaximized(false)
                  if (setIsSidebarOpen) setIsSidebarOpen(true)
                }}
                className="w-3 h-3 rounded-full bg-red-500/80 border border-red-600/50 shadow-inner group-hover:bg-red-500 flex items-center justify-center transition-transform active:scale-90"
                title="Reset View"
              />
              <button
                onClick={() => setIsSidebarOpen && setIsSidebarOpen(!isSidebarOpen)}
                className={cn("w-3 h-3 rounded-full bg-yellow-500/80 border border-yellow-600/50 shadow-inner group-hover:bg-yellow-500 flex items-center justify-center transition-transform active:scale-90", isSidebarOpen ? "opacity-100" : "opacity-50")}
                title="Toggle Sidebar"
              />
              <button
                onClick={() => setIsMaximized && setIsMaximized(!isMaximized)}
                className={cn("w-3 h-3 rounded-full bg-emerald-500/80 border border-emerald-600/50 shadow-inner group-hover:bg-emerald-500 flex items-center justify-center transition-transform active:scale-90", isMaximized ? "animate-pulse" : "")}
                title="Focus Mode (Maximize)"
              />
            </div>
            <div className="h-4 w-[1px] bg-white/10 hidden sm:block mx-2" />
            <div className="h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)] animate-pulse" />
            <span className="text-xs font-semibold tracking-wider text-cyan-100/80 uppercase font-mono whitespace-nowrap">
              DOC-{documentId.slice(0, 6)}
            </span>
          </div>
          <div className="h-4 w-[1px] bg-white/10 hidden sm:block" />

          {/* Actions */}
          <div className="flex items-center gap-1">
            <button onClick={undo} disabled={!canUndo} className="p-1.5 rounded-md hover:bg-white/10 disabled:opacity-30 transition-colors" title="Undo (Ctrl+Z)">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></svg>
            </button>
            <button onClick={redo} disabled={!canRedo} className="p-1.5 rounded-md hover:bg-white/10 disabled:opacity-30 transition-colors" title="Redo (Ctrl+Y)">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" /></svg>
            </button>
            <div className="h-4 w-[1px] bg-white/10 mx-1" />

            <button onClick={toggleListening} className={cn("p-1.5 rounded-md hover:bg-white/10 transition-colors text-zinc-400 hover:text-cyan-400", isListening && "text-red-400 animate-pulse")} title="Voice Typing">
              {isListening ? <MicOff size={14} /> : <Mic size={14} />}
            </button>

            <button onClick={() => setShowPreview(!showPreview)} className={cn("p-1.5 rounded-md hover:bg-white/10 transition-colors text-zinc-400 hover:text-cyan-400", showPreview && "bg-white/10 text-cyan-400")} title="Preview Mode (Ctrl+P)">
              {showPreview ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>


            <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/5 mx-1">
              <button onClick={handleDownloadMd} className="px-2 py-1 rounded text-[10px] hover:bg-white/10 transition-colors text-zinc-400 hover:text-cyan-400 font-mono" title="Export .md">
                MD
              </button>
              <div className="w-[1px] bg-white/10 my-0.5" />
              <button onClick={handleDownloadTxt} className="px-2 py-1 rounded text-[10px] hover:bg-white/10 transition-colors text-zinc-400 hover:text-cyan-400 font-mono" title="Export .txt">
                TXT
              </button>
              <div className="w-[1px] bg-white/10 my-0.5" />
              <button onClick={handleDownloadHtml} className="px-2 py-1 rounded text-[10px] hover:bg-white/10 transition-colors text-zinc-400 hover:text-cyan-400 font-mono" title="Export .html">
                HTML
              </button>
              <div className="w-[1px] bg-white/10 my-0.5" />
              <button onClick={handleDownloadDocx} className="px-2 py-1 rounded text-[10px] hover:bg-white/10 transition-colors text-zinc-400 hover:text-cyan-400 font-mono" title="Export .docx">
                DOCX
              </button>
              <div className="w-[1px] bg-white/10 my-0.5" />
              <button onClick={handlePrint} className="px-2 py-1 rounded text-[10px] hover:bg-white/10 transition-colors text-zinc-400 hover:text-cyan-400 font-mono" title="Print / Save PDF">
                PDF
              </button>
            </div>



          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          {/* Collaborator Avatars — hidden when sidebar is open to prevent overflow */}
          {collaborators.length > 0 && (isMaximized || !isSidebarOpen) && (
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {collaborators.slice(0, 5).map((user) => (
                  <div
                    key={user.userId}
                    title={user.displayName}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-[#0a0a0a] cursor-default transition-all duration-200 hover:scale-125 hover:z-10 hover:ring-2 hover:ring-white/20"
                    style={{ backgroundColor: user.color }}
                  >
                    {user.displayName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                ))}
                {collaborators.length > 5 && (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-zinc-300 bg-zinc-700 border-2 border-[#0a0a0a]">
                    +{collaborators.length - 5}
                  </div>
                )}
              </div>
              <span className="text-[10px] text-zinc-500 hidden sm:inline">
                {collaborators.length === 1 ? '1 editor' : `${collaborators.length} editors`}
              </span>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[10px] text-green-400/80 font-semibold">LIVE</span>
              </div>
            </div>
          )}

          {/* Status Bar */}
          <div className={cn("flex items-center justify-start pl-4 gap-2 px-3 py-1.5 rounded-full border transition-colors duration-300 backdrop-blur-sm w-[150px]",
            status === 'SUBSCRIBED'
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : status === 'CONNECTING'
                ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                : "bg-zinc-500/10 border-zinc-500/20 text-zinc-400"
          )}>
            {status === 'SUBSCRIBED' ? (
              <>
                {isSaving ? (
                  <Loader2 className="w-2 h-2 animate-spin text-emerald-400" />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.5)]" />
                )}
                <span className="font-bold">ONLINE</span>
              </>
            ) : status === 'CONNECTING' ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                <span className="font-semibold">CONNECTING</span>
              </>
            ) : (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                <span className="font-medium">OFFLINE</span>
              </>
            )}
          </div>

          {/* Save Error Indicator */}
          {saveError && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border bg-red-500/10 border-red-500/20 text-red-400 text-xs font-mono animate-pulse">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400 shadow-[0_0_5px_rgba(248,113,113,0.5)]" />
              <span className="font-bold">SAVE FAILED</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area (Split View) */}
      <div className="relative flex-1 w-full overflow-hidden flex">

        {/* Editor Pane */}
        <div ref={editorPaneRef} onMouseMove={handleMouseMove} className={cn("relative h-full transition-all duration-300", showPreview ? "w-1/2 border-r border-white/5" : "w-full")}>
          {/* Search Popover (Floating over Editor) */}
          {/* Search Popover (Floating & Expanding) */}
          {/* Search Popover (Floating & Expanding) */}
          <div className={cn("absolute top-3 right-6 z-50 flex items-center justify-end transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1)", showSearch ? "w-72" : "w-10")}>
            <div className={cn("flex items-center gap-2 bg-[#1a1a1a] border border-white/10 p-1.5 rounded-full shadow-2xl overflow-hidden transition-all duration-500", showSearch ? "w-full pl-3 pr-1.5" : "w-9 h-9 justify-center bg-transparent border-transparent shadow-none hover:bg-white/5")}>

              {/* Toggle Button (Always visible acting as anchor) */}
              <button onClick={() => setShowSearch(!showSearch)} className={cn("flex-shrink-0 transition-colors duration-300", showSearch ? "text-cyan-400" : "text-zinc-500 hover:text-cyan-400")} title="Find (Ctrl+F)">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
              </button>

              {/* Input Area (Visible only when expanded) */}
              <div className={cn("flex items-center gap-2 flex-1 transition-all duration-300 delay-75", showSearch ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4 pointer-events-none")}>
                <div className="h-4 w-[1px] bg-white/10 mx-1 flex-shrink-0" />
                <input
                  id="search-input"
                  type="text"
                  placeholder="Find in document..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none outline-none text-xs text-white placeholder-zinc-500 w-full focus:ring-0 min-w-0 font-medium"
                />
                <div className="text-[10px] text-zinc-500 font-mono whitespace-nowrap min-w-[30px] text-center bg-black/30 rounded px-1.5 py-0.5">
                  {searchResults.length > 0 ? <span className="text-emerald-400">{searchResults.length}</span> : <span>0</span>}
                </div>
                <button onClick={() => { setShowSearch(false); setSearchQuery('') }} className="text-zinc-500 hover:text-red-400 p-1 rounded-full hover:bg-white/5 flex-shrink-0 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
            </div>
          </div>

          {/* Line Numbers */}
          <div
            ref={lineNumbersRef}
            className="absolute left-0 top-0 bottom-0 w-12 bg-black/20 border-r border-white/5 text-right font-mono text-xs leading-6 py-4 pr-3 text-zinc-600 select-none overflow-hidden transition-colors hover:text-zinc-500"
            style={{ zIndex: 15 }}
          >
            {Array.from({ length: lineCount }).map((_, i) => (
              <div key={i} className="h-6">{i + 1}</div>
            ))}
          </div>

          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onScroll={handleScroll}
            className="absolute inset-0 z-10 w-full h-full resize-none !pl-20 pr-4 py-4 font-mono text-sm leading-6 bg-transparent text-transparent caret-cyan-400 outline-none border-none whitespace-pre-wrap break-words overflow-auto no-scrollbar"
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
          />

          {/* Remote Cursor Overlay (Figma-style) */}
          <CursorOverlay collaborators={collaborators} />

          {/* Highlight Layer */}
          <pre
            id="print-content"
            ref={preRef}
            className="absolute inset-0 z-0 w-full h-full m-0 !pl-20 pr-4 py-4 font-mono text-sm leading-6 whitespace-pre-wrap break-words overflow-hidden pointer-events-none text-zinc-300"
            aria-hidden="true"
          >
            <code
              className="language-markdown"
              dangerouslySetInnerHTML={{ __html: getHighlightedText(displayContent) }}
            />
          </pre>

          {/* Print Portal - Render outside normal flow */}
          {mounted && createPortal(
            <div id="print-content" className="hidden print:block text-black bg-white p-0 m-0 whitespace-pre-wrap font-mono text-sm leading-6">
              {content}
            </div>,
            document.body
          )}
        </div>

        {/* Preview Pane */}
        {showPreview && (
          <div className="w-1/2 h-full bg-black/40 overflow-auto custom-scrollbar p-8 prose prose-invert prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </div>
        )}

      </div>
    </div>
  )
}
