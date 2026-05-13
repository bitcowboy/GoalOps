import PocketBase from 'pocketbase'

let cached: PocketBase | null = null

/**
 * Lazily build (and cache) a PocketBase client.
 *
 * Auth precedence:
 *   1. POCKETBASE_AUTH_TOKEN  — saved into the auth store directly.
 *   2. POCKETBASE_ADMIN_EMAIL + POCKETBASE_ADMIN_PASSWORD — superuser login
 *      (tries the modern `_superusers` collection, falls back to the legacy
 *      `admins` API used by PocketBase < 0.23).
 *   3. unauthenticated — relies on collection rules being open.
 */
export async function getPb(): Promise<PocketBase> {
  if (cached) return cached
  const url = (process.env.POCKETBASE_URL ?? 'http://127.0.0.1:8090').trim()
  const pb = new PocketBase(url)
  // Server-side: disable per-request auto-cancellation that targets browser SPA usage.
  pb.autoCancellation(false)

  const token = process.env.POCKETBASE_AUTH_TOKEN?.trim()
  const email = process.env.POCKETBASE_ADMIN_EMAIL?.trim()
  const password = process.env.POCKETBASE_ADMIN_PASSWORD?.trim()

  if (token) {
    pb.authStore.save(token, null)
  } else if (email && password) {
    try {
      await pb.collection('_superusers').authWithPassword(email, password)
    } catch (err) {
      const legacy = (pb as unknown as { admins?: { authWithPassword: (e: string, p: string) => Promise<unknown> } }).admins
      if (legacy?.authWithPassword) {
        await legacy.authWithPassword(email, password)
      } else {
        throw err
      }
    }
  }

  cached = pb
  return pb
}
