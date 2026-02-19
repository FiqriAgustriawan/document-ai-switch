# AI Document Editor (Switch Studio)

A smart, AI-powered document editor that understands context, line numbers, and multimodal inputs. Built with Next.js, Supabase, and Google Gemini.

🔗 **Live Demo:** [Vercel Deployment URL Here]  
📂 **Repo:** [GitHub Repository URL Here]

## 🌟 Key Features

*   **Smart AI Assistant**: Understands cursor position and line numbers. Can edit, insert, replace, and delete text directly.
*   **Multimodal Support**: Drag & drop images (diagrams, screenshots) for AI analysis and transcription.
*   **Real-time Collaboration**: Live typing indicators and instant sync users (powered by Supabase).
*   **Two-Panel UI**: Markdown editor on the left, live preview on the right.
*   **Production Ready**: Full error handling, TypeScript safety, and secure authentication (RLS).
*   **Bonus Features**:
    *   Undo/Redo (Ctrl+Z / Ctrl+Y)
    *   Export to PDF, Markdown, TXT, HTML, DOCX
    *   Voice-to-Text (Indonesian/English)
    *   Dark Mode "Galaxy" Theme
    *   Focus Mode

## 🛠️ Setup Instructions

1.  **Clone the repo**
    ```bash
    git clone <your-repo-url>
    cd ai-doc-editor-gemini
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Environment Variables**
    Create a `.env.local` file in the root directory:
    ```env
    NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
    GEMINI_API_KEY=your_gemini_api_key
    ```

4.  **Run Development Server**
    ```bash
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000).

## 🧪 Testing Guide

### 1. Function Calling (AI Editing)
*   **Update**: Ask "Change text on line 5 to 'Hello World'".
*   **Insert**: Ask "Add a table of contents at line 1".
*   **Delete**: Ask "Remove lines 10 to 12".
*   **Replace**: Ask "Replace 'bad' with 'good' everywhere".

### 2. Multimodal Features
*   Click the **Paperclip** icon in the chat.
*   Upload an image (e.g., a screenshot of code or a diagram).
*   Ask: "Explain this image" or "Convert this screenshot to markdown code".

## ⚠️ Known Limitations
*   **Undo/Redo**: History is character-based, which can be memory-intensive for extremely large documents.
*   **Gemini Quotas**: The app defaults to `gemini-2.5-flash`. If the API rate limit is hit, it may return a 429 error (though fallback logic is in place for some calls).
*   **Mobile View**: While responsive, the best experience is on Desktop due to complex keyboard shortcuts.
