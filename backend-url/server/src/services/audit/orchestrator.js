import { v4 as uuidv4 } from 'uuid';
import { auditRepository } from '../../store/repository.js';
import PlaywrightAuditor from '../playwright/auditor.js';
import { captureIssueScreenshots, verifyScreenshotExists } from '../playwright/issueScreenshots.js';
import { runWcagChecks, runWcagPageChecks } from '../checks/wcag/index.js';
import { runHeuristicChecks } from '../checks/heuristics/index.js';
import { runMultilingualChecks } from '../checks/multilingual/languageChecks.js';
import { TARGET_LANGUAGES } from '../multilingual/languageDetector.js';
import AiRecommendationService from '../ai/recommendations.js';
import { calculateScores, buildSummary } from '../scoring/index.js';
import ReportGenerator from '../reporting/generator.js';

/**
 * Orchestrates the full audit pipeline.
 */
export class AuditOrchestrator {
  constructor(io) {
    this.io = io;
  }

  async startAudit(url, existingId = null, languageConfig = null) {
    const auditId = existingId || uuidv4();
    const normalizedUrl = this.normalizeUrl(url);

    let report = await auditRepository.findById(auditId);
    if (!report) {
      report = await auditRepository.create({
        _id: auditId,
        url: normalizedUrl,
        status: 'running',
        language: languageConfig?.lang || 'en',
        languageLabel: languageConfig?.label || 'English',
        parentAuditId: languageConfig?.parentAuditId || null,
        startedAt: new Date(),
        progress: { stage: 'init', percent: 0, message: 'Starting audit...' },
      });
    } else {
      await auditRepository.findByIdAndUpdate(auditId, {
        status: 'running',
        startedAt: new Date(),
        language: languageConfig?.lang || report.language || 'en',
        languageLabel: languageConfig?.label || report.languageLabel || 'English',
        parentAuditId: languageConfig?.parentAuditId || report.parentAuditId || null,
      });
    }

    this.emitProgress(auditId, 'init', 0, `Audit queued for ${languageConfig?.label || 'English'}...`);
    this.runPipeline(auditId, normalizedUrl, languageConfig).catch(async (err) => {
      console.error(`Audit ${auditId} failed:`, err);
      this.io.to(auditId).emit('audit:error', { error: err.message || 'Audit failed' });
      await auditRepository.findByIdAndUpdate(auditId, { status: 'failed' }).catch(() => {});
    });

    return { auditId, url: normalizedUrl, language: languageConfig?.lang || 'en' };
  }

  /**
   * Start audits for multiple languages linked to a parent English audit.
   */
  async startMultilingualAudits(parentAuditId, selectedLanguages) {
    const parentReport = await auditRepository.findById(parentAuditId);
    if (!parentReport) {
      throw new Error(`Parent audit ${parentAuditId} not found`);
    }

    const detected = parentReport.pageData?.detectedLanguages || parentReport.detectedLanguages || [];
    const started = {};

    for (const langCode of selectedLanguages) {
      // Find matching detection config or fallback to target language default
      const matched = detected.find(d => d.lang === langCode);
      const targetLangDef = TARGET_LANGUAGES.find(t => t.lang === langCode);

      if (!matched) {
        throw new Error(`Language ${langCode} was not detected on the audited website`);
      }

      const languageConfig = {
        lang: langCode,
        label: matched?.label || targetLangDef?.label || langCode.toUpperCase(),
        nativeName: matched?.nativeName || targetLangDef?.nativeName || langCode,
        switchMethod: matched.switchMethod,
        targetUrl: matched.targetUrl,
        selector: matched?.selector,
        value: matched?.value,
        parentAuditId,
      };

      const childAuditId = `${parentAuditId}-${langCode}`;
      await this.startAudit(parentReport.url, childAuditId, languageConfig);

      started[langCode] = {
        auditId: childAuditId,
        label: languageConfig.label,
        nativeName: languageConfig.nativeName,
      };
    }

    // Record children in parent's multilingualAudits map
    const existingChildren = parentReport.multilingualAudits || {};
    await auditRepository.findByIdAndUpdate(parentAuditId, {
      multilingualAudits: { ...existingChildren, ...started },
    });

    return { parentAuditId, started };
  }

