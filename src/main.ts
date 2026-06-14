import { Game } from './Game';

const container = document.getElementById('game-container');
if (container) {
  new Game(container);
}
