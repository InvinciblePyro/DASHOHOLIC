let globalMusic = null;
let highScore = 1;

class Platformer extends Phaser.Scene {
    constructor() {
        super("platformerScene");
    }

    init(data) {
        //pause
        this.isPaused = false;

        //mute music
        this.muteMusic= false;

        // variables and settings
        this.lvl = data?.lvl ?? 1;
        this.timeLeft = 10; //timer in seconds
        this.lastDirection = null; // "left", "right", or null        
        this.ACCELERATION =400;
        this.DRAG = 2000;    // DRAG < ACCELERATION = icy slide
        this.physics.world.gravity.y = 1500;
        this.JUMP_VELOCITY = -600;
        this.PARTICLE_VELOCITY = 50;

        // dash settings
        this.DASH_VELOCITY = 800;
        this.canDash = true;
        this.dashCooldown = 1000; // in milliseconds

        // window scaling
        let desiredScale = 2;
        if(window.innerHeight<=400){desiredScale=1}
        else if (window.innerHeight<=600){desiredScale=1.5}
        this.SCALE = desiredScale;
    }

    create() {
        //uigroup for ui screen elements:
        this.uiGroup = this.add.group();
        
        // Create a new tilemap game object which uses 18x18 pixel tiles, and is
        // 45 tiles wide and 25 tiles tall.
        this.map = this.add.tilemap("map");

        this.tileset1 = this.map.addTilesetImage("monochrome_tilemap_transparent_packed", "monochrome_tilemap_transparent_packed");
        this.tileset2 = this.map.addTilesetImage("monochrome_tilemap_packed", "monochrome_tilemap_packed");

        this.visualLayer = this.map.createLayer("Ground-n-PlatformsVisual", [this.tileset1, this.tileset2], 0, 0);
        this.groundLayer = this.map.createLayer("Ground-n-Platforms", [this.tileset1, this.tileset2], 0, 0);
    
        // Make it collidable
        this.groundLayer.setCollisionByProperty({
            collides: true
        });
        this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);

        // Find coins in the "Objects" layer in Phaser
        // Look for them by finding objects with the name "coin"
        // Assign the coin texture from the tilemap_sheet sprite sheet
        // Phaser docs:
        // https://newdocs.phaser.io/docs/3.80.0/focus/Phaser.Tilemaps.Tilemap-createFromObjects
        this.coins = [];

        for (let i = 0; i < this.lvl; i++) {  // spawn 10 coins
            // Pick random x/y within world bounds (adjust as needed)
            let x = Phaser.Math.Between(50, this.map.widthInPixels - 50);
            let y = Phaser.Math.Between(50, this.map.heightInPixels - 100);

            let coin = this.add.sprite(x, y, "kenny-particles", "muzzle_02.png");
            coin.setScale(0.05);
            coin.anims.play("coinSpin");
            this.physics.add.existing(coin, true);  // true = static body

            this.coins.push(coin);
        }

        this.coinGroup = this.add.group(this.coins);

        // Since createFromObjects returns an array of regular Sprites, we need to convert 
        // them into Arcade Physics sprites (STATIC_BODY, so they don't move) 
        this.physics.world.enable(this.coins, Phaser.Physics.Arcade.STATIC_BODY);

        // Create a Phaser group out of the array this.coins
        // This will be used for collision detection below.
        this.coinGroup = this.add.group(this.coins);
        
        // set up player avatar
        my.sprite.player = this.physics.add.sprite(30, 0, "platformer_characters", "tile_0000.png");
        my.sprite.player.setCollideWorldBounds(true);

        // Enable collision handling
        this.physics.add.collider(my.sprite.player, this.groundLayer);

        // Handle collision detection with coins
        this.physics.add.overlap(my.sprite.player, this.coinGroup, (obj1, obj2) => {
            obj2.destroy(); // remove coin on overlap 
            this.SFX_CoinCollect.setRate(Phaser.Math.FloatBetween(0.7, 1.3)).play();

            this.coinText.setText(`Coins: ${this.coinGroup.countActive(true)}`);
            if(this.timeLeft<=10){this.timeLeft+=1;}
            if (this.coinGroup.countActive(true) <= 0){this.win();}
        });
        
