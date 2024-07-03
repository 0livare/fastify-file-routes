import {$} from 'bun'
import chalk from 'chalk'

/**
 * Wrapper around [Bun Shell](https://bun.sh/docs/runtime/shell) that takes
 * a plain string and does not require use of a tagged template.
 *
 * @see Bun Shell - https://bun.sh/docs/runtime/shell
 * @see Tagged Templates - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates
 */
export async function shell(cmd: string) {
  console.info(chalk.gray(`$ ${cmd}`))

  const fakeLiteral = [cmd] as unknown as TemplateStringsArray
  // @ts-expect-error
  fakeLiteral.raw = [cmd]

  return await $(fakeLiteral, []).cwd(process.cwd())
}
