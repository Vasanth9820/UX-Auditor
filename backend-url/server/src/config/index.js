import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/cicaada-auditor',
  groqApiKey: process.env.GROQ_API_KEY || '',
  groqModel: 'groq/compound-mini',
  outputDir: path.resolve(__dirname, '../../outputs'),
  maxAiIssues: parseInt(process.env.MAX_AI_ISSUES || '50', 10),
  publicUrl: process.env.PUBLIC_URL || 'http://localhost:3001',
};
