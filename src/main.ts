import './styles.css';
import { Game } from './game/game';

const app = document.getElementById('app')!;
const loading = document.createElement('div');
loading.className = 'loading';
loading.textContent = 'Reticulating splines…';
document.body.appendChild(loading);

function webglAvailable(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

// Let the loading text paint before the (synchronous) demo city is generated.
requestAnimationFrame(() =>
  setTimeout(() => {
    if (!webglAvailable()) {
      loading.textContent = 'SlopCity 3000 needs WebGL 2. Please use a recent version of Chrome, Edge, Firefox or Safari.';
      return;
    }
    try {
      const game = new Game(app);
      game.start();
      loading.classList.add('done');
      setTimeout(() => loading.remove(), 700);
      (window as unknown as { slop: unknown }).slop = game;
    } catch (e) {
      console.error(e);
      loading.textContent = `Something went wrong while starting the game: ${(e as Error).message}`;
    }
  }, 30),
);
