import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getPb } from '../pbClient.js'
import { ok, fail, compactRecord } from '../utils.js'

type ListOptions = { filter?: string; sort?: string; expand?: string }

export function registerKeyResultTools(server: McpServer): void {
  server.registerTool(
    'goalops_key_results_list',
    {
      title: 'List key results',
      description:
        'List key_results, typically filtered by `objective="<id>"`. Default sort is "sort_order,name".',
      inputSchema: {
        objective_id: z.string().optional().describe('If provided, filters by objective relation.'),
        filter: z.string().optional(),
        sort: z.string().optional(),
        expand: z.string().optional().describe('e.g. "owner"'),
      },
    },
    async ({ objective_id, filter, sort, expand }) => {
      try {
        const pb = await getPb()
        const opts: ListOptions = {}
        const effectiveFilter = objective_id ? `objective="${objective_id}"` : filter
        if (effectiveFilter) opts.filter = effectiveFilter
        opts.sort = sort ?? 'sort_order,name'
        if (expand) opts.expand = expand
        const items = await pb.collection('key_results').getFullList({ ...opts, batch: 300 })
        return ok(items)
      } catch (e) {
        return fail(e)
      }
    },
  )

  server.registerTool(
    'goalops_key_results_create',
    {
      title: 'Create a key result',
      description: 'Create a Checkbox key result under an objective.',
      inputSchema: {
        objective: z.string().min(1),
        name: z.string().min(1),
        is_completed: z.boolean().default(false),
        owner: z.string().optional(),
        note: z.string().optional(),
        sort_order: z.number().int().optional(),
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
        'Partial update of a key result (e.g. tick `is_completed`, rename, reorder, swap owner). Pass `owner: null` to clear.',
      inputSchema: {
        id: z.string().min(1),
        name: z.string().optional(),
        is_completed: z.boolean().optional(),
        owner: z.string().nullable().optional(),
        note: z.string().optional(),
        sort_order: z.number().int().optional(),
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
      description: 'Delete a key result by id.',
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
