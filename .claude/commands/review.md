# Code Review

Perform a thorough code review of the staged changes.

## Instructions

1. Run `git diff --cached` to see staged changes
2. If no staged changes, run `git diff` for unstaged changes
3. Review for:
   - **Security**: SQL injection, XSS, command injection, exposed secrets
   - **Performance**: N+1 queries, unnecessary re-renders, memory leaks
   - **Code Quality**: Type safety, error handling, edge cases
   - **Style**: PEP 8 (Python), ESLint rules (TypeScript)
   - **Architecture**: Component responsibility, separation of concerns

4. Provide specific feedback with file paths and line numbers
5. Suggest improvements where applicable
