import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getPb } from '../pbClient.js'
import { ok, fail, compactRecord } from '../utils.js'

const SEVERITY = z.enum(['low', 'medium', 'high'])

type ListOptions = { filter?: string; sort?: string; expand?: string }

export function registerBlockerTools(server: McpServer): void {
  server.registerTool(
    'goalops_blockers_list',
    {
      title: 'List blockers',
      description: 'List blockers, typically filtered by `objective="<id>"`. Severity-ranked on the client side if you sort by `-severity` is not enough.',
      inputSchema: {
        objective_id: z.string().optional(),
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
        if (sort) opts.sort = sort
        if (expand) opts.expand = expand
        const items = await pb.collection('blockers').getFullList({ ...opts, batch: 200 })
        return ok(items)
      } catch (e) {
        return fail(e)
      }
    },
  )

  server.registerTool(
    'goalops_blockers_create',
    {
      title: 'Create a blocker',
      description: 'Create a blocker entry under an objective.',
      inputSchema: {
        objective: z.string().min(1),
        description: z.string().min(1),
        severity: SEVERITY.default('medium'),
        owner: z.string().optional(),
        target_resolution_date: z.string().optional().describe('YYYY-MM-DD'),
      },
    },
    async (args) => {
      try {
        const pb = await getPb()
        const rec = await pb.collection('blockers').create(compactRecord({ ...args }))
        return ok(rec)
      } catch (e) {
        return fail(e)
      }
    },
  )

  server.registerTool(
    'goalops_blockers_update',
    {
      title: 'Update a blocker',
      description: 'Partial update of a blocker. Pass `owner: null` to clear the responsible member.',
      inputSchema: {
        id: z.string().min(1),
        description: z.string().optional(),
        severity: SEVERITY.optional(),
        owner: z.string().nullable().optional(),
        target_resolution_date: z.string().optional(),
      },
    },
    async ({ id, ...rest }) => {
      try {
        const pb = await getPb()
        const rec = await pb.collection('blockers').update(id, compactRecord(rest))
        return ok(rec)
      } catch (e) {
        return fail(e)
      }
    },
  )

  server.registerTool(
    'goalops_blockers_delete',
    {
      title: 'Delete a blocker',
      description: 'Delete a blocker by id.',
      inputSchema: { id: z.string().min(1) },
    },
    async ({ id }) => {
      try {
        const pb = await getPb()
        await pb.collection('blockers').delete(id)
        return ok({ deleted: id })
      } catch (e) {
        return fail(e)
      }
    },
  )
}
