import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

interface Document {
  id: string
  content: string
  title: string
  updated_at: string
}

interface UseRealtimeDocumentProps {
  documentId: string
  // initialContent: string // Removed as unused
  onContentUpdate: (newContent: string) => void
}

export function useRealtimeDocument({ documentId, onContentUpdate }: UseRealtimeDocumentProps) {
  const [status, setStatus] = useState<'CONNECTING' | 'SUBSCRIBED' | 'DISCONNECTED'>('CONNECTING')

  // Grace period ref
  const disconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!documentId) return

    // Logic: Subscribe ke channel Supabase untuk dokumen spesifik.
    const channel = supabase
      .channel(`document:${documentId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'documents',
          filter: `id=eq.${documentId}`,
        },
        (payload: RealtimePostgresChangesPayload<Document>) => {
// console.log('Realtime update received:', payload)
          const newDoc = payload.new as Document
          if (newDoc && newDoc.content) {
             // Logic: Tangani event postgres_changes untuk mengupdate state lokal
            onContentUpdate(newDoc.content)
          }
        }
      )
      .subscribe((status) => {
// console.log(`Realtime subscription status for doc ${documentId}:`, status)
        
        if (status === 'SUBSCRIBED') {
          // Clear any pending disconnect timer
          if (disconnectTimeoutRef.current) {
            clearTimeout(disconnectTimeoutRef.current)
            disconnectTimeoutRef.current = null
          }
          setStatus('SUBSCRIBED')
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Debounce disconnect: wait 2s before showing OFFLINE
          if (!disconnectTimeoutRef.current) {
            disconnectTimeoutRef.current = setTimeout(() => {
               setStatus('DISCONNECTED')
            }, 2000)
          }
        }
      })

    // Critical Requirement: Pastikan fungsi cleanup menggunakan supabase.removeChannel(channel)
    return () => {
// console.log(`Unsubscribing from channel document:${documentId}`)
      supabase.removeChannel(channel)
      
      // Clear timeout on unmount
      if (disconnectTimeoutRef.current) {
         clearTimeout(disconnectTimeoutRef.current)
      }
    }
  }, [documentId, onContentUpdate])

  return { status }
}
