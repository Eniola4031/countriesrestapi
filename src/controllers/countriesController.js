import { getDb } from '../db/index.js';
import { logger } from '../logger.js';
import { refreshCountries as runRefresh } from '../services/refreshService.js';
import { getSummaryImageBuffer } from '../services/imageService.js';

export async function postRefresh(req, res) {
  try {
    const result = await runRefresh();
    return res.json(result);
  } catch (err) {
    if (err?.status === 503) {
      return res.status(503).json({
        error: 'External data source unavailable',
        details:
          err.message?.replace(/^External data source unavailable:\s*/i, '') ||
          'Could not fetch data from external API',
      });
    }
    logger.error({ err }, 'Unexpected error during refresh');
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export function getCountries(req, res) {
  const db = getDb();
  const { region, currency, sort, limit, offset } = req.validatedQuery;

  let sql = `
    SELECT id, name, capital, region, population, currency_code,
           exchange_rate, estimated_gdp, flag_url, last_refreshed_at
    FROM countries
  `;
  const where = [];
  const params = {};

  if (region) {
    where.push('LOWER(region) = LOWER(@region)');
    params.region = region;
  }
  if (currency) {
    where.push('LOWER(currency_code) = LOWER(@currency)');
    params.currency = currency;
  }
  if (where.length) {
    sql += ' WHERE ' + where.join(' AND ');
  }

  if (sort === 'gdp_desc') sql += ' ORDER BY estimated_gdp DESC NULLS LAST';
  else if (sort === 'gdp_asc') sql += ' ORDER BY estimated_gdp ASC NULLS LAST';

  sql += ' LIMIT @limit OFFSET @offset';
  params.limit = limit;
  params.offset = offset;

  try {
    const stmt = db.prepare(sql);
    const rows = stmt.all(params);
    return res.json(rows);
  } catch (err) {
    logger.error({ err, sql, params }, 'Failed to query countries');
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export function getCountryByName(req, res) {
  const db = getDb();
  const { name } = req.validatedParams;

  try {
    const row = db
      .prepare(
        `SELECT id, name, capital, region, population, currency_code,
                exchange_rate, estimated_gdp, flag_url, last_refreshed_at
         FROM countries
         WHERE LOWER(name) = LOWER(?)
         LIMIT 1`,
      )
      .get(name);

    if (!row) return res.status(404).json({ error: 'Country not found' });
    return res.json(row);
  } catch (err) {
    logger.error({ err, name }, 'Failed to get country by name');
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export function deleteCountryByName(req, res) {
  const db = getDb();
  const { name } = req.validatedParams;

  try {
    const info = db.prepare(`DELETE FROM countries WHERE LOWER(name) = LOWER(?)`).run(name);

    if (info.changes === 0) {
      return res.status(404).json({ error: 'Country not found' });
    }
    return res.json({ message: `${name} deleted successfully` });
  } catch (err) {
    logger.error({ err, name }, 'Failed to delete country by name');
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export function getStatus(req, res) {
  const db = getDb();

  try {
    const totalRow = db.prepare(`SELECT COUNT(*) AS total FROM countries`).get();
    const statusRow = db.prepare(`SELECT last_refreshed_at FROM refresh_status WHERE id = 1`).get();

    return res.json({
      total_countries: totalRow?.total ?? 0,
      last_refreshed_at: statusRow?.last_refreshed_at || null,
    });
  } catch (err) {
    logger.error({ err }, 'Failed to get status');
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export function getSummaryImage(req, res) {
  try {
    const buf = getSummaryImageBuffer();
    if (!buf) {
      return res.status(404).json({ error: 'Summary image not found' });
    }
    res.setHeader('Content-Type', 'image/png');
    return res.send(buf);
  } catch (err) {
    logger.error({ err }, 'Failed to serve summary image');
    return res.status(500).json({ error: 'Internal server error' });
  }
}
