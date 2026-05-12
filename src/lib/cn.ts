/** Join Tailwind-ish class fragments; trims falsy segments. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
