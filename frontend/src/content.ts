export interface OrganizationPackageManifest {
  schemaVersion: 1;
  id: string;
  name: string;
  organization: string;
  locale: string;
  experience: string;
  theme: {
    background: string;
    surface: string;
    primary: string;
    secondary: string;
  };
}

export interface ExperienceContent {
  schemaVersion: 4;
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
    questionAriaLabel: string;
    yesLabel: string;
    yesDetail: string;
    noLabel: string;
    noDetail: string;
    touchNote: string;
    missionLabel: string;
    missionTitle: string;
    missionMeta: string;
  };
  mission: {
    number: string;
    label: string;
    yesTitle: string;
    noTitle: string;
    yesPrompt: string;
    noPrompt: string;
    yesChoiceAriaLabel: string;
    noChoiceAriaLabel: string;
    yesConfirmLabel: string;
    noConfirmLabel: string;
    noStillConfirmLabel: string;
    multiSelectNote: string;
    choices: Array<{
      id: string;
      branch: 'yes' | 'no';
      label: string;
      detail: string;
      outcomeTitle: string;
      outcomeBody: string;
    }>;
  };
  completion: {
    eyebrow: string;
    fallbackTitle: string;
    fallbackBody: string;
    multiTitle: string;
    multiBody: string;
    selectionPrefix: string;
    promotionalLine: string;
    realizationKicker: string;
    realizationTitle: string;
    realizationBody: string;
    nonGamerKicker: string;
    nonGamerTitle: string;
    nonGamerBody: string;
    nonGamerPromotionalLine: string;
    discoverLabel: string;
    restartLabel: string;
  };
  discovery: {
    eyebrow: string;
    title: string;
    prompt: string;
    choiceAriaLabel: string;
    exploreLabel: string;
    allTopicsLabel: string;
    moreInTopicLabel: string;
    surpriseAgainLabel: string;
    connectKicker: string;
    connectText: string;
    qrAlt: string;
    restartLabel: string;
    items: Array<{
      id: string;
      label: string;
      summary: string;
      kicker: string;
      title: string;
      lead: string;
      factKicker: string;
      factTitle: string;
      factBody: string;
      humanKicker: string;
      humanTitle: string;
      humanBody: string;
      sourceLabel: string;
      sourceUrl?: string;
      chapterTitle?: string;
      chapterPrompt?: string;
      chapterAriaLabel?: string;
      randomizeChapters?: boolean;
      chapters?: Array<{
        id: string;
        label: string;
        summary: string;
        kicker: string;
        title: string;
        lead: string;
        factKicker: string;
        factTitle: string;
        factBody: string;
        humanKicker: string;
        humanTitle: string;
        humanBody: string;
        sourceLabel: string;
        sourceUrl?: string;
      }>;
    }>;
  };
}

export interface LoadedOrganizationPackage {
  manifest: OrganizationPackageManifest;
  content: ExperienceContent;
  onlineSourcesEnabled: boolean;
}

interface ActivePackageConfig {
  schemaVersion: 1;
  activePackage: string;
  onlineSourcesEnabled?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasStrings(value: unknown, keys: string[]): value is Record<string, string> {
  return isRecord(value) && keys.every((key) => typeof value[key] === 'string' && value[key].trim().length > 0);
}

function isPackageId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 64;
}

function isRelativePackagePath(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.startsWith('/') || value.includes('\\') || value.includes(':') || value.includes('?') || value.includes('#')) return false;
  return value.split('/').every((part) => part.length > 0 && part !== '.' && part !== '..');
}

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isActivePackageConfig(value: unknown): value is ActivePackageConfig {
  return isRecord(value)
    && value.schemaVersion === 1
    && isPackageId(value.activePackage)
    && (value.onlineSourcesEnabled === undefined || typeof value.onlineSourcesEnabled === 'boolean');
}

function isOrganizationPackageManifest(value: unknown): value is OrganizationPackageManifest {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isPackageId(value.id)) return false;
  if (!hasStrings(value, ['name', 'organization', 'locale', 'experience']) || !isRelativePackagePath(value.experience)) return false;
  if (!isRecord(value.theme)) return false;
  const theme = value.theme;
  return ['background', 'surface', 'primary', 'secondary'].every((key) => isHexColor(theme[key]));
}

