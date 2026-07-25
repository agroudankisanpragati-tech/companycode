/**
 * Market Agent
 * Domain: Mandi prices, commodity rates, selling advice
 *
 * Fix 7 — Preferred data flow:
 *   1. pageData (already on screen — fastest)
 *   2. Live Mandi API (data.gov.in / Agmarknet)
 *   3. MarketPriceHistory MongoDB cache
 *   4. MarketplaceListing MongoDB
 *   5. Helpful fallback (never empty-handed)
 *
 * Fix 2: reads commodity from ctx.entities — supports Hindi/Marwari crop names
 *        Generic queries ("mandi", "bhav", "price") work without a crop name
 */

import { MarketplaceListing } from '../models/Marketplace';
import { MarketPriceHistory } from '../models/MarketPriceHistory';
import { AgentContext, AgentResult } from './types';
import { buildFallbackResult, buildErrorResult } from '../services/fallbackManager';
import { createLogger } from '../utils/logger';
import { createSafeRegex } from '../utils/regex';

const log = createLogger('marketAgent');

// ─── Live Mandi API config ────────────────────────────────────────────────────

const MANDI_API_URL     = process.env.MANDI_API_URL || '';
const MANDI_API_KEY     = process.env.MANDI_API_KEY || '';
const MANDI_API_TIMEOUT = parseInt(process.env.MANDI_API_TIMEOUT_MS || '5000', 10);

// ─── Live API fetch ───────────────────────────────────────────────────────────

interface MandiApiRecord {
  Commodity?: string;
  Market?: string;
  State?: string;
  District?: string;
  Arrival_Date?: string;
  Modal_Price?: string | number;
  Min_Price?: string | number;
  Max_Price?: string | number;
  modal_price?: string | number;
  min_price?: string | number;
  max_price?: string | number;
  arrival_date?: string;
  commodity?: string;
  market?: string;
  state?: string;
  district?:   string;
}

async function fetchLiveMandiPrice(
  commodity: string,
  state:     string,
  district?: string,
): Promise<MandiApiRecord | null> {
  if (!MANDI_API_URL || !MANDI_API_KEY) return null;

  try {
    const params = new URLSearchParams({
      'api-key': MANDI_API_KEY,
      format:    'json',
      limit:     '50',
      'sort[Arrival_Date]': 'desc',
    });
    if (commodity) params.set('filters[Commodity]', commodity);
    if (state)     params.set('filters[State]', state);
    if (district)  params.set('filters[District]', district);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), MANDI_API_TIMEOUT);

    const res = await fetch(`${MANDI_API_URL}?${params.toString()}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return null;

    const data = await res.json() as { records?: MandiApiRecord[] };
    return data.records?.[0] || null;
  } catch (err: any) {
    log.debug('Live Mandi API unavailable', { error: err?.message });
    return null;
  }
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export async function runMarketAgent(ctx: AgentContext): Promise<AgentResult> {
  try {
    const { pageData, farmerProfile, entities, shared } = ctx;

    // Fix 2: use pre-extracted commodity (supports Hindi/Marwari names via entityExtractor)
    const commodity = entities?.commodity || entities?.crop || shared?.activeCrops?.[0]?.cropName || pageData?.marketData?.commodity || '';
    const state     = entities?.state || farmerProfile?.state || shared?.farmerProfile?.state || pageData?.marketData?.state || '';
    const district  = entities?.district || farmerProfile?.district || shared?.farmerProfile?.district || pageData?.marketData?.district || '';

    log.debug('MarketAgent running', { commodity, state, district });

    // Step 2: Live Mandi API
    const liveRecord = await fetchLiveMandiPrice(commodity, state, district);
    if (liveRecord) {
      const commodityName = String(liveRecord.Commodity || liveRecord.commodity || commodity || 'Unknown');
      const marketName = String(liveRecord.Market || liveRecord.market || 'Unknown');
      const stateName = String(liveRecord.State || liveRecord.state || state || 'Unknown');
      const districtName = String(liveRecord.District || liveRecord.district || district || '');
      const modalPrice = Number(liveRecord.Modal_Price ?? liveRecord.modal_price ?? 0);
      const minPrice = Number(liveRecord.Min_Price ?? liveRecord.min_price ?? 0);
      const maxPrice = Number(liveRecord.Max_Price ?? liveRecord.max_price ?? 0);
      const arrivalDate = String(liveRecord.Arrival_Date || liveRecord.arrival_date || '');

      return {
        agent:   'MarketAgent',
        success: true,
        data: {
          commodity:   commodityName,
          market:      marketName,
          district:    districtName,
          state:       stateName,
          modalPrice,
          minPrice,
          maxPrice,
          arrivalDate,
          source:      'live_api',
        },
        summary: `${commodityName} at ${marketName}${districtName ? `, ${districtName}` : ''} (${stateName}): Modal ₹${modalPrice}/quintal, Min ₹${minPrice}, Max ₹${maxPrice}${arrivalDate ? ` as of ${arrivalDate}` : ''} [Live].`,
      };
    }

    // Step 3: MarketPriceHistory MongoDB cache
    const filter: any = {};
    if (commodity) filter.commodity = createSafeRegex(commodity);
    if (state)     filter.state     = createSafeRegex(state);
    if (district)  filter.district   = createSafeRegex(district);

    const priceRecord = await MarketPriceHistory.findOne(filter)
      .sort({ date: -1, arrivalDate: -1, createdAt: -1 })
      .lean();

    if (priceRecord) {
      const p = priceRecord as any;
      return {
        agent:   'MarketAgent',
        success: true,
        data: {
          commodity:   p.commodity,
          market:      p.market,
          district:    p.district,
          state:       p.state,
          modalPrice:  p.modalPrice,
          minPrice:    p.minPrice,
          maxPrice:    p.maxPrice,
          arrivalDate: p.arrivalDate || p.date,
          source:      'db_cache',
        },
        summary: `${p.commodity} at ${p.market}${p.district ? `, ${p.district}` : ''} (${p.state}): Modal ₹${p.modalPrice}/quintal, Min ₹${p.minPrice}, Max ₹${p.maxPrice}${p.arrivalDate || p.date ? ` as of ${p.arrivalDate || p.date}` : ''}.`,
      };
    }

    // Step 4: Marketplace listings
    const listingFilter: any = {};
    if (commodity) listingFilter.cropName = createSafeRegex(commodity);

    const listing = await MarketplaceListing.findOne(listingFilter)
      .sort({ createdAt: -1 })
      .lean();

    if (listing) {
      const l = listing as any;
      return {
        agent:   'MarketAgent',
        success: true,
        data: {
          commodity: l.cropName,
          price:     l.price,
          unit:      l.unit,
          location:  l.location,
          source:    'marketplace',
        },
        summary: `${l.cropName} listed at ₹${l.price}/${l.unit} in ${l.location?.district || 'N/A'}.`,
      };
    }

    // Step 5: Helpful fallback — never return empty-handed
    const hint = commodity
      ? `No price data found for ${commodity}. `
      : 'No mandi price data found. ';

    return buildFallbackResult('MarketAgent', 'market', hint);
  } catch (err: any) {
    log.error('MarketAgent error', { error: err?.message });
    return buildErrorResult('MarketAgent', 'market', err);
  }
}
