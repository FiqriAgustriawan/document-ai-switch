---
description: Workflow to implement core logic with strict verification before styling.
---

steps:
  - name: 1. Logic Analysis
    instruction: Analyze the requirement. Identify necessary Hooks, API Routes, and Database Interactions. Do not think about UI yet.

  - name: 2. Core Implementation
    instruction: Write the functional code (Hooks/API). Focus on data integrity, error handling, and type safety.

  - name: 3. Logic Verification
    instruction: Check the code: Does it handle edge cases? Is the Supabase channel cleaned up? Are line numbers calculated correctly (1-based vs 0-based)?

  - name: 4. Placeholder UI
    instruction: Connect the logic to a basic UI (Skeleton). Confirm it works. Mark components with `// TODO: Upgrade to React Bits later` comments.