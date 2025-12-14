export type PreviewBackgroundSetting = 'ide' | 'white' | 'black';

export function resolvePreviewColors(
  setting: PreviewBackgroundSetting
): { bg: string; fg: string; border: string; cardBg: string } | null {
  switch (setting) {
    case 'white':
      return {
        bg: '#f5f5f5',
        fg: '#1a1a1a',
        cardBg: '#ffffff',
        border: '#e0e0e0',
      };
    case 'black':
      return {
        bg: '#1e1e1e',
        fg: '#d4d4d4',
        cardBg: '#252526',
        border: '#454545',
      };
    case 'ide':
    default:
      return null;
  }
}

