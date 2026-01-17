# Fastify File-Based Routing CLI

Automatic URL synchronization for Fastify file-based routing. This CLI tool watches your API route files and automatically keeps the `url` field in your Fastify route configuration in sync with the file path.

## Installation

```bash
# fastify-fbr-cli depends on bun being installed globally
npm i -g bun

# Creates a global `fastify-fbr` cli command
npm i -g fastify-fbr-cli
```

## Usage

Run the `fastify-fbr` command from your project root to watch your API routes:

```bash
fastify-fbr
```

The CLI will:

1. Perform an initial scan of all routes in `src/api`
2. Fix any URLs that don't match their file paths
3. Watch for file changes and automatically update URLs

### Options

- `--help`, `-h`: Show help message
- `--quiet`, `-q`: Suppress all output except initial notification that the tool is watching

```bash
# Run in quiet mode (minimal output)
fastify-fbr --quiet

# Or use the short flag
fastify-fbr -q
```

## How it works

The tool follows file-based routing conventions to automatically generate URLs from file paths:

### Route Parameter Syntax

- `$userId` or `.$userId` → `:userId` in URL
- Example: `src/api/users/$userId.get.ts` → `/users/:userId`

### Index Files

- `index.get.ts` maps to parent path
- Example: `src/api/users/index.get.ts` → `/users`

### Pathless Layouts

- Files/folders starting with `_` are excluded from URL
- Example: `src/api/_auth/login.post.ts` → `/login`

### HTTP Methods

- Supported methods: `.get.ts`, `.post.ts`, `.put.ts`, `.patch.ts`, `.delete.ts`
- Both `.ts` and `.js` extensions are supported

### Example File Structure

```
src/api/
├── users/
│   ├── index.get.ts          → GET /users
│   ├── $userId.get.ts         → GET /users/:userId
│   └── $userId.patch.ts       → PATCH /users/:userId
├── products/
│   ├── index.get.ts          → GET /products
│   └── $id/
│       └── reviews.get.ts    → GET /products/:id/reviews
└── _auth/
    └── login.post.ts         → POST /login
```

## Conflict Resolution

If multiple files would map to the same URL (e.g., files with different logic but same path and method), the tool automatically resolves conflicts by appending numeric suffixes:

- First file: `/users/:id`
- Second file: `/users/:id-2`
- Third file: `/users/:id-3`

Warnings are logged when conflicts are detected.

## Development

> You must have [Bun](https://bun.sh/docs/installation) installed globally.

To install dependencies:

```bash
bun install
```

To run the CLI in development:

```bash
bun src/watch.ts
```

To link the global `fastify-fbr` command to this local development version:

```bash
bun link
```

### Running Tests

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test:watch

# Run tests with UI
bun test:ui

# Type checking
bun typecheck

# Linting
bun lint
```

## Features

- **Zero Configuration**: Works out of the box with sensible defaults
- **File Watching**: Automatically detects file additions, changes, and deletions
- **Safe Modifications**: Preserves code formatting, indentation, comments, and quote styles
- **Conflict Detection**: Automatically resolves URL conflicts with clear warnings
- **TypeScript Support**: Full TypeScript support with type-safe route files
- **Graceful Shutdown**: Clean exit on Ctrl+C

## Requirements

- Bun runtime
- Fastify route files in `src/api` directory
- Routes must use the standard Fastify route registration pattern with `url` and `method` fields
