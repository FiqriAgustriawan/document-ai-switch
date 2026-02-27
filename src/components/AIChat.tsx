'use client'

import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Send, Bot, Paperclip, FileIcon, Loader2, Sparkles, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'

interface Message {
  role: 'user' | 'assistant'
  content: string
  file?: {
    name: string
    type: string
    base64: string
  }
}

interface AIChatProps {
  documentContent: string
  onApplyChanges: (newContent: string) => void
}

export default function AIChat({ documentContent, onApplyChanges }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [attachedFile, setAttachedFile] = useState<{ name: string, type: string, base64: string } | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setAttachedFile({
          name: file.name,
          type: file.type,
          base64: reader.result as string
        })
      }
      reader.readAsDataURL(file)
    }
  }

  const sendMessage = async () => {
    if ((!input.trim() && !attachedFile) || isLoading) return

    const userMessage: Message = {
      role: 'user',
      content: input,
      file: attachedFile || undefined
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setAttachedFile(null)
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          documentContent // Send current doc content for context
        })
      })

      const data = await response.json()

      if (data.error) throw new Error(data.error)

      // Add assistant response
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.content
      }])

      // If AI updated the document, apply changes
      if (data.updatedDocument && data.updatedDocument !== documentContent) {
        onApplyChanges(data.updatedDocument)
      }

    } catch (error) {
      console.error('Chat Error:', error)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Error processing request. Please try again.'
      }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-black/40 backdrop-blur-md border-l border-white/10 rounded-r-xl overflow-hidden">
      {/* Glassy Header */}
      <div className="flex items-center px-6 py-4 border-b border-white/5 bg-white/5 backdrop-blur-xl">
        <div className="p-1.5 rounded-lg bg-indigo-500/20 mr-3 shadow-[0_0_15px_rgba(99,102,241,0.3)]">
          <Sparkles className="w-4 h-4 text-indigo-400" />
        </div>
        <h2 className="font-medium text-zinc-200 tracking-wide text-sm">AI Assistant</h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-50 space-y-4">
            <Bot className="w-12 h-12 text-zinc-600" />
            <p className="text-zinc-500 text-sm max-w-[200px]">
              Ready to help you edit directly.
            </p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className={cn("flex w-full gap-3", m.role === 'user' ? "justify-end" : "justify-start")}
            >
              {m.role === 'assistant' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mt-1">
                  <Bot className="w-4 h-4 text-indigo-400" />
                </div>
              )}

              <div className={cn(
                "max-w-[85%] rounded-2xl p-4 text-sm shadow-lg backdrop-blur-sm",
                m.role === 'user'
                  ? "bg-cyan-500/10 text-cyan-50 border border-cyan-500/20 rounded-tr-sm"
                  : "bg-white/5 text-zinc-300 border border-white/5 rounded-tl-sm"
              )}>
                {m.file && (
                  <div className="flex items-center mb-3 p-2 bg-black/20 rounded-lg border border-white/5">
                    <FileIcon className="w-4 h-4 mr-2 text-zinc-400" />
                    <span className="truncate max-w-[150px] text-xs font-mono">{m.file.name}</span>
                  </div>
                )}

                <div className="prose prose-sm prose-invert max-w-none leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ node: _node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                      a: ({ node: _node, ...props }) => <a className="text-cyan-400 hover:underline" {...props} />,
                      code: ({ node: _node, className, children, ...props }) => {
                        const match = /language-(\w+)/.exec(className || '')
                        return match ? (
                          <code className={className} {...props}>{children}</code>
                        ) : (
                          <code className="bg-white/10 px-1 py-0.5 rounded text-xs font-mono text-cyan-200" {...props}>{children}</code>
                        )
                      },
                      pre: ({ node: _node, ...props }) => (
                        <div className="overflow-x-auto my-3 rounded-lg border border-white/10 bg-black/30 p-3 custom-scrollbar">
                          <pre className="text-xs font-mono" {...(props as React.HTMLAttributes<HTMLPreElement>)} />
                        </div>
                      )
                    }}
                  >
                    {m.content}
                  </ReactMarkdown>
                </div>
              </div>

              {m.role === 'user' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mt-1">
                  <User className="w-4 h-4 text-cyan-400" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex justify-start gap-3"
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mt-1">
              <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
            </div>
            <div className="bg-white/5 border border-white/5 rounded-2xl p-3 shadow-sm rounded-tl-sm">
              <div className="flex gap-1 h-full items-center">
                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce"></span>
              </div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-white/5 bg-black/20 backdrop-blur-lg">
        {attachedFile && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center mb-3 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded-lg text-xs w-fit"
          >
            <div className="p-1 bg-indigo-500/20 rounded mr-2">
              <FileIcon className="w-3 h-3" />
            </div>
            {attachedFile.name}
            <button
              onClick={() => setAttachedFile(null)}
              className="ml-3 hover:text-white transition-colors"
            >×</button>
          </motion.div>
        )}

        <div className="relative flex items-end gap-2 bg-black/40 border border-white/10 rounded-2xl p-2 shadow-inner focus-within:border-cyan-500/50 focus-within:ring-1 focus-within:ring-cyan-500/20 transition-all duration-300">

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 text-zinc-500 hover:text-indigo-400 hover:bg-white/5 rounded-xl transition-all duration-200"
            title="Attach file"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            placeholder="Type a message..."
            className="flex-1 max-h-32 min-h-[44px] py-3 bg-transparent text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none resize-none custom-scrollbar"
            rows={1}
          />

          <button
            onClick={sendMessage}
            disabled={(!input.trim() && !attachedFile) || isLoading}
            className="p-2.5 bg-cyan-600 text-white rounded-xl hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-cyan-600 transition-all duration-200 shadow-lg shadow-cyan-900/20"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </div>
        <div className="mt-2 text-center">
          <span className="text-[10px] text-zinc-600">AI can make mistakes. Review generated code.</span>
        </div>
      </div>
    </div>
  )
}