function isExperienceContent(value: unknown): value is ExperienceContent {
  if (!isRecord(value) || value.schemaVersion !== 4 || typeof value.id !== 'string') return false;
  if (typeof value.idleTimeoutSeconds !== 'number' || value.idleTimeoutSeconds < 15) return false;
  if (!hasStrings(value.brand, ['organization', 'product', 'tagline', 'offlineStatus'])) return false;
  if (!hasStrings(value.assets, ['brandLogo', 'qrCode'])) return false;
  if (!hasStrings(value.home, ['eyebrow', 'headline', 'highlightedHeadline', 'lede', 'questionAriaLabel', 'yesLabel', 'yesDetail', 'noLabel', 'noDetail', 'touchNote', 'missionLabel', 'missionTitle', 'missionMeta'])) return false;
  if (!hasStrings(value.completion, ['eyebrow', 'fallbackTitle', 'fallbackBody', 'multiTitle', 'multiBody', 'selectionPrefix', 'promotionalLine', 'realizationKicker', 'realizationTitle', 'realizationBody', 'nonGamerKicker', 'nonGamerTitle', 'nonGamerBody', 'nonGamerPromotionalLine', 'discoverLabel', 'restartLabel'])) return false;
  if (!hasStrings(value.mission, ['number', 'label', 'yesTitle', 'noTitle', 'yesPrompt', 'noPrompt', 'yesChoiceAriaLabel', 'noChoiceAriaLabel', 'yesConfirmLabel', 'noConfirmLabel', 'noStillConfirmLabel', 'multiSelectNote'])) return false;
  if (!hasStrings(value.discovery, ['eyebrow', 'title', 'prompt', 'choiceAriaLabel', 'exploreLabel', 'allTopicsLabel', 'moreInTopicLabel', 'surpriseAgainLabel', 'connectKicker', 'connectText', 'qrAlt', 'restartLabel'])) return false;

  const choices = value.mission.choices;
  if (!Array.isArray(choices) || choices.length < 4 || choices.length > 12) return false;
  if (!choices.every((choice) => hasStrings(choice, ['id', 'branch', 'label', 'detail', 'outcomeTitle', 'outcomeBody']) && (choice.branch === 'yes' || choice.branch === 'no'))) return false;
  if (new Set(choices.map((choice) => choice.id)).size !== choices.length) return false;
  const yesChoices = choices.filter((choice) => choice.branch === 'yes');
  const noChoices = choices.filter((choice) => choice.branch === 'no');
  if (yesChoices.length < 2 || yesChoices.length > 6 || noChoices.length < 2 || noChoices.length > 6) return false;

  const discoveryItems = value.discovery.items;
  if (!Array.isArray(discoveryItems) || discoveryItems.length < 2 || discoveryItems.length > 6) return false;
  if (!discoveryItems.every((item) => {
    if (!hasStrings(item, ['id', 'label', 'summary', 'kicker', 'title', 'lead', 'factKicker', 'factTitle', 'factBody', 'humanKicker', 'humanTitle', 'humanBody', 'sourceLabel'])) return false;
    if (item.sourceUrl !== undefined && !isHttpsUrl(item.sourceUrl)) return false;
    if (item.randomizeChapters !== undefined && typeof item.randomizeChapters !== 'boolean') return false;
    if (item.randomizeChapters === true && item.chapters === undefined) return false;
    if (item.chapters === undefined) return true;
    if (!hasStrings(item, ['chapterTitle', 'chapterPrompt', 'chapterAriaLabel'])) return false;
    if (!Array.isArray(item.chapters) || item.chapters.length < 2 || item.chapters.length > 6) return false;
    if (!item.chapters.every((chapter) => hasStrings(chapter, ['id', 'label', 'summary', 'kicker', 'title', 'lead', 'factKicker', 'factTitle', 'factBody', 'humanKicker', 'humanTitle', 'humanBody', 'sourceLabel'])
      && (chapter.sourceUrl === undefined || isHttpsUrl(chapter.sourceUrl)))) return false;
    return new Set(item.chapters.map((chapter) => chapter.id)).size === item.chapters.length;
  })) return false;
  return new Set(discoveryItems.map((item) => item.id)).size === discoveryItems.length;
}

async function fetchJson(path: string): Promise<unknown> {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${path} returned ${response.status}.`);
  return response.json();
}

async function loadActivePackageConfig(): Promise<ActivePackageConfig> {
  let runtimeResponse: Response | undefined;
  try {
    runtimeResponse = await fetch('/api/config', { cache: 'no-store' });
  } catch {
    runtimeResponse = undefined;
  }

  if (runtimeResponse?.ok && runtimeResponse.headers.get('content-type')?.includes('application/json')) {
    const runtimeConfig: unknown = await runtimeResponse.json();
    if (!isActivePackageConfig(runtimeConfig)) throw new Error('Runtime package configuration is invalid.');
    return runtimeConfig;
  }

  const localConfig = await fetchJson('/active-package.json');
  if (!isActivePackageConfig(localConfig)) throw new Error('Active package configuration is invalid.');
  return localConfig;
}

function packageFileUrl(packageId: string, relativePath: string): string {
  const encodedPath = relativePath.split('/').map((part) => encodeURIComponent(part)).join('/');
  return `/packages/${encodeURIComponent(packageId)}/${encodedPath}`;
}

export async function loadExperience(): Promise<LoadedOrganizationPackage> {
  const activeConfig = await loadActivePackageConfig();
  const manifestPath = packageFileUrl(activeConfig.activePackage, 'manifest.json');
  const manifestCandidate = await fetchJson(manifestPath);
  if (!isOrganizationPackageManifest(manifestCandidate) || manifestCandidate.id !== activeConfig.activePackage) {
    throw new Error(`Organization package ${activeConfig.activePackage} has an invalid manifest.`);
  }

  const experiencePath = packageFileUrl(manifestCandidate.id, manifestCandidate.experience);
  const experienceCandidate = await fetchJson(experiencePath);
  if (!isExperienceContent(experienceCandidate)) {
    throw new Error(`Organization package ${manifestCandidate.id} has an invalid experience.`);
  }
  if (!isRelativePackagePath(experienceCandidate.assets.brandLogo) || !isRelativePackagePath(experienceCandidate.assets.qrCode)) {
    throw new Error(`Organization package ${manifestCandidate.id} contains an invalid asset path.`);
  }

  return {
    manifest: manifestCandidate,
    content: {
      ...experienceCandidate,
      assets: {
        brandLogo: packageFileUrl(manifestCandidate.id, experienceCandidate.assets.brandLogo),
        qrCode: packageFileUrl(manifestCandidate.id, experienceCandidate.assets.qrCode),
      },
    },
    onlineSourcesEnabled: activeConfig.onlineSourcesEnabled === true,
  };
}
