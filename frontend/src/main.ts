import './style.css';

const appRoot = document.querySelector<HTMLElement>('#app');

if (!appRoot) throw new Error('CTG Engage app root was not found.');

const app = appRoot;

type Screen = 'home' | 'mission' | 'complete';

const choices = [
  ['spectate', 'Let them watch first', 'Give them time to learn the group from the sidelines.'],
  ['welcome', 'Make the first introduction', 'Invite them in, learn their name, and find a game you share.'],
  ['rules', 'Start with the rules', 'Explain how the community works before getting acquainted.'],
] as const;

let screen: Screen = 'home';
let selected = '';
let showHint = false;
let idleTimer = 0;

function resetIdleTimer() {
  window.clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => {
    if (screen !== 'home') {
      screen = 'home';
      selected = '';
      showHint = false;
      render();
    }
  }, 120_000);
}

function shell(content: string, step: number) {
  return `<main class="kiosk-shell">
    <header class="brand-bar">
      <button class="wordmark" data-action="home" aria-label="Return to the CTG Engage home screen">
        <span class="brand-mark" aria-hidden="true"><span>C</span><span>T</span><span>G</span></span>
        <span class="brand-name">CTG <strong>ENGAGE</strong></span>
      </button>
      <p class="tagline">Our Community <span aria-hidden="true">—</span> Deployed.</p>
    </header>
    <div class="progress" aria-label="Step ${step} of 3">
      <span>${String(step).padStart(2, '0')} / 03</span>
      <span class="progress-track"><span style="width:${(step / 3) * 100}%"></span></span>
    </div>
    ${content}
    <footer><span>Combat Tested Gaming</span><span class="status"><i></i> Offline experience ready</span></footer>
  </main>`;
}

function homeScreen() {
  return shell(`<section class="screen home-screen" aria-labelledby="home-title">
    <div class="hero-copy">
      <p class="eyebrow">Welcome to the community</p>
      <h1 id="home-title" tabindex="-1">Better connections<br><em>start with hello.</em></h1>
      <p class="lede">Take a one-minute mission and discover how a simple first move can turn a room full of strangers into a squad.</p>
      <button class="primary-button" data-action="start">Begin your mission <span aria-hidden="true">→</span></button>
      <p class="touch-note"><span aria-hidden="true">◎</span> Tap the button to begin</p>
    </div>
    <div class="hero-art" aria-hidden="true">
      <div class="radar radar-one"></div><div class="radar radar-two"></div>
      <div class="connection connection-a"><span></span><span></span></div>
      <div class="connection connection-b"><span></span><span></span></div>
      <div class="mission-card"><p>Today’s mission</p><strong>Make the first move.</strong><span>01 minute · all skill levels</span></div>
    </div>
  </section>`, 1);
}

function missionScreen() {
  const choiceButtons = choices.map(([id, label, detail], index) => `
    <button class="choice ${selected === id ? 'selected' : ''}" data-choice="${id}" aria-pressed="${selected === id}">
      <span class="choice-key">${String.fromCharCode(65 + index)}</span>
      <span><strong>${label}</strong><small>${detail}</small></span>
      <span class="choice-check" aria-hidden="true">✓</span>
    </button>`).join('');

  return shell(`<section class="screen mission-screen" aria-labelledby="mission-title">
    <div class="mission-heading">
      <p class="eyebrow">Mission 01 · First contact</p>
      <h1 id="mission-title" tabindex="-1">A new player walks up alone.</h1>
      <p>They’re interested—but they don’t know anyone yet. What’s your first move?</p>
    </div>
    <div class="choice-list" role="group" aria-label="Choose your first move">${choiceButtons}</div>
    <div class="mission-actions">
      <p class="hint ${showHint ? 'visible' : ''}" role="status">${showHint ? 'Strong communities start by making room. Try the choice that puts connection first.' : ''}</p>
      <button class="primary-button compact" data-action="confirm" ${selected ? '' : 'disabled'}>Lock it in <span aria-hidden="true">→</span></button>
    </div>
  </section>`, 2);
}

function completeScreen() {
  return shell(`<section class="screen complete-screen" aria-labelledby="complete-title">
    <div class="success-mark" aria-hidden="true"><span>✓</span></div>
    <div class="complete-copy">
      <p class="eyebrow">Mission complete</p>
      <h1 id="complete-title" tabindex="-1">That’s how community starts.</h1>
      <p class="lede">You didn’t start with a pitch or a rulebook. You started with a person.</p>
      <blockquote>“Creating better first conversations.”</blockquote>
    </div>
    <aside class="ctg-card">
      <p class="card-kicker">About CTG</p>
      <h2>Gaming with purpose.<br>Community for life.</h2>
      <p>Combat Tested Gaming brings veterans and allies together through gaming, shared experiences, and genuine connection.</p>
      <div class="cta-row"><div><span>Your next move</span><strong>Meet the CTG team today.</strong></div><span class="cta-arrow" aria-hidden="true">→</span></div>
    </aside>
    <button class="secondary-button" data-action="restart">Run it again</button>
  </section>`, 3);
}

function render(focusTarget: 'heading' | 'choice' = 'heading') {
  app.innerHTML = screen === 'home' ? homeScreen() : screen === 'mission' ? missionScreen() : completeScreen();
  const focusElement = focusTarget === 'choice' && selected
    ? app.querySelector<HTMLElement>(`[data-choice="${selected}"]`)
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
    if (selected === 'welcome') { screen = 'complete'; showHint = false; }
    else {
      showHint = true;
      render('choice');
      return;
    }
  }
  render();
});

window.addEventListener('pointerdown', resetIdleTimer, { passive: true });
window.addEventListener('keydown', resetIdleTimer, { passive: true });
render();
