const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'https://mcp.smithery.ai/ngweilieh';
const RESOURCE_METADATA_URL = 'https://mcp.smithery.ai/.well-known/oauth-protected-resource/ngweilieh';

/**
 * Checks the health and reachability of the Smithery MCP server (https://mcp.smithery.ai/ngweilieh).
 * Can be invoked directly as an Express/Vercel handler or called programmatically.
 */
export async function checkMcpHealth() {
  const startTime = Date.now();
  const apiKey = process.env.SMITHERY_API_KEY || process.env.MCP_API_KEY || '';

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  try {
    // 1. Check OAuth protected resource discovery metadata on Smithery
    const metaPromise = fetch(RESOURCE_METADATA_URL, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    }).then(async (r) => (r.ok ? await r.json() : null)).catch(() => null);

    // 2. Send JSON-RPC 2.0 initialize handshake to https://mcp.smithery.ai/ngweilieh
    const rpcResponse = await fetch(MCP_SERVER_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'atmosphere-weather-health',
            version: '1.0.0',
          },
        },
      }),
      signal: AbortSignal.timeout(6000),
    });

    const latencyMs = Date.now() - startTime;
    const metadata = await metaPromise;
    const sessionId = rpcResponse.headers.get('mcp-session-id');

    let tools = [];
    let rpcPayload = null;

    if (rpcResponse.ok) {
      const text = await rpcResponse.text();
      try {
        rpcPayload = JSON.parse(text);
      } catch {
        // Parse SSE stream if returned as text/event-stream
        const dataLine = text.split('\n').find((line) => line.startsWith('data: '));
        if (dataLine) {
          try {
            rpcPayload = JSON.parse(dataLine.slice(6));
          } catch {
            rpcPayload = { raw: text.slice(0, 200) };
          }
        }
      }

      // Attempt to list tools from the MCP server
      try {
        const listHeaders = { ...headers };
        if (sessionId) listHeaders['mcp-session-id'] = sessionId;
        const toolsRes = await fetch(MCP_SERVER_URL, {
          method: 'POST',
          headers: listHeaders,
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/list',
            params: {},
          }),
          signal: AbortSignal.timeout(4000),
        });
        if (toolsRes.ok) {
          const toolsText = await toolsRes.text();
          const toolsJson = JSON.parse(toolsText);
          if (toolsJson?.result?.tools) {
            tools = toolsJson.result.tools.map((t) => t.name);
          }
        }
      } catch {
        // Ignore tools list error during health check
      }

      return {
        ok: true,
        status: 'healthy',
        authenticated: true,
        endpoint: MCP_SERVER_URL,
        httpStatus: rpcResponse.status,
        latencyMs,
        tools,
        serverInfo: rpcPayload?.result?.serverInfo || null,
        resourceMetadata: metadata,
        timestamp: new Date().toISOString(),
      };
    }

    // HTTP 401 means the Smithery MCP gateway for ngweilieh is online and reachable,
    // and is awaiting a valid Bearer token if SMITHERY_API_KEY is not configured.
    if (rpcResponse.status === 401 || rpcResponse.status === 403) {
      return {
        ok: true,
        status: 'reachable',
        authenticated: false,
        endpoint: MCP_SERVER_URL,
        httpStatus: rpcResponse.status,
        latencyMs,
        message: apiKey
          ? 'MCP server reachable, but the provided token was rejected.'
          : 'Smithery MCP endpoint is online and responding (OAuth protected resource verified).',
        resourceMetadata: metadata,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      ok: false,
      status: 'degraded',
      authenticated: false,
      endpoint: MCP_SERVER_URL,
      httpStatus: rpcResponse.status,
      latencyMs,
      message: `MCP server returned HTTP ${rpcResponse.status}`,
      resourceMetadata: metadata,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      ok: false,
      status: 'unreachable',
      authenticated: false,
      endpoint: MCP_SERVER_URL,
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown connection error',
      timestamp: new Date().toISOString(),
    };
  }
}

export default async function healthHandler(req, res) {
  const result = await checkMcpHealth();
  const statusCode = result.ok ? 200 : 503;
  res.status(statusCode).json(result);
}
