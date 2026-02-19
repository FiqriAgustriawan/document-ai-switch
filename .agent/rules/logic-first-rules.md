---
trigger: always_on
---

# 🛡️ PROJECT PHILOSOPHY: LOGIC FIRST
- **Priority:** Functionality > Aesthetics. Do NOT implement complex animations (React Bits/Framer) until the core logic is proven to work.
- **Phase Strategy:**
  1. Build strong Logic/Backend (Supabase, API, Hooks).
  2. Verify Data Flow (Console logs, DB checks).
  3. Apply UI Polish (React Bits) ONLY in the final phase.

# 🧠 CODING STANDARDS (STRICT)
- **TypeScript:** NO `any`. All props and state must be typed via interfaces.
- **Error Handling:** Every async operation (Supabase/API) MUST have try-catch blocks with clear console errors.
- **State Management:**
  - Ensure `useEffect` cleanup functions are present for Supabase subscriptions.
  - Use `useRef` for values that shouldn't trigger re-renders (like timeouts).

# 🤖 AI LOGIC REQUIREMENTS
- **Line Awareness:** When editing documents, you MUST strictly adhere to line numbers.
- **State Verification:** After every AI tool execution, the system must return the *updated* document state to the AI context.
- **Debugging:** If a function fails, provide a detailed error message identifying exactly *which* line number or logic caused the break.

# 🚫 RESTRICTIONS
- **No Early Optimization:** Do not add `framer-motion` or complex Tailwind classes yet. Use standard layout.
- **No Emojis:** Use `lucide-react` icons only.