import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { delimiter, extname, isAbsolute, resolve, win32 } from 'node:path';

export function copilotEnv(env = process.env) {
  const allowed = new Set(['PATH', 'PATHEXT', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'HOMEDRIVE', 'HOMEPATH', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'TMP', 'TEMP', 'XDG_CONFIG_HOME', 'XDG_STATE_HOME', 'COPILOT_GITHUB_TOKEN']);
  return Object.fromEntries([...Object.entries(env).filter(([key, value]) => allowed.has(key.toUpperCase()) && typeof value === 'string'), ['CI', 'true'], ['NO_COLOR', '1']]);
}

export function requireCopilotAuth(env = process.env) {
  if (!env.COPILOT_GITHUB_TOKEN?.trim() && env.COPILOT_USE_LOGGED_IN !== '1') {
    throw new Error('Copilot auth required: set COPILOT_GITHUB_TOKEN (fine-grained PAT with Copilot Requests), or run copilot then /login and set COPILOT_USE_LOGGED_IN=1.');
  }
}

export async function resolveCopilot({ env = process.env, platform = process.platform, canExecute = async (path) => { try { await access(path, platform === 'win32' ? constants.F_OK : constants.X_OK); return true; } catch { return false; } } } = {}) {
  const windows = platform === 'win32';
  const path = windows ? win32 : { isAbsolute, resolve, extname };
  const override = env.COPILOT_CLI;
  const names = override ? [override] : windows ? ['copilot.exe', 'copilot.cmd'] : ['copilot'];
  const searchPath = Object.entries(env).find(([key]) => key.toUpperCase() === 'PATH')?.[1] ?? '';
  for (const name of names) {
    const candidates = path.isAbsolute(name) || /[\\/]/.test(name)
      ? [path.resolve(name)]
      : searchPath.split(windows ? ';' : delimiter).filter(Boolean).map((dir) => path.resolve(dir.replace(/^"|"$/g, ''), name));
    for (const candidate of candidates) {
      const variants = windows && !path.extname(candidate) ? [`${candidate}.exe`, `${candidate}.cmd`] : [candidate];
      for (const variant of variants) if (await canExecute(variant)) return variant;
    }
  }
  throw new Error('Copilot CLI not found. Install it with: npm install -g @github/copilot (or set COPILOT_CLI to its executable path).');
}

export function copilotLaunch(executable, args, { platform = process.platform, env = process.env } = {}) {
  if (platform !== 'win32' || !/\.(?:cmd|bat)$/i.test(executable)) {
    if ([executable, ...args].join(' ').length > 30_000) throw new Error('Copilot command line is too long; use sandbox files for prompt/evidence.');
    return { file: executable, args, options: { shell: false } };
  }
  // cmd.exe expands percent/exclamation references even inside quotes. Keep this
  // fallback deliberately narrow; all model instructions live in sandbox files.
  const quote = (value) => {
    if (/["%!^&|<>\r\n\0]/.test(value)) throw new Error('Unsafe Windows shim argument; use a Copilot .exe path without shell metacharacters.');
    return `"${value}"`;
  };
  const command = `"${[executable, ...args].map(quote).join(' ')}"`;
  if (command.length > 7_500) throw new Error('Copilot shim command line is too long; use sandbox files for prompt/evidence.');
  const systemRoot = env.SystemRoot ?? env.SYSTEMROOT ?? 'C:\\Windows';
  return { file: win32.join(systemRoot, 'System32', 'cmd.exe'), args: ['/d', '/s', '/c', command], options: { shell: false, windowsVerbatimArguments: true } };
}
