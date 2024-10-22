// @ts-nocheck
import { Scene } from 'phaser';
import PlayerContainer from '../sprites/PlayerContainer';

import '../plugins/AnimatedTiles';

const MAX_SPEED = 360;
const ACCELERATION = 30;

// Scroll factor to use in updateParallax()
// 0 = no parallax
// 1 = full parallax
const SCROLL_FACTOR = 0.10;

class GameScene extends Scene {
  constructor() {
    super("scene-game");
  }

  preload() {
    // Plugins
    this.load.scenePlugin('AnimatedTiles', window.AnimatedTiles, 'animatedTiles', 'animatedTiles');
  }

  debugXYMarker(xPos, yPos, color = 0xff0000) {
    var gfx = this.add.graphics();
    gfx.lineStyle(1, color, 1);
    gfx.lineBetween(xPos, 0, xPos, 5000); // Vertical line
    gfx.lineBetween(0, yPos, 10000, yPos); // Horizontal line
  }

  create() {
    this.currentMessageIndex = 0;
    this.unsettledMessages = new Map();

    this.cameras.main.fadeIn(1500, 0, 0, 0);

    this.connectedToChat = false

    // @todo Remove this later
    this.currentDebugCameraIndex = 0;
    this.debugFollow = false;

    // Input locking for chat input
    this.inputLocked = false;
    this.didSendEmptyInput = false;

    this.rainEmitters = {};

    // Set up Arena music
    this.backgroundmusic = this.sound.add('arena-rain-loop');

    this.playerSounds = {
      switchLevel: this.sound.add('sword-switch-level'),
      parry: this.sound.add('sword-parry'),
      parryHigh: this.sound.add('sword-parry-high'),
      stabDeath: this.sound.add('player-stabbed'),
      stompDeath: this.sound.add('curbstomped'),
      jump: this.sound.add('player-jump'),
      swordPickup: this.sound.add('sword-pickup'),
      // steps: [
      //   this.sound.add('step1'),
      //   this.sound.add('step2'),
      //   this.sound.add('step3'),
      //   this.sound.add('step4'),
      // ]
    }

    this.sound.setVolume(0);

    this.tweens.add({
      targets: this.sound,
      volume: 1,
      duration: 3000,
      ease: 'Linear',
    });

    this.backgroundmusic.play({ loop: true });

    // Launch game overlay UI in parallel
    this.scene.launch('scene-game-ui', {
      parentScene: this
    });
    this.overlayUI = this.scene.get('scene-game-ui');

    // Player sprites clientside representation
    this.playerSprites = {
      // [sessionId]: {
      //   ...[player data]
      // }
    };

    this.objectSprites = {};
    this.debugBodies = {};
    this.isGameOver = false;

    // This client's player ref
    this.player = null;
    this.playerID = null;


    // WSAD keyboard helper
    this.cursors = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      attack: Phaser.Input.Keyboard.KeyCodes.K,
      jump: Phaser.Input.Keyboard.KeyCodes.J
    });

    // Local input cache
    this.inputPayload = {
      up: false,
      left: false,
      right: false,
      down: false,
      attack: false,
      jump: false,
      roll: false
    };

    // Event based inputs
    this.input.keyboard.on('keyup-W', () => {
      if(!this.inputLocked) this.registry.gameRoom.send('change-stance', {
        direction: 'up'
      });
    });

    this.input.keyboard.on('keyup-S', () => {
      if(!this.inputLocked) this.registry.gameRoom.send('change-stance', {
        direction: 'down'
      });
    });

    this.tilemap = this.make.tilemap({ key: 'SingularityMap' });

    // var debugGfx = this.add.graphics();

    // this.tilemap.renderDebug(debugGfx, {
    //   tileColor: null, // Color of non-colliding tiles
    //   collidingTileColor: new Phaser.Display.Color(243, 134, 48, 255), // Color of colliding tiles
    //   faceColor: new Phaser.Display.Color(40, 39, 37, 255) // Color of colliding face edges
    // }, 'ground');

    this.tileset = this.tilemap.addTilesetImage('Singularity_tiles', 'tileset');
    this.ground = this.tilemap.createLayer('ground', this.tileset);

    this.ground.setCollisionByProperty({ collides: true });

    // Enable animated tiles
    this.animatedTiles.init(this.tilemap);

    this.roomBounds = this.tilemap.getObjectLayer('rooms').objects;

    this.roomBG = this.add.sprite(0, 0, 'room_0-bg');
    // this.roomBG.setTexture('room_0-bg');
    // this.roomBG.setFrame(0);
    // Set y origin lower from center because roomBG is so huge now
    this.roomBG.setOrigin(0.5, 0.25);
    this.roomBG.setScale(2);

    this.roomCenter = {
      x: 0,
      y: 0
    }

    this.setupRain();
    // Unpause the center room emitters
    this.rainEmitters['room_0'][0].start();
    this.rainEmitters['room_0'][1].start();
    this.rainEmitters['room_L1'][0].start();
    this.rainEmitters['room_L1'][1].start();
    this.rainEmitters['room_R1'][0].start();
    this.rainEmitters['room_R1'][1].start();

    this.addWinObjs();

    this.joinChatRoom(this.registry.gameRoom.state.chatRoomID);

    /**
     * @-+=========================================================+-@
     * |                   Handle Server Updates                     |
     * @-+=========================================================+-@
     */
    this.registry.gameRoom.onMessage('player-move', ({ messageID, playerID, data }) => {
      // @todo Finish dis sheeit
    });

    this.registry.gameRoom.state.players.onChange = (player, key) => {
      console.log(`Player ${player.id} change:`);
      console.log(key);
    }

    this.registry.gameRoom.onMessage('player-change-level', ({ messageID, playerID, level }) => {
      // If the player is in current room, play audio
      if(this.cameras.main.getBounds().contains(this.playerSprites[playerID].x, this.playerSprites[playerID].y)) {
        this.playerSounds.switchLevel.play();
      } 
    });

    this.registry.gameRoom.onMessage('player-killed', ({ playerID, isLaying }) => {
      this.playerSprites[playerID].kill(isLaying);
    });

    this.registry.gameRoom.onMessage('player-pickup', (playerID) => {
      this.playerSprites[playerID].sprite.hasSword = true;
      if(this.cameras.main.getBounds().contains(this.playerSprites[playerID].x, this.playerSprites[playerID].y)) {
        this.playerSounds.swordPickup.play();
      } 
    });

    this.registry.gameRoom.onMessage('player-fall-down', (playerID) => {
      this.playerSprites[playerID].fall();
    });

    this.registry.gameRoom.onMessage('player-jump', ({ messageID, playerID }) => {
      this.playerSprites[playerID].sprite.isJumping = true;
      if(this.cameras.main.getBounds().contains(this.playerSprites[playerID].x, this.playerSprites[playerID].y)) {
        this.playerSounds.jump.play();
      } 
    });

    this.registry.gameRoom.onMessage('player-jumpkick', (playerID) => {
      // this.playerSprites[playerID].setAnim(`${this.playerSprites[playerID].hasSword ? "sword" : "nosword"}-jumpkick`, 'play-hold');
      this.playerSprites[playerID].sprite.isJumping = true;
      this.playerSprites[playerID].jumpkick();
    });

    this.registry.gameRoom.onMessage('player-crouch', ({ playerID, isCrouching }) => {
      // 
    });

    this.registry.gameRoom.state.objects.onRemove = (item, key) => {
      if (this.objectSprites[key]) {
        this.tweens.add({
          targets: this.objectSprites[key],
          alpha: 0,
          duration: 500,
          ease: 'Linear',
          onComplete: () => {
            this.objectSprites[key].destroy();
            delete this.objectSprites[key];
          }
        });
        // this.time.delayedCall(500, () => {
          
        // });
      }
      if (this.debugBodies[key]) {
        this.debugBodies[key].destroy();
        delete this.debugBodies[key];
      }
    };

    this.registry.gameRoom.onMessage('player-disarm', (playerID) => {
      this.playerSprites[playerID].sprite.disarm();
      this.playerSounds.parry.play();
    });

    this.registry.gameRoom.onMessage('thrown-sword-parry', () => {
      this.playerSounds.parryHigh.play();
    });


    this.registry.gameRoom.onLeave((code) => {
      // Display error when disconnected from server
      if(code >= 1001 && cod <= 1015) {
        console.log('You have been disconnected from the server.');
        this.overlayUI.disconnected();
        // @todo Add a reconnect button
      }
    })

    /**
     * OLD! TODO: Kill
     */
    // Register server message listener
    this.registry.gameRoom.onMessage('player-attack', ({ messageID, playerID, hasSword, level, isCrouching }) => {
      console.log(`Player ${playerID} is attacking`);
      // Exclude our client, we're going to predict that we should attack
      // @todo Add server-client reconciliation of player state
      if (!this.playerSprites[playerID].isAttacking() && playerID !== this.playerID) {
        this.playerSprites[playerID].hasSword = hasSword;
        this.playerSprites[playerID].isCrouching = isCrouching;
        this.playerSprites[playerID].level = level; // Force level for other player sprites
        this.playerSprites[playerID].attack();
      }
    });

    this.registry.gameRoom.onMessage('player-curbstomp', ({ playerID }) => {
      console.log(`Player ${playerID} is curbstomping`);
      this.playerSprites[playerID].curbstomp();
    });

    this.registry.gameRoom.onMessage('camera-flash', () => {
      this.cameras.main.flash(200);
    });

    this.registry.gameRoom.onMessage('player-respawn', (playerID) => {
      // Wait 500ms before calling 'respawn' because 
      this.time.delayedCall(500, () => this.playerSprites[playerID].respawn());
    });

    this.registry.gameRoom.onMessage('game-over', ({winnerID, winnerName, winnerByDefault }) => {
      if (!this.isGameOver) {
        if(!winnerByDefault) {
          this.cameras.main.stopFollow();
          this.gameOver = true;
          console.log(`Game over! ${winnerName} wins!`);
          // Add particle emitter
          if(this.playerID == winnerID) {
            this.gameOverEmitter = this.add.particles('flares');
            this.time.delayedCall(500, () => {
              var emitter = this.gameOverEmitter.createEmitter({
                frame: ['blue', 'red', 'green', 'yellow'],
                x: this.playerSprites[this.playerID].body.center.x,
                y: this.playerSprites[this.playerID].body.center.y,
                lifespan: 1000,
                speed: { start: 50, end: 10 },
                angle: { min: 0, max: 360 },
                scale: { start: 0.2, end: 0 },
                blendMode: 'ADD',
                follow: this.playerSprites[this.playerID]
              });
            });
            this.gameOverEmitter.setDepth(1);
            this.playerSprites[this.playerID].setDepth(2);
          } else {
            this.cameras.main.setTint(0xaaaaaa);
          }

          this.time.delayedCall(2000, () => {
            this.input.keyboard.clearCaptures();
            this.backgroundmusic.stop();
            this.overlayUI.gameOver(winnerName, winnerByDefault);
            this.registry.gameRoom.leave();
          })
          
          // this.tweens.add({
          //   targets: this.playerSprites[this.playerID],
          //   y: this.playerSprites[this.playerID].y + 50,
          //   duration: 1000,
          //   ease: 'Power2',
          //   onComplete: () => {
          //     emitter.stop();
          //     this.gameOverEmitter.createEmitter({
          //       frame: ['blue', 'red', 'green', 'yellow'],
          //       x: this.playerSprites[this.playerID].body.center.x,
          //       y: this.playerSprites[this.playerID].body.center.y,
          //       lifespan: 1000,
          //       speed: { min: 200, max: 250 },
          //       angle: { min: 92, max: 88 },
          //       scale: { start: 0.5, end: 0 },
          //       blendMode: 'ADD',
          //       follow: this.playerSprites[this.playerID]
          //     });
          //     this.tweens.add({
          //       targets: [this.playerSprites[this.playerID], this.playerSprites[this.playerID].sprite],
          //       y: -10,
          //       duration: 2000,
          //       ease: 'Power2',
          //       onComplete: () => {
                  // this.input.keyboard.clearCaptures();
                  // this.backgroundmusic.stop();
                  // this.overlayUI.gameOver(winnerName, winnerByDefault);
                  // this.registry.gameRoom.leave();
          //       }
          //     })
          //   }
          // })

          this.tweens.add({
            targets: this.backgroundmusic,
            volume: 0,
            duration: 1000,
          });
        } else {
          this.input.keyboard.clearCaptures();
          this.tweens.add({
            targets: this.backgroundmusic,
            volume: 0,
            duration: 1000,
          });
          this.time.delayedCall(1300, () => {
            this.backgroundmusic.stop();
          });
          this.overlayUI.gameOver(winnerName, winnerByDefault);
          this.registry.gameRoom.leave();
          this.isGameOver = true;
        }
      }
    });

    this.registry.gameRoom.onMessage('server-message', (data) => {
      try { 
        // Single string
        if(typeof data === 'string') {
          console.log(data);
        // String array
        } else {

          let i = 0;

          // If first argument is a command, execute it and don't print it.
          // The following arguments will be data
          if(data[0].startsWith(':')) {

          }

          for(;i < data.length; i++) {
            console.log(data[i]);
          }
        }
      } catch (e) {
        console.log(e);
      }
    });

    // Listen for new additions to the hitboxes to update hitbox colliders
    this.registry.gameRoom.state.hitboxDebug.onChange = (hitbox, key) => {
      if(hitbox.type === 'sword') {
        // this.physics.add.collider(<>, this.debugBodies[hitbox.id], () => {
        //   console.log("Player hit by a sword!");
        // });
      } else if (hitbox.type === 'player') {
        // @todo Add player hitbox collision
      }
    }

    // Camera config
    this.cameras.main.setZoom(2);
    this.cameras.main.setBackgroundColor('#001111');
    this.cameras.main.setBounds(0, 0, this.tilemap.widthInPixels, this.tilemap.heightInPixels);

    // Test (REMOVE AFTER)
    this.hitBoxesVisible = false;
    // this.hitBoxesVisible = true;

    this.input.keyboard.on('keydown-B', () => {
      if(!this.inputLocked) this.hitBoxesVisible = !this.hitBoxesVisible;
    });

    // Follow next game object
    // this.input.keyboard.on('keydown-C', () => {
    //   if(this.inputLocked) return;
    //   // Cancel debug camera
    //   // @todo fix this shit
    //   if(this.input.keyboard.checkDown(Phaser.Input.Keyboard.KeyCodes.SHIFT)) {
    //     console.log("WORKING")
    //     // Follow player again if SHIFT+C is held down
    //     this.cameras.main.startFollow(this.playerSprites[this.playerID]);
    //     this.debugFollow = false;
    //     return;
    //   // Cycle through current gameObjects with camera
    //   } else {
    //     this.debugFollow = true;
    //     // Set camera bounds to infinite
    //     this.cameras.main.setBounds(0, 0, this.tilemap.widthInPixels, this.tilemap.heightInPixels);
    //     // Collect all gameObjects
    //     const allSprites = new Map();
    //     // First, add player sprites
    //     for (const playerID in this.playerSprites) {
    //       allSprites.set(playerID, this.playerSprites[playerID]);
    //     }
    //     // Then, add object sprites
    //     for (const objectID in this.objectSprites) {
    //       allSprites.set(objectID, this.objectSprites[objectID]);
    //     }

    //     var IDs = [...allSprites.keys()];
    //     console.log(IDs);
        
    //     // Get next index of allSprites
    //     if(allSprites.get(IDs[this.currentDebugCameraIndex + 1])) {
    //       this.currentDebugCameraIndex++;
    //     } else {
    //       this.currentDebugCameraIndex = 0;
    //     }
        
    //     const objInfo = allSprites.get(IDs[this.currentDebugCameraIndex]);
    //     console.log(objInfo);
        
    //     console.log(`Camera following ${this.currentDebugCameraIndex}/${allSprites.size - 1} - ${IDs[this.currentDebugCameraIndex]}`);

    //     const nextSprite = allSprites.get(IDs[this.currentDebugCameraIndex]) || allSprites.get(IDs[0]);
    //     this.cameras.main.setZoom(0.5);
    //     this.cameras.main.startFollow(nextSprite);
    //   }
    // });

    // Initialize roomBG position
    const mapWidth = this.tilemap.widthInPixels;
    this.roomCenter.x = (this.getCurrentRoom(mapWidth / 2).x + (this.getCurrentRoom(mapWidth / 2).width / 2));
    this.roomCenter.y = this.getCurrentRoom(mapWidth / 2).height / 2;

    this.roomBG.setX(this.roomCenter.x);
    
    this.roomBG.setY(this.roomCenter.y);

    // Set roomBG scale
    // this.roomBG.setScale(1.1);
    // console.log(this.cameras.main.getScroll((this.getCurrentRoom(6500).x + (this.getCurrentRoom(6500).width / 2)), (this.getCurrentRoom(6500).height / 2)));
    // this.roomBG.setScrollFactor(SCROLL_FACTOR);

    // Layering
    this.roomBG.setDepth(-2);
    this.ground.setDepth(-1);
    this.renderRoomBG(this.registry.gameRoom.state);
  }

  async joinChatRoom(id) {
    if(this.connectedToChat) return;

    console.log(`Attempting to join chat: ${id}`)
    // Join the chat room if not already in it
    var room = await this.registry.gameClient.joinById(id, {
      playerName: this.registry.gameRoom.state.players[this.registry.gameRoom.sessionId].playerName
    });
    await this.registry.chatClients.set("current_room", room);
    await this.overlayUI.registerChatRooms();
    this.connectedToChat = true;
  }

  addWinObjs() {
    // Wait 10 seconds for objects to settle before placing images
    this.time.delayedCall(10000, () => {
      this.registry.gameRoom.state.objects.forEach(obj => {
        console.log(obj.texture);
        if(obj.texture === 'win-obj') {
          this.add.image(obj.x, obj.y, 'rip-bozo').setOrigin(0.5, 1).setDepth(1);
          console.log(`Added win object at ${obj.x}, ${obj.y}`);
        }
      }); 
    })
  }

  addNewPlayer(player) {
    const sprite = new PlayerContainer(this, player.x, player.y, player.width, player.height, player.playerName, player.color, false).setDepth(2);

    this.playerSprites[player.id] = sprite;

    this.physics.add.collider(this.ground, sprite, () => {
      console.log("Player hit the ground!");
    });

    // Add player to stats panel
    this.overlayUI.addPlayerToStats(player.id, player.playerName, player.winRoom);

    if (player.id === this.registry.gameRoom.sessionId) {
      this.player = this.playerSprites[player.id];
      this.playerID = player.id;
    }
  }

  syncState(state, sessionId) {
    // Add or update player sprites with latest from server
    state.players.forEach((player) => {
      const playerSpriteExists = (typeof this.playerSprites[player.id] !== 'undefined');

      // Players other than this client
      if (playerSpriteExists) {
        // this.playerSprites[player.id].setPosition(player.x, player.y);
        // Cache recent server X & Y positions for smooth movement
        this.playerSprites[player.id].setData('serverX', player.x);
        this.playerSprites[player.id].setData('serverY', player.y);

        this.playerSprites[player.id].prevX = this.playerSprites[player.id].x;
        this.playerSprites[player.id].prevY = this.playerSprites[player.id].y;

        // Update player velocity
        this.playerSprites[player.id].velocityX = player.x - this.playerSprites[player.id].x;
        this.playerSprites[player.id].velocityY = player.y - this.playerSprites[player.id].y;

        // Sync player states
        // this.playerSprites[player.id].setVelX(player.velX);
        this.playerSprites[player.id].sprite.isFallen = player.isFallenDown;
        this.playerSprites[player.id].sprite.hasSword = player.hasSword;
        this.playerSprites[player.id].sprite.level = player.level;

        // Update positions of living player sprites by interpolating between server X & Y positions]
        if(this.playerSprites[player.id].isAlive) {
          this.playerSprites[player.id].x = Phaser.Math.Linear(this.playerSprites[player.id].x, 
            this.playerSprites[player.id].data.values.serverX, 0.5);
          this.playerSprites[player.id].y = Phaser.Math.Linear(this.playerSprites[player.id].y, 
            this.playerSprites[player.id].data.values.serverY, 0.5);
        // Otherwise, don't LERP
        } else {
          this.playerSprites[player.id].x = this.playerSprites[player.id].data.values.serverX;
          this.playerSprites[player.id].y = this.playerSprites[player.id].data.values.serverY;
        }
        

        
        this.playerSprites[player.id].setFlipX(player.flipX);
        if (!this.playerSprites[player.id].isAttacking()) {
          const prevAnim = this.playerSprites[player.id].getAnim();
          // if (player.anim != prevAnim) {
            this.playerSprites[player.id].setAnim(player.anim, player.animMode);
            // this.playerSprites[player.id].sprite.play(player.anim, true);
          // }
        }
      }
      // This client's player sprite
      // For client prediction
      // else if(playerSpriteExists && player.id === this.playerID) {
      //   // Left/Right Up/Down Movement is handled by the client

      //   this.playerSprites[player.id].setFlipX(player.flipX);
      //   if (!this.playerSprites[player.id].isAttacking()) {
      //     this.playerSprites[player.id].setAnim(player.anim, player.animMode);
      //   }
      // }
      else {
        // const sprite = new ServerAtlas(this, player.x, player.y, player.width, player.height, player.playerName, player.color);
        this.addNewPlayer(player);
      }
    });

    // Remove player sprites for any disconnected players
    Object.keys(this.playerSprites).forEach((id) => {
      const playerHasLeft = (typeof state.players[id] === 'undefined');

      if (playerHasLeft) {
        this.playerSprites[id].destroy();
        delete this.playerSprites[id];
      }
    });

    // Add or update object sprites
    state.objects.forEach((object) => {
      const objectSpriteExists = (typeof this.objectSprites[object.id] !== 'undefined');

      if (objectSpriteExists) {

        // Do not interpolate object positions, only player movement
        this.objectSprites[object.id].setPosition(object.x, object.y);

        this.objectSprites[object.id].setFlipX(object.flipX);
        this.objectSprites[object.id].setVisible(object.isTextureVisible);
      }
      else {
        const sprite = this.add.image(object.x, object.y, object.texture);
        sprite.setFlipX(object.flipX);
        sprite.setOrigin(object.originX, object.originY);
        sprite.setVisible(object.isTextureVisible);

        this.objectSprites[object.id] = sprite;
      }
    });

    // Sync hitbox debug bodies
    state.hitboxDebug.forEach((hitbox) => {
      const hitboxSpriteExists = (typeof this.debugBodies[hitbox.id] !== 'undefined');

      if (hitboxSpriteExists) {
        // If hitbox dimensions have changed, update them
        this.debugBodies[hitbox.id].setSize(hitbox.width, hitbox.height);
        // If hitbox position has changed, update it
        this.debugBodies[hitbox.id].setPosition(hitbox.x, hitbox.y);
        // If hitbox is visible, update it
        this.debugBodies[hitbox.id].setAlpha(hitbox.isActive ? 1 : 0);
        this.debugBodies[hitbox.id].setVisible(this.hitBoxesVisible);
        // this.debugBodies[hitbox.id].body.setDebug(this.hitBoxesVisible, this.hitBoxesVisible, 0x00aaaa);
        if(hitbox.isLethal) {
          if(this.debugBodies[hitbox.id].listenerRegistered === false) {
            this.debugBodies[hitbox.id].listenerRegistered = true;
            this.debugBodies[hitbox.id].setInteractive();
            this.debugBodies[hitbox.id].body.debugBodyColor = 0xff0000;
          }
          this.debugBodies[hitbox.id].setFillStyle(0xff0000, 0.25);
          this.debugBodies[hitbox.id].setStrokeStyle(1, 0xff0000, 0.4);
        } else {
          this.debugBodies[hitbox.id].setFillStyle(0xff00ff, 0.25);
          this.debugBodies[hitbox.id].setStrokeStyle(1, 0xff00ff, 0.4);
          this.debugBodies[hitbox.id].body.debugBodyColor = 0xff00ff;
        }
      }
      else {
        // Debug bodies
        const debugBody = this.add.rectangle(
          hitbox.x,
          hitbox.y,
          hitbox.width,
          hitbox.height,
          0xFF00FF,
          0.25
        );
        // Add hitboxes to physics to render collisions
        this.physics.add.existing(debugBody, false);
        debugBody.body.allowGravity = false;

        debugBody.setVisible(this.hitBoxesVisible);
        debugBody.setAlpha(hitbox.isActive ? 1 : 0);
        debugBody.setOrigin(0, 0);

        this.debugBodies[hitbox.id] = debugBody;
        this.debugBodies[hitbox.id].listenerRegistered = false;
      }
    });
  }

  sendInput() {
    // If inputLocked from chat, don't send input
    if(this.inputLocked) return;

    const {up, left, right, down, attack, jump} = this.cursors;

    this.inputPayload = {
      up: up.isDown,
      left: left.isDown,
      right: right.isDown,
      down: down.isDown,
      attack: attack.isDown,
      jump: jump.isDown,
    };

    var hasInput = false;

    for (var key in this.inputPayload) {
      if(this.inputPayload[key]) {
        hasInput = true;
        break;
      }
    }

    // Play character anims based on input, don't wait for server to send anims
    if(hasInput) {
      if(this.inputPayload.attack && !this.playerSprites[this.playerID].isAttacking() && !this.registry.gameRoom.state.players[this.playerID].isJumping) {
        if(this.inputPayload.up && this.player.sprite.level == 'high' && this.player.sprite.hasSword) {
          this.player.throwSword();
        } else {
          this.player.attack();
        }
      }
    }

    // Client Input prediction - Immediately adjust player sprite to match input
    // @todo Add client input prediction. 

    // If there is no input, and we have already said there's no input, do not send input.
    if(this.didSendEmptyInput && !hasInput) {
      return;
    } else if(!hasInput) {
      this.registry.gameRoom.send('keyboard-input', { ...this.inputPayload, messageID: this.currentMessageIndex });
      this.currentMessageIndex++; 
      this.didSendEmptyInput = true;
    } else {
      this.registry.gameRoom.send('keyboard-input', { ...this.inputPayload, messageID: this.currentMessageIndex });
      this.currentMessageIndex++;
      this.didSendEmptyInput = false;
    }
  }

  getCurrentRoom(x) {
    let room = null;

    this.roomBounds.forEach((r) => {
      const {x: rx, width} = r;
      if (x >= rx && x <= rx + width) {
        room = r;
      }
    });

    return room;
  }

  setRoomBounds(state) {
    // @todo Override setRoomBounds in debug camera mode, remove later
    if(this.debugFollow) return;

    if (this.player !== null) {
      let {x} = this.player;

      // Override x position to that of the opponent if you're dead
      const thisPlayer = state.players[this.playerID];

      if (typeof thisPlayer !== 'undefined' && thisPlayer.isDead) {
        state.players.forEach((player) => {
          const isEnemy = (player.id !== this.playerID);

          if (isEnemy) {
            x = player.x;
          }
        });
      }

      const room = this.getCurrentRoom(x);

      if (room !== null) {
        // const bgcolor = room.properties[0].value;
        // this.cameras.main.setBackgroundColor(bgcolor);
        this.cameras.main.setBounds(room.x, 0, room.width, this.tilemap.heightInPixels);
      }
    }
  }

  updateParallax() {
    // Get position in world of camera
    const worldPoint = this.cameras.main.getScroll(this.roomCenter.x, this.roomCenter.y);

    // Get difference between camera scroll and room center
    const distanceFromCenterX = this.cameras.main.scrollX - worldPoint.x;
    const distanceFromCenterY = this.cameras.main.scrollY - worldPoint.y;

    // Set position of roomBG image based on a percentage of the distance from the center of the room
    this.roomBG.x = this.roomCenter.x + distanceFromCenterX * SCROLL_FACTOR;
    this.roomBG.y = this.roomCenter.y + distanceFromCenterY * SCROLL_FACTOR;
  }

  runLocalUpdates(time, delta) {
    Object.keys(this.playerSprites).forEach((id) => {
      const sprite = this.playerSprites[id].sprite;

      if (typeof sprite.update === 'function') {
        sprite.update(time, delta);
      }
    });
  }

  handleCameraFollowing(state) {
    // @todo Override camera following for debugging purposes, remove this later
    if(this.debugFollow) return;

    if (!this.isGameOver) {
      let deadPlayerID = '';
  
      // Establish if there is a dead player
      state.players.forEach((player) => {
        if (player.isDead) {
          deadPlayerID = player.id;
        }
      });

      if (deadPlayerID !== '') {  
        // If there is, follow camera on alive player
        state.players.forEach((player) => {
          if (player.id !== deadPlayerID) {
            this.cameras.main.setTintFill(0x000000);
            this.cameras.main.startFollow(this.playerSprites[player.id], true, 0.1, 0.1);
          }
        });
      }
      else if (this.player !== null) {
        // If both players are alive, follow camera on self
        this.cameras.main.startFollow(this.player);
        this.cameras.main.clearTint();
      }
    }
  }

  /**
   * Method that sets up 2 rain emitters for each room, pauses all.
   * 
   * Example:
   * room_L1 = [fgEmitter, bgEmitter]
   * room_0 = [fgEmitter, bgEmitter]
   */
  setupRain() {
    var deadZoneRect = new Phaser.Geom.Rectangle(0, this.tilemap.heightInPixels + 10, this.tilemap.widthInPixels, 30);

    var gfxN = this.add.graphics();
    gfxN.fillStyle(0x0000ff, 0.5);
    gfxN.fillRectShape(deadZoneRect);

    var deadZone = {
      contains: (x, y) => {
        return Phaser.Geom.Rectangle.Contains(deadZoneRect, x, y);
      }
    }

    this.roomBounds.forEach((room) => {
      // Get room bounds
      const { width, x } = room;
      // Get the number of columns we should have based on the image width.
      // Multiply by 2 because we set the scale by 2.
      var widthInCols = Math.floor(width);

      // Get random x position within room bounds
      var rain = {
        width: widthInCols,
        height: 40,
        getPoints: function (quantity)
        {
            var cols = (new Array(rain.width)).fill(0);
            var lastCol = cols.length - 1;
            var Between = Phaser.Math.Between;
            var points = [];

            for (var i = 0; i < quantity; i++)
            {
                var col = Between(0, lastCol);
                points[i] = new Phaser.Math.Vector2(x + (2 * col), 350);
            }

            return points;
        }
      };
      // Create rain emitter
      const fgEmitter = this.add.particles('rain').setDepth(2).createEmitter({
        x: { min: -5, max: 5 },
        lifespan: 1000,
        frame: ['red', 'green', 'blue', 'yellow', 'orange', 'purp'],
        speed: 1500,
        angle: 90,
        scale: 0.2,
        emitZone: { source: rain, type: 'edge', quantity: 4000 },
        deathZone: { type: 'onEnter', source: deadZone },
        frequency: 1,
        quantity: 5,
        gravityY: 0,
        blendMode: 'ADD',
        // frequency: 100,
      });

      const bgEmitter = this.add.particles('rain').createEmitter({
        x: { min: -5, max: 5 },
        lifespan: 1000,
        frame: ['red', 'green', 'blue', 'yellow', 'orange', 'purp'],
        speed: 900,
        angle: 90,
        scale: 0.1,
        emitZone: { source: rain, type: 'edge', quantity: 9000 },
        deathZone: { type: 'onEnter', source: deadZone },
        frequency: 1,
        quantity: 10,
        gravityY: 0,
        blendMode: 'ADD',
        // frequency: 100,
      });

      bgEmitter.stop();
      fgEmitter.stop();

      // Add emitter to room
      this.rainEmitters[room.name] = [fgEmitter, bgEmitter];
    });
  }

  renderRoomBG(state) {
    if (this.player !== null) {
      let {x} = this.player;
      const { key: bgKey } = this.roomBG.texture;
      
      // Override x position to that of the opponent if you're dead
      const thisPlayer = state.players[this.playerID];

      if (typeof thisPlayer !== 'undefined' && thisPlayer.isDead) {
        state.players.forEach((player) => {
          const isEnemy = (player.id !== this.playerID);

          if (isEnemy) {
            x = player.x;
          }
        });
      }

      const room = this.getCurrentRoom(x);
      const roomName = room.name.replace('L', '').replace('R', '');
      
      if (bgKey !== `${roomName}-bg`) {
        // ------ Play RoomBG Anims ------
        this.roomBG?.stop();
        
        this.roomCenter.x = (room.x + (room.width / 2));

        this.roomBG.setX(this.roomCenter.x);
        // @todo Draw position of room center for debug purposes

        // this.debugXYMarker((room.x + (room.width / 2)), this.roomCenter.y, 0x0000ff);
        // this.roomBG.setScrollFactor(0.95);
        
        // console.log(`Setting room background to ${roomName}-bg`);
        this.roomBG.setTexture(`${roomName}-bg`);

        if (roomName !== 'room_0') {
          this.roomBG.play({
            key: `${roomName}-anim`,
            repeat: -1
          });
        }
        // ------ Trigger Rain ------
        // Pause all rain emitters
        // Unpause emitters of current room, and rooms to left and right (if exists)
        const rainKeys = Object.keys(this.rainEmitters);
        rainKeys.forEach((key) => {
          const emitter = this.rainEmitters[key];
          emitter[0].stop();
          emitter[1].stop();
        });
        
        // Unpause rain emitters of current room
        const keysIndex = rainKeys.indexOf(room.name);
        const leftRoom = rainKeys[keysIndex - 1];
        const rightRoom = rainKeys[keysIndex + 1];

        if (typeof leftRoom !== 'undefined') {
          this.rainEmitters[leftRoom][0].start();
          this.rainEmitters[leftRoom][1].start();
        }

        if (typeof rightRoom !== 'undefined') {
          this.rainEmitters[rightRoom][0].start();
          this.rainEmitters[rightRoom][1].start();
        }

        this.rainEmitters[room.name][0].start();
        this.rainEmitters[room.name][1].start();
      }
    }
  }
  
  // To trigger game over:
  // this.overlayUI.gameOver(winningPlayerName);
  // this.isGameOver = true;

  update(time, delta) {
    if (!this.isGameOver) {
      const {state, sessionId} = this.registry.gameRoom;
      this.syncState(state, sessionId);
      this.sendInput();
      this.setRoomBounds(state);
      this.runLocalUpdates(time, delta);
      this.handleCameraFollowing(state);
      this.renderRoomBG(state);
      this.updateParallax();
      // this.updateRoomBG(state);
      
      // @todo Get new running sounds
      // Check velocity of player boxes
      // Object.keys(this.playerSprites).forEach((key) => {
      //   const player = this.playerSprites[key];
      //   const { isJumping, isRolling, isGrounded, isFallenDown } = this.registry.gameRoom.state.players[key];
      //   const velX = Math.abs(player.velocityX);
      //   const velY = Math.abs(player.velocityY);

      //   if(velY < 1.5) {
      //     player.sprite.isJumping = false;
      //   }

      //   if(velX > 2 && velX < 5 && (velY < 1 && velY >= 0) && !isJumping && !isRolling && !isFallenDown) {
      //     player.sprite.playStep('walk');
      //   } else if(velX > 2 && velX > 5 && (velY < 1 && velY >= 0) && !isJumping && !isRolling && !isFallenDown) {
      //     player.sprite.playStep('run');
      //   }
      // });
    }
  }

}
export default GameScene;