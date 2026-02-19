'use client'

import React, { useState } from 'react'
import { Panel, Group, Separator } from 'react-resizable-panels'
import dynamicImport from 'next/dynamic'

const DocumentEditor = dynamicImport(() => import('@/components/DocumentEditor'), { ssr: false })
const AIChat = dynamicImport(() => import('@/components/AIChat'), { ssr: false })

export const dynamic = 'force-dynamic'

export default function AIEditorPage() {
  // In a real app, this might come from params or a fetching hook
  // For demo, we use a fixed ID and user
  const documentId = '550e8400-e29b-41d4-a716-446655440000'
  const userId = 'user-123'

  // State for sharing content between Editor and Chat
  const [contentForChat, setContentForChat] = useState('')
  const [aiUpdatedContent, setAiUpdatedContent] = useState<string | null>(null)

  // Hydration fix
  const [mounted, setMounted] = useState(false)
  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div className="h-screen w-full bg-gray-100 overflow-hidden flex flex-col">
      <header className="h-14 bg-white border-b flex items-center px-4 shadow-sm z-10">
        <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          AI Doc Editor
        </h1>
      </header>

      <div className="flex-1 overflow-hidden">
        <Group orientation="horizontal">
          {/* Editor Panel */}
          <Panel defaultSize={60} minSize={30}>
            <div className="h-full p-4">
              <DocumentEditor
                documentId={documentId}
                userId={userId}
                initialContent=""
                onContentUpdate={setContentForChat}
                externalContent={aiUpdatedContent}
              />
            </div>
          </Panel>

          <Separator className="w-2 bg-gray-200 hover:bg-indigo-300 transition-colors cursor-col-resize flex items-center justify-center">
            <div className="w-1 h-8 bg-gray-400 rounded-full" />
          </Separator>

          {/* Chat Panel */}
          <Panel defaultSize={40} minSize={20}>
            <div className="h-full bg-white">
              <AIChat
                documentContent={contentForChat}
                onApplyChanges={setAiUpdatedContent}
              />
            </div>
          </Panel>
        </Group>
      </div>
    </div>
  )
}
