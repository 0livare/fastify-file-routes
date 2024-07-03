import {objectKeys} from './utils'

const packageManagerDefs = {
  npm: {
    lockFileNames: ['package-lock.json'],
    installDepsCmd: 'npm install',
    installFrozenDepsCmd: 'npm ci',
    addNewDepCmd: 'npm install',
    devDepFlag: '--save-dev',
  },
  yarn: {
    lockFileNames: ['yarn.lock'],
    installDepsCmd: 'yarn install',
    installFrozenDepsCmd: 'yarn install --frozen-lockfile',
    addNewDepCmd: 'yarn add',
    devDepFlag: '--dev',
  },
  pnpm: {
    lockFileNames: ['pnpm-lock.yaml'],
    installDepsCmd: 'pnpm install',
    installFrozenDepsCmd: 'pnpm install --frozen-lockfile',
    addNewDepCmd: 'pnpm add',
    devDepFlag: '--save-dev',
  },
  bun: {
    lockFileNames: ['bun.lock', 'bun.lockb'],
    installDepsCmd: 'bun install',
    installFrozenDepsCmd: 'bun install --frozen-lockfile',
    addNewDepCmd: 'bun add',
    devDepFlag: '--dev',
  },
} satisfies Record<string, Omit<PackageManagerDefinition, 'name'>>

export const packageManagerDefList: PackageManagerDefinition[] = objectKeys(
  packageManagerDefs,
).map((managerName) => ({
  name: managerName,
  ...packageManagerDefs[managerName],
}))

export type PackageManagerName = keyof typeof packageManagerDefs
export type PackageManagerDefinition = {
  name: PackageManagerName
  lockFileNames: string[]
  installDepsCmd: string
  installFrozenDepsCmd: string
  addNewDepCmd: string
  devDepFlag: string
}
