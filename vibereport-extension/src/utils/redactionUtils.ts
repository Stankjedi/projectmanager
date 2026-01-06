const REDACTED_PATH = '[REDACTED_PATH]';
const REDACTED_COMMAND = '[REDACTED_COMMAND]';
const REDACTED_SESSION = 'session_[REDACTED]';
const REDACTED_SECRET = '[REDACTED_SECRET]';

export function redactSecretLikePatterns(input: string): string {
  let output = input;

  // GitHub access tokens
  // Examples: ghp_..., gho_..., ghu_..., ghs_..., ghr_...
  output = output.replace(/\b(gh[pousr])_[A-Za-z0-9]{20,}\b/g, (_full, prefix: string) => {
    return `${prefix}_${REDACTED_SECRET}`;
  });

  // OpenAI-style API keys
  output = output.replace(/\bsk-[A-Za-z0-9]{20,}\b/g, `sk-${REDACTED_SECRET}`);

  // AWS access key id (not the secret key, but still sensitive)
  output = output.replace(/\bAKIA[0-9A-Z]{16}\b/g, `AKIA${REDACTED_SECRET}`);

  // Google API key prefix
  output = output.replace(/\bAIza[0-9A-Za-z_-]{20,}\b/g, `AIza${REDACTED_SECRET}`);

  // JWT-like tokens (very common accidental leaks)
  output = output.replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, REDACTED_SECRET);

  return output;
}

export function redactForSharing(input: string): string {
  let output = input;

  // Remove VS Code command links in markdown link syntax.
  // Example: [label](command:vibereport.openFunctionInFile?...)
  output = output.replace(/\[([^\]]+)\]\(command:[^)]+\)/g, '$1');

  // Mask any remaining raw command: URIs (defense-in-depth).
  output = output.replace(/\bcommand:[^\s)]+/g, REDACTED_COMMAND);

  // Mask session ids like "session_<timestamp>_<rand>".
  output = output.replace(/\bsession_[a-z0-9]+_[a-z0-9]+\b/gi, REDACTED_SESSION);

  // Mask Windows absolute paths (drive-letter and UNC).
  output = output.replace(/\b[a-zA-Z]:[\\/][^\s`|)]+/g, REDACTED_PATH);
  output = output.replace(/\\\\[^\s`|)]+/g, REDACTED_PATH);

  // Mask POSIX absolute paths, while avoiding URL schemes ("//") and double-slash prefixes.
  output = output.replace(/(?<!\/)\/(?!\/)(?:[^\s`|)]+\/)+[^\s`|)]+/g, REDACTED_PATH);

  output = redactSecretLikePatterns(output);

  return output;
}