        // set up Phaser-provided cursor key input
        cursors = this.input.keyboard.createCursorKeys();
        this.rKey = this.input.keyboard.addKey('R');
        this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        
        //pause key 
        this.shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
        
        //mute music key
        this.MKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);

        //wasd keys
        this.WKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
        this.AKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
        this.SKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
        this.DKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);

        // Start with debug off
        this.physics.world.drawDebug = false; 
        this.physics.world.debugGraphic.clear();

        // debug key listener (assigned to F key)
        this.physics.world.debugGraphic.clear()
        this.input.keyboard.on('keydown-F', () => {
            this.physics.world.drawDebug = this.physics.world.drawDebug ? false : true
            this.physics.world.debugGraphic.clear()
        }, this);

        // movement vfx
        my.vfx.walking = this.add.particles(0, 0, "kenny-particles", {
            frame: ['smoke_03.png', 'smoke_09.png'],
            // TODO: Try: add random: true
            scale: { start: 0.03, end: 0.1 },
            // TODO: Try: maxAliveParticles: 8,
            lifespan: 350,
            // TODO: Try: gravityY: -400,
            alpha: { start: 1, end: 0.1 },
        });
        my.vfx.walking.stop();
        
        //dashing var
        this.numOfDashes = 0;
        // dashing vfx
        my.vfx.dashing = this.add.particles(0, 0, "kenny-particles", {
            frame: ['magic_03.png', 'magic_05.png'],
            // TODO: Try: add random: true
            scale: { start: 0.03, end: 0.1 },
            // TODO: Try: maxAliveParticles: 8,
            lifespan: 200,
            // TODO: Try: gravityY: -400,
            alpha: { start: 1, end: 0.1 },
        });
        my.vfx.dashing.startFollow(my.sprite.player, 0, 0);
        my.vfx.dashing.stop();

 
        //timer text
        this.timerText = this.add.text(16, 16, `Time: ${this.timeLeft}`, {
            fontSize: '24px',
            fill: '#ffffff',
            fontFamily: "Monospace"
        })
        .setScrollFactor(0)        // Stay fixed on screen
        .setDepth(1000)            // Draw on top of everything else
        this.uiGroup.add(this.timerText);
        
        //number of Coins text
        this.coinText = this.add.text(16, 40, `Coins: ${this.coinGroup.countActive(true)}`, {
            fontSize: '24px',
            fill: '#ffffff',
            fontFamily: "Monospace"
        })
        .setScrollFactor(0)        // Stay fixed on screen
        .setDepth(1000)            // Draw on top of everything else
        this.uiGroup.add(this.coinText);

        //highscore text
        this.highScoreText = this.add.text(16, 65, `Highscore: ${highScore}`, {
            fontSize: '24px',
            fill: '#ffffff',
            fontFamily: "Monospace"
        })
            .setScrollFactor(0)        // Stay fixed on screen
            .setDepth(1000)            // Draw on top of everything else
        this.uiGroup.add(this.highScoreText);

        //Pause text
        this.pauseText = this.add.text(window.innerWidth / 2, window.innerHeight/4, `PAUSED`, {
            fontSize: '64px',
            fill: '#ffffff',
            fontFamily: "Monospace"
        })
            .setOrigin(0.5)
            .setScrollFactor(0)        // Stay fixed on screen
            .setDepth(1000)            // Draw on top of everything else
        this.uiGroup.add(this.pauseText);
        this.pauseText.setVisible(false);

        //timer
        this.time.addEvent({
            delay: 1000,                // 1 second
            callback: () => {
                if(!this.isPaused){this.timeLeft--;}
                this.timerText.setText(`Time: ${this.timeLeft}`);
                if (this.timeLeft <= 3 && this.timeLeft > 0 && !this.isPaused) {this.SFX_BombTick.play()}
                if (this.timeLeft <= 0) {this.timeUp();}
            },
            callbackScope: this,
            loop: true
        });
        
        // camera code
        this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
        this.cameras.main.startFollow(my.sprite.player, true, 0.25, 0.25); // (target, [,roundPixels][,lerpX][,lerpY])
        this.cameras.main.setDeadzone(50, 50);
        this.cameras.main.setZoom(this.SCALE);
    
        // Create a second camera for UI (like the timer)
        this.UICam = this.cameras.add(0, 0, this.game.config.width, this.game.config.height);
        this.UICam.setScroll(0, 0);
        this.UICam.setZoom(1);
        this.UICam.ignore([my.sprite.player, this.groundLayer, this.visualLayer, ...this.coins]);
        this.UICam.ignore(this.children.list.filter(obj => !this.uiGroup.contains(obj)));
        
        //OST
        if (!globalMusic) {
            globalMusic = this.sound.add("OST", {
                loop: true,
                volume: 1,
                rate: 1,
            });
            globalMusic.play();
        }

        //SFX
        this.SFX_CoinCollect = this.sound.add("SFX-CoinCollect");
        this.SFX_Dash = this.sound.add("SFX-Dash");
        this.SFX_Fail = this.sound.add("SFX-Fail");
        this.SFX_lvlFinish = this.sound.add("SFX-lvlFinish");
        this.SFX_BombTick= this.sound.add("SFX-BombTick");
    }

    update() {
        //pause
        if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
            this.isPaused = this.isPaused ? false : true;
            globalMusic.volume = globalMusic.volume==1 ? 0 : 1;
            this.pauseText.setVisible(this.isPaused);
            my.sprite.player.setVelocityX(0);
            my.sprite.player.setVelocityY(0);
            my.sprite.player.setAccelerationX(0);
            my.sprite.player.setAccelerationY(0);
        }

        //mute music
        if (Phaser.Input.Keyboard.JustDown(this.MKey)) {
            this.muteMusic = this.muteMusic ? false : true;
            globalMusic.volume = globalMusic.volume == 1 ? 0 : 1;
        }

        const player = my.sprite.player;
        //arrow and wasd movement
        if (!this.isPaused) {
            if (cursors.left.isDown || this.AKey.isDown) {
                if (this.lastDirection !== "left") {
                    my.sprite.player.setVelocityX(0); // cancel rightward velocity
                    my.sprite.player.setDragX(this.DRAG);
                }
                my.sprite.player.setAccelerationX(-this.ACCELERATION);
                this.lastDirection = "left";

                my.sprite.player.setAccelerationX(-this.ACCELERATION);
                my.sprite.player.resetFlip();
                my.sprite.player.anims.play('walk', true);
                // TODO: add particle following code here
                my.vfx.walking.startFollow(my.sprite.player, my.sprite.player.displayWidth / 2 - 10, my.sprite.player.displayHeight / 2 - 5, false);

                my.vfx.walking.setParticleSpeed(this.PARTICLE_VELOCITY, 0);

                // Only play smoke effect if touching the ground
                if (my.sprite.player.body.blocked.down) {    
                    my.vfx.walking.start();
                }

            } else if (cursors.right.isDown || this.DKey.isDown) {
                if (this.lastDirection !== "right") {
                    my.sprite.player.setVelocityX(0); // cancel leftward velocity
                    my.sprite.player.setDragX(this.DRAG);
                }
                my.sprite.player.setAccelerationX(this.ACCELERATION);
                this.lastDirection = "right";

                my.sprite.player.setAccelerationX(this.ACCELERATION);
                my.sprite.player.setFlip(true, false);
                my.sprite.player.anims.play('walk', true);
                // TODO: add particle following code here
                my.vfx.walking.startFollow(my.sprite.player, my.sprite.player.displayWidth / 2 - 10, my.sprite.player.displayHeight / 2 - 5, false);

                my.vfx.walking.setParticleSpeed(this.PARTICLE_VELOCITY, 0);

                // Only play smoke effect if touching the ground
                if (my.sprite.player.body.blocked.down) {
                    my.vfx.walking.start();
                }

            } else {
                // Set acceleration to 0 and have DRAG take over
                my.sprite.player.setAccelerationX(0);
                my.sprite.player.setDragX(this.DRAG);
                this.lastDirection = null;
                my.sprite.player.anims.play('idle');
                // TODO: have the vfx stop playing
                my.vfx.walking.stop();
            }

            // player jump
            // note that we need body.blocked rather than body.touching b/c the former applies to tilemap tiles and the latter to the "ground"
            if(!my.sprite.player.body.blocked.down) {
                my.sprite.player.anims.play('jump');
            }
            if (my.sprite.player.body.blocked.down && (Phaser.Input.Keyboard.JustDown(cursors.up) || this.WKey.isDown)) {
                my.sprite.player.body.setVelocityY(this.JUMP_VELOCITY);
            }
            
            // player dash
            if (my.sprite.player.body.blocked.down) { this.numOfDashes = 0}
            if (this.numOfDashes<=1){
                if (Phaser.Input.Keyboard.JustDown(this.shiftKey) && this.canDash) {
                    // left dash
                    if (cursors.left.isDown || this.AKey.isDown) {
                        my.sprite.player.body.setVelocityY(0);
                        my.sprite.player.setVelocityX(-this.DASH_VELOCITY);

                        my.vfx.dashing.setParticleSpeed(this.PARTICLE_VELOCITY, 0);
                        my.vfx.dashing.start();
                        this.SFX_Dash.setRate(Phaser.Math.FloatBetween(0.7, 1.3)).play();
                        this.cameras.main.shake(100, 0.002);
                    // right dash
                    } else if (cursors.right.isDown || this.DKey.isDown) {
                        my.sprite.player.body.setVelocityY(0);
                        my.sprite.player.setVelocityX(this.DASH_VELOCITY);

                        my.vfx.dashing.setParticleSpeed(this.PARTICLE_VELOCITY, 0);
                        my.vfx.dashing.start();
                        this.SFX_Dash.setRate(Phaser.Math.FloatBetween(0.7, 1.3)).play();
                        this.cameras.main.shake(100, 0.002);
                    } 


                    this.canDash = false;

                    // up dash
                    if (cursors.up.isDown || this.WKey.isDown) {
                        this.canDash = true;
                        this.numOfDashes++;
                        my.sprite.player.body.setVelocityY(-this.DASH_VELOCITY);

                        my.vfx.dashing.setParticleSpeed(this.PARTICLE_VELOCITY, 0);
                        my.vfx.dashing.start();
                        this.SFX_Dash.setRate(Phaser.Math.FloatBetween(0.7, 1.3)).play();
                        this.cameras.main.shake(100, 0.002);
                    }
                    // down dash
                    if (cursors.down.isDown || this.SKey.isDown) {
                        this.numOfDashes++;
                        my.sprite.player.body.setVelocityX(0);
                        my.sprite.player.body.setVelocityY(this.DASH_VELOCITY);

                        my.vfx.dashing.setParticleSpeed(this.PARTICLE_VELOCITY, 0);
                        my.vfx.dashing.start();
                        this.SFX_Dash.setRate(Phaser.Math.FloatBetween(0.7, 1.3)).play();
                        this.cameras.main.shake(100, 0.002);
                    }

                    // Re-enable dash after cooldown
                    this.time.delayedCall(this.dashCooldown, () => {
                        this.canDash = true;
                        my.vfx.dashing.stop();
                    });
                }
            }
        }
        // scene restart
        if(Phaser.Input.Keyboard.JustDown(this.rKey)) {
            this.scene.restart();
        }
    }
    timeUp() 
    { 
        this.SFX_Fail.play();
        this.scene.restart({ lvl: 1 }); 
    }
    win() 
    { 
        this.SFX_lvlFinish.play();
        if (this.lvl > highScore){ highScore = this.lvl}
        this.scene.restart({ lvl: this.lvl + 1 });  // pass next level
    }
}