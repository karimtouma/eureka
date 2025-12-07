# Contributing to Eureka

Thank you for your interest in contributing to Eureka! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and constructive in all interactions. We welcome contributors of all experience levels.

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/karimtouma/eureka/issues)
2. If not, create a new issue with:
   - A clear, descriptive title
   - Steps to reproduce the bug
   - Expected vs actual behavior
   - Environment details (OS, Python version, Node version)

### Suggesting Features

1. Open an issue with the `enhancement` label
2. Describe the feature and its use case
3. Discuss implementation approaches if you have ideas

### Pull Requests

1. **Fork** the repository
2. **Clone** your fork locally
3. **Create a branch** for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. **Make your changes** following the code style guidelines below
5. **Test** your changes thoroughly
6. **Commit** with clear, descriptive messages:
   ```bash
   git commit -m "Add feature: description of what it does"
   ```
7. **Push** to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
8. **Open a Pull Request** against the `main` branch

## Development Setup

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run tests
python -m pytest

# Start development server
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install

# Run linting
npm run lint

# Start development server
npm run dev
```

## Code Style

### Python (Backend)

- Follow [PEP 8](https://pep8.org/) style guidelines
- Use type hints for function parameters and return values
- Write docstrings for public functions and classes
- Keep functions focused and under 50 lines when possible

### TypeScript (Frontend)

- Use TypeScript strict mode
- Prefer functional components with hooks
- Use meaningful variable and function names
- Keep components focused on a single responsibility

## Project Structure Guidelines

- **Backend changes**: Place new API routes in `api/routes/`, genetic programming logic in `gp/`
- **Frontend changes**: Follow the Next.js App Router conventions, shared components go in `components/`

## Testing

- Write tests for new features
- Ensure existing tests pass before submitting PR
- Backend: Use pytest
- Frontend: Use the built-in testing framework

## Questions?

Feel free to open an issue for any questions about contributing.
