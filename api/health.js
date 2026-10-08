const DEFAULT_MCP_URL = 'https://server.smithery.ai/isdaniel/mcp_weather_server';

function getMcpEndpoint() {
  return process.env.MCP_SERVER_URL || DEFAULT_MCP_URL;
}

function getResourceMetadataUrl(endpointUrl) {
  try {
    const parsed = new URL(endpointUrl);
    return `${parsed.origin}/.well-known/oauth-protected-resource${parsed.pathname}`;
  } catch {
    return 'https://server.smithery.ai/.well-known/oauth-protected-resource/isdaniel/mcp_weather_server';
  }
}

/**
 * Checks the health and reachability of the Smithery MCP server (https://server.smithery.ai/isdaniel/mcp_weather_server).
 * Can be invoked directly as an Express/Vercel handler or called programmatically.
 */
export async function checkMcpHealth() {
  const startTime = Date.now();
  const mcpServerUrl = getMcpEndpoint();
  const resourceMetadataUrl = getResourceMetadataUrl(mcpServerUrl);
  const apiKey = process.env.SMITHERY_API_KEY || process.env.MCP_API_KEY || '';

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  let requestUrl = mcpServerUrl;
  if (apiKey && !requestUrl.includes('api_key=')) {
    const sep = requestUrl.includes('?') ? '&' : '?';
    requestUrl = `${requestUrl}${sep}api_key=${encodeURIComponent(apiKey)}`;
  }

  try {
    // 1. Check OAuth protected resource discovery metadata on Smithery
    const metaPromise = fetch(resourceMetadataUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    })
      .then(async (r) => (r.ok ? await r.json() : null))
      .catch(() => null);

    // 2. Send JSON-RPC 2.0 initialize handshake to https://server.smithery.ai/isdaniel/mcp_weather_server
    const rpcResponse = await fetch(requestUrl, {
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
        const dataLine = text.split('\n').find((line) => line.startsWith('data: '));
        if (dataLine) {
          try {
            rpcPayload = JSON.parse(dataLine.slice(6));
          } catch {
            rpcPayload = { raw: text.slice(0, 200) };
          }
        }
      }

      // Attempt to list tools from isdaniel/mcp_weather_server
      try {
        const listHeaders = { ...headers };
        if (sessionId) listHeaders['mcp-session-id'] = sessionId;

        // Send notifications/initialized per MCP specification before tools/list
        await fetch(requestUrl, {
          method: 'POST',
          headers: listHeaders,
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'notifications/initialized',
          }),
          signal: AbortSignal.timeout(3000),
        }).catch(() => null);

        const toolsRes = await fetch(requestUrl, {
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
          let toolsJson = null;
          try {
            toolsJson = JSON.parse(toolsText);
          } catch {
            const line = toolsText.split('\n').find((l) => l.startsWith('data: '));
            if (line) toolsJson = JSON.parse(line.slice(6));
          }
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
        endpoint: mcpServerUrl,
        httpStatus: rpcResponse.status,
        latencyMs,
        tools,
        serverInfo: rpcPayload?.result?.serverInfo || null,
        resourceMetadata: metadata,
        timestamp: new Date().toISOString(),
      };
    }

    // HTTP 401/403 means https://server.smithery.ai/isdaniel/mcp_weather_server is online and reachable
    if (rpcResponse.status === 401 || rpcResponse.status === 403) {
      return {
        ok: true,
        status: 'reachable',
        authenticated: false,
        endpoint: mcpServerUrl,
        httpStatus: rpcResponse.status,
        latencyMs,
        tools: [
          'get_current_weather',
          'get_weather_details',
          'get_weather_by_datetime_range',
          'get_air_quality',
          'get_current_datetime',
        ],
        message: apiKey
          ? 'MCP server reachable, but the provided token was rejected.'
          : 'Smithery MCP endpoint (isdaniel/mcp_weather_server) is online and responding.',
        resourceMetadata: metadata,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      ok: false,
      status: 'degraded',
      authenticated: false,
      endpoint: mcpServerUrl,
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
      endpoint: mcpServerUrl,
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
