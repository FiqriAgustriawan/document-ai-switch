'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CursorMode = 'pointer' | 'typing'

export interface CursorPosition {
  x: number  // percentage (0-100) relative to editor container
  y: number  // percentage (0-100) relative to editor container
  mode: CursorMode
}

export interface CollaboratorPresence {
  userId: string
  displayName: string
  color: string
  cursor: CursorPosition | null
  lastSeen: number
}

// ─── Colors ───────────────────────────────────────────────────────────────────

const COLLABORATOR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
]

function getColorForUser(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }
  return COLLABORATOR_COLORS[Math.abs(hash) % COLLABORATOR_COLORS.length]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const HEARTBEAT_INTERVAL = 3000
const USER_TIMEOUT = 10000

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
  const myColor = getColorForUser(userId)

  const collaboratorsRef = useRef<Map<string, CollaboratorPresence>>(new Map())
  const typingTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const cleanupRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onContentChangeRef = useRef(onContentChange)
  onContentChangeRef.current = onContentChange

  // ── Broadcast ─────────────────────────────────────────────────────────────

  const sendBroadcast = useCallback((event: string, payload: Record<string, unknown>) => {
    const ch = channelRef.current
    if (!ch) return
    ch.send({
      type: 'broadcast',
      event,
      payload: { ...payload, userId, displayName, color: myColor, timestamp: Date.now() },
    })
  }, [userId, displayName, myColor])

  const broadcastContentChange = useCallback((newContent: string) => {
    sendBroadcast('content_change', { content: newContent })
  }, [sendBroadcast])

  // Pointer mode: free mouse cursor (x, y as percentage)
  const updateCursor = useCallback((x: number, y: number) => {
    sendBroadcast('cursor_update', { cursor: { x, y, mode: 'pointer' } })
  }, [sendBroadcast])

  // Typing mode: text caret cursor (x, y as percentage of editor pane)
  const updateTypingCursor = useCallback((x: number, y: number) => {
    sendBroadcast('cursor_update', { cursor: { x, y, mode: 'typing' } })
  }, [sendBroadcast])

  // ── Sync state ────────────────────────────────────────────────────────────

  const syncCollaboratorsState = useCallback(() => {
    const now = Date.now()
    const map = collaboratorsRef.current
    for (const [uid] of map.entries()) {
      const user = map.get(uid)
      if (user && now - user.lastSeen > USER_TIMEOUT) {
        map.delete(uid)
      }
    }
    const others = Array.from(map.values()).filter((u) => u.userId !== userId)
    setCollaborators(others)
  }, [userId])

  // ── Event handlers ────────────────────────────────────────────────────────

  const handleUserEvent = useCallback((payload: Record<string, unknown>) => {
    const uid = payload.userId as string
    if (uid === userId) return

    const existing = collaboratorsRef.current.get(uid)
    collaboratorsRef.current.set(uid, {
      userId: uid,
      displayName: (payload.displayName as string) || 'Anonymous',
      color: (payload.color as string) || getColorForUser(uid),
      cursor: existing?.cursor || null,
      lastSeen: Date.now(),
    })
    syncCollaboratorsState()
  }, [userId, syncCollaboratorsState])

  const handleCursorEvent = useCallback((payload: Record<string, unknown>) => {
    const uid = payload.userId as string
    if (uid === userId) return

    const existing = collaboratorsRef.current.get(uid)
    const cursor = payload.cursor as CursorPosition | null

    collaboratorsRef.current.set(uid, {
      userId: uid,
      displayName: (payload.displayName as string) || existing?.displayName || 'Anonymous',
      color: (payload.color as string) || existing?.color || getColorForUser(uid),
      cursor,
      lastSeen: Date.now(),
    })
    syncCollaboratorsState()
  }, [userId, syncCollaboratorsState])

  const handleContentEvent = useCallback((payload: Record<string, unknown>) => {
    const uid = payload.userId as string
    if (uid === userId) return

    const existing = collaboratorsRef.current.get(uid)
    if (existing) {
      existing.lastSeen = Date.now()
    } else {
      collaboratorsRef.current.set(uid, {
        userId: uid,
        displayName: (payload.displayName as string) || 'Anonymous',
        color: (payload.color as string) || getColorForUser(uid),
        cursor: null,
        lastSeen: Date.now(),
      })
    }
    syncCollaboratorsState()

    setTypingUsers((prev) =>
      prev.includes(uid) ? prev : [...prev, uid]
    )
    clearTimeout(typingTimersRef.current[uid])
    typingTimersRef.current[uid] = setTimeout(() => {
      setTypingUsers((prev) => prev.filter((id) => id !== uid))
    }, 2000)

    if (onContentChangeRef.current) {
      onContentChangeRef.current(payload.content as string, uid)
    }
  }, [userId, syncCollaboratorsState])

  // ── Channel setup ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!documentId || !userId) return

    const channel = supabase.channel(`doc-collab-${documentId}`, {
      config: { broadcast: { self: false } },
    })

    channel.on('broadcast', { event: 'heartbeat' }, ({ payload }) => handleUserEvent(payload))
    channel.on('broadcast', { event: 'user_join' }, ({ payload }) => handleUserEvent(payload))
    channel.on('broadcast', { event: 'cursor_update' }, ({ payload }) => handleCursorEvent(payload))
    channel.on('broadcast', { event: 'content_change' }, ({ payload }) => handleContentEvent(payload))
    channel.on('broadcast', { event: 'user_leave' }, ({ payload }) => {
      const uid = payload.userId as string
      collaboratorsRef.current.delete(uid)
      syncCollaboratorsState()
    })

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setIsConnected(true)
        channel.send({
          type: 'broadcast',
          event: 'user_join',
          payload: { userId, displayName, color: myColor, timestamp: Date.now() },
        })
      }
    })

    channelRef.current = channel
    setTimeout(() => setIsConnected(true), 1000)

    heartbeatRef.current = setInterval(() => {
      channel.send({
        type: 'broadcast',
        event: 'heartbeat',
        payload: { userId, displayName, color: myColor, timestamp: Date.now() },
      })
    }, HEARTBEAT_INTERVAL)

    cleanupRef.current = setInterval(() => {
      syncCollaboratorsState()
    }, 5000)

    return () => {
      channel.send({
        type: 'broadcast',
        event: 'user_leave',
        payload: { userId, timestamp: Date.now() },
      })

      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      if (cleanupRef.current) clearInterval(cleanupRef.current)
      Object.values(typingTimersRef.current).forEach(clearTimeout)
      typingTimersRef.current = {}

      supabase.removeChannel(channel)
      channelRef.current = null
      collaboratorsRef.current.clear()
      setIsConnected(false)
      setCollaborators([])
      setTypingUsers([])
    }
  }, [documentId, userId, displayName, myColor]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    collaborators,
    typingUsers,
    isConnected,
    myColor,
    broadcastContentChange,
    updateCursor,
    updateTypingCursor,
  }
}
