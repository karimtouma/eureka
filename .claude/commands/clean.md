# Clean Project

Clean up Docker containers, volumes, and build artifacts.

## Instructions

1. Run `make clean` to stop containers and remove volumes/images
2. Optionally clean node_modules: `rm -rf frontend/node_modules`
3. Optionally clean Python cache: `find backend -type d -name __pycache__ -exec rm -rf {} +`
4. Report what was cleaned and freed disk space if significant
