# Contributing to Cello Scales Practice

Thank you for your interest in contributing to this project!

## How to Contribute

### Reporting Issues

- Check if the issue already exists
- Use a clear and descriptive title
- Provide steps to reproduce the issue
- Include your environment details (OS, browser, Python/Node versions)

### Suggesting Features

- Open an issue with the "feature request" label
- Describe the use case and expected behavior
- Explain why this would be useful for other users

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run tests and linting (see [DEVELOPMENT.md](DEVELOPMENT.md))
5. Commit your changes with a clear message
6. Push to your fork
7. Open a Pull Request

### Code Style

#### Python (Backend)

- Follow PEP 8
- Use type hints
- Run `ruff` for linting
- Run `mypy` for type checking

#### TypeScript (Frontend)

- Follow the existing code style
- Use TypeScript strictly (no `any` types)
- Run `npm run lint` before committing

### Commit Messages

- Use present tense ("Add feature" not "Added feature")
- Use imperative mood ("Move cursor to..." not "Moves cursor to...")
- Keep the first line under 72 characters
- Reference issues and pull requests when relevant

### Testing

- Add tests for new features
- Ensure all existing tests pass
- Test on both light and dark themes
- Test on mobile viewports

## Development Setup

See [DEVELOPMENT.md](DEVELOPMENT.md) for detailed setup instructions.

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Assume good intentions

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.
