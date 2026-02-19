import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface UseAutoSaveProps {
  documentId: string
  content: string
  userId: string
}

export function useAutoSave({ documentId, content, userId }: UseAutoSaveProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [lastSavedContent, setLastSavedContent] = useState(content)
  const contentRef = useRef(content)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

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
          .upsert({ 
            id: documentId,
            user_id: userId,
            content: contentRef.current,
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' })

        if (error) {
          console.error('AutoSave Error:', error.message)
          // Retry logic or notification could go here
        } else {
          setLastSavedContent(contentRef.current)
// console.log('Document auto-saved successfully')
        }
      } catch (err) {
        console.error('AutoSave Unexpected Error:', err)
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

  return { isSaving }
}
