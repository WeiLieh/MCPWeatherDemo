const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'https://mcp.smithery.ai/ngweilieh';

/**
 * Helper to parse either JSON or Server-Sent Events (SSE) JSON-RPC responses from an MCP server.
 */
function parseMcpResponse(text) {
  try {
    return JSON.parse(text);
  } catch {
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          return JSON.parse(line.slice(6));
        } catch {
          // continue looking
        }
      }
    }
    return null;
  }
}

/**
 * Attempts to query weather from the user's Smithery MCP server (https://mcp.smithery.ai/ngweilieh).
 */
async function querySmitheryMcpWeather(city, latitude, longitude) {
  const apiKey = process.env.SMITHERY_API_KEY || process.env.MCP_API_KEY || '';
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const initRes = await fetch(MCP_SERVER_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'atmosphere-weather-client', version: '1.0.0' },
      },
    }),
    signal: AbortSignal.timeout(5000),
  });

  if (!initRes.ok) {
    return {
      mcpAttempted: true,
      mcpStatus: initRes.status,
      mcpUsed: false,
      mcpData: null,
    };
  }

  const sessionId = initRes.headers.get('mcp-session-id');
  const sessionHeaders = { ...headers };
  if (sessionId) {
    sessionHeaders['mcp-session-id'] = sessionId;
  }

  // List available tools on https://mcp.smithery.ai/ngweilieh
  const listRes = await fetch(MCP_SERVER_URL, {
    method: 'POST',
    headers: sessionHeaders,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    }),
    signal: AbortSignal.timeout(5000),
  });

  if (!listRes.ok) {
    return {
      mcpAttempted: true,
      mcpStatus: listRes.status,
      mcpUsed: false,
      mcpData: null,
    };
  }

  const listPayload = parseMcpResponse(await listRes.text());
  const tools = listPayload?.result?.tools || [];

  // Look for a weather or forecast tool exposed by the MCP server
  const weatherTool =
    tools.find((t) => /weather|forecast|temperature|climate|current/i.test(t.name)) ||
    tools[0];

  if (!weatherTool) {
    return {
      mcpAttempted: true,
      mcpStatus: 200,
      mcpUsed: true,
      mcpData: null,
    };
  }

  // Construct versatile arguments covering common MCP weather tool schemas
  const toolArgs = {
    city,
    location: city,
    query: city,
    q: city,
    latitude,
    longitude,
    lat: latitude,
    lon: longitude,
  };

  const callRes = await fetch(MCP_SERVER_URL, {
    method: 'POST',
    headers: sessionHeaders,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: weatherTool.name,
        arguments: toolArgs,
      },
    }),
    signal: AbortSignal.timeout(6000),
  });

  if (!callRes.ok) {
    return {
      mcpAttempted: true,
      mcpStatus: callRes.status,
      mcpUsed: false,
      mcpData: null,
    };
  }

  const callPayload = parseMcpResponse(await callRes.text());
  const contentList = callPayload?.result?.content;
  let mcpText = null;
  if (Array.isArray(contentList) && contentList.length > 0) {
    mcpText = contentList.map((c) => c.text || '').join('\n').trim();
  }

  return {
    mcpAttempted: true,
    mcpStatus: 200,
    mcpUsed: true,
    mcpToolName: weatherTool.name,
    mcpData: mcpText,
  };
}

/**
 * Maps WMO Weather interpretation codes to human-readable labels and condition types.
 */
function mapWeatherCode(code, isDay = 1) {
  const map = {
    0: { label: isDay ? 'Clear Sky' : 'Clear Night', icon: isDay ? 'sun' : 'moon' },
    1: { label: 'Mainly Clear', icon: isDay ? 'sun' : 'moon' },
    2: { label: 'Partly Cloudy', icon: 'cloud-sun' },
    3: { label: 'Overcast', icon: 'cloud' },
    45: { label: 'Foggy', icon: 'fog' },
    48: { label: 'Depositing Rime Fog', icon: 'fog' },
    51: { label: 'Light Drizzle', icon: 'drizzle' },
    53: { label: 'Moderate Drizzle', icon: 'drizzle' },
    55: { label: 'Dense Drizzle', icon: 'drizzle' },
    61: { label: 'Slight Rain', icon: 'rain' },
    63: { label: 'Moderate Rain', icon: 'rain' },
    65: { label: 'Heavy Rain', icon: 'rain' },
    71: { label: 'Slight Snow', icon: 'snow' },
    73: { label: 'Moderate Snow', icon: 'snow' },
    75: { label: 'Heavy Snow', icon: 'snow' },
    80: { label: 'Rain Showers', icon: 'rain' },
    81: { label: 'Moderate Showers', icon: 'rain' },
    82: { label: 'Violent Showers', icon: 'storm' },
    95: { label: 'Thunderstorm', icon: 'storm' },
    96: { label: 'Thunderstorm & Hail', icon: 'storm' },
    99: { label: 'Heavy Thunderstorm', icon: 'storm' },
  };
  return map[code] || { label: 'Variable Conditions', icon: 'cloud' };
}

