import mongoose from 'mongoose';

const issueSchema = new mongoose.Schema(
  {
    id: String,
    category: { type: String },
    rule: String,
    title: String,
    description: String,
    element: String,
    selector: String,
    originalCode: String,
    fixedCode: String,
    explanation: String,
    severity: { type: String, enum: ['critical', 'serious', 'moderate', 'minor'] },
    priority: { type: String, enum: ['high', 'medium', 'low'] },
    estimatedFixTime: String,
    wcagCriteria: [String],
    heuristic: String,
    screenshot: String,
    metadata: mongoose.Schema.Types.Mixed,
  },
  { _id: false }
);

const auditReportSchema = new mongoose.Schema(
  {
    _id: { type: String },
    url: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed'],
      default: 'pending',
    },
    language: { type: String, default: 'en' },
    languageLabel: { type: String, default: 'English' },
    parentAuditId: { type: String, default: null, index: true },
    detectedLanguages: [mongoose.Schema.Types.Mixed],
    multilingualAudits: mongoose.Schema.Types.Mixed,
    error: String,
    startedAt: Date,
    completedAt: Date,
    duration: Number,
    scores: {
      overall: Number,
      grade: String,
      wcag: Number,
      heuristic: Number,
    },
    pageData: {
      title: String,
      language: String,
      metaDescription: String,
      headings: mongoose.Schema.Types.Mixed,
      links: mongoose.Schema.Types.Mixed,
      buttons: mongoose.Schema.Types.Mixed,
      forms: mongoose.Schema.Types.Mixed,
      htmlLength: Number,
      cssRulesCount: Number,
    },
    assets: {
      desktopScreenshot: String,
      mobileScreenshot: String,
      sectionScreenshots: [mongoose.Schema.Types.Mixed],
      videoPath: String,
      htmlPath: String,
    },
    issues: [issueSchema],
    summary: mongoose.Schema.Types.Mixed,
    progress: {
      stage: String,
      percent: Number,
      message: String,
    },
  },
  { timestamps: true }
);

export const AuditReport = mongoose.model('AuditReport', auditReportSchema);
