import './style.css';
import { loadExperience, type ExperienceContent } from './content';

const appRoot = document.querySelector<HTMLElement>('#app');

if (!appRoot) throw new Error('CTG Engage app root was not found.');

const app = appRoot;

type Screen = 'home' | 'mission' | 'complete';

let content: ExperienceContent;
let screen: Screen = 'home';
let selected = '';
let showHint = false;
let idleTimer = 0;

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

function resetIdleTimer() {
  window.clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => {
    if (screen !== 'home') {
      screen = 'home';
      selected = '';
      showHint = false;
      render();
    }
  }, content.idleTimeoutSeconds * 1000);
}

function shell(body: string, step: number) {
  return `<main class="kiosk-shell">
    <header class="brand-bar">
      <button class="wordmark" data-action="home" aria-label="Return to the ${escapeHtml(content.brand.product)} home screen">
        <img class="brand-logo" src="${escapeHtml(content.assets.brandLogo)}" alt="" aria-hidden="true">
        <span class="brand-name">${productName()}</span>
      </button>
      <p class="tagline">${escapeHtml(content.brand.tagline)}</p>
    </header>
    <div class="progress" aria-label="Step ${step} of 3">
      <span>${String(step).padStart(2, '0')} / 03</span>
      <span class="progress-track"><span style="width:${(step / 3) * 100}%"></span></span>
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
      <button class="primary-button" data-action="start">${escapeHtml(home.cta)} <span aria-hidden="true">→</span></button>
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
  const choiceButtons = mission.choices.map((choice, index) => `
    <button class="choice ${selected === choice.id ? 'selected' : ''}" data-choice="${escapeHtml(choice.id)}" aria-pressed="${selected === choice.id}">
      <span class="choice-key">${String.fromCharCode(65 + index)}</span>
      <span><strong>${escapeHtml(choice.label)}</strong><small>${escapeHtml(choice.detail)}</small></span>
      <span class="choice-check" aria-hidden="true">✓</span>
    </button>`).join('');

  return shell(`<section class="screen mission-screen" aria-labelledby="mission-title">
    <div class="mission-heading">
      <p class="eyebrow">Mission ${escapeHtml(mission.number)} · ${escapeHtml(mission.label)}</p>
      <h1 id="mission-title" tabindex="-1">${escapeHtml(mission.title)}</h1>
      <p>${escapeHtml(mission.prompt)}</p>
    </div>
    <div class="choice-list" role="group" aria-label="${escapeHtml(mission.choiceAriaLabel)}">${choiceButtons}</div>
    <div class="mission-actions">
      <p class="hint ${showHint ? 'visible' : ''}" role="status">${showHint ? escapeHtml(mission.retryHint) : ''}</p>
      <button class="primary-button compact" data-action="confirm" ${selected ? '' : 'disabled'}>${escapeHtml(mission.confirmLabel)} <span aria-hidden="true">→</span></button>
    </div>
  </section>`, 2);
}

function completeScreen() {
  const completion = content.completion;
  return shell(`<section class="screen complete-screen" aria-labelledby="complete-title">
    <div class="success-mark" aria-hidden="true"><span>✓</span></div>
    <div class="complete-copy">
      <p class="eyebrow">${escapeHtml(completion.eyebrow)}</p>
      <h1 id="complete-title" tabindex="-1">${escapeHtml(completion.title)}</h1>
      <p class="lede">${escapeHtml(completion.lede)}</p>
      <blockquote>“${escapeHtml(completion.promotionalLine)}”</blockquote>
    </div>
    <aside class="ctg-card">
      <p class="card-kicker">${escapeHtml(completion.aboutKicker)}</p>
      <h2>${escapeHtml(completion.aboutTitle)}</h2>
      <p>${escapeHtml(completion.aboutBody)}</p>
      <div class="cta-row">
        <div><span>${escapeHtml(completion.ctaKicker)}</span><strong>${escapeHtml(completion.ctaText)}</strong></div>
        <img class="cta-qr" src="${escapeHtml(content.assets.qrCode)}" alt="${escapeHtml(completion.qrAlt)}">
      </div>
    </aside>
    <button class="secondary-button" data-action="restart">${escapeHtml(completion.restartLabel)}</button>
  </section>`, 3);
}

function render(focusTarget: 'heading' | 'choice' = 'heading') {
  app.innerHTML = screen === 'home' ? homeScreen() : screen === 'mission' ? missionScreen() : completeScreen();
  const focusElement = focusTarget === 'choice' && selected
    ? app.querySelector<HTMLElement>(`[data-choice="${CSS.escape(selected)}"]`)
    : app.querySelector<HTMLElement>('h1');
  focusElement?.focus({ preventScroll: true });
  resetIdleTimer();
}

app.addEventListener('click', (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action], [data-choice]');
  if (!target) return;
  const action = target.dataset.action;

  if (action === 'home' || action === 'restart') {
    screen = 'home'; selected = ''; showHint = false;
  } else if (action === 'start') {
    screen = 'mission';
  } else if (target.dataset.choice) {
    selected = target.dataset.choice; showHint = false;
    render('choice');
    return;
  } else if (action === 'confirm' && selected) {
    const selectedChoice = content.mission.choices.find((choice) => choice.id === selected);
    if (selectedChoice?.correct) {
      screen = 'complete'; showHint = false;
    } else {
      showHint = true;
      render('choice');
      return;
    }
  }
  render();
});

window.addEventListener('pointerdown', resetIdleTimer, { passive: true });
window.addEventListener('keydown', resetIdleTimer, { passive: true });

void loadExperience().then((loadedContent) => {
  content = loadedContent;
  render();
});
