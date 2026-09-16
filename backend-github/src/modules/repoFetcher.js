import axios from 'axios';

const ALLOWED_EXTENSIONS = new Set(['html', 'css', 'scss', 'jsx', 'tsx', 'js', 'ts', 'vue']);
const SKIP_PATTERNS = [
  /node_modules/i,
  /\.git/i,
  /\/dist\//i,
  /\/build\//i,
  /\.next/i,
  /^dist\//i,
  /^build\//i,
];

function parseRepoUrl(repoUrl) {
  const cleaned = repoUrl.trim().replace(/\.git$/, '').replace(/\/$/, '');
  const match = cleaned.match(/github\.com[/:]([^/]+)\/([^/]+)/i);
  if (!match) {
    throw new Error('Invalid GitHub repository URL');
  }
  return { owner: match[1], repo: match[2] };
}

function shouldSkipPath(path) {
  return SKIP_PATTERNS.some((pattern) => pattern.test(path));
}

function getExtension(path) {
  const parts = path.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function githubRequest(url, token, retries = 5) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await axios.get(url, { headers });
      return response.data;
    } catch (err) {
      const status = err.response?.status;
      if (status === 401) {
        throw new Error(
          'GitHub authentication failed (401 Unauthorized): Your connected GitHub Personal Access Token is invalid or expired (Bad credentials). Please reconnect or generate a new GitHub token.'
        );
      }
      if (status === 429 && attempt < retries) {
        const retryAfter = parseInt(err.response?.headers?.['retry-after'] || '5', 10);
        await sleep(retryAfter * 1000);
        continue;
      }
      if (status === 403 && err.response?.headers?.['x-ratelimit-remaining'] === '0') {
        const reset = parseInt(err.response?.headers?.['x-ratelimit-reset'] || '0', 10);
        const waitMs = Math.max((reset - Math.floor(Date.now() / 1000)) * 1000, 0);
        if (waitMs <= 10000 && attempt < retries) {
          await sleep(waitMs + 1000);
          continue;
        }
        const waitMins = Math.ceil(waitMs / 60000);
        throw new Error(
          `GitHub API rate limit exceeded (resets in ~${waitMins} min). Please connect a valid GitHub Personal Access Token in the dashboard to increase your limit to 5,000 req/hr.`
        );
      }
      if (status === 404) {
        throw new Error(
          'GitHub repository or resource not found (404). If this is a private repository, please ensure a valid GitHub Personal Access Token with repository read permissions is connected.'
        );
      }
      throw err;
    }
  }
}

async function resolveBranch(owner, repo, token) {
  for (const branch of ['main', 'master']) {
    try {
      await githubRequest(
        `https://api.github.com/repos/${owner}/${repo}/branches/${branch}`,
        token
      );
      return branch;
    } catch {
      // try next branch
    }
  }
  const repoData = await githubRequest(`https://api.github.com/repos/${owner}/${repo}`, token);
  return repoData.default_branch || 'main';
}

async function fetchFileTree(owner, repo, branch, token) {
  const treeData = await githubRequest(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    token
  );

  if (!treeData.tree) {
    return [];
  }

  return treeData.tree.filter((item) => {
    if (item.type !== 'blob') return false;
    if (shouldSkipPath(item.path)) return false;
    const ext = getExtension(item.path);
    return ALLOWED_EXTENSIONS.has(ext);
  });
}

async function fetchFileContent(owner, repo, path, token) {
  const data = await githubRequest(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    token
  );

  if (Array.isArray(data) || !data.content) {
    return null;
  }

  const content = Buffer.from(data.content, 'base64').toString('utf-8');
  return content;
}

export async function fetchRepoFiles(repoUrl, githubToken) {
  let token = githubToken || process.env.GITHUB_TOKEN || '';
  const { owner, repo } = parseRepoUrl(repoUrl);

  // If a token is provided, verify it quickly; if expired/invalid, drop to unauthenticated
  if (token) {
    try {
      await axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (probeErr) {
      if (probeErr.response?.status === 401) {
        console.warn('Connected GitHub token returned 401 Unauthorized (expired or invalid). Proceeding with unauthenticated public access.');
        token = '';
      }
    }
  }

  const branch = await resolveBranch(owner, repo, token);
  const tree = await fetchFileTree(owner, repo, branch, token);

  const files = [];

  for (const item of tree) {
    try {
      const content = await fetchFileContent(owner, repo, item.path, token);
      if (content === null) continue;

      const extension = getExtension(item.path);
      const lineCount = content.split('\n').length;

      files.push({
        path: item.path,
        content,
        extension,
        lineCount,
      });
    } catch (err) {
      console.warn(`Failed to fetch ${item.path}:`, err.message);
    }
  }

  return { owner, repo, branch, files };
}

export { parseRepoUrl };
