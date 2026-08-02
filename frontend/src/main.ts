import './style.css';

const app = document.querySelector<HTMLElement>('#app');

if (!app) {
  throw new Error('ExpoPi app root was not found.');
}

app.innerHTML = `
  <section class="welcome" aria-labelledby="welcome-title">
    <p class="eyebrow">CTG ExpoPi</p>
    <h1 id="welcome-title">Convention experience ready.</h1>
    <p>The project workspace is configured. Visitor flows come next.</p>
  </section>
`;

