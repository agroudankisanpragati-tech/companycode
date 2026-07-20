/**
 * Weather Agent
 * Domain: Live weather data and farming advisories
 * Data sources: Existing weatherService (WeatherAPI.com)
 * Never communicates directly with the user.
 */

import weatherService from '../services/weatherService';
import { AgentContext, AgentResult } from './types';

export async function runWeatherAgent(ctx: AgentContext): Promise<AgentResult> {
  try {
    const { farmerProfile, pageData } = ctx;

    // If weather data is already on the page, use it
    if (pageData?.weatherData) {
      const w = pageData.weatherData;
      return {
        agent: 'WeatherAgent',
        success: true,
        data: w,
        summary: `Weather at ${w.location}: ${w.condition}, ${w.temp}°C, Humidity: ${w.humidity}%, Rainfall: ${w.rainfall}mm.`,
      };
    }

    // Fetch live weather using farmer's location
    const district = farmerProfile?.district;
    const state = farmerProfile?.state;

    if (!district && !state) {
      return {
        agent: 'WeatherAgent',
        success: true,
        data: {},
        summary: 'Farmer location not set. Ask the farmer to update their profile with district and state.',
      };
    }

    const locationQuery = [district, state, 'India'].filter(Boolean).join(', ');
    const result = await weatherService.fetchWeatherByLocationQuery(locationQuery);
    const current = result.data?.current;

    if (!current) {
      return {
        agent: 'WeatherAgent',
        success: true,
        data: {},
        summary: `Weather data unavailable for ${locationQuery}.`,
      };
    }

    const weatherData = {
      location: result.location?.displayName || locationQuery,
      condition: (current.weather as any)?.text || 'N/A',
      temp: current.temp,
      humidity: current.humidity,
      windKph: current.wind_kph,
      forecast: (result.data?.daily || []).slice(0, 3).map((d: any) => ({
        date: d.dt,
        maxTemp: d.temp?.max,
        minTemp: d.temp?.min,
        condition: d.weather?.text,
        rainChance: Math.round((d.pop || 0) * 100),
      })),
    };

    return {
      agent: 'WeatherAgent',
      success: true,
      data: weatherData,
      summary: `Weather at ${weatherData.location}: ${weatherData.condition}, ${weatherData.temp?.toFixed(1)}°C, Humidity: ${weatherData.humidity}%, Wind: ${weatherData.windKph} km/h.`,
    };
  } catch (err: any) {
    return {
      agent: 'WeatherAgent',
      success: false,
      error: 'Weather information is temporarily unavailable.',
    };
  }
}
