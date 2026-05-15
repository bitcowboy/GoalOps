import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getPb } from '../pbClient.js'
import { ok, fail, compactRecord } from '../utils.js'

const KR_TYPE = z.enum(['metric', 'checkbox', 'milestone'])
const DIRECTION = z.enum(['increase', 'decrease'])

type ListOptions = { filter?: string; sort?: string; expand?: string }

type DerivedFields = {
  key_result: string
  kr_type: 'metric' | 'checkbox' | 'milestone'
  start_value: number | null
  target_value: number | null
  unit: string
  direction: 'increase' | 'decrease' | null
  latest_value: number | null
  latest_confidence: number | null
  latest_checkin_date: string | null
  score: number | null
}

/**
 * Pull derived fields from the PB hook endpoint `/api/goalops/key_results/:id/derived`.
 * Returns null on any failure so callers can degrade gracefully.
 */
async function fetchDerived(baseUrl: string, id: string): Promise<DerivedFields | null> {
  try {
    const url = `${baseUrl.replace(/\/+$/, '')}/api/goalops/key_results/${encodeURIComponent(id)}/derived`
    const res = await fetch(url)
    if (!res.ok) return null
    return (await res.json()) as DerivedFields
  } catch {
    return null
  }
}

function wantsExpand(expand: string | undefined, token: string): boolean {
  if (!expand) return false
  return expand
    .split(',')
    .map((s) => s.trim())
    .includes(token)
}

function pbExpandWithoutDerived(expand: string | undefined): string | undefined {
  if (!expand) return undefined
  const kept = expand
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && s !== 'derived')
  return kept.length > 0 ? kept.join(',') : undefined
}

export function registerKeyResultTools(server: McpServer): void {
  server.registerTool(
    'goalops_key_results_list',
    {
      title: 'List key results',
      description:
        'List key_results, typically filtered by `objective="<id>"`. Default sort is "sort_order,name". `expand=derived` augments each item with `latest_value / latest_confidence / latest_checkin_date / score` from the latest check-in.',
      inputSchema: {
        objective_id: z.string().optional().describe('If provided, filters by objective relation.'),
        filter: z.string().optional(),
        sort: z.string().optional(),
        expand: z
          .string()
          .optional()
          .describe('Comma-separated. Supports "owner", "contributors", "derived".'),
      },
    },
    async ({ objective_id, filter, sort, expand }) => {
      try {
        const pb = await getPb()
        const opts: ListOptions = {}
        const effectiveFilter = objective_id ? `objective="${objective_id}"` : filter
        if (effectiveFilter) opts.filter = effectiveFilter
        opts.sort = sort ?? 'sort_order,name'
        const pbExpand = pbExpandWithoutDerived(expand)
        if (pbExpand) opts.expand = pbExpand
        const items = await pb.collection('key_results').getFullList({ ...opts, batch: 300 })

        if (wantsExpand(expand, 'derived')) {
          const baseUrl = pb.baseUrl
          const enriched = await Promise.all(
            items.map(async (it) => {
              const derived = await fetchDerived(baseUrl, it.id)
              return { ...it, derived }
            }),
          )
          return ok(enriched)
        }
        return ok(items)
      } catch (e) {
        return fail(e)
      }
    },
  )

  server.registerTool(
    'goalops_key_results_get',
    {
      title: 'Get a key result',
      description:
        'Fetch a single KR by id. `expand=derived` adds `latest_value / latest_confidence / latest_checkin_date / score` from the latest check-in. Other expand tokens are passed through to PocketBase.',
      inputSchema: {
        id: z.string().min(1),
        expand: z
          .string()
          .optional()
          .describe('Comma-separated. Supports "owner", "contributors", "derived".'),
      },
    },
    async ({ id, expand }) => {
      try {
        const pb = await getPb()
        const pbExpand = pbExpandWithoutDerived(expand)
        const rec = await pb
          .collection('key_results')
          .getOne(id, pbExpand ? { expand: pbExpand } : undefined)
        if (wantsExpand(expand, 'derived')) {
          const derived = await fetchDerived(pb.baseUrl, id)
          return ok({ ...rec, derived })
        }
        return ok(rec)
      } catch (e) {
        return fail(e)
      }
    },
  )

  server.registerTool(
    'goalops_key_results_create',
    {
      title: 'Create a key result',
      description:
        'Create a key result under an objective. `kr_type` defaults to "checkbox". For "metric", `start_value`, `target_value`, `unit`, `direction` are all required.',
      inputSchema: {
        objective: z.string().min(1),
        name: z.string().min(1),
        kr_type: KR_TYPE.default('checkbox'),
        is_completed: z.boolean().optional(),
        owner: z.string().optional(),
        note: z.string().optional(),
        sort_order: z.number().int().optional(),
        // metric-only
        start_value: z.number().optional(),
        target_value: z.number().optional(),
        unit: z.string().optional(),
        direction: DIRECTION.optional(),
        // multi
        contributors: z.array(z.string()).optional(),
      },
    },
    async (args) => {
      try {
        const pb = await getPb()
        const rec = await pb.collection('key_results').create(compactRecord({ ...args }))
        return ok(rec)
      } catch (e) {
        return fail(e)
      }
    },
  )

  server.registerTool(
    'goalops_key_results_update',
    {
      title: 'Update a key result',
      description:
        'Partial update of a key result. Pass `owner: null` to clear. Switching to `kr_type: "metric"` requires `start_value / target_value / unit / direction` in the same call (server enforces).',
      inputSchema: {
        id: z.string().min(1),
        name: z.string().optional(),
        kr_type: KR_TYPE.optional(),
        is_completed: z.boolean().optional(),
        owner: z.string().nullable().optional(),
        note: z.string().optional(),
        sort_order: z.number().int().optional(),
        start_value: z.number().nullable().optional(),
        target_value: z.number().nullable().optional(),
        unit: z.string().optional(),
        direction: DIRECTION.nullable().optional(),
        contributors: z.array(z.string()).optional(),
      },
    },
    async ({ id, ...rest }) => {
      try {
        const pb = await getPb()
        const rec = await pb.collection('key_results').update(id, compactRecord(rest))
        return ok(rec)
      } catch (e) {
        return fail(e)
      }
    },
  )

  server.registerTool(
    'goalops_key_results_delete',
    {
      title: 'Delete a key result',
      description: 'Delete a key result by id. Cascades to its check-ins.',
      inputSchema: { id: z.string().min(1) },
    },
    async ({ id }) => {
      try {
        const pb = await getPb()
        await pb.collection('key_results').delete(id)
        return ok({ deleted: id })
      } catch (e) {
        return fail(e)
      }
    },
  )
}
