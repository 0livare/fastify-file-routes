# Bruno Integration

The `--bruno` flag enables automatic generation of Bruno API collection requests when new route files are created.

## Setup

1. Create a Bruno collection in your project (e.g., in a `bruno` directory)
2. Ensure your collection has a `bruno.json` file at its root
3. Run fastify-sync with the `--bruno` flag

## Usage

```bash
# Start fastify-sync with Bruno integration enabled
fastify-sync --bruno --verbose

# Or with short flags
fastify-sync --bruno -v
```

## How It Works

When you create a new empty route file with the `--bruno` flag enabled:

1. **Finds Bruno Collection**: Searches for `bruno.json` in your project (up to 3 levels deep)
2. **Scaffolds Route File**: Creates a Fastify route template as usual
3. **Generates Bruno Request**: Creates a corresponding `.bru` request file
4. **Creates Folder Structure**: Mirrors your route file structure in the Bruno collection
5. **Adds folder.bru Files**: Creates `folder.bru` files for each directory in the path

## Example

### Creating a Route File

```bash
# Create an empty route file
touch src/api/users/$id.get.ts
```

### Generated Files

**Route File**: `src/api/users/$id.get.ts`

```typescript
import type {FastifyInstance} from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.route({
    method: 'GET',
    url: '/api/users/:id',
    async handler(req, reply) {
      reply.code(200).send('Hello, World!')
    },
  })
}
```

**Bruno Request**: `bruno/users/Get Users Id.bru`

```
meta {
  name: Get Users Id
  type: http
  seq: 1
}

get {
  url: {{appUrl}}/api/users/:id
  body: none
  auth: inherit
}

auth {
  mode: inherit
}
```

**Folder Metadata**: `bruno/users/folder.bru`

```
meta {
  name: /users
}

auth {
  mode: inherit
}
```

## Bruno Request Features

### HTTP Methods

Different HTTP methods generate different request templates:

- **GET, DELETE**: Basic request without body
- **POST, PUT, PATCH**: Request with JSON body template

### URL Path Mapping

The route file structure is mapped to Bruno folders:

| Route File                      | Bruno Request                          |
| ------------------------------- | -------------------------------------- |
| `src/api/users.get.ts`          | `bruno/Get Users.bru`                  |
| `src/api/users/$id.get.ts`      | `bruno/users/Get Users Id.bru`         |
| `src/api/v1/auth/login.post.ts` | `bruno/v1/auth/Post V1 Auth Login.bru` |

### Request Naming

Request names are automatically derived from the URL path:

- `/api/users` → "Get Users"
- `/api/users/:id` → "Get Users Id"
- `/api/user-profiles` → "Get User Profiles"
- `/api/buyer-agreements/:id` → "Get Buyer Agreements Id"

## Configuration

The Bruno collection must have a `bruno.json` file. Example:

```json
{
  "version": "1",
  "name": "My API",
  "type": "collection"
}
```

## Environment Variables

Bruno requests use `{{appUrl}}` for the API base URL. Configure this in your Bruno environment:

```
appUrl=http://localhost:3000
```

## Troubleshooting

### Warning: bruno.json not found

If you see this warning:

```
⚠️  --bruno flag enabled but bruno.json not found. Bruno request generation disabled.
```

**Solution**: Create a Bruno collection with a `bruno.json` file, or ensure it's within 3 directory levels of your project root.

### Bruno requests not generated

Make sure:

1. The `--bruno` flag is passed to fastify-sync
2. You're creating **empty** route files (fastify-sync scaffolds empty files)
3. The route file has a valid HTTP method suffix (`.get.ts`, `.post.ts`, etc.)

## Example Workflow

```bash
# 1. Initialize your project
mkdir my-api && cd my-api
npm init -y

# 2. Create a Bruno collection
mkdir bruno
echo '{"version":"1","name":"My API","type":"collection"}' > bruno/bruno.json

# 3. Start fastify-sync with Bruno integration
fastify-sync --bruno --verbose

# 4. Create route files (in another terminal)
mkdir -p src/api/users
touch src/api/users.get.ts          # → bruno/Get Users.bru
touch src/api/users/$id.get.ts      # → bruno/users/Get Users Id.bru
touch src/api/users.post.ts         # → bruno/Post Users.bru
touch src/api/users/$id.delete.ts   # → bruno/users/Delete Users Id.bru
```

## Benefits

- **Consistent API Documentation**: Every route automatically gets a Bruno request
- **Parallel Development**: Frontend developers can test endpoints immediately
- **Type Safety**: Route changes are reflected in both code and API client
- **No Manual Work**: Eliminates tedious copy-pasting of routes into API clients
