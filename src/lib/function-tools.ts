
// Tools definition for Gemini Function Calling

import { FunctionDeclaration, Schema, Type } from '@google/genai';

export const functionTools: FunctionDeclaration[] = [
  {
    name: 'update_doc_by_line',
    description: 'Update content of specific lines in the document. Overwrites existing content within the range.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        start_line: {
          type: Type.INTEGER,
          description: 'The starting line number to update (1-based index).',
        },
        end_line: {
          type: Type.INTEGER,
          description: 'The ending line number to update (1-based index). Inclusive.',
        },
        new_content: {
          type: Type.STRING,
          description: 'The new content to replace the lines with. Can be multiple lines separated by newline characters.',
        },
      },
      required: ['start_line', 'end_line', 'new_content'],
    },
  },
  {
    name: 'insert_at_line',
    description: 'Insert content at a specific line position.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        line: {
          type: Type.INTEGER,
          description: 'The reference line number (1-based index).',
        },
        content: {
          type: Type.STRING,
          description: 'The content to insert.',
        },
        position: {
          type: Type.STRING,
          description: 'Where to insert relative to the line. "before" inserts above the line, "after" inserts below.',
          enum: ['before', 'after'],
        },
      },
      required: ['line', 'content', 'position'],
    },
  },
  {
    name: 'update_doc_by_replace',
    description: 'Replace specific text occurrences in the document globally.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        old_text: {
          type: Type.STRING,
          description: 'The exact text to be replaced.',
        },
        new_text: {
          type: Type.STRING,
          description: 'The text to replace it with.',
        },
      },
      required: ['old_text', 'new_text'],
    },
  },
  {
    name: 'delete_lines',
    description: 'Delete specific lines from the document.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        start_line: {
          type: Type.INTEGER,
          description: 'The starting line number to delete (1-based index).',
        },
        end_line: {
          type: Type.INTEGER,
          description: 'The ending line number to delete (1-based index). Inclusive.',
        },
      },
      required: ['start_line', 'end_line'],
    },
  },
];
