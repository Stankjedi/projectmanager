const REDACTED_PATH = '[REDACTED_PATH]';
const REDACTED_COMMAND = '[REDACTED_COMMAND]';
const REDACTED_SESSION = 'session_[REDACTED]';

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

  return output;
}

