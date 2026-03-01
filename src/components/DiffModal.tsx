'use client'

import { useState, useEffect, useRef } from 'react'
import { getVersionContent, type DocumentVersion } from '@/lib/versions'
import { computeDiff, type DiffLine, type DiffResult } from '@/lib/diff'
import { X, ChevronUp, ChevronDown, Columns2, AlignJustify, Loader2 } from 'lucide-react'

interface DiffModalProps {
  versionIdA: string
  versionIdB: string
  onClose: () => void
}

type ViewMode = 'split' | 'unified'

function getLineBg(type: DiffLine['type']): string {
  switch (type) {
    case 'added': return 'bg-emerald-950/60'
    case 'removed': return 'bg-red-950/60'
    default: return ''
  }
}

function getLineTextColor(type: DiffLine['type']): string {
  switch (type) {
    case 'added': return 'text-emerald-300'
    case 'removed': return 'text-red-400 line-through opacity-80'
    default: return 'text-zinc-400'
  }
}

function getLineBorder(type: DiffLine['type']): string {
  switch (type) {
    case 'added': return 'border-l-2 border-emerald-500'
    case 'removed': return 'border-l-2 border-red-500'
    default: return 'border-l-2 border-transparent'
  }
}

function getLinePrefix(type: DiffLine['type']): string {
  switch (type) {
    case 'added': return '+'
    case 'removed': return '-'
    default: return ' '
  }
}

