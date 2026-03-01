'use client'

import { useState, useEffect, useCallback } from 'react'
import { getVersionList, restoreVersion, type DocumentVersionSummary } from '@/lib/versions'
import { History, RotateCcw, GitCompare, ChevronDown, Loader2, Clock, Tag } from 'lucide-react'

interface VersionTimelineProps {
  documentId: string
  userId: string
  onCompare: (versionIdA: string, versionIdB: string) => void
  onContentRestore: (newContent: string) => void
  onClose: () => void
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)

  if (minutes < 1) return 'Baru saja'
  if (minutes < 60) return `${minutes}m lalu`
  if (hours < 24) return `${hours}h lalu`
  return `${days}d lalu`
}

export function VersionTimeline({
  documentId,
  userId,
  onCompare,
  onContentRestore,
  onClose,
}: VersionTimelineProps) {
  const [versions, setVersions] = useState<DocumentVersionSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(0)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isRestoring, setIsRestoring] = useState<string | null>(null)

  const loadVersions = useCallback(async (pageNum: number, append = false) => {
    try {
      setIsLoading(true)
      const result = await getVersionList(documentId, pageNum)
      setVersions(prev => append ? [...prev, ...result.versions] : result.versions)
      setHasMore(result.hasMore)
    } catch (err) {
      console.error('Failed to load versions:', err)
    } finally {
      setIsLoading(false)
    }
  }, [documentId])

  useEffect(() => {
    loadVersions(0)
  }, [loadVersions])

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= 2) return [prev[1], id]
      return [...prev, id]
    })
  }

  async function handleRestore(version: DocumentVersionSummary) {
    if (!confirm(`Restore ke v${version.version_number}? Dokumen akan kembali ke versi ini.`)) return
    try {
      setIsRestoring(version.id)
      const restoredContent = await restoreVersion(documentId, version.id, userId)
      await loadVersions(0)
      onContentRestore(restoredContent)
    } catch (err) {
      console.error('Restore failed:', err)
    } finally {
      setIsRestoring(null)
    }
  }

  function handleLoadMore() {
    const nextPage = page + 1
    setPage(nextPage)
    loadVersions(nextPage, true)
  }

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-cyan-400" />
          <h2 className="font-semibold text-sm text-zinc-100">Version History</h2>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-300 text-xs px-2 py-1 rounded hover:bg-white/5 transition-colors"
        >
          Close
        </button>
      </div>

      {/* Actions */}
      <div className="px-4 py-2 border-b border-white/5 space-y-2">
        {/* Quick compare */}
        {versions.length >= 2 && (
          <button
            onClick={() => onCompare(versions[1].id, versions[0].id)}
            className="w-full text-xs bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/20 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5"
          >
            <GitCompare className="w-3.5 h-3.5" />
            Compare v{versions[1].version_number} vs v{versions[0].version_number}
          </button>
        )}

        {/* Arbitrary compare */}
        {selectedIds.length === 2 && (
          <button
            onClick={() => onCompare(selectedIds[0], selectedIds[1])}
            className="w-full text-xs bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/20 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5"
          >
            <GitCompare className="w-3.5 h-3.5" />
            Compare selected
          </button>
        )}
        {selectedIds.length === 1 && (
          <p className="text-[10px] text-zinc-500 text-center">Select 1 more version to compare</p>
        )}
      </div>

      {/* Version list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && versions.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-zinc-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span className="text-sm">Loading history...</span>
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-600 px-4">
            <Clock className="w-8 h-8 mb-3 text-zinc-700" />
            <p className="text-sm text-center">No version history yet.</p>
            <p className="text-xs text-center mt-1">Versions are saved automatically every 30 seconds.</p>
          </div>
        ) : (
          <>
            {versions.map((version, index) => {
              const isSelected = selectedIds.includes(version.id)
              const isLatest = index === 0

              return (
                <div
                  key={version.id}
                  className={`group border-b border-white/5 px-4 py-3 transition-colors ${isSelected ? 'bg-indigo-500/10' : 'hover:bg-white/[0.03]'
                    }`}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(version.id)}
                      className="mt-1 accent-indigo-500 rounded cursor-pointer"
                    />

                    {/* Timeline dot */}
                    <div className="flex flex-col items-center mt-1.5">
                      <div className={`w-2.5 h-2.5 rounded-full ${isLatest ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]' : 'bg-zinc-600'}`} />
                      {index < versions.length - 1 && (
                        <div className="w-px h-full bg-zinc-800 mt-1" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-xs font-bold ${isLatest ? 'text-emerald-400' : 'text-indigo-400'}`}>
                          v{version.version_number}
                        </span>
                        {isLatest && (
                          <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-medium">
                            LATEST
                          </span>
                        )}
                        {version.label && (
                          <span className="text-[10px] text-zinc-400 flex items-center gap-0.5 truncate">
                            <Tag className="w-2.5 h-2.5" />
                            {version.label}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-600 mt-0.5">
                        {formatRelativeTime(version.created_at)}
                        {' · '}
                        {new Date(version.created_at).toLocaleString('id-ID', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>

                    {/* Restore button */}
                    {!isLatest && (
                      <button
                        onClick={() => handleRestore(version)}
                        disabled={isRestoring === version.id}
                        className="opacity-0 group-hover:opacity-100 text-[10px] text-amber-400 hover:text-amber-300 disabled:opacity-50 shrink-0 flex items-center gap-1 px-2 py-1 rounded hover:bg-amber-500/10 transition-all"
                      >
                        {isRestoring === version.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3 h-3" />
                        )}
                        Restore
                      </button>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Load more */}
            {hasMore && (
              <button
                onClick={handleLoadMore}
                disabled={isLoading}
                className="w-full py-3 text-xs text-zinc-500 hover:text-zinc-300 flex items-center justify-center gap-1 transition-colors"
              >
                {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronDown className="w-3 h-3" />}
                Load more
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
