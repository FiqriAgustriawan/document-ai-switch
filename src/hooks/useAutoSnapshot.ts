'use client'

import { useEffect, useRef, useCallback } from 'react'
import { createSnapshot } from '@/lib/versions'

interface UseAutoSnapshotOptions {
  documentId: string
  content: string
  userId: string
  intervalMs?: number // default 30 seconds
}

export function useAutoSnapshot({
  documentId,
  content,
  userId,
  intervalMs = 30_000,
}: UseAutoSnapshotOptions) {
  const contentRef = useRef(content)
  contentRef.current = content

  // Save named version manually
  const saveNamedVersion = useCallback(async (label: string) => {
    if (!documentId || !userId) return
    try {
      const result = await createSnapshot(documentId, contentRef.current, userId, label)
      return result
    } catch (err) {
      console.error('saveNamedVersion failed:', err)
      return null
    }
  }, [documentId, userId])

  // Auto-snapshot every intervalMs
  useEffect(() => {
    if (!documentId || !userId) return

    const timer = setInterval(async () => {
      try {
        await createSnapshot(documentId, contentRef.current, userId)
      } catch (err) {
        console.error('Auto-snapshot failed:', err)
      }
    }, intervalMs)

    return () => clearInterval(timer)
  }, [documentId, userId, intervalMs])

  // Create initial snapshot on mount (first version)
  useEffect(() => {
    if (!documentId || !userId) return
    const timeout = setTimeout(async () => {
      try {
        await createSnapshot(documentId, contentRef.current, userId)
      } catch (err) {
        console.error('Initial snapshot failed:', err)
      }
    }, 2000) // Wait 2s for content to settle

    return () => clearTimeout(timeout)
  }, [documentId, userId])

  return { saveNamedVersion }
}
