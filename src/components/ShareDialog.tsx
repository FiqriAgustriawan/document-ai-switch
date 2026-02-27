'use client'

import { useState, useEffect } from 'react'
import { X, Copy, Check, Trash2, Link2, Loader2 } from 'lucide-react'
import {
  createShareLink,
  getDocumentShares,
  revokeShareLink,
  type Permission,
  type ShareRecord
} from '@/lib/sharing'

interface ShareDialogProps {
  documentId: string
  ownerId: string
  onClose: () => void
}

export function ShareDialog({ documentId, ownerId, onClose }: ShareDialogProps) {
  const [shares, setShares] = useState<ShareRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [permission, setPermission] = useState<Permission>('view')
  const [expiresInDays, setExpiresInDays] = useState<number | undefined>(undefined)
  const [isCreating, setIsCreating] = useState(false)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState(false)

  useEffect(() => {
    loadShares()
  }, [documentId])

  async function loadShares() {
    try {
      const data = await getDocumentShares(documentId)
      setShares(data)
    } catch (err: unknown) {
      console.error('Failed to load shares:', err)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCreate() {
    setIsCreating(true)
    try {
      const url = await createShareLink(documentId, ownerId, permission, expiresInDays)
      await navigator.clipboard.writeText(url)
      setCreateSuccess(true)
      setTimeout(() => setCreateSuccess(false), 3000)
      await loadShares()
    } catch (err: unknown) {
      console.error('Failed to create share link:', err)
    } finally {
      setIsCreating(false)
    }
  }

  async function handleCopy(token: string) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
    const url = `${baseUrl}/shared/${token}`
    await navigator.clipboard.writeText(url)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  async function handleRevoke(shareId: string) {
    try {
      await revokeShareLink(shareId)
      setShares(prev => prev.filter(s => s.id !== shareId))
    } catch (err: unknown) {
      console.error('Failed to revoke share:', err)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <Link2 className="w-4 h-4 text-cyan-400" />
            </div>
            <h2 className="font-semibold text-lg text-zinc-100">Share Dokumen</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Create new link form */}
        <div className="space-y-3 mb-6">
          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">Permission</label>
            <select
              value={permission}
              onChange={e => setPermission(e.target.value as Permission)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-cyan-500/50"
            >
              <option value="view">View Only (hanya bisa baca)</option>
              <option value="edit">Edit (bisa ubah dokumen)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">Kedaluwarsa (opsional)</label>
            <select
              value={expiresInDays ?? ''}
              onChange={e => setExpiresInDays(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-cyan-500/50"
            >
              <option value="">Tidak kedaluwarsa</option>
              <option value="1">1 hari</option>
              <option value="7">7 hari</option>
              <option value="30">30 hari</option>
            </select>
          </div>

          <button
            onClick={handleCreate}
            disabled={isCreating}
            className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-sm font-medium transition-all shadow-lg shadow-cyan-900/20 flex items-center justify-center gap-2"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Membuat link...
              </>
            ) : createSuccess ? (
              <>
                <Check className="w-4 h-4" />
                Link disalin ke clipboard
              </>
            ) : (
              <>
                <Link2 className="w-4 h-4" />
                Buat & Salin Link
              </>
            )}
          </button>
        </div>

        {/* Active links */}
        <div>
          <h3 className="text-sm font-medium text-zinc-400 mb-3">Link Aktif</h3>
          {isLoading ? (
            <div className="py-4 text-center">
              <Loader2 className="w-4 h-4 animate-spin text-zinc-500 mx-auto" />
            </div>
          ) : shares.length === 0 ? (
            <p className="text-sm text-zinc-600 text-center py-4">
              Belum ada link yang dibuat.
            </p>
          ) : (
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {shares.map(share => (
                <div
                  key={share.id}
                  className="flex items-center gap-2 bg-white/5 border border-white/5 rounded-lg p-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${share.permission === 'edit'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/20'
                          : 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/20'
                        }`}>
                        {share.permission}
                      </span>
                      {share.expires_at && (
                        <span className="text-[10px] text-zinc-500">
                          Exp: {new Date(share.expires_at).toLocaleDateString('id-ID')}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-600 mt-1 truncate font-mono">
                      .../{share.share_token}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCopy(share.share_token)}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-cyan-400 transition-colors"
                    title="Salin link"
                  >
                    {copiedToken === share.share_token ? (
                      <Check className="w-3.5 h-3.5 text-green-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => handleRevoke(share.id)}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors"
                    title="Hapus link"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
