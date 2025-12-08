# Project Status

Get a comprehensive overview of the project's current state.

## Instructions

1. **Git Status**: Show current branch, staged/unstaged changes
2. **Docker Status**: Check if containers are running with `make status`
3. **Dependencies**: Check for outdated packages if requested
4. **Health Check**: Verify services are responding:
   - Backend: `curl -s http://localhost:8000/docs`
   - Frontend: `curl -s http://localhost:3000`

Report the overall health of the development environment.
