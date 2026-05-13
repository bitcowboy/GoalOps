#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { registerObjectiveTools } from './tools/objectives.js'
import { registerTaskTools } from './tools/tasks.js'
import { registerKeyResultTools } from './tools/keyResults.js'
import { registerBlockerTools } from './tools/blockers.js'
import { registerNextActionTools } from './tools/nextActions.js'

async function main(): Promise<void> {
  const server = new McpServer({ name: 'goalops-mcp', version: '0.1.0' })

  registerObjectiveTools(server)
  registerTaskTools(server)
  registerKeyResultTools(server)
  registerBlockerTools(server)
  registerNextActionTools(server)

  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err: unknown) => {
  // stderr is safe for MCP servers; stdout is reserved for JSON-RPC frames.
  const message = err instanceof Error ? err.stack ?? err.message : String(err)
  process.stderr.write(`goalops-mcp failed to start: ${message}\n`)
  process.exit(1)
})
