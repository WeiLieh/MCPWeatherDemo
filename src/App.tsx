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
} from 'lucide-react';

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
  message?: string;
}

const QUICK_CITIES = ['Singapore', 'Tokyo', 'London', 'New York', 'Sydney'];

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
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function App() {
  const [searchInput, setSearchInput] = useState('');
  const [unit, setUnit] = useState<'C' | 'F'>('C');
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [geoLoading, setGeoLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealth(data);
    } catch {
      setHealth({
        ok: false,
        status: 'unreachable',
        authenticated: false,
        endpoint: 'https://mcp.smithery.ai/ngweilieh',
        latencyMs: 0,
      });
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
    <div className="min-h-screen bg-[#F6F8FA] text-slate-900 flex flex-col justify-between selection:bg-sky-500 selection:text-white">
      {/* Top Bar Contract: Zone 1 Brand — Zone 2 Quick Cities — Zone 3 Actions */}
      <header className="sticky top-0 z-30 h-14 bg-white/85 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 flex items-center justify-between">
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

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          {QUICK_CITIES.map((city) => {
            const isCurrent =
              weather?.location.name.toLowerCase() === city.toLowerCase();
            return (
              <button
                key={city}
                type="button"
                onClick={() => fetchWeatherByCity(city)}
                className={`transition-colors whitespace-nowrap py-1 border-b-2 ${
                  isCurrent
                    ? 'border-slate-900 text-slate-900 font-semibold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                {city}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <div
            className="flex items-center bg-slate-100 p-1 rounded-lg"
            role="group"
            aria-label="Temperature Unit"
          >
            <button
              type="button"
              onClick={() => setUnit('C')}
              className={`min-h-[36px] min-w-[38px] px-2.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
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
              className={`min-h-[36px] min-w-[38px] px-2.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                unit === 'F'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              °F
            </button>
          </div>
        </div>
      </header>

      {/* Main Single-Page Responsive Content Container */}
      <main id="top" className="w-full max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-10 flex-1">
        {/* Search & Geolocation Bar */}
        <section aria-label="Search Location" className="mb-6 sm:mb-8">
          <form
            onSubmit={handleSearchSubmit}
            className="flex flex-col sm:flex-row gap-2.5"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search any city or region (e.g., Singapore, Zurich, Seoul)..."
                aria-label="Search city"
                className="w-full min-h-[46px] pl-11 pr-4 py-2.5 bg-white border border-slate-200/90 rounded-2xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition-colors"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 sm:flex-initial min-h-[46px] px-5 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white text-sm font-medium rounded-2xl transition-all whitespace-nowrap cursor-pointer disabled:opacity-60"
              >
                Check Weather
              </button>

              <button
                type="button"
                onClick={handleUseMyLocation}
                disabled={geoLoading || loading}
                title="Use current location"
                className="min-h-[46px] min-w-[46px] px-3.5 py-2.5 bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 text-sm font-medium rounded-2xl flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60"
              >
                <Compass className={`w-4 h-4 ${geoLoading ? 'animate-spin text-sky-600' : ''}`} />
                <span className="sm:inline">Locate</span>
              </button>
            </div>
          </form>

          {/* Mobile Quick City Selector */}
          <div className="flex md:hidden items-center gap-1.5 overflow-x-auto pt-3 pb-1 no-scrollbar">
            {QUICK_CITIES.map((city) => {
              const isCurrent =
                weather?.location.name.toLowerCase() === city.toLowerCase();
              return (
                <button
                  key={city}
                  type="button"
                  onClick={() => fetchWeatherByCity(city)}
                  className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    isCurrent
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200/80 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {city}
                </button>
              );
            })}
          </div>
        </section>

        {/* Error Alert */}
        {error && (
          <div
            role="alert"
            className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200/80 text-red-800 text-sm flex items-center justify-between gap-4"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => fetchWeatherByCity(weather?.location.name || 'Singapore')}
              className="text-xs font-semibold underline whitespace-nowrap min-h-[36px] px-2"
            >
              Retry
            </button>
          </div>
        )}

        {/* Weather Main Display */}
        {loading && !weather ? (
          <div className="bg-white border border-slate-200/80 rounded-3xl p-8 sm:p-12 animate-pulse space-y-6">
            <div className="h-6 w-48 bg-slate-200 rounded-md" />
            <div className="h-20 w-36 bg-slate-200 rounded-xl" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-slate-100">
              <div className="h-14 bg-slate-100 rounded-xl" />
              <div className="h-14 bg-slate-100 rounded-xl" />
              <div className="h-14 bg-slate-100 rounded-xl" />
              <div className="h-14 bg-slate-100 rounded-xl" />
            </div>
          </div>
        ) : (
          weather && (
            <div className="space-y-6">
              {/* Primary Focal Card: Current Conditions */}
              <section
                aria-label="Current Weather"
                className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-10 transition-opacity duration-150"
              >
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        {[weather.location.name, weather.location.admin1, weather.location.country]
                          .filter(Boolean)
                          .join(', ')}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num">
                        {weather.location.latitude}°, {weather.location.longitude}°
                      </span>
                    </div>

                    <h1 className="font-display text-3xl sm:text-4xl text-slate-900 tracking-tight mb-4">
                      {weather.location.name}
                    </h1>

                    <div className="flex items-baseline gap-4">
                      <span className="font-mono-num text-6xl sm:text-7xl font-semibold tracking-tighter text-slate-900">
                        {formatTemp(weather.current.tempC, unit)}°{unit}
                      </span>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 text-base font-semibold text-slate-800">
                          <WeatherConditionIcon
                            icon={weather.current.icon}
                            className="w-5 h-5"
                          />
                          <span>{weather.current.condition}</span>
                        </div>
                        <p className="text-xs text-slate-500 font-mono-num">
                          Feels like {formatTemp(weather.current.feelsLikeC, unit)}°{unit}
                          {weather.daily[0] && (
                            <>
                              {' '}
                              · High {formatTemp(weather.daily[0].tempMaxC, unit)}° / Low{' '}
                              {formatTemp(weather.daily[0].tempMinC, unit)}°
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Key Atmospheric Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 pt-6 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                        <Droplets className="w-3.5 h-3.5 text-sky-500" />
                        <span>Humidity</span>
                      </div>
                      <p className="font-mono-num text-lg font-semibold text-slate-900">
                        {weather.current.humidity}%
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                        <Wind className="w-3.5 h-3.5 text-slate-500" />
                        <span>Wind</span>
                      </div>
                      <p className="font-mono-num text-lg font-semibold text-slate-900">
                        {weather.current.windKmh} km/h
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                        <Sun className="w-3.5 h-3.5 text-amber-500" />
                        <span>UV Index</span>
                      </div>
                      <p className="font-mono-num text-lg font-semibold text-slate-900">
                        {weather.current.uvIndex}
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                        <Gauge className="w-3.5 h-3.5 text-slate-500" />
                        <span>Pressure</span>
                      </div>
                      <p className="font-mono-num text-lg font-semibold text-slate-900">
                        {weather.current.pressureHpa} hPa
                      </p>
                    </div>
                  </div>
                </div>

                {/* If the user's MCP server returned direct tool narrative, display it cleanly */}
                {weather.mcp?.mcpData && (
                  <div className="mt-6 pt-5 border-t border-slate-100 text-xs text-slate-600 leading-relaxed">
                    <span className="font-semibold text-slate-800">
                      MCP Response ({weather.mcp.mcpToolName || 'ngweilieh'}):{' '}
                    </span>
                    <span>{weather.mcp.mcpData}</span>
                  </div>
                )}
              </section>

              {/* Two-Column Secondary Grid: Next Hours + 5-Day Outlook */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Hourly Scroller (7 cols on desktop) */}
                <section
                  aria-label="Hourly Forecast"
                  className="lg:col-span-7 bg-white border border-slate-200/80 rounded-3xl p-6 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-slate-900">
                      Hourly Outlook
                    </h2>
                    <span className="text-xs text-slate-500">
                      Next 8 hours · {weather.location.timezone}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 pt-2">
                    {weather.hourly.map((slot, index) => (
                      <div
                        key={slot.time}
                        className="flex flex-col items-center justify-between py-3 px-1.5 rounded-2xl bg-slate-50/70 text-center"
                      >
                        <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                          {formatHourLabel(slot.time, index)}
                        </span>
                        <div className="my-2.5">
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

                {/* 5-Day Forecast (5 cols on desktop) */}
                <section
                  aria-label="5-Day Forecast"
                  className="lg:col-span-5 bg-white border border-slate-200/80 rounded-3xl p-6"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-slate-900">
                      5-Day Forecast
                    </h2>
                    <span className="text-xs text-slate-500">Daily range</span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {weather.daily.map((day, index) => (
                      <div
                        key={day.date}
                        className="py-2.5 first:pt-1 last:pb-0 flex items-center justify-between gap-3 text-sm"
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

                        <div className="font-mono-num text-xs sm:text-sm flex items-center gap-2 shrink-0">
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
            </div>
          )
        )}
      </main>

      {/* Quiet Footer with live /api/health check action */}
      <footer className="border-t border-slate-200/70 bg-white/60 px-4 sm:px-8 py-4 mt-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-700">MCP Service</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num">https://mcp.smithery.ai/ngweilieh</span>
            {health && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-slate-700">
                  {health.ok
                    ? `Online (${health.latencyMs}ms)`
                    : `Offline (${health.status})`}
                </span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={fetchHealth}
            className="min-h-[36px] inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Check MCP Health (/api/health)</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
