import { supabase } from './supabase'

export interface DocumentVersion {
  id: string
  document_id: string
  content: string
  version_number: number
  label: string | null
  created_by: string | null
  created_at: string
}

export type DocumentVersionSummary = Omit<DocumentVersion, 'content'>

// ─── Get latest version number ─────────────────────────────────────────────

async function getLatestVersionNumber(documentId: string): Promise<number> {
  const { data } = await supabase
    .from('document_versions')
    .select('version_number')
    .eq('document_id', documentId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data?.version_number ?? 0
}

// ─── Create snapshot ────────────────────────────────────────────────────────

export async function createSnapshot(
  documentId: string,
  content: string,
  createdBy: string,
  label?: string
): Promise<DocumentVersion | null> {
  try {
    // Check if content changed from last version
    const { data: lastVersion } = await supabase
      .from('document_versions')
      .select('content, version_number')
      .eq('document_id', documentId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Skip if content is identical
    if (lastVersion && lastVersion.content === content) return null

    const nextVersion = (lastVersion?.version_number ?? 0) + 1

    const { data, error } = await supabase
      .from('document_versions')
      .insert({
        document_id: documentId,
        content,
        version_number: nextVersion,
        label: label ?? null,
        created_by: createdBy,
      })
      .select()
      .single()

    if (error) {
      console.error('createSnapshot error:', error)
      return null
    }

    return data
  } catch (err) {
    console.error('createSnapshot exception:', err)
    return null
  }
}

// ─── Get version list (without content) for timeline ───────────────────────

export async function getVersionList(
  documentId: string,
  page: number = 0,
  pageSize: number = 20
): Promise<{ versions: DocumentVersionSummary[]; hasMore: boolean }> {
  try {
    const from = page * pageSize
    const to = from + pageSize // fetch 1 extra to check hasMore

    const { data, error } = await supabase
      .from('document_versions')
      .select('id, document_id, version_number, label, created_by, created_at')
      .eq('document_id', documentId)
      .order('version_number', { ascending: false })
      .range(from, to)

    if (error) {
      console.error('getVersionList error:', error)
      return { versions: [], hasMore: false }
    }

    const hasMore = (data?.length ?? 0) > pageSize
    return {
      versions: (data ?? []).slice(0, pageSize),
      hasMore,
    }
  } catch (err) {
    console.error('getVersionList exception:', err)
    return { versions: [], hasMore: false }
  }
}

// ─── Get single version content (for diff and restore) ─────────────────────

export async function getVersionContent(versionId: string): Promise<DocumentVersion> {
  const { data, error } = await supabase
    .from('document_versions')
    .select('*')
    .eq('id', versionId)
    .single()

  if (error || !data) {
    console.error('getVersionContent error:', error)
    throw new Error('Version not found')
  }

  return data
}

// ─── Restore: copy old version content to active document ──────────────────

export async function restoreVersion(
  documentId: string,
  versionId: string,
  userId: string
): Promise<string> {
  try {
    const version = await getVersionContent(versionId)

    const { error: updateError } = await supabase
      .from('documents')
      .update({
        content: version.content,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId)

    if (updateError) {
      console.error('restoreVersion update error:', updateError)
      throw new Error('Failed to restore document')
    }

    // Save new snapshot marked as restored
    await createSnapshot(
      documentId,
      version.content,
      userId,
      `Restored from v${version.version_number}`
    )

    return version.content
  } catch (err) {
    console.error('restoreVersion exception:', err)
    throw err
  }
}

// ─── Update version label ──────────────────────────────────────────────────

export async function updateVersionLabel(
  versionId: string,
  label: string
): Promise<void> {
  const { error } = await supabase
    .from('document_versions')
    .update({ label })
    .eq('id', versionId)

  if (error) {
    console.error('updateVersionLabel error:', error)
    throw new Error('Failed to update label')
  }
}