export default async function weatherHandler(req, res) {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const latParam = req.query.lat ? parseFloat(String(req.query.lat)) : null;
    const lonParam = req.query.lon ? parseFloat(String(req.query.lon)) : null;

    let locationName = 'Singapore';
    let country = 'Singapore';
    let admin1 = '';
    let latitude = 1.2897;
    let longitude = 103.8501;
    let timezone = 'Asia/Singapore';

    if (latParam !== null && lonParam !== null && !Number.isNaN(latParam) && !Number.isNaN(lonParam)) {
      latitude = latParam;
      longitude = lonParam;
      locationName = typeof req.query.name === 'string' && req.query.name ? req.query.name : 'Current Location';
      country = '';
      // Reverse geocode via BigDataCloud free client endpoint or Open-Meteo if needed
      try {
        const revRes = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
          { signal: AbortSignal.timeout(4000) }
        );
        if (revRes.ok) {
          const revData = await revRes.json();
          locationName = revData.city || revData.locality || revData.principalSubdivision || 'Current Location';
          country = revData.countryName || '';
        }
      } catch {
        // Fallback to coordinates title
      }
    } else if (query) {
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
      const geoRes = await fetch(geoUrl, { signal: AbortSignal.timeout(5000) });
      if (!geoRes.ok) {
        return res.status(502).json({ error: 'Unable to reach geocoding service.' });
      }
      const geoData = await geoRes.json();
      if (!geoData.results || geoData.results.length === 0) {
        return res.status(404).json({ error: `Could not find location "${query}". Try another city name.` });
      }
      const match = geoData.results[0];
      locationName = match.name;
      country = match.country || '';
      admin1 = match.admin1 || '';
      latitude = match.latitude;
      longitude = match.longitude;
      timezone = match.timezone || 'auto';
    }

    // Connect to the Smithery MCP server (https://mcp.smithery.ai/ngweilieh) and fetch live meteorological telemetry in parallel
    const [mcpResult, meteoRes] = await Promise.all([
      querySmitheryMcpWeather(locationName, latitude, longitude).catch((err) => ({
        mcpAttempted: true,
        mcpUsed: false,
        mcpError: err instanceof Error ? err.message : 'MCP connection error',
      })),
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure,uv_index&hourly=temperature_2m,weather_code,precipitation_probability,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max&timezone=auto`,
        { signal: AbortSignal.timeout(6000) }
      ),
    ]);

    if (!meteoRes.ok) {
      return res.status(502).json({ error: 'Failed to retrieve meteorological data.' });
    }

    const meteo = await meteoRes.json();
    const current = meteo.current;
    const condition = mapWeatherCode(current.weather_code, current.is_day);

    // Build next 8 hours slice
    const nowIso = current.time; // e.g. "2026-10-08T14:00"
    let startIdx = meteo.hourly.time.findIndex((t) => t >= nowIso);
    if (startIdx === -1) startIdx = 0;

    const hourly = meteo.hourly.time.slice(startIdx, startIdx + 8).map((timeStr, idx) => {
      const i = startIdx + idx;
      const code = meteo.hourly.weather_code[i];
      const isDay = meteo.hourly.is_day ? meteo.hourly.is_day[i] : 1;
      const mapped = mapWeatherCode(code, isDay);
      return {
        time: timeStr,
        tempC: Math.round(meteo.hourly.temperature_2m[i]),
        precipProb: meteo.hourly.precipitation_probability?.[i] ?? 0,
        condition: mapped.label,
        icon: mapped.icon,
      };
    });

    // Build 5-day forecast
    const daily = meteo.daily.time.slice(0, 5).map((dateStr, i) => {
      const code = meteo.daily.weather_code[i];
      const mapped = mapWeatherCode(code, 1);
      return {
        date: dateStr,
        tempMaxC: Math.round(meteo.daily.temperature_2m_max[i]),
        tempMinC: Math.round(meteo.daily.temperature_2m_min[i]),
        precipProb: meteo.daily.precipitation_probability_max?.[i] ?? 0,
        condition: mapped.label,
        icon: mapped.icon,
      };
    });

    res.status(200).json({
      location: {
        name: locationName,
        admin1,
        country,
        latitude: Number(latitude.toFixed(4)),
        longitude: Number(longitude.toFixed(4)),
        timezone: meteo.timezone || timezone,
      },
      current: {
        tempC: Math.round(current.temperature_2m),
        feelsLikeC: Math.round(current.apparent_temperature),
        humidity: Math.round(current.relative_humidity_2m),
        windKmh: Math.round(current.wind_speed_10m),
        windDirection: current.wind_direction_10m,
        pressureHpa: Math.round(current.surface_pressure),
        uvIndex: Number((current.uv_index ?? 0).toFixed(1)),
        precipitationMm: current.precipitation ?? 0,
        isDay: Boolean(current.is_day),
        condition: condition.label,
        icon: condition.icon,
        observedAt: current.time,
      },
      hourly,
      daily,
      mcp: {
        endpoint: MCP_SERVER_URL,
        ...mcpResult,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unexpected server error',
    });
  }
}
