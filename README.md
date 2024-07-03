# Easy Install

Single command to install dependencies with the correct package manager for any JavaScript project.

## Installation

```bash
# easy-install depends on bun being installed globally
npm i -g bun

# Creates a global `in` cli command
npm i -g easy-install
```

## Usage

Run the `in` command, optionally followed by dependencies you want to install.

```bash
in [flags] [...<pkg>]
```

```bash
Flags:
  -d, -D, --dev, --save-dev        Install pkg as a development dependency
  -z, --frozen, --frozen-lockfile  Disallow changes to lockfile
  -v, --version                    Print version number
  -h, --help                       Print help information
```

## Examples

### Install all project dependencies

```bash
in
# might run: npm install
# or: yarn install
# or: pnpm install
# or: bun install
```

### Add a project dependency

```bash
in express
# might run: npm install express
# or: yarn add express
# or: pnpm add express
# or: bun add express
```

### Add a project development dependency

```bash
in --dev nodemon
# might run: npm install --save-dev nodemon
# or: yarn add --dev nodemon
# or: pnpm add --save-dev nodemon
# or: bun add --dev nodemon
```

### Add multiple project dependencies at once

```bash
in react immer axios
```

## How it works

Easy Install determines the correct package manager based on the lock file present in the project directory.

`in` can be run from any subdirectory of a project, and it will find the closest lock file in any parent directory relative to where the command is run.

### Supported package managers

| Package Manager | Lock File               |
| --------------- | ----------------------- |
| npm             | `package-lock.json`     |
| yarn            | `yarn.lock`             |
| pnpm            | `pnpm-lock.yaml`        |
| bun             | `bun.lock`, `bun.lockb` |

## Development

> You must have [Bun](https://bun.sh/docs/installation) installed globally.

To install dependencies:

```bash
bun install
```

To run:

```bash
bun in
```

To link the global `in` command to this local development version:

```bash
bun link
```
