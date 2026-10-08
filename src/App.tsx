import React, { useEffect, useState, useCallback } from 'react';
import {
  Search,
  MapPin,
  Wind,
  Droplets,
  Sun,
  Moon,
  Cloud,
  CloudSun,
  CloudRain,
  CloudLightning,
  CloudSnow,
  CloudFog,
  RefreshCw,
  Compass,
  Gauge,
  CheckCircle2,
  AlertCircle,
  Server,
  Clock,
  ShieldCheck,
  Wrench,
  QrCode,
  ExternalLink,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface WeatherLocation {
  name: string;
  admin1: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

interface CurrentWeather {
  tempC: number;
  feelsLikeC: number;
  humidity: number;
  windKmh: number;
  windDirection: number;
  pressureHpa: number;
  uvIndex: number;
  precipitationMm: number;
  isDay: boolean;
  condition: string;
  icon: string;
  observedAt: string;
}

interface HourlyForecast {
  time: string;
  tempC: number;
  precipProb: number;
  condition: string;
  icon: string;
}

interface DailyForecast {
  date: string;
  tempMaxC: number;
  tempMinC: number;
  precipProb: number;
  condition: string;
  icon: string;
}

interface WeatherResponse {
  location: WeatherLocation;
  current: CurrentWeather;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
  mcp?: {
    endpoint: string;
    mcpAttempted?: boolean;
    mcpUsed?: boolean;
    mcpToolName?: string;
    mcpData?: string | null;
  };
}

interface HealthResponse {
  ok: boolean;
  status: string;
  authenticated: boolean;
  endpoint: string;
  latencyMs: number;
  httpStatus?: number;
  tools?: string[];
  message?: string;
  error?: string;
  resourceMetadata?: {
    resource?: string;
    authorization_servers?: string[];
    scopes_supported?: string[];
  } | null;
  timestamp?: string;
}

function WeatherConditionIcon({
  icon,
  className = 'w-6 h-6',
}: {
  icon: string;
  className?: string;
}) {
  switch (icon) {
    case 'sun':
      return <Sun className={`${className} text-amber-500`} />;
    case 'moon':
      return <Moon className={`${className} text-indigo-400`} />;
    case 'cloud-sun':
      return <CloudSun className={`${className} text-amber-500`} />;
    case 'rain':
    case 'drizzle':
      return <CloudRain className={`${className} text-sky-500`} />;
    case 'storm':
      return <CloudLightning className={`${className} text-amber-600`} />;
    case 'snow':
      return <CloudSnow className={`${className} text-sky-300`} />;
    case 'fog':
      return <CloudFog className={`${className} text-slate-400`} />;
    default:
      return <Cloud className={`${className} text-slate-500`} />;
  }
}

function formatTemp(tempC: number, unit: 'C' | 'F'): number {
  if (unit === 'F') {
    return Math.round((tempC * 9) / 5 + 32);
  }
  return Math.round(tempC);
}

function formatHourLabel(isoTime: string, index: number): string {
  if (index === 0) return 'Now';
  const parts = isoTime.split('T');
  if (parts.length < 2) return isoTime;
  const hour = parseInt(parts[1].slice(0, 2), 10);
  if (Number.isNaN(hour)) return parts[1].slice(0, 5);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour} ${suffix}`;
}

function formatDayLabel(dateStr: string, index: number): string {
  if (index === 0) return 'Today';
  const date = new Date(`${dateStr}T12:00:00`);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatTimestamp(iso?: string): string {
  if (!iso) return 'Just now';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function App() {
  const [searchInput, setSearchInput] = useState('');
  const [unit, setUnit] = useState<'C' | 'F'>('C');
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [healthLoading, setHealthLoading] = useState<boolean>(false);
  const [geoLoading, setGeoLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealth(data);
    } catch {
      setHealth({
        ok: false,
        status: 'unreachable',
        authenticated: false,
        endpoint: 'https://server.smithery.ai/isdaniel/mcp_weather_server',
        latencyMs: 0,
        error: 'Unable to reach /api/health endpoint.',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const fetchWeatherByCity = useCallback(async (city: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/weather?q=${encodeURIComponent(city)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not load weather for that location.');
      }
      setWeather(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch weather data.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchWeatherByCoords = useCallback(async (lat: number, lon: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not load weather for your coordinates.');
      }
      setWeather(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch weather data.');
    } finally {
      setLoading(false);
      setGeoLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeatherByCity('Singapore');
    fetchHealth();
  }, [fetchWeatherByCity, fetchHealth]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchInput.trim();
    if (!trimmed) return;
    fetchWeatherByCity(trimmed);
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    setGeoLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setGeoLoading(false);
        setError('Location access was denied. Please search by city name.');
      },
      { timeout: 8000 }
    );
  };

  return (
    <div className="min-h-screen bg-[#E9EEF4] text-slate-900 flex flex-col items-center justify-start sm:py-6 selection:bg-sky-500 selection:text-white">
      {/* Mobile Web App Shell (430px max-width mobile viewport canvas) */}
      <div className="w-full max-w-[430px] min-h-screen sm:min-h-[844px] bg-[#F6F8FA] sm:rounded-[36px] sm:shadow-xl sm:border sm:border-slate-200/90 flex flex-col justify-between overflow-hidden">
        {/* Compact Sticky Mobile Top App Bar (56px height) */}
        <header className="sticky top-0 z-30 h-14 bg-white/85 backdrop-blur-md border-b border-slate-200/80 px-4 flex items-center justify-between">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              fetchWeatherByCity('Singapore');
            }}
            className="font-display text-2xl tracking-tight text-slate-900 whitespace-nowrap"
          >
            Atmosphere
          </a>

          <div
            className="flex items-center bg-slate-100 p-1 rounded-xl"
            role="group"
            aria-label="Temperature Unit"
          >
            <button
              type="button"
              onClick={() => setUnit('C')}
              className={`min-h-[36px] min-w-[40px] px-2.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                unit === 'C'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              °C
            </button>
            <button
              type="button"
              onClick={() => setUnit('F')}
              className={`min-h-[36px] min-w-[40px] px-2.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                unit === 'F'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              °F
            </button>
          </div>
        </header>

        {/* Mobile App Scrollable Content */}
        <main id="top" className="w-full px-4 py-4 space-y-4 flex-1">
          {/* Touch-Friendly Search & Geolocation Bar */}
          <section aria-label="Search Location">
            <form onSubmit={handleSearchSubmit} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search city or region..."
                    aria-label="Search city"
                    className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 bg-white border border-slate-200/90 rounded-2xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition-colors"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleUseMyLocation}
                  disabled={geoLoading || loading}
                  title="Use current location"
                  aria-label="Use current location"
                  className="min-h-[46px] min-w-[46px] px-3.5 bg-white hover:bg-slate-50 active:scale-[0.98] border border-slate-200/90 text-slate-700 rounded-2xl flex items-center justify-center transition-all cursor-pointer disabled:opacity-60"
                >
                  <Compass
                    className={`w-4 h-4 ${geoLoading ? 'animate-spin text-sky-600' : ''}`}
                  />
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[46px] px-4 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white text-sm font-medium rounded-2xl transition-all whitespace-nowrap cursor-pointer disabled:opacity-60"
              >
                Check Weather
              </button>
            </form>
          </section>

          {/* Error Alert */}
          {error && (
            <div
              role="alert"
              className="p-3.5 rounded-2xl bg-red-50 border border-red-200/80 text-red-800 text-xs flex items-center justify-between gap-3"
            >
              <span>{error}</span>
              <button
                type="button"
                onClick={() => fetchWeatherByCity(weather?.location.name || 'Singapore')}
                className="text-xs font-semibold underline whitespace-nowrap min-h-[36px] px-2 cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* Weather Main Display */}
          {loading && !weather ? (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 animate-pulse space-y-5">
              <div className="h-5 w-40 bg-slate-200 rounded-md" />
              <div className="h-16 w-32 bg-slate-200 rounded-xl" />
              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                <div className="h-14 bg-slate-100 rounded-xl" />
                <div className="h-14 bg-slate-100 rounded-xl" />
                <div className="h-14 bg-slate-100 rounded-xl" />
                <div className="h-14 bg-slate-100 rounded-xl" />
              </div>
            </div>
          ) : (
            weather && (
              <div className="space-y-4">
                {/* Primary Hero Card: Current Conditions */}
                <section
                  aria-label="Current Weather"
                  className="bg-white border border-slate-200/80 rounded-3xl p-5 transition-opacity duration-150"
                >
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">
                      {[weather.location.name, weather.location.admin1, weather.location.country]
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-num shrink-0">
                      {weather.location.latitude}°, {weather.location.longitude}°
                    </span>
                  </div>

                  <h1 className="font-display text-3xl text-slate-900 tracking-tight mb-3">
                    {weather.location.name}
                  </h1>

                  <div className="flex items-baseline justify-between gap-3 pb-5 border-b border-slate-100">
                    <span className="font-mono-num text-6xl font-semibold tracking-tighter text-slate-900">
                      {formatTemp(weather.current.tempC, unit)}°{unit}
                    </span>

                    <div className="text-right space-y-0.5">
                      <div className="inline-flex items-center justify-end gap-1.5 text-sm font-semibold text-slate-800">
                        <WeatherConditionIcon
                          icon={weather.current.icon}
                          className="w-5 h-5"
                        />
                        <span>{weather.current.condition}</span>
                      </div>
                      <p className="text-xs text-slate-500 font-mono-num">
                        Feels {formatTemp(weather.current.feelsLikeC, unit)}°{unit}
                      </p>
                      {weather.daily[0] && (
                        <p className="text-xs text-slate-500 font-mono-num">
                          H {formatTemp(weather.daily[0].tempMaxC, unit)}° · L{' '}
                          {formatTemp(weather.daily[0].tempMinC, unit)}°
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 2x2 Atmospheric Metric Grid */}
                  <div className="grid grid-cols-2 gap-3 pt-4">
                    <div className="p-3 rounded-2xl bg-slate-50/80">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                        <Droplets className="w-3.5 h-3.5 text-sky-500" />
                        <span>Humidity</span>
                      </div>
                      <p className="font-mono-num text-base font-semibold text-slate-900">
                        {weather.current.humidity}%
                      </p>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50/80">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                        <Wind className="w-3.5 h-3.5 text-slate-500" />
                        <span>Wind Speed</span>
                      </div>
                      <p className="font-mono-num text-base font-semibold text-slate-900">
                        {weather.current.windKmh} km/h
                      </p>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50/80">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                        <Sun className="w-3.5 h-3.5 text-amber-500" />
                        <span>UV Index</span>
                      </div>
                      <p className="font-mono-num text-base font-semibold text-slate-900">
                        {weather.current.uvIndex}
                      </p>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50/80">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                        <Gauge className="w-3.5 h-3.5 text-slate-500" />
                        <span>Pressure</span>
                      </div>
                      <p className="font-mono-num text-base font-semibold text-slate-900">
                        {weather.current.pressureHpa} hPa
                      </p>
                    </div>
                  </div>

                  {/* Direct MCP Tool Narrative if returned */}
                  {weather.mcp?.mcpData && (
                    <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-600 leading-relaxed">
                      <span className="font-semibold text-slate-800">
                        MCP Response ({weather.mcp.mcpToolName || 'get_current_weather'}):{' '}
                      </span>
                      <span>{weather.mcp.mcpData}</span>
                    </div>
                  )}
                </section>

                {/* Horizontal Touch Scroller: Hourly Outlook */}
                <section
                  aria-label="Hourly Forecast"
                  className="bg-white border border-slate-200/80 rounded-3xl p-5"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-slate-900">
                      Hourly Outlook
                    </h2>
                    <span className="text-xs text-slate-500">
                      {weather.location.timezone}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {weather.hourly.map((slot, index) => (
                      <div
                        key={slot.time}
                        className="min-w-[64px] shrink-0 flex flex-col items-center justify-between py-3 px-2 rounded-2xl bg-slate-50/80 text-center"
                      >
                        <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                          {formatHourLabel(slot.time, index)}
                        </span>
                        <div className="my-2">
                          <WeatherConditionIcon icon={slot.icon} className="w-5 h-5" />
                        </div>
                        <span className="font-mono-num text-sm font-semibold text-slate-900">
                          {formatTemp(slot.tempC, unit)}°
                        </span>
                        <span className="font-mono-num text-[11px] text-sky-600 mt-0.5">
                          {slot.precipProb > 0 ? `${slot.precipProb}%` : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* 5-Day Forecast List */}
                <section
                  aria-label="5-Day Forecast"
                  className="bg-white border border-slate-200/80 rounded-3xl p-5"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-sm font-semibold text-slate-900">
                      5-Day Forecast
                    </h2>
                    <span className="text-xs text-slate-500">Low / High</span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {weather.daily.map((day, index) => (
                      <div
                        key={day.date}
                        className="py-2.5 first:pt-1 last:pb-0 flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="w-24 text-slate-700 font-medium truncate">
                          {formatDayLabel(day.date, index)}
                        </span>

                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <WeatherConditionIcon
                            icon={day.icon}
                            className="w-4 h-4 shrink-0"
                          />
                          <span className="text-xs text-slate-500 truncate">
                            {day.condition}
                          </span>
                        </div>

                        <div className="font-mono-num text-xs flex items-center gap-1.5 shrink-0">
                          <span className="text-slate-400">
                            {formatTemp(day.tempMinC, unit)}°
                          </span>
                          <span className="text-slate-300">/</span>
                          <span className="font-semibold text-slate-900">
                            {formatTemp(day.tempMaxC, unit)}°
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )
          )}

          {/* Enhanced Smithery MCP Service Health Inspector Card */}
          <section
            aria-label="MCP Server Health"
            className="bg-white border border-slate-200/80 rounded-3xl p-5 space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-slate-700 shrink-0" />
                  <h2 className="text-sm font-semibold text-slate-900">
                    Smithery MCP Service
                  </h2>
                </div>
                <p className="text-xs text-slate-500 font-mono-num break-all">
                  {health?.endpoint ||
                    'https://server.smithery.ai/isdaniel/mcp_weather_server'}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 text-xs font-semibold">
                {health?.ok ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>
                      {health.status === 'healthy' ? 'Healthy' : 'Reachable'}
                    </span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-red-700">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span>{health?.status || 'Offline'}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Detailed Diagnostics Grid from /api/health.js */}
            <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-100 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50/80 space-y-0.5">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Latency</span>
                </div>
                <p className="font-mono-num text-sm font-semibold text-slate-900">
                  {health ? `${health.latencyMs} ms` : '—'}
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50/80 space-y-0.5">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                  <span>HTTP / Auth</span>
                </div>
                <p className="font-mono-num text-sm font-semibold text-slate-900">
                  {health?.httpStatus ? `HTTP ${health.httpStatus}` : '—'}
                  {' · '}
                  <span className="font-sans font-medium text-xs text-slate-600">
                    {health?.authenticated ? 'Token Valid' : 'OAuth Protected'}
                  </span>
                </p>
              </div>
            </div>

            {/* Status Message & OAuth Discovery Details */}
            {health && (
              <div className="space-y-2.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                {(health.message || health.error) && (
                  <p className="leading-relaxed text-slate-700">
                    {health.message || health.error}
                  </p>
                )}

                {health.resourceMetadata?.authorization_servers &&
                  health.resourceMetadata.authorization_servers.length > 0 && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-slate-400">Authorization Server</span>
                      <span className="font-mono-num text-slate-700 break-all">
                        {health.resourceMetadata.authorization_servers[0]}
                      </span>
                    </div>
                  )}

                {health.tools && health.tools.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Available MCP Weather Tools</span>
                    </div>
                    <p className="font-mono-num text-slate-700 leading-relaxed">
                      {health.tools.join(' · ')}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>Endpoint: /api/health</span>
                  <span className="font-mono-num">
                    Checked {formatTimestamp(health.timestamp)}
                  </span>
                </div>
              </div>
            )}

            {/* Primary Interactive Button to Check MCP Server Health */}
            <button
              type="button"
              onClick={fetchHealth}
              disabled={healthLoading}
              className="w-full min-h-[46px] px-4 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white text-xs font-semibold rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
            >
              <RefreshCw
                className={`w-4 h-4 ${healthLoading ? 'animate-spin' : ''}`}
              />
              <span>
                {healthLoading ? 'Checking MCP Server Health...' : 'Check MCP Server Health'}
              </span>
            </button>
          </section>

          {/* QR Code Section pointing to https://mcp-weather-demo.vercel.app/ */}
          <section
            aria-label="Mobile Demo QR Code"
            className="bg-white border border-slate-200/80 rounded-3xl p-5 flex flex-col items-center text-center space-y-3"
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
              <QrCode className="w-4 h-4 text-slate-600" />
              <span>Scan to Open on Mobile</span>
            </div>

            <div className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
              <QRCodeSVG
                value="https://mcp-weather-demo.vercel.app/"
                size={148}
                level="M"
                bgColor="#ffffff"
                fgColor="#0f172a"
              />
            </div>

            <a
              href="https://mcp-weather-demo.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-mono-num text-slate-600 hover:text-slate-900 underline underline-offset-4 transition-colors"
            >
              <span>https://mcp-weather-demo.vercel.app/</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </section>
        </main>

        {/* Minimal Mobile Footer */}
        <footer className="px-4 py-3 text-center text-[11px] text-slate-400 border-t border-slate-200/60 bg-white/50">
          Atmosphere Mobile · Powered by Smithery MCP
        </footer>
      </div>
    </div>
  );
}
