import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getPb } from '../pbClient.js'
import { ok, fail, compactRecord } from '../utils.js'

const TASK_STATUS = z.enum(['pending', 'in_progress', 'deliver', 'review', 'done'])
const PRIORITY = z.enum(['P0', 'P1', 'P2', 'P3'])

type ListOptions = { filter?: string; sort?: string; expand?: string }

export function registerTaskTools(server: McpServer): void {
  server.registerTool(
    'goalops_tasks_list',
    {
      title: 'List tasks',
      description:
        'List tasks. Common filters: `objective="<id>"`, `assignee="<id>"`, `status="in_progress"`. `expand` accepts a comma list like "assignee,key_result,objective".',
      inputSchema: {
        filter: z.string().optional(),
        sort: z.string().optional(),
        limit: z.number().int().min(1).max(500).optional(),
        expand: z.string().optional(),
      },
    },
    async ({ filter, sort, limit, expand }) => {
      try {
        const pb = await getPb()
        const opts: ListOptions = {}
        if (filter) opts.filter = filter
        if (sort) opts.sort = sort
        if (expand) opts.expand = expand
        if (typeof limit === 'number') {
          const page = await pb.collection('tasks').getList(1, limit, opts)
          return ok(page.items)
        }
        const items = await pb.collection('tasks').getFullList({ ...opts, batch: 200 })
        return ok(items)
      } catch (e) {
        return fail(e)
      }
    },
  )

  server.registerTool(
    'goalops_tasks_get',
    {
      title: 'Get a task',
      description: 'Fetch one task by id; optional expand (e.g. "assignee,key_result,objective").',
      inputSchema: {
        id: z.string().min(1),
        expand: z.string().optional(),
      },
    },
    async ({ id, expand }) => {
      try {
        const pb = await getPb()
        const rec = await pb.collection('tasks').getOne(id, expand ? { expand } : {})
        return ok(rec)
      } catch (e) {
        return fail(e)
      }
    },
  )

  server.registerTool(
    'goalops_tasks_create',
    {
      title: 'Create a task',
      description: 'Create a new task. `objective` is required; `key_result` and `assignee` are optional record ids.',
      inputSchema: {
        title: z.string().min(1),
        objective: z.string().min(1),
        key_result: z.string().optional(),
        assignee: z.string().optional(),
        status: TASK_STATUS.default('pending'),
        priority: PRIORITY.default('P2'),
        predecessor_ids: z.array(z.string()).optional(),
        estimate_hours: z.number().min(0).optional(),
        due_date: z.string().optional().describe('YYYY-MM-DD'),
      },
    },
    async (args) => {
      try {
        const pb = await getPb()
        const rec = await pb.collection('tasks').create(compactRecord({ ...args }))
        return ok(rec)
      } catch (e) {
        return fail(e)
      }
    },
  )

  server.registerTool(
    'goalops_tasks_update',
    {
      title: 'Update a task',
      description:
        'Partial update of a task. Pass `key_result: null` or `assignee: null` to clear those relations.',
      inputSchema: {
        id: z.string().min(1),
        title: z.string().optional(),
        objective: z.string().optional(),
        key_result: z.string().nullable().optional(),
        assignee: z.string().nullable().optional(),
        status: TASK_STATUS.optional(),
        priority: PRIORITY.optional(),
        predecessor_ids: z.array(z.string()).optional(),
        estimate_hours: z.number().min(0).optional(),
        due_date: z.string().optional(),
      },
    },
    async ({ id, ...rest }) => {
      try {
        const pb = await getPb()
        const rec = await pb.collection('tasks').update(id, compactRecord(rest))
        return ok(rec)
      } catch (e) {
        return fail(e)
      }
    },
  )

  server.registerTool(
    'goalops_tasks_delete',
    {
      title: 'Delete a task',
      description: 'Delete a task by id.',
      inputSchema: { id: z.string().min(1) },
    },
    async ({ id }) => {
      try {
        const pb = await getPb()
        await pb.collection('tasks').delete(id)
        return ok({ deleted: id })
      } catch (e) {
        return fail(e)
      }
    },
  )
}
