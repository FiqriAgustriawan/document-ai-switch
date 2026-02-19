import { GoogleGenAI } from '@google/genai'
import { NextRequest, NextResponse } from 'next/server'
import { functionTools } from '@/lib/function-tools'
import { executeFunctionCall } from '@/lib/execute-function'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

// Helper: Format document with line numbers for AI
function formatDocumentForAI(content: string): string {
  const lines = content.split('\n')
  return lines.map((line, i) => `${i + 1}. ${line}`).join('\n')
}

// Helper: Generate content with fallback logic for rate limits
async function generateWithFallback(contents: any[], tools?: any[]) {
  try {
    // Try Premium Model (Gemini 2.5 Flash) as requested
    return await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
      config: {
        tools: tools
      }
    })
  } catch (error: any) {
    // Log error but do not fallback as user requested specific model
    console.error('Gemini 2.5 Flash Error:', error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { messages, documentContent } = body
    // Check top-level file OR file in last message
    const file = body.file || messages[messages.length - 1]?.file
    
    // CRITICAL: Always give AI the current document state with line numbers
    const documentWithLines = formatDocumentForAI(documentContent)
    
    const systemPrompt = `You are a helpful AI assistant for a document editor.

**CURRENT DOCUMENT (${documentContent.split('\n').length} lines):**
\`\`\`
${documentWithLines}
\`\`\`

You have tools to manipulate the document. When the user asks you to edit:
1. Look at the line numbers above
2. Use the appropriate tool
3. Be precise with line numbers

Always check the current document state before making changes.`

    // Prepare content parts for Gemini
    const userMessage = messages[messages.length - 1]
    const contentParts: any[] = []
    
    // Build history matching Content[] structure
    const history = messages.slice(0, -1).map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }))

    // Combine System Prompt + User Message + File into the FINAL User turn
    const finalUserParts = []
    
    // 1. Add System Context & Instructions
    finalUserParts.push({ text: systemPrompt + "\n\n---\n" })

    // 2. Add File (if present)
    if (file) {
      // Frontend sends: { name, type, base64: "data:image/png;base64,..." }
      // We need to extract just the base64 string
      const base64Data = file.base64.includes('base64,') 
        ? file.base64.split('base64,')[1] 
        : file.base64
      
// console.log(`Processing file: ${file.name} (${file.type})`)

      finalUserParts.push({
        inlineData: {
          mimeType: file.type,
          data: base64Data
        }
      })
      
      finalUserParts.push({ text: `[User attached image: ${file.name}]` })
    }

    // 3. Add User's Actual Text
    finalUserParts.push({ text: `USER REQUEST: ${userMessage.content}` })

    const contents = [
      ...history,
      {
        role: 'user',
        parts: finalUserParts
      }
    ]

    // 1. First Call: Send context to Gemini (with Fallback)
    const response = await generateWithFallback(contents, [{ functionDeclarations: functionTools }])

    const functionCalls = response.functionCalls

    // 2. Handle Function Calls
    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0]
      const functionName = call.name

      if (!functionName) {
        throw new Error('Function name is missing')
      }
      
      const args = call.args

// console.log('Function Call:', functionName, args)

      // Execute logic
      const result = executeFunctionCall(functionName, args, documentContent)

      if (result.success && result.newContent) {
        // Send success + new content to AI
        const functionResponse = {
          name: functionName,
          response: {
            result: 'Success',
            updated_document: result.newContent // Send FULL new content to keep AI in sync
          }
        }
        
        // Add model's function call and our response to history
        const secondContents = [
            ...contents,
            { role: 'model', parts: [{ functionCall: call }] },
            { role: 'function', parts: [{ functionResponse: functionResponse }] }
        ]

        const secondResponse = await generateWithFallback(secondContents)

        return NextResponse.json({
          role: 'assistant',
          content: secondResponse.text,
          updatedDocument: result.newContent // Frontend will update editor
        })
      } else {
        // Handle Failure
        const errorResponse = {
            name: functionName,
            response: {
                error: result.error || 'Unknown error'
            }
        }

        const secondResponse = await genai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: [
              ...contents,
              { role: 'model', parts: [{ functionCall: call }] },
              { role: 'function', parts: [{ functionResponse: errorResponse }] }
            ]
        })

        return NextResponse.json({
            role: 'assistant',
            content: secondResponse.text
        })
      }
    }

    // 3. Normal Text Response
    return NextResponse.json({
      role: 'assistant',
      content: response.text
    })

  } catch (error: any) {
    console.error('Gemini API Error:', error)
    return NextResponse.json(
      { error: 'Failed to process request', details: error.message },
      { status: 500 }
    )
  }
}
