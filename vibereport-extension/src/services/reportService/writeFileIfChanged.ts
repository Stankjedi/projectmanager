import * as fs from 'fs/promises';

export async function writeFileIfChanged(filePath: string, next: string): Promise<boolean> {
  try {
    const current = await fs.readFile(filePath, 'utf-8');
    if (current === next) return false;
  } catch {
    // File missing or unreadable: fall through and write.
  }

  await fs.writeFile(filePath, next, 'utf-8');
  return true;
}

