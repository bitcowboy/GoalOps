#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import express, { type Request, type Response } from 'express'

import { registerObjectiveTools } from './tools/objectives.js'
import { registerTaskTools } from './tools/tasks.js'
import { registerKeyResultTools } from './tools/keyResults.js'
import { registerBlockerTools } from './tools/blockers.js'
import { registerNextActionTools } from './tools/nextActions.js'

/**
 * Build a fresh McpServer with all GoalOps tools registered.
 *
 * In HTTP mode we create one server + transport per request (stateless), so
 * this gets called repeatedly. Tool registrations close over the cached PB
 * client from pbClient.ts, so this is cheap.
 */
function buildServer(): McpServer {
  const server = new McpServer({ name: 'goalops-mcp', version: '0.1.0' })
  registerObjectiveTools(server)
  registerTaskTools(server)
  registerKeyResultTools(server)
  registerBlockerTools(server)
  registerNextActionTools(server)
  return server
}

async function runStdio(): Promise<void> {
  const server = buildServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

async function runHttp(): Promise<void> {
  const port = Number(process.env.MCP_HTTP_PORT ?? 8765)
  const host = process.env.MCP_HTTP_HOST ?? '127.0.0.1'

  const app = express()
  // 4 MiB is plenty for tool calls; tighten later if needed.
  app.use(express.json({ limit: '4mb' }))

  // Stateless: spin up a fresh server + transport for every POST. The MCP
  // protocol allows this and it sidesteps any session-state coupling between
  // concurrent team-member requests. We tear both down when the response
  // closes so we don't leak listeners.
  app.post('/mcp', async (req: Request, res: Response) => {
    const server = buildServer()
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    })
    res.on('close', () => {
      void transport.close()
      void server.close()
    })
    try {
      await server.connect(transport)
      await transport.handleRequest(req, res, req.body)
    } catch (err) {
      process.stderr.write(
        `goalops-mcp request failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
      )
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        })
      }
    }
  })

  // Stateless mode doesn't keep server-initiated streams alive, so reject the
  // long-poll GET and the session-delete DELETE with a clear 405.
  const methodNotAllowed = (_req: Request, res: Response) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed in stateless mode.' },
      id: null,
    })
  }
  app.get('/mcp', methodNotAllowed)
  app.delete('/mcp', methodNotAllowed)

  // Caddy / load-balancer health probe.
  app.get('/healthz', (_req, res) => {
    res.status(200).type('text/plain').send('ok')
  })

  await new Promise<void>((resolve) => {
    app.listen(port, host, () => {
      process.stderr.write(`goalops-mcp HTTP listening on ${host}:${port}\n`)
      resolve()
    })
  })
}

async function main(): Promise<void> {
  const mode = (process.env.MCP_TRANSPORT ?? 'stdio').toLowerCase()
  if (mode === 'http') {
    await runHttp()
  } else if (mode === 'stdio') {
    await runStdio()
  } else {
    throw new Error(`Unknown MCP_TRANSPORT=${mode} (expected "stdio" or "http")`)
  }
}

main().catch((err: unknown) => {
  // stderr is safe for MCP servers; stdout is reserved for JSON-RPC frames
  // in stdio mode. In HTTP mode either stream is fine but we keep it
  // consistent.
  const message = err instanceof Error ? err.stack ?? err.message : String(err)
  process.stderr.write(`goalops-mcp failed to start: ${message}\n`)
  process.exit(1)
})
