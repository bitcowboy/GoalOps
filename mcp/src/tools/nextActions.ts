import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getPb } from '../pbClient.js'
import { ok, fail } from '../utils.js'

/**
 * `next_actions` is a JSON array stored on the `objectives` collection, not a
 * separate collection. Each item shape matches `ObjectiveNextActionJson`:
 *   { suggestion, type, priority, suggester_name, suggester_initials,
 *     suggester_color?, suggestion_date }
 */
const NEXT_ACTION = z.object({
  suggestion: z.string().min(1),
  type: z.string().min(1).default('plan'),
  priority: z.string().min(1).default('P2'),
  suggester_name: z.string().default(''),
  suggester_initials: z.string().default(''),
  suggester_color: z.string().optional(),
  suggestion_date: z.string().describe('YYYY-MM-DD'),
})

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function readNextActions(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) {
    return raw.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const v: unknown = JSON.parse(raw)
      return Array.isArray(v)
        ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
        : []
    } catch {
      return []
    }
  }
  return []
}

export function registerNextActionTools(server: McpServer): void {
  server.registerTool(
    'goalops_next_actions_list',
    {
      title: 'List next actions',
      description: 'Read the `next_actions` array from an objective.',
      inputSchema: { objective_id: z.string().min(1) },
    },
    async ({ objective_id }) => {
      try {
        const pb = await getPb()
        const rec = await pb.collection('objectives').getOne(objective_id)
        return ok(readNextActions(rec['next_actions']))
      } catch (e) {
        return fail(e)
      }
    },
  )

  server.registerTool(
    'goalops_next_actions_set',
    {
      title: 'Replace next actions',
      description:
        'Overwrite the `next_actions` array on an objective with the provided list. Missing dates default to today.',
      inputSchema: {
        objective_id: z.string().min(1),
        items: z.array(NEXT_ACTION),
      },
    },
    async ({ objective_id, items }) => {
      try {
        const pb = await getPb()
        const today = todayIso()
        const normalized = items.map((item) => ({
          ...item,
          suggestion_date: item.suggestion_date || today,
        }))
        const rec = await pb
          .collection('objectives')
          .update(objective_id, { next_actions: normalized })
        return ok(rec['next_actions'])
      } catch (e) {
        return fail(e)
      }
    },
  )

  server.registerTool(
    'goalops_next_actions_append',
    {
      title: 'Append a next action',
      description:
        'Append one entry to the `next_actions` array on an objective. Returns the updated array.',
      inputSchema: {
        objective_id: z.string().min(1),
        item: NEXT_ACTION,
      },
    },
    async ({ objective_id, item }) => {
      try {
        const pb = await getPb()
        const current = await pb.collection('objectives').getOne(objective_id)
        const existing = readNextActions(current['next_actions'])
        const next = [
          ...existing,
          { ...item, suggestion_date: item.suggestion_date || todayIso() },
        ]
        const rec = await pb
          .collection('objectives')
          .update(objective_id, { next_actions: next })
        return ok(rec['next_actions'])
      } catch (e) {
        return fail(e)
      }
    },
  )
}
