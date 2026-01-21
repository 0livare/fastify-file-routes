# Fastify Sync CLI

This CLI tool watches your Fastify API route files and automatically updates the `url` and `method` fields to match the file path.

It provides a fully-featured file-based routing convention for Fastify:

- Automatic synchronization between filenames and route URLs
- Multiple endpoints for the same resource (e.g. `GET /users/:id` and `PATCH /users/:id`)
- Route parameters (`src/api/users/$userId.get.ts`)
- Index routes (`src/api/users/index.get.ts`)
- Pathless layouts (`src/api/_group/users.post.ts`) - group routes into folders that don't appear in the URL

## Naming Convention

The tool establishes a naming convention similar to [Tanstack Router](https://tanstack.com/router/v1/docs/framework/react/routing/file-based-routing):

| File Name                         | URL                         | Note                                                                             |
| --------------------------------- | --------------------------- | -------------------------------------------------------------------------------- |
| `src/api/users.get.ts`            | `GET /api/users`            | HTTP method is suffixed to the end of the file name                              |
| `src/api/users/$userId.put.ts`    | `PUT /api/users/:userId`    | Directories become URL segments; `$` prefix becomes `:` for fastify route params |
| `src/api/users.$userId.delete.ts` | `DELETE /api/users/:userId` | Dots can also be used to separate params from the rest of the file name          |
| `src/api/_auth/login.post.ts`     | `POST /api/login`           | Files/folders starting with `_` are excluded from URL                            |
| `src/api/files/index.patch.ts`    | `PATCH /api/files`          | `index.verb` files map to parent path                                            |
| `src/api/files/patch.ts`          | `PATCH /api/files`          | The `index.` is optional. `verb.ts` files are equivalent to `index.verb.ts`      |

## Features

- **Zero Configuration**: Works out of the box with sensible defaults
- **File Watching**: Automatically detects file additions, changes, and deletions
- **Safe Modifications**: Preserves code formatting, indentation, comments, and quote styles
- **Conflict Detection**: Automatically resolves URL conflicts with clear warnings
- **Graceful Shutdown**: Clean exit on Ctrl+C

## Installation

> Prerequisite: You must have [Bun](https://bun.sh) installed globally.

```bash
# Creates a global `fastify-sync` cli command
npm i -g fastify-sync
```

## Usage

1. Make sure **Fastify Sync** can find your root server file.
   - By default it looks in `src/server`, `src/main`, and `src/index`.
   - If your file is elsewhere, use the `--root` or `-r` flag to specify its path.
1. Define your routes in the `src/api` directory using `fastify.route()` (not the shorthand methods).
   ```js
   fastify.route({
     method: 'GET',
     url: '/api/health',
   })
   ```
   - The [zod](https://github.com/turkerdev/fastify-type-provider-zod) and [zod openapi](https://github.com/samchungy/fastify-zod-openapi) type providers are also supported:
     ```ts
     fastify.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
       method: 'GET',
       url: '/api/health',
     })
     ```
1. Configure [@fastify/autoload]
   ```js
   fastify.register(autoLoad, {
     // 1. Look for routes in the `src/api` directory
     dir: path.join(import.meta.dirname, 'api'),
     options: {
       // 2. Prefix all routes with /api
       prefix: '/api',
       // 3. Do not implicitly use the directory name as part of the route prefix
       // (Fastify Sync will explicitly set the full URL in each route file)
       dirNameRoutePrefix: false,
     },
   })
   ```
1. Run the `fastify-sync` command from your project root to watch your API routes:

   ```bash
   fastify-sync
   ```

   Commonly, you'll want Fastify Sync to run alongside your fastify server in dev mode. You can append it to your existing `dev` script with [concurrently](https://www.npmjs.com/package/concurrently):

   ```json
   "dev": "concurrently --raw 'tsx --watch src/server.ts | pino-pretty' 'fastify-sync'",
   ```

1. Try it out!
   - Create a new file at `src/api/users/$userId.post.ts` see it get automatically bootstrapped
   - Edit the file name to end in `.get.ts` and see the method update
   - You can now access this route at `/api/users/123`.

[@fastify/autoload]: https://github.com/fastify/fastify-autoload

On startup, **Fastify Sync** will:

1. Perform an initial scan of all routes in `src/api`
2. Fix any URLs that don't match their file paths
3. Watch for file changes and automatically update URLs

### Options

- `--help`, `-h`: Show help message
- `--version`, `-v`: Show version number
- `--verbose`: Show detailed output during operation (by default, the CLI runs quietly)
- `--bruno`: Auto-generate [Bruno](https://www.usebruno.com) API request files when a new Fastify route is created

### Bruno Integration

The `--bruno` flag enables automatic generation of corresponding [Bruno] API request files when a new Fastify route is created.

Your Bruno collection is automatically located (by looking for `bruno.json`) and the Bruno folder structure mirrors your Fastify route files.

> If you're not familiar, [Bruno] is an API client similar to Postman, except that it stores the API requests as plain text files in your project; alongside your code.
>
> This encourages developers to keep the requests up to date, and makes it so that when you check out old code, the API requests are still relevant.

[Bruno]: https://www.usebruno.com

## How it works

The tool follows file-based routing conventions to automatically generate URLs from file paths:

### Route Parameter Syntax

- `$userId` or `.$userId` → `:userId` in URL
- Example: `src/api/users/$userId.get.ts` → `/api/users/:userId`

### Index Files

- `index.get.ts` maps to parent path
- Example: `src/api/users/index.get.ts` → `/api/users`

### Pathless Layouts

- Files/folders starting with `_` are excluded from URL
- Example: `src/api/_auth/login.post.ts` → `/api/login`

### HTTP Methods

- Supported methods: GET, POST, PUT, PATCH, DELETE
- Both `.ts` and `.js` extensions are supported

### Example File Structure

```
src/api/
├── users/
│   ├── index.get.ts           → GET /api/users
│   ├── $userId.get.ts         → GET /api/users/:userId
│   └── $userId.patch.ts       → PATCH /api/users/:userId
├── products/
│   ├── index.get.ts          → GET /api/products
│   └── $id/
│       └── reviews.get.ts    → GET /api/products/:id/reviews
└── _auth/
    └── login.post.ts         → POST /api/login
```

Note: Each route file's `url` field will contain the full path shown above (e.g., `/api/users/:userId`), not a relative path.

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

To link the global `fastify-sync` command to this local development version:

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
