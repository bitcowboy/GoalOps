import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getPb } from '../pbClient.js'
import { ok, fail, compactRecord } from '../utils.js'

const OBJECTIVE_STATUS = z.enum([
  'not_started',
  'explore_plan',
  'in_progress',
  'paused',
  'in_review',
  'done',
  'cancelled',
])
const PRIORITY = z.enum(['P0', 'P1', 'P2', 'P3'])
const RISK = z.enum(['low', 'medium', 'high'])

type ListOptions = {
  filter?: string
  sort?: string
  expand?: string
}

export function registerObjectiveTools(server: McpServer): void {
  server.registerTool(
    'goalops_objectives_list',
    {
      title: 'List objectives',
      description:
        'List GoalOps objectives. Supports a PocketBase filter expression (e.g. `status="in_progress" && priority="P0"`), sort (e.g. `-created`, `due_date`), and an optional page-size limit. Pass expandOwner to include the owner record.',
      inputSchema: {
        filter: z.string().optional(),
        sort: z.string().optional(),
        limit: z.number().int().min(1).max(500).optional(),
        expandOwner: z.boolean().optional(),
      },
    },
    async ({ filter, sort, limit, expandOwner }) => {
      try {
        const pb = await getPb()
        const opts: ListOptions = {}
        if (filter) opts.filter = filter
        if (sort) opts.sort = sort
        if (expandOwner) opts.expand = 'owner'
        if (typeof limit === 'number') {
          const page = await pb.collection('objectives').getList(1, limit, opts)
          return ok(page.items)
        }
        const items = await pb.collection('objectives').getFullList({ ...opts, batch: 200 })
        return ok(items)
      } catch (e) {
        return fail(e)
      }
    },
  )

  server.registerTool(
    'goalops_objectives_get',
    {
      title: 'Get an objective',
      description: 'Fetch one objective by id; optionally expand owner.',
      inputSchema: {
        id: z.string().min(1),
        expandOwner: z.boolean().optional(),
      },
    },
    async ({ id, expandOwner }) => {
      try {
        const pb = await getPb()
        const rec = await pb
          .collection('objectives')
          .getOne(id, expandOwner ? { expand: 'owner' } : {})
        return ok(rec)
      } catch (e) {
        return fail(e)
      }
    },
  )

  server.registerTool(
    'goalops_objectives_create',
    {
      title: 'Create an objective',
      description:
        'Create a new objective. `definition` is the merged plain-text description (multi-line; was summary + background). `owner` and `participant_ids` reference `members.id`.',
      inputSchema: {
        name: z.string().min(1),
        owner: z.string().min(1),
        status: OBJECTIVE_STATUS.default('not_started'),
        priority: PRIORITY.default('P1'),
        definition: z.string().optional(),
        start_date: z.string().optional().describe('YYYY-MM-DD'),
        due_date: z.string().optional().describe('YYYY-MM-DD'),
        progress_percent: z.number().min(0).max(100).optional(),
        out_of_scope: z.array(z.string()).optional(),
        participant_ids: z.array(z.string()).optional(),
        risk_level: RISK.optional(),
        current_blockers_summary: z.string().optional(),
        display_code: z.string().optional(),
      },
    },
    async (args) => {
      try {
        const pb = await getPb()
        const rec = await pb.collection('objectives').create(compactRecord({ ...args }))
        return ok(rec)
      } catch (e) {
        return fail(e)
      }
    },
  )

  server.registerTool(
    'goalops_objectives_update',
    {
      title: 'Update an objective',
      description: 'Partial update of an objective by id. Only provided fields are written.',
      inputSchema: {
        id: z.string().min(1),
        name: z.string().optional(),
        owner: z.string().optional(),
        status: OBJECTIVE_STATUS.optional(),
        priority: PRIORITY.optional(),
        definition: z.string().optional(),
        start_date: z.string().optional(),
        due_date: z.string().optional(),
        progress_percent: z.number().min(0).max(100).optional(),
        out_of_scope: z.array(z.string()).optional(),
        participant_ids: z.array(z.string()).optional(),
        risk_level: RISK.optional(),
        current_blockers_summary: z.string().optional(),
        display_code: z.string().optional(),
      },
    },
    async ({ id, ...rest }) => {
      try {
        const pb = await getPb()
        const rec = await pb.collection('objectives').update(id, compactRecord(rest))
        return ok(rec)
      } catch (e) {
        return fail(e)
      }
    },
  )

  server.registerTool(
    'goalops_objectives_delete',
    {
      title: 'Delete an objective',
      description:
        'Delete an objective by id. PocketBase cascade rules will also drop related key_results / tasks / blockers / deliverables / core_documents.',
      inputSchema: { id: z.string().min(1) },
    },
    async ({ id }) => {
      try {
        const pb = await getPb()
        await pb.collection('objectives').delete(id)
        return ok({ deleted: id })
      } catch (e) {
        return fail(e)
      }
    },
  )
}
