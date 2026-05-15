import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getPb } from '../pbClient.js'
import { ok, fail, compactRecord } from '../utils.js'

const CHECKIN_TYPE = z.enum(['weekly', 'milestone', 'adhoc'])
const STATUS_SIGNAL = z.enum(['on_track', 'at_risk', 'off_track'])

type ListOptions = { filter?: string; sort?: string; expand?: string }

const CREATE_DESCRIPTION = `Record a periodic check-in for a Key Result. A check-in is a point-in-time
snapshot answering three questions: where the number is now, how confident the
team is about end-of-period achievement (1-10), and what next week's focus is.

The metric field depends on the KR's kr_type:
- metric KR   -> fill \`current_value\` (e.g., auto_pass_rate = 58)
- checkbox KR -> fill \`is_completed\` (true/false)
- milestone KR -> fill \`progress_percent\` (0-100)

Confidence (1-10) is more sensitive than progress: a confidence drop from 7 to
4 is an early warning even when the number is still rising. \`status_signal\`
auto-derives from confidence (>=7 on_track, 4-6 at_risk, <=3 off_track) unless
explicitly set.`

export function registerCheckinTools(server: McpServer): void {
  server.registerTool(
    'goalops_checkins_list',
    {
      title: 'List KR check-ins',
      description:
        'List kr_checkins. Almost always filter by `key_result_id` to view a KR timeline. Default sort: "-checkin_date,-created".',
      inputSchema: {
        key_result_id: z.string().optional().describe('Filter by KR id (relation match).'),
        filter: z.string().optional().describe('Raw PB filter (overridden if key_result_id is set).'),
        sort: z.string().optional(),
        limit: z.number().int().min(1).max(200).optional(),
        expand: z.string().optional().describe('e.g. "author,key_result"'),
      },
    },
    async ({ key_result_id, filter, sort, limit, expand }) => {
      try {
        const pb = await getPb()
        const opts: ListOptions = {}
        const effectiveFilter = key_result_id ? `key_result="${key_result_id}"` : filter
        if (effectiveFilter) opts.filter = effectiveFilter
        opts.sort = sort ?? '-checkin_date,-created'
        if (expand) opts.expand = expand
        const items = await pb
          .collection('kr_checkins')
          .getFullList({ ...opts, batch: limit ?? 100 })
        return ok(limit ? items.slice(0, limit) : items)
      } catch (e) {
        return fail(e)
      }
    },
  )

  server.registerTool(
    'goalops_checkins_get',
    {
      title: 'Get a KR check-in',
      description: 'Fetch a single check-in by id.',
      inputSchema: {
        id: z.string().min(1),
        expand: z.string().optional().describe('e.g. "author,key_result"'),
      },
    },
    async ({ id, expand }) => {
      try {
        const pb = await getPb()
        const rec = await pb.collection('kr_checkins').getOne(id, expand ? { expand } : undefined)
        return ok(rec)
      } catch (e) {
        return fail(e)
      }
    },
  )

  server.registerTool(
    'goalops_checkins_create',
    {
      title: 'Create a KR check-in',
      description: CREATE_DESCRIPTION,
      inputSchema: {
        key_result: z.string().min(1),
        checkin_date: z.string().min(1).describe('YYYY-MM-DD, business date of the check-in. Must not be in the future.'),
        confidence: z.number().int().min(1).max(10),
        progress_note: z.string().min(1),
        author: z.string().min(1),

        checkin_type: CHECKIN_TYPE.default('weekly'),
        status_signal: STATUS_SIGNAL.optional().describe('Defaults to derived from confidence if omitted.'),

        // Metric three-way (server enforces consistency vs KR.kr_type)
        current_value: z.number().optional(),
        progress_percent: z.number().min(0).max(100).optional(),
        is_completed: z.boolean().optional(),

        blockers_note: z.string().optional(),
        next_focus: z.string().optional(),
      },
    },
    async (args) => {
      try {
        const pb = await getPb()
        // status_signal default: derive client-side too so callers get a fully populated record
        const payload: Record<string, unknown> = { ...args }
        if (!payload.status_signal) {
          const c = args.confidence
          payload.status_signal = c >= 7 ? 'on_track' : c >= 4 ? 'at_risk' : 'off_track'
        }
        const rec = await pb.collection('kr_checkins').create(compactRecord(payload))
        return ok(rec)
      } catch (e) {
        return fail(e)
      }
    },
  )

  server.registerTool(
    'goalops_checkins_update',
    {
      title: 'Update a KR check-in',
      description:
        'Partial update of a check-in. The same type-consistency rules apply if you change a metric field.',
      inputSchema: {
        id: z.string().min(1),
        checkin_date: z.string().optional(),
        checkin_type: CHECKIN_TYPE.optional(),
        confidence: z.number().int().min(1).max(10).optional(),
        status_signal: STATUS_SIGNAL.optional(),
        progress_note: z.string().optional(),
        blockers_note: z.string().optional(),
        next_focus: z.string().optional(),
        current_value: z.number().nullable().optional(),
        progress_percent: z.number().min(0).max(100).nullable().optional(),
        is_completed: z.boolean().optional(),
        author: z.string().optional(),
      },
    },
    async ({ id, ...rest }) => {
      try {
        const pb = await getPb()
        const rec = await pb.collection('kr_checkins').update(id, compactRecord(rest))
        return ok(rec)
      } catch (e) {
        return fail(e)
      }
    },
  )

  server.registerTool(
    'goalops_checkins_delete',
    {
      title: 'Delete a KR check-in',
      description: 'Delete a check-in by id. Does not affect the parent KR.',
      inputSchema: { id: z.string().min(1) },
    },
    async ({ id }) => {
      try {
        const pb = await getPb()
        await pb.collection('kr_checkins').delete(id)
        return ok({ deleted: id })
      } catch (e) {
        return fail(e)
      }
    },
  )
}
