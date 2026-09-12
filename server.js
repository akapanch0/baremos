import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

// API health endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'BAREMO', version: '5.9.48' });
});

// Servir archivos estáticos
app.use(express.static(__dirname, {
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (
      filePath.endsWith('.html') ||
      filePath.endsWith('.css') ||
      filePath.endsWith('.js') ||
      filePath.endsWith('baremo.json') ||
      filePath.endsWith('version.json') ||
      filePath.endsWith('VERSION')
    ) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// Fallback a index.html solo para solicitudes de navegación HTML (sin extensión de archivo)
app.use((req, res) => {
  const ext = path.extname(req.path);
  if (ext && ext !== '.html') {
    return res.status(404).end();
  }
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`BAREMO server running on http://${HOST}:${PORT}`);
});
