import { GameObjects } from "phaser";
import PlayerSprite from './PlayerSprite';
const { Container } = GameObjects;


class PlayerContainer extends Container {
  constructor(scene, x, y, width, height, playerName, color, physicsEnabled) {
    super(scene, x, y, []);

    this.xOffsetNoFlip = 5;
    this.xOffsetFlip = -5;

    this.scene = scene;
    
    // Update to add skin support
    this.sprite = new PlayerSprite(scene, this.xOffsetNoFlip, 0, color);
    // this.sprite = scene.add.sprite(this.xOffsetNoFlip, -15, 'atlas');

    this.initPlayerTag(playerName);

    this.add([
      this.sprite,
      this.label
    ]);

    this.setSize(width, height);

    this.scene.add.existing(this);
    this.scene.physics.world.enable(this);

    // @ts-ignore
    this.body.allowGravity = false;
    // @ts-ignore
    this.body.setOffset(0,-18);
    // @ts-ignore
    this.body.setImmovable(true);

    // Typically, you would want to add only *this* client's player to the physics world for client prediction
    if(physicsEnabled) {
      this.scene.physics.add.existing(this);
    }

    // Hide after death
    this.sprite.on('animationcomplete-death-stand', () => {
      this.sprite.setVisible(false);
      this.label.setVisible(false);
    });

    // Animation props
    this.animHolding = false;
    this.isNextAnim = false;
    this.animLocked = false;
    this.stepPlaying = false;

    this.isAlive = true;

    this.playerSounds = {
      switchLevel: scene.sound.add('sword-switch-level'),
      parry: scene.sound.add('sword-parry'),
      parryHigh: scene.sound.add('sword-parry-high'),
      pickup: scene.sound.add('sword-pickup'),
      jump: this.scene.sound.add('player-jump'),
      stabDeath: this.scene.sound.add('player-stabbed'),
      stabScream: this.scene.sound.add('player-scream'),
      stompDeath: this.scene.sound.add('curbstomped'),
      steps: [
        this.scene.sound.add('step1'),
        this.scene.sound.add('step2'),
        this.scene.sound.add('step3'),
        this.scene.sound.add('step4'),
      ]
    }

    // Register anim listeners
    this.sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, function (anim) {
      if(anim.key.includes('death')) {
        this.sprite.setVisible(false);
        this.sprite.setAlpha(0);
      }
    }, this);
  }

  setVelX(vel) {
    this.velX = vel;
    this.sprite.velX = vel;
  }

  respawn() {
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 1,
      duration: 300,
      ease: 'Ease'
    });
    this.sprite.play({ key: 'spawn', repeat: 0 }, false);
    this.sprite.on('animationcomplete-spawn', () => {
      this.animLocked = false;
    })
    this.sprite.setVisible(true);
    this.label.setVisible(true);
    // Reset player flags
    this.sprite.hasSword = true;
    this.sprite.isAttacking = false;
    this.sprite.isCrouching = false;
    this.sprite.isFallen = false;
    this.sprite.level = 'mid';
    this.isAlive = true;
    this.sprite.isAlive = true;
    // Reset player anim lock incase something happens to spawn anim
    this.scene.time.delayedCall(1000, () => {
      this.animLocked = false;
    });
  }

  curbstomp() {
    // var offset = (this.sprite.flipX) ? 150 : -150;
    // this.sprite.setX(offset);

    this.animLocked = true;
    if(this.sprite.hasSword) {
      this.sprite.play({ key: 'sword-curbstomp', frameRate: 12 }, false);
      this.sprite.once('animationcomplete-sword-curbstomp', () => {
        this.sprite.setX(this.sprite.flipX ? 5 : -5);
        this.animLocked = false;
        this.sprite.isAttacking = false;
      });
    } else {
      this.sprite.play({ key: 'nosword-curbstomp', frameRate: 12 }, false);
      this.sprite.once('animationcomplete-nosword-curbstomp', () => {
        this.sprite.setX(this.sprite.flipX ? 5 : -5);
        this.animLocked = false;
        this.sprite.isAttacking = false;
      });
    }
  }

  jumpkick() {
    this.animLocked = true;
    this.sprite.play({ key: `${(this.sprite.hasSword) ? "sword" : "nosword"}-jumpkick` }, false);
    this.scene.time.delayedCall(this.scene.anims.get('sword-jumpkick').duration, () => {
      this.animLocked = false;
      this.sprite.isAttacking = false;
    })
  }

  throwSword() {
    this.animLocked = true;
    this.sprite.isAttacking = true;
    this.sprite.hasSword = false;
    this.sprite.play('throw', false);
    this.sprite.once('animationcomplete-throw', () => {
      this.animLocked = false;
      this.sprite.isAttacking = false;
    });
  }

  attack() {
    this.sprite.attack();
  }

  initPlayerTag(label) {
    this.label = this.scene.add.text(0, 20, label, {
      fontFamily: 'Cormorant Garamond',
      color: '#FFF',
      backgroundColor: 'rgba(0,0,0,0.7)',
      padding: 3,
      fontSize: 15
    });
    this.label.setOrigin(0.5);
  }

  getAnim() {
    return this.sprite.anims.getName();
  }

  setAnim(animKey, animMode) {
    if (!this.animLocked) {
      if (animMode === 'loop') {
        this.animHolding = false;
        this.isNextAnim = false;
        this.sprite.play({ key: animKey, repeat: -1 }, true);
      }
      else if (animMode === 'play-hold' && !this.animHolding) {
        this.animHolding = true;
        this.sprite.play(animKey, true);
      }

      // /*
      // * When playing animation, trigger associated sound effect.
      // */
      // Player Jump Sound
      // if (animKey.split('-')[1] === 'jump') {
      //   this.playerSounds.jump.play();
      // }
    }
  }

  fall() {
    this.sprite.isFallen = true;
    this.animLocked = true;
    this.setVelX(0);
    this.sprite.play('to-fall', false);
    this.sprite.once('animationcomplete-to-fall', () => {
      this.sprite.play({ key: 'fallen', repeat: -1 }, false);
    });
    this.scene.time.delayedCall(2750, () => {
      this.animLocked = false;
    })
  }

  kill(isLaying) {
    // We don't need to reset animLocked here because respawn will do that
    this.animLocked = true;
    this.isAlive = false;
    this.sprite.isAlive = false;
    this.setVelX(0);
    if (!isLaying) {
      this.sprite.play({ key: 'death-stand', repeat: 0 }, false);
      this.playerSounds.stabDeath.play();
      this.playerSounds.stabScream.volume = 0.8;
      this.playerSounds.stabScream.play();
      this.label.setVisible(false);
    } else {
      this.sprite.play({ key: 'deathlay', frameRate: 12 }, false);
      this.scene.time.delayedCall(750, () => {
        this.playerSounds.stompDeath.play();
      });
      this.scene.time.delayedCall(1450, () => {
        this.scene.tweens.add({
          targets: this.sprite,
          alpha: 0,
          duration: 205,
          ease: 'Power2',
        });
        this.label.setVisible(false);
      })
    }
  }

  isAttacking() {
    return this.sprite.isAttacking;
  }

  setFlipX(flip) {
    this.sprite.setFlipX(flip);
  }

  // update(time, delta) {
  //   this.sprite.preUpdate(time, delta);
  // }
}

export default PlayerContainer;