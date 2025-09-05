# Mux Sync Engine Tests

This directory contains tests for the Mux sync-engine.

## Structure

```
src/test/
├── README.md              # This file
├── setup.ts              # Global test setup with testcontainers
├── helpers/
│   └── mockMux.ts        # Mock of Mux SDK
├── migrations.test.ts    # Tests for runMigrations
├── backfill.test.ts     # Tests for syncBackfill
└── webhooks.test.ts     # Tests for processWebhook
```

## Configuration

The tests use:
- **Vitest** as the testing framework
- **Testcontainers** to spin up a PostgreSQL instance during tests
- **Mocks** of the Mux SDK to simulate API responses

## Running Tests

### Locally with Testcontainers

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui
```

## CI/CD

To integrate these tests in a CI/CD pipeline:

```yaml
# Example for GitHub Actions
- name: Install dependencies
  run: npm ci

- name: Run tests
  run: npm test
  env:
    CI: true
```

The tests use testcontainers, so they require:
- Docker available on the runner
- Permissions to create containers

## Additional Configuration

### Environment Variables

The tests respect the following environment variables:

- `CI`: When set to `true`, optimizes configuration for CI

### Timeouts

Tests have extended timeouts (60 seconds) to accommodate:
- Docker container startup
- Database operations
- Mocked API calls

### Debugging

To debug tests:

```bash
# Run a specific test
npm test -- migrations.test.ts

# Run with detailed logs
npm test -- --reporter=verbose

# Run with UI for interactive debugging
npm run test:ui
```
