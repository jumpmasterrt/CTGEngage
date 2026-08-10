export interface ExperienceContent {
  schemaVersion: 1;
  id: string;
  idleTimeoutSeconds: number;
  brand: {
    organization: string;
    product: string;
    tagline: string;
    offlineStatus: string;
  };
  assets: {
    brandLogo: string;
    qrCode: string;
  };
  home: {
    eyebrow: string;
    headline: string;
    highlightedHeadline: string;
    lede: string;
    cta: string;
    touchNote: string;
    missionLabel: string;
    missionTitle: string;
    missionMeta: string;
  };
  mission: {
    number: string;
    label: string;
    title: string;
    prompt: string;
    choiceAriaLabel: string;
    confirmLabel: string;
    retryHint: string;
    choices: Array<{
      id: string;
      label: string;
      detail: string;
      correct: boolean;
    }>;
  };
  completion: {
    eyebrow: string;
    title: string;
    lede: string;
    promotionalLine: string;
    aboutKicker: string;
    aboutTitle: string;
    aboutBody: string;
    ctaKicker: string;
    ctaText: string;
    qrAlt: string;
    restartLabel: string;
  };
}

const fallbackExperience: ExperienceContent = {
  schemaVersion: 1,
  id: 'first-contact-fallback',
  idleTimeoutSeconds: 120,
  brand: {
    organization: 'Combat Tested Gaming',
    product: 'CTG Engage',
    tagline: 'Our Community — Deployed.',
    offlineStatus: 'Offline experience ready',
  },
  assets: {
    brandLogo: '/branding/Transparent%20CTG%20Tag%20Only.png',
    qrCode: '/branding/CTG%20QR.png',
  },
  home: {
    eyebrow: 'Welcome to the community',
    headline: 'Better connections',
    highlightedHeadline: 'start with hello.',
    lede: 'Take a one-minute mission and discover how a simple first move can turn a room full of strangers into a squad.',
    cta: 'Begin your mission',
    touchNote: 'Tap the button to begin',
    missionLabel: 'Today’s mission',
    missionTitle: 'Make the first move.',
    missionMeta: '01 minute · all skill levels',
  },
  mission: {
    number: '01',
    label: 'First contact',
    title: 'A new player walks up alone.',
    prompt: 'They’re interested—but they don’t know anyone yet. What’s your first move?',
    choiceAriaLabel: 'Choose your first move',
    confirmLabel: 'Lock it in',
    retryHint: 'Strong communities start by making room. Try the choice that puts connection first.',
    choices: [
      { id: 'spectate', label: 'Let them watch first', detail: 'Give them time to learn the group from the sidelines.', correct: false },
      { id: 'welcome', label: 'Make the first introduction', detail: 'Invite them in, learn their name, and find a game you share.', correct: true },
      { id: 'rules', label: 'Start with the rules', detail: 'Explain how the community works before getting acquainted.', correct: false },
    ],
  },
  completion: {
    eyebrow: 'Mission complete',
    title: 'That’s how community starts.',
    lede: 'You didn’t start with a pitch or a rulebook. You started with a person.',
    promotionalLine: 'Creating better first conversations.',
    aboutKicker: 'About CTG',
    aboutTitle: 'Gaming with purpose. Community for life.',
    aboutBody: 'Combat Tested Gaming brings veterans and allies together through gaming, shared experiences, and genuine connection.',
    ctaKicker: 'Your next move',
    ctaText: 'Scan to connect with CTG.',
    qrAlt: 'QR code to connect with Combat Tested Gaming',
    restartLabel: 'Run it again',
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasStrings(value: unknown, keys: string[]): value is Record<string, string> {
  return isRecord(value) && keys.every((key) => typeof value[key] === 'string');
}

function isExperienceContent(value: unknown): value is ExperienceContent {
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.id !== 'string') return false;
  if (typeof value.idleTimeoutSeconds !== 'number' || value.idleTimeoutSeconds < 15) return false;
  if (!hasStrings(value.brand, ['organization', 'product', 'tagline', 'offlineStatus'])) return false;
  if (!hasStrings(value.assets, ['brandLogo', 'qrCode'])) return false;
  if (!hasStrings(value.home, ['eyebrow', 'headline', 'highlightedHeadline', 'lede', 'cta', 'touchNote', 'missionLabel', 'missionTitle', 'missionMeta'])) return false;
  if (!hasStrings(value.completion, ['eyebrow', 'title', 'lede', 'promotionalLine', 'aboutKicker', 'aboutTitle', 'aboutBody', 'ctaKicker', 'ctaText', 'qrAlt', 'restartLabel'])) return false;
  if (!hasStrings(value.mission, ['number', 'label', 'title', 'prompt', 'choiceAriaLabel', 'confirmLabel', 'retryHint'])) return false;

  const choices = value.mission.choices;
  if (!Array.isArray(choices) || choices.length < 2 || choices.length > 6) return false;
  if (!choices.every((choice) => hasStrings(choice, ['id', 'label', 'detail']) && typeof choice.correct === 'boolean')) return false;
  if (new Set(choices.map((choice) => choice.id)).size !== choices.length) return false;
  return choices.filter((choice) => choice.correct).length === 1;
}

export async function loadExperience(): Promise<ExperienceContent> {
  try {
    const response = await fetch('/experience.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Content pack returned ${response.status}.`);
    const candidate: unknown = await response.json();
    if (!isExperienceContent(candidate)) throw new Error('Content pack did not match schema version 1.');
    return candidate;
  } catch (error) {
    console.warn('CTG Engage is using its built-in fallback content.', error);
    return fallbackExperience;
  }
}
