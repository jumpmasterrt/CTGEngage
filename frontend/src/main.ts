import './style.css';
import { loadExperience, type ExperienceContent, type OrganizationPackageManifest } from './content';

const appRoot = document.querySelector<HTMLElement>('#app');

if (!appRoot) throw new Error('CTG Engage app root was not found.');

const app = appRoot;

type Screen = 'home' | 'mission' | 'complete' | 'discovery' | 'chapters' | 'detail' | 'chapter' | 'operator';
type OpeningAnswer = 'yes' | 'no' | '';
type PowerAction = 'poweroff' | 'reboot';
type PowerState = 'idle' | 'requesting' | 'shutting-down' | 'restarting' | 'failed';
type EventName = 'session_started' | 'opening_answered' | 'mission_completed' | 'discovery_opened' | 'chapter_opened' | 'session_reset' | 'idle_timeout';

let content: ExperienceContent;
let screen: Screen = 'home';
let openingAnswer: OpeningAnswer = '';
let selected: string[] = [];
let discoveryId = '';
let chapterId = '';
let viewedSurpriseIds: string[] = [];
let lastSurpriseId = '';
let idleTimer = 0;
let operatorEntryTimer = 0;
let powerTimer = 0;
let suppressOperatorClick = false;
let powerState: PowerState = 'idle';
let powerAction: PowerAction = 'poweroff';
let organizationPackageId = '';
let visitSessionId = '';
let visitStartedAt = Date.now();

const operatorEntryHoldMilliseconds = 4000;
const shutdownHoldMilliseconds = 3000;

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character] ?? character);
}

function productName() {
  const [first, ...rest] = content.brand.product.split(' ');
  return `${escapeHtml(first)}${rest.length ? ` <strong>${escapeHtml(rest.join(' '))}</strong>` : ''}`;
}

function applyOrganizationPackage(manifest: OrganizationPackageManifest, loadedContent: ExperienceContent) {
  const root = document.documentElement;
  root.lang = manifest.locale;
  root.style.setProperty('--package-background', manifest.theme.background);
  root.style.setProperty('--package-surface', manifest.theme.surface);
  root.style.setProperty('--package-primary', manifest.theme.primary);
  root.style.setProperty('--package-secondary', manifest.theme.secondary);
  document.title = loadedContent.brand.product;
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', manifest.theme.background);
  document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', `${manifest.name} offline visitor experience.`);
}

function renderPackageFailure() {
  app.innerHTML = `<main class="kiosk-shell package-error-shell">
    <section class="screen package-error-screen" aria-labelledby="package-error-title">
      <p class="eyebrow">Package unavailable</p>
      <h1 id="package-error-title">Engage could not start.</h1>
      <p class="lede">Ask the event operator to restart the kiosk or verify the active organization package.</p>
    </section>
    <footer><span>Engage Core</span><span class="status status-error"><i></i> Package error</span></footer>
  </main>`;
}