export function DiffModal({ versionIdA, versionIdB, onClose }: DiffModalProps) {
  const [versionA, setVersionA] = useState<DocumentVersion | null>(null)
  const [versionB, setVersionB] = useState<DocumentVersion | null>(null)
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('unified')
  const [currentChangeIndex, setCurrentChangeIndex] = useState(0)

  const changeRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true)
        const [a, b] = await Promise.all([
          getVersionContent(versionIdA),
          getVersionContent(versionIdB),
        ])

        const [older, newer] = a.version_number < b.version_number ? [a, b] : [b, a]
        setVersionA(older)
        setVersionB(newer)
        setDiffResult(computeDiff(older.content, newer.content))
      } catch (err) {
        console.error('Failed to load diff:', err)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [versionIdA, versionIdB])

  const changeLineIndices = diffResult?.lines
    .map((line, i) => line.type !== 'unchanged' ? i : -1)
    .filter(i => i !== -1) ?? []

  function scrollToChange(index: number) {
    const lineIndex = changeLineIndices[index]
    if (lineIndex === undefined) return
    const el = changeRefs.current.get(lineIndex)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  function goToNextChange() {
    const next = Math.min(currentChangeIndex + 1, changeLineIndices.length - 1)
    setCurrentChangeIndex(next)
    scrollToChange(next)
  }

  function goToPrevChange() {
    const prev = Math.max(currentChangeIndex - 1, 0)
    setCurrentChangeIndex(prev)
    scrollToChange(prev)
  }

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-[100] p-3">
      <div className="bg-[#0f0f0f] border border-white/10 rounded-xl w-full max-w-6xl h-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0 bg-black/50">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="font-bold text-sm text-zinc-100 shrink-0">
              {versionA && versionB
                ? `v${versionA.version_number} → v${versionB.version_number}`
                : 'Loading...'}
            </h2>

            {diffResult && (
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">+{diffResult.stats.added}</span>
                <span className="text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">-{diffResult.stats.removed}</span>
                <span className="text-zinc-500">{diffResult.stats.unchanged} unchanged</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Change navigation */}
            {changeLineIndices.length > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-zinc-400">
                <button
                  onClick={goToPrevChange}
                  disabled={currentChangeIndex === 0}
                  className="p-1 rounded hover:bg-white/10 disabled:opacity-30 transition-colors"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <span className="min-w-[40px] text-center">
                  {currentChangeIndex + 1}/{changeLineIndices.length}
                </span>
                <button
                  onClick={goToNextChange}
                  disabled={currentChangeIndex === changeLineIndices.length - 1}
                  className="p-1 rounded hover:bg-white/10 disabled:opacity-30 transition-colors"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* View mode toggle */}
            <div className="flex bg-white/5 border border-white/10 rounded-lg overflow-hidden text-[10px]">
              <button
                onClick={() => setViewMode('unified')}
                className={`px-2.5 py-1.5 flex items-center gap-1 transition-colors ${viewMode === 'unified' ? 'bg-cyan-500/20 text-cyan-300' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <AlignJustify className="w-3 h-3" />
                Unified
              </button>
              <button
                onClick={() => setViewMode('split')}
                className={`px-2.5 py-1.5 flex items-center gap-1 transition-colors ${viewMode === 'split' ? 'bg-cyan-500/20 text-cyan-300' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <Columns2 className="w-3 h-3" />
                Split
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-zinc-500 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Computing diff...
            </div>
          ) : !diffResult ? (
            <div className="flex items-center justify-center h-full text-red-400">
              Failed to load diff
            </div>
          ) : diffResult.lines.length === 0 ? (
            <div className="flex items-center justify-center h-full text-zinc-500">
              No differences found
            </div>
          ) : viewMode === 'unified' ? (
            /* ── UNIFIED VIEW ────────────────────────────────────────── */
            <div className="font-mono text-xs">
              <div className="sticky top-0 z-10 grid grid-cols-[3.5rem_3.5rem_1fr] bg-[#0a0a0a] text-zinc-600 text-[10px] px-1 py-1.5 border-b border-white/10">
                <span className="text-right pr-2">Old</span>
                <span className="text-right pr-2">New</span>
                <span className="pl-6">Content</span>
              </div>

              {diffResult.lines.map((line, i) => {
                const isChange = line.type !== 'unchanged'
                return (
                  <div
                    key={i}
                    ref={isChange ? (el) => { if (el) changeRefs.current.set(i, el) } : undefined}
                    className={`grid grid-cols-[3.5rem_3.5rem_1fr] ${getLineBg(line.type)} ${getLineBorder(line.type)} ${isChange && changeLineIndices[currentChangeIndex] === i ? 'ring-1 ring-cyan-500/30' : ''
                      }`}
                  >
                    <span className="text-zinc-700 text-[10px] px-1 py-0.5 select-none text-right pr-2">
                      {line.lineNumberOld ?? ''}
                    </span>
                    <span className="text-zinc-700 text-[10px] px-1 py-0.5 select-none text-right pr-2">
                      {line.lineNumberNew ?? ''}
                    </span>
                    <span className={`px-1 py-0.5 whitespace-pre-wrap break-all ${getLineTextColor(line.type)}`}>
                      <span className="select-none mr-2 opacity-40 inline-block w-3 text-center">{getLinePrefix(line.type)}</span>
                      {line.content || '\u00A0'}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            /* ── SPLIT VIEW ──────────────────────────────────────────── */
            <div className="grid grid-cols-2 divide-x divide-white/10 h-full font-mono text-xs">
              {/* Left panel: OLD version */}
              <div className="overflow-auto">
                <div className="sticky top-0 z-10 bg-[#0a0a0a] px-3 py-1.5 text-[10px] text-red-400 border-b border-white/10 flex items-center justify-between">
                  <span>v{versionA?.version_number} — {versionA?.label ?? 'Old'}</span>
                  {versionA && (
                    <span className="text-zinc-600">
                      {new Date(versionA.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                {diffResult.lines.filter(l => l.type !== 'added').map((line, i) => (
                  <div key={i} className={`flex ${getLineBg(line.type)} ${getLineBorder(line.type)}`}>
                    <span className="text-zinc-700 text-[10px] px-1 py-0.5 select-none w-10 text-right shrink-0 pr-2">
                      {line.lineNumberOld}
                    </span>
                    <span className={`px-1 py-0.5 whitespace-pre-wrap break-all flex-1 ${getLineTextColor(line.type)}`}>
                      {line.content || '\u00A0'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Right panel: NEW version */}
              <div className="overflow-auto">
                <div className="sticky top-0 z-10 bg-[#0a0a0a] px-3 py-1.5 text-[10px] text-emerald-400 border-b border-white/10 flex items-center justify-between">
                  <span>v{versionB?.version_number} — {versionB?.label ?? 'New'}</span>
                  {versionB && (
                    <span className="text-zinc-600">
                      {new Date(versionB.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                {diffResult.lines.filter(l => l.type !== 'removed').map((line, i) => (
                  <div key={i} className={`flex ${getLineBg(line.type)} ${getLineBorder(line.type)}`}>
                    <span className="text-zinc-700 text-[10px] px-1 py-0.5 select-none w-10 text-right shrink-0 pr-2">
                      {line.lineNumberNew}
                    </span>
                    <span className={`px-1 py-0.5 whitespace-pre-wrap break-all flex-1 ${getLineTextColor(line.type)}`}>
                      {line.content || '\u00A0'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
