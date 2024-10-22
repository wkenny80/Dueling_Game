import Phaser, { Display } from "phaser";

class PlayerSprite extends Phaser.Physics.Arcade.Sprite {

  constructor(scene, x, y, color) {
    super(scene, x, y, 'atlas');

    this.scene = scene;

    scene.add.existing(this);

    this.xOffsetNoFlip = 5;
    this.xOffsetFlip = -5;

    // [**start of** texture key]: non-flipped x offset for texture
    this.textureOffsetMap = {
      'default': 5,
      'sword-idle': 5,
      'sword-run': 13,
    };

    this.setOrigin(0.5, 0.9);

    const r = color.replace('rgb(', '').replace(')', '').replace(' ', '').split(',')[0];
    const g = color.replace('rgb(', '').replace(')', '').replace(' ', '').split(',')[1];
    const b = color.replace('rgb(', '').replace(')', '').replace(' ', '').split(',')[2];
    this.color = color;
    this.colorTint = Display.Color.GetColor(r, g, b);

    this.setTint(this.colorTint);

    this.isAlive = true;
    this.isAttacking = false;
    this.isFallen = false;
    this.isJumping = false;
    this.level = 'mid';
    this.isCrouching = false
    this.stepPlaying = false;
    this.hasSword = true;
    this.velX = 0;

    this.steps = [
      this.scene.sound.add('step1'),
      this.scene.sound.add('step2'),
      this.scene.sound.add('step3'),
      this.scene.sound.add('step4'),
    ]

    this.steps.forEach((sound) => { sound.volume = 0.5 });

    // Fade out nametag on death
    // this.on('animationstart', ({key}) => {
    //   if (key === 'death-stand') {
    //     // this.scene.tweens.add({
    //     //   targets: this.label,
    //     //   alpha: 0,
    //     //   y: 50,
    //     //   duration: 1500,
    //     //   repeat: 0
    //     // });

    //   }
    // });
  }

  attack() {
    this.isAttacking = true;

    function resetIsAttacking() {
      this.isAttacking = false;
    }
    resetIsAttacking = resetIsAttacking.bind(this);

    if (this.hasSword) {
      if (this.isCrouching) {
        this.play('sword-crouch-attack', false);
        this.once('animationcomplete-sword-crouch-attack', resetIsAttacking);
      } else {
        if (this.level === 'mid') {
          this.play('sword-attack-mid', false);
          this.once('animationcomplete-sword-attack-mid', resetIsAttacking);
        }
        else if (this.level === 'high') {
          this.play('sword-attack-high', false);
          this.once('animationcomplete-sword-attack-high', resetIsAttacking);
        }
        else if (this.level === 'low') {
          this.play('sword-attack-low', false);
          this.once('animationcomplete-sword-attack-low', resetIsAttacking);
        }
      }
    }
    else {
      if(this.isCrouching) {
        this.play('nosword-crouch-attack', false);
        this.once('animationcomplete-nosword-crouch-attack', resetIsAttacking);
      } else {
        this.play('nosword-attack');
        this.once('animationcomplete-nosword-attack', resetIsAttacking);
      }
    }
  }

  disarm() {
    this.hasSword = false;
  }

  playStep(type) {
    if(!this.stepPlaying) {
      this.stepPlaying = true;
      const rand = Math.floor(Math.random() * this.steps.length);
      this.steps[rand].play();
      if(type === 'walk') {
        this.scene.time.delayedCall(200, () => {
          this.stepPlaying = false;
        });
      } else if(type === 'run') {
        this.scene.time.delayedCall(100, () => {
          this.stepPlaying = false;
        });
      }
    }
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);

    if (this.anims.currentAnim !== null) {
      const {key: animKey} = this.anims.currentAnim;

      // Texture offset map handling
      Object.keys(this.textureOffsetMap).forEach((key) => {
        let xOffset = 0;

        if (animKey.startsWith(key)) {
          xOffset = this.textureOffsetMap[key];
        }
        else {
          xOffset = this.textureOffsetMap['default'];
        }

        if (this.flipX) {
          this.setX(-xOffset);
        }
        else {
          this.setX(xOffset);
        }
      });

      // Offset texture upwards if crouching
      if (animKey.match('-crouch')) {
        // this.setY(-15 - 40 * 0.6);
      }
      else {
        this.setY(-15);
      }
    }

    if(this.isAlive && this.alpha != 1){
      this.alpha = 1;
    }
    // // Running Sounds
    // if(this.velX > 5) {
    //   this.playStep('walk');
    // }
  }
}

export default PlayerSprite;