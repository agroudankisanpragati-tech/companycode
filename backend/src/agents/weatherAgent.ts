/**
 * Weather Agent
 * Fix M4: correct WeatherAPI field — condition.text not weather.text
 * Fix 9: structured logger
 */

import weatherService from '../services/weatherService';
import { AgentContext, AgentResult } from './types';
import { buildFallbackResult, buildErrorResult } from '../services/fallbackManager';
import { createLogger } from '../utils/logger';

const log = createLogger('weatherAgent');

export async function runWeatherAgent(ctx: AgentContext): Promise<AgentResult> {
  try {
    const { farmerProfile, pageData, entities } = ctx;

    if (pageData?.weatherData) {
      const w = pageData.weatherData;
      return {
        agent: 'WeatherAgent', success: true, data: w,
        summary: `Weather at ${w.location}: ${w.condition}, ${w.temp}°C, Humidity: ${w.humidity}%, Rainfall: ${w.rainfall}mm.`,
      };
    }

    const district = entities?.district || farmerProfile?.district;
    const state    = entities?.state    || farmerProfile?.state;

    if (!district && !state) {
      return buildFallbackResult('WeatherAgent', 'weather', 'Farmer location not set. Ask the farmer to update their profile with district and state.');
    }

    const locationQuery = [district, state, 'India'].filter(Boolean).join(', ');
    log.debug('WeatherAgent fetching', { locationQuery });

    const result  = await weatherService.fetchWeatherByLocationQuery(locationQuery);
    const current = result.data?.current;

    if (!current) {
      return buildFallbackResult('WeatherAgent', 'weather', `Weather data unavailable for ${locationQuery}.`);
    }

    // Fix M4: WeatherAPI returns condition.text (normalised as weather.text in weatherService)
    const conditionText = (current.weather as any)?.text || 'N/A';

    const weatherData = {
      location:  result.location?.displayName || locationQuery,
      condition: conditionText,
      temp:      current.temp,
      humidity:  current.humidity,
      windKph:   current.wind_kph,
      forecast:  (result.data?.daily || []).slice(0, 3).map((d: any) => ({
        date:       d.dt,
        maxTemp:    d.temp?.max,
        minTemp:    d.temp?.min,
        condition:  d.weather?.text,
        rainChance: Math.round((d.pop || 0) * 100),
      })),
    };

    return {
      agent: 'WeatherAgent', success: true, data: weatherData,
      summary: `Weather at ${weatherData.location}: ${weatherData.condition}, ${weatherData.temp?.toFixed(1)}°C, Humidity: ${weatherData.humidity}%, Wind: ${weatherData.windKph} km/h.`,
    };
  } catch (err: any) {
    log.error('WeatherAgent error', { error: err?.message });
    return buildErrorResult('WeatherAgent', 'weather', err);
  }
}
