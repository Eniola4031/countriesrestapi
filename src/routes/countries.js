import { Router } from 'express';
import {
  postRefresh,
  getCountries,
  getCountryByName,
  deleteCountryByName,
  getStatus,
  getSummaryImage,
} from '../controllers/countriesController.js';
import {
  validateCountriesQuery,
  validateNameParam,
} from '../validators/queryValidators.js';

const router = Router();

// Refresh cache (atomic)
router.post('/countries/refresh', postRefresh);

// Serve summary image
router.get('/countries/image', getSummaryImage);

// List countries (filters/sort/pagination validated)
router.get('/countries', validateCountriesQuery, getCountries);

// Single country by name (case-insensitive)
router.get('/countries/:name', validateNameParam, getCountryByName);

// Delete by name (case-insensitive)
router.delete('/countries/:name', validateNameParam, deleteCountryByName);

// Global status
router.get('/status', getStatus);

export default router;
