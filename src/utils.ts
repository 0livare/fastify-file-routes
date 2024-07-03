/**
 * A strongly typed version of `Object.keys()` that types
 * each returned key such that `object[key]` is typed correctly.
 */
export function objectKeys<T extends {}>(object: T): Array<keyof T> {
  return Object.keys(object) as Array<keyof T>
}
