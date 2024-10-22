import { Scene } from 'phaser';
import { Client } from 'colyseus.js';

class BootScene extends Scene {
  constructor() {
    super({
      key: "scene-boot",
      pack: {
        files: [
            { type: 'image', key: 'gf-studios', url: 'assets/GeiserForge.png' }
        ]
      }
    });
  }
  
  preload() {
    var img = this.add.image(this.sys.canvas.width / 2, this.sys.canvas.height / 2, 'gf-studios');
    img.setOrigin(0.5, 0.5);
    img.setScale(this.sys.canvas.width / img.width);
    // Sprites
    this.load.aseprite('atlas', 'assets/sprites/knight.png', 'assets/sprites/knight.json');
    this.load.image('sword', 'assets/sprites/sword.png');
    this.load.image('sword-tip', 'assets/sprites/sword-tip.png');

    this.load.spritesheet('room-pointer', 'assets/sprites/PointerSword.png', {
      frameWidth: 240,
      frameHeight: 51
    });

    this.load.spritesheet('gameover-screen', 'assets/sprites/WinScreen.png', {
      frameWidth: 960,
      frameHeight: 540
    });

    this.load.aseprite('curtains', 'assets/sprites/Curtains.png', 'assets/sprites/Curtains.json');

    // this.load.spritesheet('curtains', 'assets/sprites/Curtains.png', {
    //   frameWidth: 480,
    //   frameHeight: 270
    // });

    this.load.image('rip-bozo', 'assets/sprites/RIPBOZO.png');

    // Particles
    this.load.atlas('rain', 'assets/particles/rain.png', 'assets/particles/rain.json');
    this.load.atlas('flares', 'assets/particles/flares.png', 'assets/particles/flares.json');

    // Audio
    this.load.audio('menu-music', 'assets/audio/atlantis-song.mp3');
    // this.load.audio('arena-music', 'assets/audio/arena-music.mp3');
    this.load.audio('arena-rain-loop', 'assets/audio/rain-music-loop.mp3');

    this.load.audio('sword-switch-level', 'assets/audio/Sword/SwitchSwordLevel.wav');
    this.load.audio('sword-parry', 'assets/audio/Sword/ParriedStanding.wav');
    this.load.audio('sword-parry-high', 'assets/audio/Sword/ParriedThrownSword.wav');
    this.load.audio('sword-pickup', 'assets/audio/Sword/SwordPickedUp.wav');

    this.load.audio('player-jump', 'assets/audio/jump.wav');
    this.load.audio('step1', 'assets/audio/Running/step1.wav');
    this.load.audio('step2', 'assets/audio/Running/step2.wav');
    this.load.audio('step3', 'assets/audio/Running/step3.wav');
    this.load.audio('step4', 'assets/audio/Running/step4.wav');

    this.load.audio('player-stabbed', 'assets/audio/Death/Stabbed.wav');
    this.load.audio('curbstomped', 'assets/audio/Death/CurbStomped.wav');
    this.load.audio('player-scream', 'assets/audio/Death/Scream.wav');

    this.load.audio('btn-click', 'assets/audio/UI/button-click.wav');
    this.load.audio('btn-click-2', 'assets/audio/UI/button-click-2.wav');
    this.load.audio('btn-clack', 'assets/audio/UI/button-clack.wav');

    // Maps
    this.load.tilemapTiledJSON('map-arena', 'assets/maps/arena.json');

    this.load.image('tileset', 'assets/maps/tileset.png');
    this.load.tilemapTiledJSON('SingularityMap', 'assets/maps/SingularityMap02.json');

    // Map room BGs
    this.load.spritesheet('room_0-bg', 'assets/maps/backgrounds/room_0.png', { frameWidth: 960, frameHeight: 540 });
    this.load.aseprite('room_1-bg', 'assets/maps/backgrounds/room_1.png', 'assets/maps/backgrounds/room_1.json');
    this.load.aseprite('room_2-bg', 'assets/maps/backgrounds/room_2.png', 'assets/maps/backgrounds/room_2.json');
    this.load.aseprite('room_3-bg', 'assets/maps/backgrounds/room_3.png', 'assets/maps/backgrounds/room_3.json');
    this.load.aseprite('room_4-bg', 'assets/maps/backgrounds/room_4.png', 'assets/maps/backgrounds/room_4.json');
    this.load.aseprite('room_5-bg', 'assets/maps/backgrounds/room_5.png', 'assets/maps/backgrounds/room_5.json');
    this.load.aseprite('room_6-bg', 'assets/maps/backgrounds/room_6.png', 'assets/maps/backgrounds/room_6.json');

    // DOM UI
    this.load.html('dom-lobby', 'assets/html/lobby-scene.html');
    this.load.html('dom-game-overlay', 'assets/html/game-overlay.html');

    // Preloader
    this.completeText = this.add.text(window.innerWidth / 2, window.innerHeight - 50, 'Click to Start', {
      fontFamily: 'Cormorant Garamond',
      color: '#FFF',
      fontSize: "32px"
    });
    this.completeText.setOrigin(0.5, 1);

    this.warningText = this.add.text(window.innerWidth / 2, 50, 'TRIDENT PRIVATE PVP DEMO v0.1\n\nWARNING: This game may potentially trigger seizures for people with photosensitive epilepsy. Viewer discretion is advised.', {
      fontFamily: 'monospace',
      color: '#777',
      fontSize: "16px",
      wordWrap: {
        width: 420
      },
      align: 'center'
    });
    this.warningText.setOrigin(0.5, 0);

    this.preloaderLog = this.add.text(window.innerWidth - 20, window.innerHeight - 20, '', {
      fontFamily: 'monospace',
      color: 'rgba(180, 110, 110, 0.3)',
      fontSize: "22px",
      align: 'right'
    });
    this.preloaderLog.setOrigin(1, 1);

    this.loadRectangleBG = this.add.rectangle(0, window.innerHeight, window.innerWidth, 5, 0x000000).setOrigin(0, 1);
    this.loadRectangle = this.add.rectangle(0, window.innerHeight, 0, 5, 0x666611).setOrigin(0, 1);

    this.load.on('filecomplete', (file) => {
      this.preloaderLog.text += `\n${file}`;
    });

    this.load.on('progress', (value) => {
      this.completeText.setText(`${Math.floor(value * 100)}%`);
      this.completeText.setAlpha(value);

      this.loadRectangle.setSize(value * window.innerWidth, 5);
    });

    this.load.on('complete', () => {
      this.completeText.setText('Click to Start');
    });
  }

  create() {
    this.buttonClick = this.sound.add('btn-click');

    // Parse animations
    this.anims.createFromAseprite('atlas');
    this.anims.createFromAseprite('room_1-bg');
    this.anims.createFromAseprite('room_2-bg');
    this.anims.createFromAseprite('room_3-bg');
    this.anims.createFromAseprite('room_4-bg');
    this.anims.createFromAseprite('room_5-bg');
    this.anims.createFromAseprite('room_6-bg');

    this.anims.createFromAseprite('room-pointer');

    // Create client on registry (so accessible between scenes)...
    
    // If on localhost, point to local server
    if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
      this.registry.gameClient = new Client('ws://localhost:2567');
    }
    else {
      this.registry.gameClient = new Client('wss://z61lxg.colyseus.dev');
    }

    this.input.on('pointerdown', () => {
      this.buttonClick.play();
      this.cameras.main.fadeOut(700, 0, 0, 0, () => {
        this.scene.start('scene-lobby');
        console.clear();
      });
    });

    // this.sound.setVolume(0);
  }
}

export default BootScene;