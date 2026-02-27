import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface UseAutoSaveProps {
  documentId: string
  content: string
  userId: string
}

export function useAutoSave({ documentId, content, userId }: UseAutoSaveProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastSavedContent, setLastSavedContent] = useState(content)
  const contentRef = useRef(content)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Warn user about unsaved changes before closing tab/browser
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (contentRef.current !== lastSavedContent) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [lastSavedContent])

  // Update ref whenever content changes to always have the latest value in timeout
  useEffect(() => {
    contentRef.current = content
  }, [content])

  useEffect(() => {
    // Logic: Debounce save ke Supabase setiap 2 detik jika ada perubahan content.
    if (content === lastSavedContent) return

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(async () => {
      setIsSaving(true)
      try {
        const { error } = await supabase
          .from('documents')
          .update({ 
            content: contentRef.current,
            updated_at: new Date().toISOString()
          })
          .eq('id', documentId)

        if (error) {
          console.error('AutoSave Error:', error.message)
          setSaveError(`Save failed: ${error.message}`)
        } else {
          setLastSavedContent(contentRef.current)
          setSaveError(null)
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error('AutoSave Unexpected Error:', message)
        setSaveError(`Save failed: ${message}`)
      } finally {
        setIsSaving(false)
      }
    }, 2000)

    // Cleanup function
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [content, documentId, userId, lastSavedContent])

  return { isSaving, saveError }
}
