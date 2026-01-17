# Fastify File-Based Routing CLI

With [@fastify/autoload] and a good naming convention, you can _almost_ achieve file-based routing in Fastify. But you still have the issue of keeping your route `url` in sync with your file path.

This CLI tool watches your API route files and automatically keeps the `url` and `method` fields in your Fastify route configuration in sync with the file path.

It also establishes a fully-featured naming convention similar to [Tanstack Router](https://tanstack.com/router/v1/docs/framework/react/routing/file-based-routing):

| URL                         | File Name                         | Note                                                                                                                                                                 |
| --------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/users`            | `src/api/users.get.ts`            | HTTP method is suffixed to the end of the file name                                                                                                                  |
| `POST /api/users/:userId`   | `src/api/users/$userId.post.ts`   | Directories become URL segments; `$` prefix becomes `:` for fastify route params                                                                                     |
| `DELETE /api/users/:userId` | `src/api/users.$userId.delete.ts` | Dots can also be used to separate params from the rest of the file name                                                                                              |
| `POST /api/login`           | `src/api/_auth/login.post.ts`     | Files/folders starting with `_` are excluded from URL                                                                                                                |
| `GET /api/files`            | `src/api/files/index.get.ts`      | `index` files map to parent path, but [cause all other files in that dir to be ignored](https://github.com/fastify/fastify-autoload?tab=readme-ov-file#dir-required) |

> [!NOTE]
> It is recommended to configure `@fastify/autoload` with the initial `/api` prefix so that your routes match your file structure exactly, but that is not required. If it's missing, the previous exmples should remove `/api` from the beginning of the URLs.
>
> ```ts
> fastify.register(autoLoad, {
>   dir: path.join(import.meta.dirname, 'api'),
>   options: {prefix: '/api'},
> })
> ```

> [!important]
>
> `@fastify/autoload` has a [restriction](https://github.com/fastify/fastify-autoload?tab=readme-ov-file#dir-required) where if a directory contains an `index` file, it will only load that file and ignore other files in the same directory. So this tool inherits that same limitation.

## Features

- **Zero Configuration**: Works out of the box with sensible defaults
- **File Watching**: Automatically detects file additions, changes, and deletions
- **Safe Modifications**: Preserves code formatting, indentation, comments, and quote styles
- **Conflict Detection**: Automatically resolves URL conflicts with clear warnings
- **Graceful Shutdown**: Clean exit on Ctrl+C

## Requirements

1. [Bun](https://bun.sh) is installed
2. [@fastify/autoload] is used to load routes
3. Define your routes inside of the `src/api` directory
4. Your routes are defined with `fastify.route()`, not the shorthand methods like `fastify.get()` or `fastify.post()`

[@fastify/autoload]: https://github.com/fastify/fastify-autoload

## Installation

> Prerequisite: You must have [Bun](https://bun.sh) installed globally.

```bash
# Creates a global `ffr` cli command
npm i -g fastify-file-routes
```

## Usage

Run the `ffr` command from your project root to watch your API routes:

```bash
ffr
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
ffr --quiet
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

- Supported methods: GET, POST, PUT, PATCH, DELETE
- Both `.ts` and `.js` extensions are supported

### Example File Structure

```
src/api/
├── users/
│   ├── index.get.ts           → GET /users
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

To link the global `ffr` command to this local development version:

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