  async runPipeline(auditId, url, languageConfig = null) {
    const emit = (stage, percent, message) => this.emitProgress(auditId, stage, percent, message);

    let session = null;

    try {
      const playwright = new PlaywrightAuditor(auditId, (p) => emit(p.stage, p.percent, p.message));
      session = await playwright.run(url, languageConfig);
      const { page, pageData, assets, html } = session;

      emit('checks', 52, 'Running WCAG accessibility checks...');
      const wcagStatic = runWcagChecks(pageData, html);
      const wcagLive = await runWcagPageChecks(page);

      emit('checks', 58, 'Running Nielsen UX heuristic checks...');
      const heuristicIssues = runHeuristicChecks(pageData, url);

      let multilingualIssues = [];
      if (languageConfig?.lang && languageConfig.lang !== 'en') {
        emit('checks', 64, `Running ${languageConfig.label || languageConfig.lang} localization and UX checks...`);
        multilingualIssues = await runMultilingualChecks(page, pageData, html, languageConfig.lang);
      }

      const rawIssues = [...wcagStatic, ...wcagLive, ...heuristicIssues, ...multilingualIssues].map((issue, i) => ({
        ...issue,
        id: issue.id || `issue-${i}`,
      }));

      emit('screenshots', 70, 'Capturing vulnerability screenshots with highlights...');
      let issuesWithScreenshots = await captureIssueScreenshots(
        page,
        rawIssues,
        auditId,
        (p) => emit(p.stage, p.percent, p.message)
      );

      emit('ai', 80, 'Generating AI-powered recommendations...');
      const ai = new AiRecommendationService((p) => emit(p.stage, p.percent, p.message));
      let enrichedIssues = await ai.enrichIssues(issuesWithScreenshots, {
        url,
        title: pageData.title,
        language: languageConfig?.lang || 'en',
        languageLabel: languageConfig?.label || 'English',
      });

      // Ensure every issue retains a valid screenshot path
      enrichedIssues = enrichedIssues.map((issue, i) => ({
        ...issue,
        screenshot: issue.screenshot || issuesWithScreenshots[i]?.screenshot || null,
      }));

      // Retry capture for any issues still missing screenshots (same page session)
      const missing = enrichedIssues.filter((i) => !i.screenshot || !verifyScreenshotExists(i.screenshot));
      if (missing.length > 0) {
        emit('screenshots', 78, `Retrying ${missing.length} missing vulnerability screenshots...`);
        const retried = await captureIssueScreenshots(page, missing, auditId);
        const retriedMap = new Map(retried.map((r) => [r.id, r.screenshot]));
        enrichedIssues = enrichedIssues.map((issue) => ({
          ...issue,
          screenshot: retriedMap.get(issue.id) || issue.screenshot,
        }));
      }

      await session.finalize();
      session = null;

      const withScreenshots = enrichedIssues.filter((i) => i.screenshot).length;
      console.log(`Audit ${auditId}: ${withScreenshots}/${enrichedIssues.length} issues have screenshots`);

      emit('scoring', 92, 'Calculating scores...');
      const scores = calculateScores(enrichedIssues);
      const summary = buildSummary(enrichedIssues, scores);

      emit('report', 95, 'Generating downloadable report...');
      const reportGen = new ReportGenerator(auditId);
      const reportFiles = await reportGen.generate({
        url,
        scores,
        issues: enrichedIssues,
        assets,
        completedAt: new Date(),
      });

      const completedAt = new Date();
      const startedAt = (await auditRepository.findById(auditId))?.startedAt || completedAt;

      const detectedLanguages = pageData.detectedLanguages || [];

      await auditRepository.findByIdAndUpdate(auditId, {
        status: 'completed',
        completedAt,
        duration: completedAt - startedAt,
        scores,
        language: languageConfig?.lang || 'en',
        languageLabel: languageConfig?.label || 'English',
        parentAuditId: languageConfig?.parentAuditId || null,
        detectedLanguages,
        pageData: {
          title: pageData.title,
          language: pageData.language,
          metaDescription: pageData.metaDescription,
          headings: pageData.headings,
          links: pageData.links?.length,
          buttons: pageData.buttons?.length,
          forms: pageData.forms,
          htmlLength: pageData.htmlLength,
          cssRulesCount: pageData.cssRulesCount,
          detectedLanguages,
        },
        assets: {
          ...assets,
          reportJson: reportFiles.jsonPath,
          reportHtml: reportFiles.htmlPath,
        },
        issues: enrichedIssues,
        summary,
        progress: { stage: 'complete', percent: 100, message: 'Audit complete!' },
      });

      // If child audit, update the parent audit record
      if (languageConfig?.parentAuditId) {
        const parent = await auditRepository.findById(languageConfig.parentAuditId);
        if (parent) {
          const existing = parent.multilingualAudits || {};
          existing[languageConfig.lang] = {
            auditId,
            label: languageConfig.label,
            nativeName: languageConfig.nativeName,
            status: 'completed',
            score: scores.overall,
            grade: scores.grade,
            totalIssues: enrichedIssues.length,
          };
          await auditRepository.findByIdAndUpdate(languageConfig.parentAuditId, {
            multilingualAudits: existing,
          });
          this.io?.to(languageConfig.parentAuditId).emit('audit:multilingual_updated', {
            parentAuditId: languageConfig.parentAuditId,
            multilingualAudits: existing,
          });
        }
      }

      emit('complete', 100, 'Audit complete!');
      this.io?.to(auditId).emit('audit:complete', { auditId, language: languageConfig?.lang || 'en' });

      if (detectedLanguages.length > 0) {
        this.io?.to(auditId).emit('audit:languages_detected', {
          auditId,
          detectedLanguages,
        });
      }
    } catch (error) {
      if (session?.finalize) await session.finalize().catch(() => {});
      await auditRepository.findByIdAndUpdate(auditId, {
        status: 'failed',
        error: error.message,
        progress: { stage: 'error', percent: 0, message: error.message },
      });
      this.io?.to(auditId).emit('audit:error', { auditId, error: error.message });
    }
  }

  emitProgress(auditId, stage, percent, message) {
    const progress = { stage, percent, message };
    auditRepository.findByIdAndUpdate(auditId, { progress }).catch(() => {});
    this.io?.to(auditId).emit('audit:progress', { auditId, progress });
  }

  normalizeUrl(url) {
    let u = url.trim();
    if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
    return u;
  }
}

export default AuditOrchestrator;
