import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase, pool } from './db';
import { templatesRouter } from './routes/templates';
import { documentsRouter } from './routes/documents';

dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || '5000', 10);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health Check endpoint
app.get('/api/v1/health', async (req: Request, res: Response) => {
  let dbStatus = 'disconnected';
  try {
    const [result] = await pool.query('SELECT 1 as val');
    if (result) {
      dbStatus = 'connected';
    }
  } catch (err: any) {
    dbStatus = `error: ${err.message}`;
  }

  res.json({
    status: 'ok',
    service: 'documentation-platform-backend',
    database: dbStatus,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Mount routes
app.use('/api/v1/templates', templatesRouter);
app.use('/api/v1/documents', documentsRouter);

// Root fallback
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'DocForge Backend Service API',
    endpoints: {
      health: '/api/v1/health',
      templates: '/api/v1/templates',
      documents: '/api/v1/documents',
    },
  });
});

async function startServer() {
  await initDatabase();
  app.listen(port, '0.0.0.0', () => {
    console.log(`[DocForge Backend] Server is running on port ${port}`);
    console.log(`[DocForge Backend] Health check available at http://localhost:${port}/api/v1/health`);
  });
}

startServer().catch((err) => {
  console.error('[DocForge Backend] Fatal startup error:', err);
});
