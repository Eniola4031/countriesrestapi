import axios from 'axios';
import { getDb, runInTransaction } from '../db/index.js';
import { logger } from '../logger.js';
import { randomBetween, safeDivide } from '../utils/math.js';
import { generateSummaryImage } from './imageService.js';

const { EXTERNAL_TIMEOUT_MS = 15000 } = process.env;

const COUNTRIES_API =
  'https://restcountries.com/v2/all?fields=name,capital,region,population,flag,currencies';
const RATES_API = 'https://open.er-api.com/v6/latest/USD';

export async function refreshCountries() {
  logger.info('Starting refresh of country and exchange rate data...');
  const db = getDb();
  const http = axios.create({ timeout: Number(EXTERNAL_TIMEOUT_MS) });

  let countriesData, rateData;
  try {
    const [countriesResp, rateResp] = await Promise.all([
      http.get(COUNTRIES_API),
      http.get(RATES_API),
    ]);
    countriesData = countriesResp.data;
    rateData = rateResp.data;
  } catch (err) {
    const failed = (err?.config?.url || '').includes('restcountries')
      ? 'countries API'
      : 'exchange rates API';
    logger.error({ err }, `Failed to fetch data from ${failed}`);
    const error = new Error(`External data source unavailable: ${failed}`);
    error.status = 503;
    throw error;
  }

  if (!Array.isArray(countriesData) || !rateData?.rates) {
    const error = new Error('Invalid data from external APIs');
    error.status = 503;
    throw error;
  }

  const exchangeRates = rateData.rates;
  const refreshedAt = new Date().toISOString();

  const transformed = [];

  for (const c of countriesData) {
    if (!c?.name || typeof c.population !== 'number') continue;

    const currency = Array.isArray(c.currencies) ? c.currencies[0] : null;
    let currency_code = null;
    let exchange_rate = null;
    let estimated_gdp = null;

    if (!currency || !currency.code) {
      currency_code = null;
      exchange_rate = null;
      estimated_gdp = 0;
    } else {
      currency_code = currency.code;
      exchange_rate = exchangeRates[currency_code] ?? null;
      if (exchange_rate) {
        const multiplier = randomBetween(1000, 2000);
        estimated_gdp = safeDivide(c.population * multiplier, exchange_rate);
      } else {
        estimated_gdp = null;
      }
    }

    transformed.push({
      name: c.name.trim(),
      capital: c.capital ?? null,
      region: c.region ?? null,
      population: c.population,
      currency_code,
      exchange_rate,
      estimated_gdp,
      flag_url: c.flag ?? null,
      last_refreshed_at: refreshedAt,
    });
  }

  logger.info(`Fetched ${transformed.length} countries — writing to database...`);

  runInTransaction((trx) => {
    const upsert = trx.prepare(
      `
      INSERT INTO countries
        (name, capital, region, population, currency_code,
         exchange_rate, estimated_gdp, flag_url, last_refreshed_at)
      VALUES
        (@name, @capital, @region, @population, @currency_code,
         @exchange_rate, @estimated_gdp, @flag_url, @last_refreshed_at)
      ON CONFLICT(LOWER(name))
      DO UPDATE SET
        capital = excluded.capital,
        region = excluded.region,
        population = excluded.population,
        currency_code = excluded.currency_code,
        exchange_rate = excluded.exchange_rate,
        estimated_gdp = excluded.estimated_gdp,
        flag_url = excluded.flag_url,
        last_refreshed_at = excluded.last_refreshed_at;
    `,
    );

    for (const country of transformed) {
      upsert.run(country);
    }

    trx.prepare(`UPDATE refresh_status SET last_refreshed_at = ? WHERE id = 1`).run(refreshedAt);
  });

  logger.info('Database updated. Generating summary image...');
  await generateSummaryImage(transformed, refreshedAt);

  logger.info('Refresh complete.');
  return {
    message: 'Countries refreshed successfully',
    count: transformed.length,
    last_refreshed_at: refreshedAt,
  };
}
