import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface Workspace {
  id: string
  name: string
  user_id: string
  created_at: string
}

export interface Folder {
  id: string
  name: string
  workspace_id: string
  user_id: string
  created_at: string
}

export interface DocumentItem {
  id: string
  user_id: string
  content?: string
  updated_at: string
  workspace_id?: string | null
  folder_id?: string | null
  is_trashed?: boolean
  name?: string
}

export function useWorkspaces(userId: string | undefined) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isOperating, setIsOperating] = useState(false)

  const fetchData = useCallback(async () => {
    if (!userId) {
      setIsLoading(false)
      return
    }

    try {
      // Fetch Workspaces
      const { data: workspacesData, error: workspacesError } = await supabase
        .from('workspaces')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
      
      if (workspacesError) throw workspacesError

      // If user has no workspace, create a default "Personal" one
      let currentWorkspaces = workspacesData || []
      if (currentWorkspaces.length === 0) {
        const { data: newWp, error: insertError } = await supabase
          .from('workspaces')
          .insert([{ user_id: userId, name: 'Personal Project' }])
          .select()
        if (insertError) throw insertError
        if (newWp) {
           currentWorkspaces = newWp
        }
      }

      setWorkspaces(currentWorkspaces)

      // Fetch Folders
      const { data: foldersData, error: foldersError } = await supabase
        .from('folders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })

      if (foldersError) throw foldersError
      setFolders(foldersData || [])

      // Fetch Documents
      const { data: docsData, error: docsError } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })

      if (docsError) throw docsError
      
      // We will add a mock 'name' property base on content for now
      const parsedDocs = (docsData || []).map(d => {
           let docName = 'Untitled Document'
           if (d.content) {
              const lines = d.content.split('\n')
              const firstLine = lines.find((l: string) => l.trim().length > 0)
              if (firstLine) {
                 docName = firstLine.replace(/^[#*>-]+\s*/, '').substring(0, 30) + (firstLine.length > 30 ? '...' : '')
              }
           }
           return { ...d, name: docName }
      })

      setDocuments(parsedDocs)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error("Error fetching workspace data:", message)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const createWorkspace = async (name: string) => {
    if (!userId) return null
    setIsOperating(true)
    try {
      const { data, error } = await supabase.from('workspaces').insert([{ user_id: userId, name }]).select().single()
      if (!error && data) {
        setWorkspaces(prev => [...prev, data])
        return data
      }
      return null
    } finally {
      setIsOperating(false)
    }
  }

  const createFolder = async (name: string, workspaceId: string) => {
    if (!userId) return null
    const { data, error } = await supabase.from('folders').insert([{ user_id: userId, workspace_id: workspaceId, name }]).select().single()
    if (!error && data) {
      setFolders(prev => [...prev, data])
      return data
    }
    return null
  }

  const moveDocument = async (docId: string, updates: { workspace_id?: string | null, folder_id?: string | null, is_trashed?: boolean }) => {
    // Optimistic update
    setDocuments(prev => prev.map(d => d.id === docId ? { ...d, ...updates } : d))
    const { error } = await supabase.from('documents').update(updates).eq('id', docId)
    if (error) {
       console.error("Failed to move document:", error)
       fetchData() // Revert on failure
    }
  }

  const deleteWorkspace = async (workspaceId: string) => {
    if (!userId) return false
    
    // Optimistic update
    setWorkspaces(prev => prev.filter(w => w.id !== workspaceId))
    
    const { error } = await supabase.from('workspaces').delete().eq('id', workspaceId)
    if (error) {
       console.error("Failed to delete workspace:", error)
       fetchData() // Revert on failure
       return false
    }
    return true
  }

  const createDocument = async (name: string, content: string, workspaceId?: string | null, folderId?: string | null) => {
    if (!userId) return null
    const newDocId = crypto.randomUUID()
    const docData: {
      id: string
      user_id: string
      content: string
      updated_at: string
      workspace_id?: string | null
      folder_id?: string | null
    } = {
      id: newDocId,
      user_id: userId,
      content,
      updated_at: new Date().toISOString()
    }
    if (workspaceId) docData.workspace_id = workspaceId
    if (folderId) docData.folder_id = folderId

    // Optimistic update
    setDocuments(prev => [{ ...docData, name, is_trashed: false }, ...prev])

    const { error } = await supabase.from('documents').insert([docData])
    if (error) {
       console.error("Failed to create document:", error)
       fetchData() // Revert on failure
       return null
    }
    return newDocId
  }

  return {
    workspaces,
    folders,
    documents,
    isLoading,
    isOperating,
    refresh: fetchData,
    createWorkspace,
    deleteWorkspace,
    createFolder,
    moveDocument,
    createDocument
  }
}
