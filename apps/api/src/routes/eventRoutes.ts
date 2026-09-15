import { Router } from 'express';

import { ingestEvent } from '../controllers/eventController';
import { requireIngestionAuth } from '../middleware/ingestionAuth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.post('/', requireIngestionAuth, asyncHandler(ingestEvent));

export default router;
