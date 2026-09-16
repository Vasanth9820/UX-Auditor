import { Router } from 'express';
import { auditRepository } from '../store/repository.js';
import AuditOrchestrator from '../services/audit/orchestrator.js';

export function createAuditRoutes(io) {
  const router = Router();
  const orchestrator = new AuditOrchestrator(io);

  router.post('/start', async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL is required' });
      }
      const result = await orchestrator.startAudit(url);
      res.status(202).json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/', async (req, res) => {
    try {
      const reports = await auditRepository.find(
        { createdAt: -1 },
        50,
        'url status scores createdAt completedAt progress'
      );
      res.json(reports);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const report = await auditRepository.findById(req.params.id);
      if (!report) return res.status(404).json({ error: 'Report not found' });
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/:id/multilingual', async (req, res) => {
    try {
      const { languages } = req.body;
      if (!Array.isArray(languages) || languages.length === 0) {
        return res.status(400).json({ error: 'languages array is required (e.g. ["hi", "mr", "ta"])' });
      }
      const result = await orchestrator.startMultilingualAudits(req.params.id, languages);
      res.status(202).json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/:id/multilingual', async (req, res) => {
    try {
      const parent = await auditRepository.findById(req.params.id);
      if (!parent) return res.status(404).json({ error: 'Audit not found' });

      // Gather child audits
      const childAudits = {};
      const multilingualMap = parent.multilingualAudits || {};
      for (const [lang, info] of Object.entries(multilingualMap)) {
        if (info?.auditId) {
          const child = await auditRepository.findById(info.auditId);
          if (child) {
            childAudits[lang] = child;
          }
        }
      }

      res.json({
        parent,
        languages: childAudits,
        comparison: {
          en: {
            lang: 'en',
            label: 'English',
            score: parent.scores?.overall,
            grade: parent.scores?.grade,
            wcag: parent.scores?.wcag,
            heuristic: parent.scores?.heuristic,
            totalIssues: parent.issues?.length || 0,
            status: parent.status,
          },
          ...Object.fromEntries(
            Object.entries(childAudits).map(([lang, doc]) => [
              lang,
              {
                lang,
                label: doc.languageLabel || lang.toUpperCase(),
                score: doc.scores?.overall,
                grade: doc.scores?.grade,
                wcag: doc.scores?.wcag,
                heuristic: doc.scores?.heuristic,
                totalIssues: doc.issues?.length || 0,
                status: doc.status,
                progress: doc.progress || null,
              }
            ])
          )
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      await auditRepository.findByIdAndDelete(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
