'use client'

import { useState, useEffect, use } from 'react'
import { getDocumentByToken, type SharedDocumentResult } from '@/lib/sharing'
import { SharedDocumentView } from './SharedDocumentView'
import { Loader2, AlertTriangle } from 'lucide-react'

export default function SharedDocumentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [result, setResult] = useState<SharedDocumentResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isInvalid, setIsInvalid] = useState(false)

  useEffect(() => {
    async function fetchSharedDocument() {
      try {
        const data = await getDocumentByToken(token)
        if (data) {
          setResult(data)
        } else {
          setIsInvalid(true)
        }
      } catch (err: unknown) {
        console.error('Error fetching shared document:', err)
        setIsInvalid(true)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSharedDocument()
  }, [token])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    )
  }

  if (isInvalid || !result) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-zinc-100">
        <div className="text-center max-w-md mx-4">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold mb-3">Link Tidak Valid</h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Link ini sudah kedaluwarsa, telah dihapus, atau dokumen tidak lagi tersedia.
          </p>
        </div>
      </div>
    )
  }

  return (
    <SharedDocumentView
      document={result.document}
      permission={result.permission}
    />
  )
}
