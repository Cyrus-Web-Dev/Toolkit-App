const path = require('path');
const express = require('express');
const cors = require('cors');
const config = require('./config/config.json');
const historyService = require('./services/historyService');
const quotaService = require('./services/quotaService');

function createServer(opts = {}) {
  historyService.init(opts.dataDir || null);
  quotaService.init(opts.dataDir || null);

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '40mb' }));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, mode: 'local-server', edition: 'public', time: Date.now() });
  });
  app.get('/api/features', (req, res) => res.json(config.features));
  app.get('/api/quota', (req, res) => {
    try {
      res.json({ ok: true, ...quotaService.status() });
    } catch (e) {
      res.status(500).json({ ok: false, message: e.message });
    }
  });

  app.use('/api/pdf', require('./routes/pdf'));
  app.use('/api/bg-remove', require('./routes/bgRemove'));
  app.use('/api/convert', require('./routes/convert'));
  app.use('/api/ai/cover-letter', require('./routes/coverLetter'));
  app.use('/api/ai/cv', require('./routes/cv'));
  app.use('/api/ai/resume', require('./routes/resume'));
  app.use('/api/ai/portfolio', require('./routes/portfolio'));
  app.use('/api/ai/chat', require('./routes/chat'));
  app.use('/api/ai/office', require('./routes/office'));
  app.use('/api/ai/solver', require('./routes/aiSolver'));
  app.use('/api/ai/summarize', require('./routes/aiSummarize'));
  app.use('/api/ai/quiz', require('./routes/aiQuiz'));
  app.use('/api/ai/detect', require('./routes/aiDetect'));
  app.use('/api/ocr', require('./routes/ocr'));
  app.use('/api/image-batch', require('./routes/imageBatch'));
  app.use('/api/qr', require('./routes/qr'));
  app.use('/api/pdf-to-jpg', require('./routes/pdfToJpg'));
  app.use('/api/office-to-pdf', require('./routes/officeToPdf'));
  app.use('/api/history', require('./routes/history'));

  return app;
}

if (require.main === module) {
  const app = createServer();
  const { port, host } = config.server;
  app.listen(port, host, () => {
    console.log(`Toolkit App (public) di http://${host}:${port}`);
    console.log(`Data dir: ${historyService.getDataDir()}`);
  });
}

module.exports = { createServer };