function createSessionId() {
  return globalThis.crypto?.randomUUID?.() ?? `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function recordEvent(event: EventName, details: {
  branch?: string;
  target?: string;
  reason?: string;
  selections?: string[];
} = {}) {
  if (!visitSessionId) return;
  const payload = {
    packageId: organizationPackageId,
    sessionId: visitSessionId,
    event,
    screen,
    ...details,
    elapsedMs: Math.max(0, Date.now() - visitStartedAt),
  };
  void fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => undefined);
}

function beginVisitorSession() {
  visitSessionId = createSessionId();
  visitStartedAt = Date.now();
  recordEvent('session_started');
}

function clearVisitorState() {
  screen = 'home';
  openingAnswer = '';
  selected = [];
  discoveryId = '';
  chapterId = '';
  viewedSurpriseIds = [];
  lastSurpriseId = '';
}

function resetVisitorSession(event: 'session_reset' | 'idle_timeout', reason: string) {
  recordEvent(event, {
    branch: openingAnswer || undefined,
    target: chapterId || discoveryId || undefined,
    reason,
    selections: selected.length ? selected : undefined,
  });
  clearVisitorState();
  beginVisitorSession();
}

function resetIdleTimer() {
  window.clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => {
    if (screen !== 'home') {
      resetVisitorSession('idle_timeout', 'inactivity');
      render();
    }
  }, content.idleTimeoutSeconds * 1000);
}

function shell(body: string, step: number) {
  const totalSteps = 5;
  return `<main class="kiosk-shell">
    <header class="brand-bar">
      <button class="wordmark" data-action="home" data-operator-entry aria-label="Return to the ${escapeHtml(content.brand.product)} home screen">
        <img class="brand-logo" src="${escapeHtml(content.assets.brandLogo)}" alt="" aria-hidden="true">
        <span class="brand-name">${productName()}</span>
      </button>
      ${step === 1
        ? `<p class="tagline">${escapeHtml(content.brand.tagline)}</p>`
        : '<button class="start-over" data-action="home"><span aria-hidden="true">↺</span> Start over</button>'}
    </header>
    <div class="progress" aria-label="Step ${step} of ${totalSteps}">
      <span>${String(step).padStart(2, '0')} / ${String(totalSteps).padStart(2, '0')}</span>
      <span class="progress-track"><span style="width:${(step / totalSteps) * 100}%"></span></span>
    </div>
    ${body}
    <footer><span>${escapeHtml(content.brand.organization)}</span><span class="status"><i></i> ${escapeHtml(content.brand.offlineStatus)}</span></footer>
  </main>`;
}

function homeScreen() {
  const home = content.home;
  return shell(`<section class="screen home-screen" aria-labelledby="home-title">
    <div class="hero-copy">
      <p class="eyebrow">${escapeHtml(home.eyebrow)}</p>
      <h1 id="home-title" tabindex="-1">${escapeHtml(home.headline)}<br><em>${escapeHtml(home.highlightedHeadline)}</em></h1>
      <p class="lede">${escapeHtml(home.lede)}</p>
      <div class="opening-choices" role="group" aria-label="${escapeHtml(home.questionAriaLabel)}">
        <button class="opening-choice" data-opening="yes">
          <span><strong>${escapeHtml(home.yesLabel)}</strong><small>${escapeHtml(home.yesDetail)}</small></span>
          <span class="tap-cue" aria-hidden="true"><span>Tap</span><b>→</b></span>
        </button>
        <button class="opening-choice" data-opening="no">
          <span><strong>${escapeHtml(home.noLabel)}</strong><small>${escapeHtml(home.noDetail)}</small></span>
          <span class="tap-cue" aria-hidden="true"><span>Tap</span><b>→</b></span>
        </button>
      </div>
      <p class="touch-note"><span aria-hidden="true">◎</span> ${escapeHtml(home.touchNote)}</p>
    </div>
    <div class="hero-art" aria-hidden="true">
      <div class="radar radar-one"></div><div class="radar radar-two"></div>
      <div class="connection connection-a"><span></span><span></span></div>
      <div class="connection connection-b"><span></span><span></span></div>
      <div class="mission-card"><p>${escapeHtml(home.missionLabel)}</p><strong>${escapeHtml(home.missionTitle)}</strong><span>${escapeHtml(home.missionMeta)}</span></div>
    </div>
  </section>`, 1);
}

function missionScreen() {
  const mission = content.mission;
  const availableChoices = mission.choices.filter((choice) => choice.branch === openingAnswer);
  const confirmLabel = openingAnswer === 'yes'
    ? mission.yesConfirmLabel
    : selected.includes('still-no') ? mission.noStillConfirmLabel : mission.noConfirmLabel;
  const choiceButtons = availableChoices.map((choice, index) => `
    <button class="choice ${selected.includes(choice.id) ? 'selected' : ''}" data-choice="${escapeHtml(choice.id)}" aria-pressed="${selected.includes(choice.id)}">
      <span class="choice-key">${String.fromCharCode(65 + index)}</span>
      <span><strong>${escapeHtml(choice.label)}</strong><small>${escapeHtml(choice.detail)}</small></span>
      <span class="choice-check" aria-hidden="true">✓</span>
    </button>`).join('');

  return shell(`<section class="screen mission-screen" aria-labelledby="mission-title">
    <div class="mission-heading">
      <p class="eyebrow">Mission ${escapeHtml(mission.number)} · ${escapeHtml(mission.label)}</p>
      <h1 id="mission-title" tabindex="-1">${escapeHtml(openingAnswer === 'no' ? mission.noTitle : mission.yesTitle)}</h1>
      <p>${escapeHtml(openingAnswer === 'no' ? mission.noPrompt : mission.yesPrompt)}</p>
    </div>
    <div class="choice-list" role="group" aria-label="${escapeHtml(openingAnswer === 'no' ? mission.noChoiceAriaLabel : mission.yesChoiceAriaLabel)}">${choiceButtons}</div>
    <div class="mission-actions">
      <p class="selection-note">${openingAnswer === 'yes' ? escapeHtml(mission.multiSelectNote) : ''}</p>
      <button class="primary-button compact" data-action="confirm" ${selected.length ? '' : 'disabled'}>${escapeHtml(confirmLabel)} <span aria-hidden="true">→</span></button>
    </div>
  </section>`, 2);
}

function completeScreen() {
  const completion = content.completion;
  const selectedChoices = selected
    .map((id) => content.mission.choices.find((choice) => choice.id === id))
    .filter((choice): choice is ExperienceContent['mission']['choices'][number] => Boolean(choice));
  const selectedChoice = selectedChoices[0];
  const isMultiSelectResult = openingAnswer === 'yes' && selectedChoices.length > 1;
  const isNonGamerResult = selected.includes('still-no');
  const selectedLabels = selectedChoices.map((choice) => choice.label).join(', ');
  const outcomeTitle = isMultiSelectResult ? completion.multiTitle : selectedChoice?.outcomeTitle ?? completion.fallbackTitle;
  const outcomeBody = isMultiSelectResult
    ? `${completion.multiBody} ${completion.selectionPrefix}: ${selectedLabels}.`
    : selectedChoice?.outcomeBody ?? completion.fallbackBody;
  const realizationKicker = isNonGamerResult ? completion.nonGamerKicker : completion.realizationKicker;
  const realizationTitle = isNonGamerResult ? completion.nonGamerTitle : completion.realizationTitle;
  const realizationBody = isNonGamerResult ? completion.nonGamerBody : completion.realizationBody;
  const promotionalLine = isNonGamerResult ? completion.nonGamerPromotionalLine : completion.promotionalLine;
  return shell(`<section class="screen complete-screen" aria-labelledby="complete-title">
    <div class="success-mark" aria-hidden="true"><span>◎</span></div>
    <div class="complete-copy">
      <p class="eyebrow">${escapeHtml(completion.eyebrow)}</p>
      <h1 id="complete-title" tabindex="-1">${escapeHtml(outcomeTitle)}</h1>
      <p class="lede">${escapeHtml(outcomeBody)}</p>
      <blockquote>“${escapeHtml(promotionalLine)}”</blockquote>
    </div>
    <aside class="ctg-card">
      <p class="card-kicker">${escapeHtml(realizationKicker)}</p>
      <h2>${escapeHtml(realizationTitle)}</h2>
      <p>${escapeHtml(realizationBody)}</p>
      <button class="primary-button compact discovery-cta" data-action="discover">${escapeHtml(completion.discoverLabel)} <span aria-hidden="true">→</span></button>
    </aside>
    <button class="secondary-button" data-action="restart">${escapeHtml(completion.restartLabel)}</button>
  </section>`, 3);
}

function discoveryScreen() {
  const discovery = content.discovery;
  const choices = discovery.items.map((item, index) => `
    <button class="discovery-choice" data-discovery="${escapeHtml(item.id)}">
      <span class="discovery-number">${String(index + 1).padStart(2, '0')}</span>
      <span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.summary)}</small></span>
      <span class="tap-cue" aria-hidden="true"><span>Tap</span><b>→</b></span>
    </button>`).join('');

  return shell(`<section class="screen discovery-screen" aria-labelledby="discovery-title">
    <div class="discovery-heading">
      <p class="eyebrow">${escapeHtml(discovery.eyebrow)}</p>
      <h1 id="discovery-title" tabindex="-1">${escapeHtml(discovery.title)}</h1>
      <p>${escapeHtml(discovery.prompt)}</p>
    </div>
    <div class="discovery-grid" role="group" aria-label="${escapeHtml(discovery.choiceAriaLabel)}">${choices}</div>
  </section>`, 4);
}

function chaptersScreen() {
  const discovery = content.discovery;
  const item = discovery.items.find((candidate) => candidate.id === discoveryId) ?? discovery.items[0];
  const chapters = item.chapters ?? [];
  const choices = chapters.map((chapter, index) => `
    <button class="chapter-choice" data-chapter="${escapeHtml(chapter.id)}">
      <span class="discovery-number">${String(index + 1).padStart(2, '0')}</span>
      <span><strong>${escapeHtml(chapter.label)}</strong><small>${escapeHtml(chapter.summary)}</small></span>
      <span class="tap-cue" aria-hidden="true"><span>Tap</span><b>→</b></span>
    </button>`).join('');

  return shell(`<section class="screen chapters-screen" aria-labelledby="chapters-title">
    <div class="discovery-heading">
      <p class="eyebrow">${escapeHtml(item.kicker)}</p>
      <h1 id="chapters-title" tabindex="-1">${escapeHtml(item.chapterTitle ?? item.title)}</h1>
      <p>${escapeHtml(item.chapterPrompt ?? item.lead)}</p>
    </div>
    <div class="chapter-grid" role="group" aria-label="${escapeHtml(item.chapterAriaLabel ?? item.label)}">${choices}</div>
    <button class="secondary-button chapter-back" data-action="discover">${escapeHtml(discovery.allTopicsLabel)}</button>
  </section>`, 5);
}

function showNextSurprise(item: ExperienceContent['discovery']['items'][number]) {
  const chapters = item.chapters ?? [];
  if (!chapters.length) {
    screen = 'detail';
    return;
  }

  let available = chapters.filter((chapter) => !viewedSurpriseIds.includes(chapter.id));
  if (!available.length) {
    viewedSurpriseIds = lastSurpriseId ? [lastSurpriseId] : [];
    available = chapters.filter((chapter) => chapter.id !== lastSurpriseId);
  }

  const nextChapter = available[Math.floor(Math.random() * available.length)] ?? chapters[0];
  chapterId = nextChapter.id;
  viewedSurpriseIds = [...viewedSurpriseIds, nextChapter.id];
  lastSurpriseId = nextChapter.id;
  screen = 'chapter';
  recordEvent('chapter_opened', { target: `${item.id}/${nextChapter.id}` });
}

function detailScreen() {
  const discovery = content.discovery;
  const item = discovery.items.find((candidate) => candidate.id === discoveryId) ?? discovery.items[0];
  const detail = screen === 'chapter'
    ? item.chapters?.find((chapter) => chapter.id === chapterId) ?? item
    : item;
  const isRandomizedChapter = screen === 'chapter' && item.randomizeChapters === true;
  const primaryAction = isRandomizedChapter ? 'surprise' : screen === 'chapter' ? 'chapters' : 'discover';
  const primaryLabel = isRandomizedChapter
    ? discovery.surpriseAgainLabel
    : screen === 'chapter' ? discovery.moreInTopicLabel : discovery.exploreLabel;
  return shell(`<section class="screen detail-screen" aria-labelledby="detail-title">
    <div class="detail-heading">
      <p class="eyebrow">${escapeHtml(detail.kicker)}</p>
      <h1 id="detail-title" tabindex="-1">${escapeHtml(detail.title)}</h1>
      <p>${escapeHtml(detail.lead)}</p>
    </div>
    <div class="detail-grid">
      <article class="detail-card fact-card">
        <p class="card-kicker">${escapeHtml(detail.factKicker)}</p>
        <h2>${escapeHtml(detail.factTitle)}</h2>
        <p>${escapeHtml(detail.factBody)}</p>
      </article>
      <article class="detail-card human-card">
        <p class="card-kicker">${escapeHtml(detail.humanKicker)}</p>
        <h2>${escapeHtml(detail.humanTitle)}</h2>
        <p>${escapeHtml(detail.humanBody)}</p>
        <small class="source-note"><span>Source</span>${escapeHtml(detail.sourceLabel)}</small>
      </article>
    </div>
    <div class="detail-actions">
      <button class="primary-button compact" data-action="${primaryAction}">${escapeHtml(primaryLabel)} <span aria-hidden="true">↺</span></button>
      <div class="connect-card" aria-label="${escapeHtml(discovery.connectKicker)}. ${escapeHtml(discovery.connectText)}">
        <div class="connect-copy">
          <span>${escapeHtml(discovery.connectKicker)}</span>
          <strong>${escapeHtml(discovery.connectText)}</strong>
          <small>Point your phone camera at the code.</small>
        </div>
        <div class="qr-frame"><span aria-hidden="true">Scan</span><img class="cta-qr" src="${escapeHtml(content.assets.qrCode)}" alt="${escapeHtml(discovery.qrAlt)}"></div>
      </div>
      <button class="secondary-button detail-restart" data-action="restart">${escapeHtml(discovery.restartLabel)}</button>
    </div>
  </section>`, 5);
}

function operatorScreen() {
  const isRequesting = powerState === 'requesting';
  const isShuttingDown = powerState === 'shutting-down';
  const isRestarting = powerState === 'restarting';
  const hasFailed = powerState === 'failed';
  const actionLabel = powerAction === 'reboot' ? 'restart' : 'shutdown';
  const statusTitle = isRestarting
    ? 'ExpoPi is restarting'
    : isShuttingDown
      ? 'ExpoPi is shutting down'
    : isRequesting
      ? `Requesting a clean ${actionLabel}`
      : 'Restart or shut down ExpoPi safely';
  const statusBody = isRestarting
    ? 'The display will go black briefly. Engage will return automatically when ExpoPi finishes restarting.'
    : isShuttingDown
      ? 'Wait for the display to go black and the green activity light to stop blinking. Then use the inline power switch.'
    : hasFailed
      ? `ExpoPi did not accept the ${actionLabel} request. Try again, return to Engage, or use the proxenos administrator account.`
      : 'Restart recovers the kiosk without removing power. Shut down closes the filesystem safely before the inline power switch is used.';

  return `<main class="kiosk-shell operator-shell">
    <header class="brand-bar">
      <span class="wordmark operator-wordmark">
        <img class="brand-logo" src="${escapeHtml(content.assets.brandLogo)}" alt="" aria-hidden="true">
        <span class="brand-name">${productName()}</span>
      </span>
      <p class="operator-label">Operator controls</p>
    </header>
    <section class="screen operator-screen" aria-labelledby="operator-title" aria-live="polite">
      <p class="eyebrow">Event operations</p>
      <h1 id="operator-title" tabindex="-1">${statusTitle}</h1>
      <p class="lede">${statusBody}</p>
      ${isShuttingDown || isRestarting
        ? '<div class="shutdown-indicator" aria-hidden="true"><span></span><span></span><span></span></div>'
        : `<div class="operator-actions">
            <div class="power-controls">
              <button class="shutdown-control reboot-control ${isRequesting ? 'is-requesting' : ''}" data-power-control="reboot" ${isRequesting ? 'disabled' : ''}>
                <span class="shutdown-fill" aria-hidden="true"></span>
                <span class="shutdown-copy"><strong>Hold to restart</strong><small>Keep holding for three seconds</small></span>
              </button>
              <button class="shutdown-control ${isRequesting ? 'is-requesting' : ''}" data-power-control="poweroff" ${isRequesting ? 'disabled' : ''}>
                <span class="shutdown-fill" aria-hidden="true"></span>
                <span class="shutdown-copy"><strong>Hold to shut down</strong><small>Keep holding for three seconds</small></span>
              </button>
            </div>
            <button class="secondary-button operator-return" data-action="operator-return">Return to Engage</button>
          </div>`}
    </section>
    <footer><span>Local operator access</span><span class="status"><i></i> ExpoPi</span></footer>
  </main>`;
}

async function requestPowerAction(action: PowerAction) {
  powerAction = action;
  powerState = 'requesting';
  render();

  try {
    const sessionResponse = await fetch('/api/operator/session', { cache: 'no-store' });
    if (!sessionResponse.ok) throw new Error('Operator session unavailable.');
    const session = await sessionResponse.json() as { token?: unknown };
    if (typeof session.token !== 'string' || !session.token) throw new Error('Operator token unavailable.');

    const powerResponse = await fetch(`/api/operator/${action}`, {
      method: 'POST',
      headers: { 'X-CTG-Operator-Token': session.token },
    });
    if (!powerResponse.ok) throw new Error('Power request rejected.');
    powerState = action === 'reboot' ? 'restarting' : 'shutting-down';
  } catch {
    powerState = 'failed';
  }

  render();
}

function cancelOperatorEntryHold() {
  window.clearTimeout(operatorEntryTimer);
  operatorEntryTimer = 0;
  app.querySelector<HTMLElement>('[data-operator-entry].is-holding')?.classList.remove('is-holding');
}

function cancelPowerHold() {
  window.clearTimeout(powerTimer);
  powerTimer = 0;
  app.querySelector<HTMLElement>('[data-power-control].is-holding')?.classList.remove('is-holding');
}

function render(focusTarget: 'heading' | 'choice' = 'heading') {
  cancelOperatorEntryHold();
  cancelPowerHold();
  app.innerHTML = screen === 'operator'
    ? operatorScreen()
    : screen === 'home'
    ? homeScreen()
    : screen === 'mission'
      ? missionScreen()
      : screen === 'complete'
        ? completeScreen()
        : screen === 'discovery'
          ? discoveryScreen()
          : screen === 'chapters'
            ? chaptersScreen()
          : detailScreen();
  const focusElement = focusTarget === 'choice' && selected
    ? app.querySelector<HTMLElement>(`[data-choice="${CSS.escape(selected[selected.length - 1] ?? '')}"]`)
    : app.querySelector<HTMLElement>('h1');
  focusElement?.focus({ preventScroll: true });
  resetIdleTimer();
}

app.addEventListener('click', (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action], [data-choice], [data-opening], [data-discovery], [data-chapter]');
  if (!target) return;
  if (suppressOperatorClick && target.hasAttribute('data-operator-entry')) {
    suppressOperatorClick = false;
    event.preventDefault();
    return;
  }
  const action = target.dataset.action;

  if (action === 'home' || action === 'restart') {
    if (screen !== 'home') resetVisitorSession('session_reset', action === 'restart' ? 'run_again' : 'start_over');
  } else if (action === 'operator-return') {
    resetVisitorSession('session_reset', 'operator_return');
    powerState = 'idle';
  } else if (action === 'discover') {
    screen = 'discovery'; discoveryId = ''; chapterId = '';
  } else if (action === 'chapters') {
    screen = 'chapters'; chapterId = '';
  } else if (action === 'surprise') {
    const discoveryItem = content.discovery.items.find((item) => item.id === discoveryId);
    if (discoveryItem) showNextSurprise(discoveryItem);
  } else if (target.dataset.opening === 'yes' || target.dataset.opening === 'no') {
    recordEvent('opening_answered', { branch: target.dataset.opening });
    openingAnswer = target.dataset.opening;
    selected = [];
    screen = 'mission';
  } else if (target.dataset.choice) {
    const choiceId = target.dataset.choice;
    selected = openingAnswer === 'yes'
      ? selected.includes(choiceId) ? selected.filter((id) => id !== choiceId) : [...selected, choiceId]
      : [choiceId];
    render('choice');
    return;
  } else if (target.dataset.discovery) {
    discoveryId = target.dataset.discovery;
    chapterId = '';
    recordEvent('discovery_opened', { target: discoveryId });
    const discoveryItem = content.discovery.items.find((item) => item.id === discoveryId);
    if (discoveryItem?.randomizeChapters && discoveryItem.chapters?.length) {
      showNextSurprise(discoveryItem);
    } else {
      screen = discoveryItem?.chapters?.length ? 'chapters' : 'detail';
    }
  } else if (target.dataset.chapter) {
    chapterId = target.dataset.chapter;
    screen = 'chapter';
    recordEvent('chapter_opened', { target: `${discoveryId}/${chapterId}` });
  } else if (action === 'confirm' && selected.length) {
    recordEvent('mission_completed', { branch: openingAnswer, selections: selected });
    screen = 'complete';
  }
  render();
});

app.addEventListener('pointerdown', (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-operator-entry], [data-power-control]');
  if (!target) return;

  if (target.hasAttribute('data-operator-entry')) {
    cancelOperatorEntryHold();
    target.classList.add('is-holding');
    operatorEntryTimer = window.setTimeout(() => {
      operatorEntryTimer = 0;
      suppressOperatorClick = true;
      screen = 'operator';
      powerState = 'idle';
      render();
      window.setTimeout(() => { suppressOperatorClick = false; }, 800);
    }, operatorEntryHoldMilliseconds);
  }

  if (target.dataset.powerControl && powerState !== 'requesting' && powerState !== 'shutting-down' && powerState !== 'restarting') {
    cancelPowerHold();
    target.classList.add('is-holding');
    powerTimer = window.setTimeout(() => {
      powerTimer = 0;
      void requestPowerAction(target.dataset.powerControl as PowerAction);
    }, shutdownHoldMilliseconds);
  }
});

window.addEventListener('pointerup', () => {
  cancelOperatorEntryHold();
  cancelPowerHold();
});
window.addEventListener('pointercancel', () => {
  cancelOperatorEntryHold();
  cancelPowerHold();
});
app.addEventListener('contextmenu', (event) => {
  if ((event.target as HTMLElement).closest('[data-operator-entry], [data-power-control]')) {
    event.preventDefault();
  }
});
window.addEventListener('pointerdown', resetIdleTimer, { passive: true });
window.addEventListener('keydown', resetIdleTimer, { passive: true });

void loadExperience()
  .then((loadedPackage) => {
    organizationPackageId = loadedPackage.manifest.id;
    content = loadedPackage.content;
    applyOrganizationPackage(loadedPackage.manifest, content);
    beginVisitorSession();
    render();
  })
  .catch((error: unknown) => {
    console.error('Engage could not load the active organization package.', error);
    renderPackageFailure();
  });
