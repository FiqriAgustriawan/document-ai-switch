export function executeFunctionCall(
  functionName: string,
  args: any,
  currentContent: string
): { success: boolean; newContent?: string; error?: string } {
  try {
    const lines = currentContent.split('\n')
    
    switch (functionName) {
      case 'update_doc_by_line': {
        const { start_line, end_line, new_content } = args
        
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
        const { old_text, new_text } = args
        
        if (!currentContent.includes(old_text)) {
          return { success: false, error: `Text "${old_text}" not found in document` }
        }
        
        // Default behavior: replace all occurrences
        const newContent = currentContent.replaceAll(old_text, new_text)
        
        return { success: true, newContent }
      }
      
      case 'insert_at_line': {
        const { line, content, position } = args
        const lineNumber = line // Map 'line' from schema to 'lineNumber' logic
        
        if (lineNumber < 1 || lineNumber > lines.length) {
          return { 
            success: false, 
            error: `Invalid line number: ${lineNumber}. Document has ${lines.length} lines.` 
          }
        }
        
        const insertIndex = position === 'before' ? lineNumber - 1 : lineNumber
        const newLines = [
          ...lines.slice(0, insertIndex),
          content,
          ...lines.slice(insertIndex)
        ]
        
        return { success: true, newContent: newLines.join('\n') }
      }
      
      case 'delete_lines': {
        const { start_line, end_line } = args
        
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
        // Handle undefined or null content explicitly if needed
        const contentToAdd = args.content || '';
        return { success: true, newContent: currentContent + '\n' + contentToAdd }
      }
      
      default:
        return { success: false, error: `Unknown function: ${functionName}` }
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
