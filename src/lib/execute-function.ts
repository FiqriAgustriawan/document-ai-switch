export function executeFunctionCall(
  functionName: string,
  args: Record<string, unknown>,
  currentContent: string
): { success: boolean; newContent?: string; error?: string } {
  try {
    const lines = currentContent.split('\n')
    
    switch (functionName) {
      case 'update_doc_by_line': {
        const start_line = args.start_line as number
        const end_line = args.end_line as number
        const new_content = args.new_content as string
        
        // Validate line numbers
        if (start_line < 1 || end_line > lines.length || start_line > end_line) {
          return { 
            success: false, 
            error: `Invalid line range: ${start_line}-${end_line}. Document has ${lines.length} lines.` 
          }
        }
        
        // Replace lines
        const newLines = [
          ...lines.slice(0, start_line - 1),
          new_content,
          ...lines.slice(end_line)
        ]
        
        return { success: true, newContent: newLines.join('\n') }
      }
      
      case 'update_doc_by_replace': {
        const { old_text, new_text, mode } = args as { old_text: string; new_text: string; mode?: string }
        
        if (!currentContent.includes(old_text as string)) {
          return { success: false, error: `Text "${old_text}" not found in document` }
        }

        const replaceMode = (mode as string) || 'all'
        let newContent: string

        switch (replaceMode) {
          case 'first':
            // String.replace() only replaces first occurrence
            newContent = currentContent.replace(old_text as string, new_text as string)
            break
          case 'last': {
            const lastIndex = currentContent.lastIndexOf(old_text as string)
            if (lastIndex === -1) {
              return { success: false, error: `Text "${old_text}" not found in document` }
            }
            newContent = currentContent.slice(0, lastIndex) + (new_text as string) + currentContent.slice(lastIndex + (old_text as string).length)
            break
          }
          case 'all':
          default:
            newContent = currentContent.replaceAll(old_text as string, new_text as string)
            break
        }
        
        return { success: true, newContent }
      }
      
      case 'insert_at_line': {
        const lineNumber = args.line as number
        const insertContent = args.content as string
        const position = args.position as string
        
        if (lineNumber < 1 || lineNumber > lines.length) {
          return { 
            success: false, 
            error: `Invalid line number: ${lineNumber}. Document has ${lines.length} lines.` 
          }
        }
        
        const insertIndex = position === 'before' ? lineNumber - 1 : lineNumber
        const newLines = [
          ...lines.slice(0, insertIndex),
          insertContent,
          ...lines.slice(insertIndex)
        ]
        
        return { success: true, newContent: newLines.join('\n') }
      }
      
      case 'delete_lines': {
        const start_line = args.start_line as number
        const end_line = args.end_line as number
        
        if (start_line < 1 || end_line > lines.length || start_line > end_line) {
          return { 
            success: false, 
            error: `Invalid line range: ${start_line}-${end_line}. Document has ${lines.length} lines.` 
          }
        }
        
        const newLines = [
          ...lines.slice(0, start_line - 1),
          ...lines.slice(end_line)
        ]
        
        return { success: true, newContent: newLines.join('\n') }
      }
      
      case 'append_to_document': {
        const contentToAdd = (args.content as string) || '';
        return { success: true, newContent: currentContent + '\n' + contentToAdd }
      }
      
      default:
        return { success: false, error: `Unknown function: ${functionName}` }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown execution error'
    return { success: false, error: message }
  }
}
