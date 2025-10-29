import { z } from 'zod';

const countriesQuerySchema = z.object({
  region: z.string().trim().min(1).optional(),
  currency: z.string().trim().min(1).optional(),
  sort: z.enum(['gdp_desc', 'gdp_asc']).optional(),
  limit: z
    .string()
    .transform((v) => (v === undefined ? undefined : Number(v)))
    .pipe(z.number().int().min(1).max(500))
    .optional(),
  offset: z
    .string()
    .transform((v) => (v === undefined ? undefined : Number(v)))
    .pipe(z.number().int().min(0).max(1_000_000_000))
    .optional(),
});

function zodErrorToDetails(err) {
  const details = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.') || 'query';
    details[key] = issue.message;
  }
  return details;
}

export function validateCountriesQuery(req, res, next) {
  try {
    const parsed = countriesQuerySchema.parse(req.query);
    req.validatedQuery = {
      region: parsed.region,
      currency: parsed.currency,
      sort: parsed.sort,
      limit: parsed.limit ?? 250,
      offset: parsed.offset ?? 0,
    };
    return next();
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: zodErrorToDetails(e),
      });
    }
    return res.status(400).json({
      error: 'Validation failed',
      details: { query: 'Invalid query parameters' },
    });
  }
}

const nameParamSchema = z.object({
  name: z.string().trim().min(1, 'is required'),
});

export function validateNameParam(req, res, next) {
  try {
    const parsed = nameParamSchema.parse(req.params);
    req.validatedParams = parsed;
    return next();
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: { name: e.issues[0]?.message || 'is invalid' },
      });
    }
    return res.status(400).json({
      error: 'Validation failed',
      details: { name: 'is invalid' },
    });
  }
}
