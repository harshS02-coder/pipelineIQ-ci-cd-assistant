# Contributing to LLM DevOps Assistant

## Getting Started

1. **Fork the repository**
   ```bash
   git clone https://github.com/yourfork/llm-devops-assistant.git
   cd llm-devops-assistant
   ```

2. **Install dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Setup

### Prerequisites
- Node.js 18+
- MongoDB 6.0+
- Redis 7+

### Quick Start
```bash
# Start all services
docker-compose -f backend/docker-compose.yml up -d

# Install dependencies
npm install

# Start development server
npm run dev
```

## Code Standards

### ESLint & Prettier

```bash
# Check code style
npm run lint

# Auto-fix issues
npm run lint:fix

# Format code
npm run format
```

### Commit Messages

Follow conventional commits:
```
feat: Add new feature
fix: Fix a bug
docs: Update documentation
test: Add tests
chore: Update dependencies
```

### Pull Request Process

1. **Update documentation** if needed
2. **Add tests** for new features
3. **Pass all linting** (`npm run lint`)
4. **Update CHANGELOG.md**
5. **Request review** from maintainers

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Check test coverage
open coverage/lcov-report/index.html
```

## Adding a New Feature

### 1. Create Feature Branch
```bash
git checkout -b feature/my-feature
```

### 2. Implement Feature
- Follow existing code style
- Add comprehensive comments
- Create unit tests
- Update documentation

### 3. Test Thoroughly
```bash
npm test
npm run lint
make docker-up
npm run dev
```

### 4. Create Pull Request
- Clear description of changes
- Link to related issues
- Screenshots/examples if applicable

## Reporting Bugs

**Security Issues**: Email security@yourdomain.com (do not create public issues)

**Other Bugs**: Create GitHub issue with:
- Description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Environment details
- Error logs/screenshots

## Project Structure

```
backend/
├── src/
│   ├── routes/          # API route handlers
│   ├── controllers/      # Business logic
│   ├── services/         # External service integrations
│   ├── models/          # MongoDB schemas
│   ├── middleware/      # Express middleware
│   ├── config/          # Configuration
│   ├── utils/           # Utility functions
│   ├── queues/          # BullMQ job queue setup
│   ├── app.js           # Express app
│   └── server.js        # Server entry point
├── package.json
├── Dockerfile
└── docker-compose.yml
```

## Key Files to Know

- **Controllers**: `src/controllers/analyze.controller.js`
- **Routes**: `src/routes/analyze.routes.js`
- **Services**: `src/services/logParser.js`, `llmService.js`, `fixService.js`
- **Models**: `src/models/`

## Architecture Overview

```
Request → Middleware → Controller → Service → Model → Database
                    ↓
                  Queue → Workers
```

## Performance Tips

- Use MongoDB indexes for frequently queried fields
- Cache LLM responses when possible
- Implement pagination for large result sets
- Monitor queue depth and worker load
- Use connection pooling for databases

## Security Considerations

- **Never** commit `.env` files
- **Sanitize** all user input
- **Validate** LLM outputs before execution
- **Log** all security-relevant events
- **Use** HTTPS in production
- **Rotate** API keys regularly

## Documentation

### Where to Update Docs

- **API Changes**: Update `API.md`
- **Deployment**: Update `DEPLOYMENT.md`
- **Security**: Update `SECURITY.md`
- **General**: Update `README.md`

### Code Comments

```javascript
/**
 * Brief description of what the function does
 * @param {object} param - Parameter description
 * @returns {object} Return value description
 */
function doSomething(param) {
  // Implementation
}
```

## Debugging

### Debug Mode
```bash
DEBUG=llm:* npm run dev
```

### View Logs
```bash
docker-compose logs -f api
```

### MongoDB Connection
```bash
docker-compose exec mongodb mongosh -u root -p password
```

### Redis Connection
```bash
docker-compose exec redis redis-cli
```

## Performance Profiling

```bash
# Node profiler
node --prof src/server.js
node --prof-process isolate-*.log > profile.txt
```

## Releases

Maintainers perform releases using:
```bash
npm version minor
npm publish
git push origin --tags
```

## Questions?

- **Documentation**: See `README.md`, `API.md`, `DEPLOYMENT.md`
- **GitHub Discussions**: Ask questions in discussions tab
- **Issues**: Check existing issues for answers

## Thanks for Contributing! 🙏

Your contributions help make the LLM DevOps Assistant better for everyone.

---

See [SECURITY.md](SECURITY.md) for security contribution guidelines.
