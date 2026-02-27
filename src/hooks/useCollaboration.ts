'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CollaboratorPresence {
  userId: string
  displayName: string
  color: string
  cursor: {
    line: number
    col: number
  } | null
  lastSeen: string
}

// ─── Colors ───────────────────────────────────────────────────────────────────

const COLLABORATOR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
]

function getColorForIndex(index: number): string {
  return COLLABORATOR_COLORS[index % COLLABORATOR_COLORS.length]
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseCollaborationOptions {
  documentId: string
  userId: string
  displayName: string
  onContentChange?: (newContent: string, fromUserId: string) => void
}

export function useCollaboration({
  documentId,
  userId,
  displayName,
  onContentChange,
}: UseCollaborationOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const [collaborators, setCollaborators] = useState<CollaboratorPresence[]>([])
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const myColor = useRef<string>(COLLABORATOR_COLORS[0])
  const typingTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const onContentChangeRef = useRef(onContentChange)
  onContentChangeRef.current = onContentChange

  // ── Broadcast content change ──────────────────────────────────────────────

  const broadcastContentChange = useCallback((newContent: string) => {
    const ch = channelRef.current
    if (!ch) return
    try {
      ch.send({
        type: 'broadcast',
        event: 'content_change',
        payload: { content: newContent, userId, timestamp: Date.now() },
      })
    } catch (err: unknown) {
      console.error('Broadcast error:', err)
    }
  }, [userId])

  // ── Update cursor position (via presence track) ───────────────────────────

  const updateCursor = useCallback((line: number, col: number) => {
    const ch = channelRef.current
    if (!ch) return
    try {
      ch.track({
        userId,
        displayName,
        color: myColor.current,
        cursor: { line, col },
        lastSeen: new Date().toISOString(),
      })
    } catch (err: unknown) {
      console.error('Cursor track error:', err)
    }
  }, [userId, displayName])

  // ── Setup channel ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!documentId || !userId) return

    console.log(`[Collab] Joining channel document:${documentId} as ${displayName} (${userId})`)

    const channel = supabase.channel(`document:${documentId}`, {
      config: {
        presence: { key: userId },
        broadcast: { self: false },
      },
    })

    // Presence sync — update collaborators list
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<CollaboratorPresence>()
      const allUsers = Object.values(state).map((entries) => entries[0])
      const others = allUsers.filter((u) => u.userId !== userId)

      console.log(`[Collab] Presence sync: ${allUsers.length} total, ${others.length} others`)

      // Assign stable colors based on join order
      const allSorted = [...allUsers].sort(
        (a, b) => new Date(a.lastSeen).getTime() - new Date(b.lastSeen).getTime()
      )
      const myIndex = allSorted.findIndex((u) => u.userId === userId)
      if (myIndex >= 0) myColor.current = getColorForIndex(myIndex)

      setCollaborators(others)
    })

    channel.on('presence', { event: 'join' }, ({ newPresences }) => {
      console.log('[Collab] User joined:', newPresences.map((p) => (p as unknown as CollaboratorPresence).displayName))
    })

    channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      console.log('[Collab] User left:', leftPresences.map((p) => (p as unknown as CollaboratorPresence).displayName))
    })

    // Broadcast — receive content changes from others
    channel.on('broadcast', { event: 'content_change' }, ({ payload }) => {
      if (payload.userId === userId) return

      console.log(`[Collab] Content change from ${payload.userId}`)

      // Track typing users
      setTypingUsers((prev) =>
        prev.includes(payload.userId) ? prev : [...prev, payload.userId]
      )

      // Clear typing after 2s idle
      clearTimeout(typingTimersRef.current[payload.userId])
      typingTimersRef.current[payload.userId] = setTimeout(() => {
        setTypingUsers((prev) => prev.filter((id) => id !== payload.userId))
      }, 2000)

      // Apply the content change
      if (onContentChangeRef.current) {
        onContentChangeRef.current(payload.content, payload.userId)
      }
    })

    // Subscribe and track presence
    channel.subscribe(async (status, err) => {
      console.log(`[Collab] Channel status: ${status}`, err || '')
      if (status === 'SUBSCRIBED') {
        setIsConnected(true)
        try {
          await channel.track({
            userId,
            displayName,
            color: myColor.current,
            cursor: null,
            lastSeen: new Date().toISOString(),
          })
          console.log('[Collab] Presence tracked successfully')
        } catch (trackErr: unknown) {
          console.error('[Collab] Failed to track presence:', trackErr)
        }
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[Collab] Channel error:', err)
        setIsConnected(false)
      } else if (status === 'TIMED_OUT') {
        console.error('[Collab] Channel timed out')
        setIsConnected(false)
      }
    })

    channelRef.current = channel

    // Cleanup
    return () => {
      console.log(`[Collab] Leaving channel document:${documentId}`)
      Object.values(typingTimersRef.current).forEach(clearTimeout)
      typingTimersRef.current = {}

      supabase.removeChannel(channel)
      channelRef.current = null
      setIsConnected(false)
      setCollaborators([])
      setTypingUsers([])
    }
  }, [documentId, userId, displayName]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    collaborators,
    typingUsers,
    isConnected,
    myColor: myColor.current,
    broadcastContentChange,
    updateCursor,
  }
}
