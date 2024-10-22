// import './main.css';
import Phaser, {Game} from 'phaser';
import BootScene from './scenes/BootScene';
import GameScene from './scenes/GameScene';
import LobbyScene from './scenes/LobbyScene';
import GameUI from './scenes/GameUI';
import "./styles/root.scss";

const config = {
  type: Phaser.WEBGL,
  scale: {
    mode: Phaser.Scale.NONE,
    parent: 'game',
    width: window.innerWidth,
    height: window.innerHeight
  },
  dom: {
    createContainer: true
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 400 },
      debug: false,
    }
  },
  // plugins: {
  //   global: [
  //     {
  //       key: 'AnimatedTiles',
  //       url: ,
  //       mapping: 'animatedTiles',
  //       start: true
  //     },
  //   ]
  // },
  pixelArt: true,
  scene: [
    BootScene,
    LobbyScene,
    GameScene,

    // Overlay scenes
    GameUI
  ]
};

const game = new Game(config);

window.addEventListener('resize', function (event) {

  game.scale.resize(window.innerWidth, window.innerHeight);

}, false);