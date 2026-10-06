import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT) || 3000;
const host = '0.0.0.0';

app.use(express.json());

// Health check endpoints for Cloud Run
app.get(['/health', '/healthz', '/_health'], (_req, res) => {
  res.status(200).send('OK');
});

const distPath = path.join(__dirname, 'dist');

// Serve static assets
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));

  // SPA fallback
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  app.get('*', (_req, res) => {
    res.status(503).send('Application is building or dist folder not found.');
  });
}

app.listen(port, host, () => {
  console.log(`Server listening on http://${host}:${port}`);
});
