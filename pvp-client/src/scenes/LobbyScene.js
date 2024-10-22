// @ts-nocheck
import { Scene } from "phaser";
// @ts-ignore
import * as THREE from "three";
// @ts-ignore
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

class LobbyScene extends Scene {
  constructor() {
    super('scene-lobby');
  }

  sanitize(input) {
    // Check for null inputs
    return (input !== null)
      ? input.replace(/[^a-zA-Z0-9_$]+$/g, '')
      : ""; // Return empty string if null
  }

  validate(e) {
    return !(/[^a-zA-Z0-9_$]+$/g.test(e.key))
  }

  threeJSRender() {
    const debugObject = {
      waveDepthColor: "#0e2d20",
      waveSurfaceColor: "#375f54",
      fogNear: 1,
      fogFar: 3,
      fogColor: "#0e1410",
    };

    /**
     * Base
     */
    // Canvas
    const canvas = document.querySelector("canvas.webgl");

    // Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(debugObject.fogColor, debugObject.fogNear, debugObject.fogFar);
    scene.background = new THREE.Color(debugObject.fogColor);

    /**
     * Object
     */
    const waterGeometry = new THREE.PlaneGeometry(12, 12, 512, 512);

    // Material
    const waterMaterial = new THREE.ShaderMaterial({
        // @ts-ignore
        vertexShader: document.getElementById("vertexShader").textContent,
        // @ts-ignore
        fragmentShader: document.getElementById("fragmentShader").textContent,
        transparent: true,
        fog: true,
        uniforms: {
            uTime: { value: 0 },
            uMouse: { value: new THREE.Vector2() },
            uBigWavesElevation: { value: 0.2 },
            uBigWavesFrequency: { value: new THREE.Vector2(4, 2) },
            uBigWaveSpeed: { value: 0.925 },
            // Small Waves
            uSmallWavesElevation: { value: 0.4 },
            uSmallWavesFrequency: { value: 20 },
            uSmallWavesSpeed: { value: 0.15 },
            uSmallWavesIterations: { value: 4 },
            // Color
            uDepthColor: { value: new THREE.Color(debugObject.waveDepthColor) },
            uSurfaceColor: { value: new THREE.Color(debugObject.waveSurfaceColor) },
            uColorOffset: { value: 0.08 },
            uColorMultiplier: { value: 5 },

            // Fog, contains fogColor, fogDensity, fogFar and fogNear
            ...THREE.UniformsLib["fog"],
        },
    });

    const water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.rotation.x = -Math.PI * 0.5;
    scene.add(water);

    /**
     * Sizes
     */
    const sizes = {
        width: window.innerWidth,
        height: window.innerHeight,
    };

    window.addEventListener("resize", () => {
        // Update sizes
        sizes.width = window.innerWidth;
        sizes.height = window.innerHeight;

        // Update camera
        camera.aspect = sizes.width / sizes.height;
        camera.updateProjectionMatrix();

        // Update renderer
        renderer.setSize(sizes.width, sizes.height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    });

    /**
     * Camera
     */

    // Base camera
    const camera = new THREE.PerspectiveCamera(70, sizes.width / sizes.height, 0.1, 100);
    camera.position.set(1, 1, 1);
    scene.add(camera);

    // Controls
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;

    /**
     * Renderer
     */
    const renderer = new THREE.WebGLRenderer({
        canvas: canvas,
    });
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    /**
     * Animate
     */
    const clock = new THREE.Clock();

    const tick = () => {
        const elapsedTime = clock.getElapsedTime();

        // Update controls
        controls.update();

        // Update time
        waterMaterial.uniforms.uTime.value = elapsedTime;

        // Render
        renderer.render(scene, camera);

        // Call tick again on the next frame
        window.requestAnimationFrame(tick);
    };

    tick();
  }

  setPlayerName(name) {
    // Add name to localstorage
    window.localStorage.setItem('playername', this.sanitize(name));
    this.playerName = this.sanitize(name);

    this.joinGlobalChat();
  }

  /**
   * Connect to user's chat rooms.
   * The user should connect to the global chat, and any previous user opened chats.
   */
  async joinGlobalChat() {
    // First, check if user is connected to global chat
    // If so, leave it and we'll rejoin.
    // This is so players can change their usernames
    if (this.registry.chatClients.get("global_chat") !== undefined) {
      this.registry.chatClients.get("global_chat").leave();
    }

    // If playername doesn't exist, return. We'll try again later.
    if (!this.playerName) return;

    if (this.playerName.length > 0) {
      try {
        this.registry.chatClients.set("global_chat", await this.registry.gameClient.joinOrCreate('global_chat', {
          playerName: this.playerName
        }));
      }
      catch(e) {
        alert('Unexpected error occurred while joining chat! Please see console for more details.');
        console.error(e);
      }
    }
    else {
      alert('Please enter a valid name.');
    }
  }

  /**
   * Join a game, or create one if there are no games available.
   */
  async joinAnyGame() {
    // Update player name when they hit enter, and then start match
    this.setPlayerName(this.txtName.value.trim());

    // Rejoin global chat with new username
    this.joinGlobalChat();

    if (this.playerName.length > 0) {
      this.txtName.setAttribute('disabled', 'true');
      this.btnJoinAny.setAttribute('disabled', 'true');

      try {
        this.registry.gameRoom = await this.registry.gameClient.joinOrCreate('arena_room', {
          playerName: this.playerName
        });

        this.scene.start('scene-game');
      }
      catch(e) {
        alert('Unexpected error occurred! Please see console for more details.');
        console.error(e);
      }
    }
    else {
      alert('Please enter a valid name.');
    }
  }

  /**
   * @todo Add a method for creating a game room, get room ID
   * 
   */
  async createNewGame() {
    const playerName = this.sanitize(this.txtName.value.trim());

    if (this.playerName.length > 0) {
      this.txtName.setAttribute('disabled', true);
      this.btnJoinAny.setAttribute('disabled', true);

      try {
        this.registry.gameRoom = await this.registry.gameClient.create('arena_room', {
          playerName: this.playerName
        });

        this.scene.start('scene-game');
      }
      catch(e) {
        alert('Unexpected error occurred! Please see console for more details.');
        console.error(e);
      }
    }
    else {
      alert('Please enter a valid name.');
    }
  }

  /**
   * @todo Add a method for joining a game room by room ID
   */
  async joinGameById(roomId) {

    if (this.playerName.length > 0) {
      this.txtName.setAttribute('disabled', true);
      this.btnJoinAny.setAttribute('disabled', true);
      
      try {
        this.registry.gameRoom = await this.registry.gameClient.joinById(roomId, {
          playerName: this.playerName
        });

        this.scene.start('scene-game');
      }
      catch(e) {
        alert('Unexpected error occurred! Please see console for more details.');
        console.error(e);
      }
    }
    else {
      alert('Please enter a valid name.');
    }
  }

  async tryLobbyConnection() {
    try {
      if(this.registry.lobbyRoom != undefined) {
        this.registry.lobbyRoom.leave();
      }
      this.registry.lobbyRoom = await this.registry.gameClient.joinOrCreate('lobby_room');
      this.errorPopup.classList.add('disabled');
      this.registerListeners();
    } catch (err) {
      this.errorPopup.classList.remove('disabled');
      this.time.delayedCall(10000, this.tryLobbyConnection);
    }
  }

  /**
   * Function takes the current active matches from this.panelMatches and then sort it first in order of timestamp, and then in order of open matches vs started
   * Credit mostly to OpenAI Codex/GitHub Copilot for this function
   */
  sortMatches() {
    const matches = this.panelMatches.children;

    let placeHolders = [];
    let openMatches = [];
    let activeMatches = [];

    for(let i = 0; i < matches.length; i++) {
      if(matches[i].classList.contains('started')) {
        activeMatches.push(matches[i]);
      } else if(matches[i].classList.contains('placeholder')) {
        placeHolders.push(matches[i]);
      } else {
        openMatches.push(matches[i]);
      }
    }

    openMatches.sort((a, b) => {
      return a.getAttribute('timestamp') - b.getAttribute('timestamp');
    });
    
    activeMatches.sort((a, b) => {
      return a.getAttribute('timestamp') - b.getAttribute('timestamp');
    });

    this.panelMatches.innerHTML = '';

    this.panelMatches.append(...openMatches, ...activeMatches, ...placeHolders);
    // for(let i = 0; i < openMatches.length; i++) {
    //   this.panelMatches.appendChild(openMatches[i]);
    // }
    // for(let i = 0; i < activeMatches.length; i++) {
    //   this.panelMatches.appendChild(activeMatches[i]);
    // }
  }

  async registerListeners() {
    this.btnsColors.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.buttonClick.play();

        document.querySelector('.color-picker button.selected').classList.remove('selected');

        btn.classList.add('selected');

        this.selectedColor = btn.querySelector('span').style.backgroundColor;
      });
    });

    this.registry.lobbyRoom.state.listen('onlinePlayers', (currentOnline, prevOnline) => {
      if(currentOnline > 0) {
        this.playersOnline.innerText = `${currentOnline} player${(currentOnline > 1) ? "s" : ""} online`;
      } else {
        this.playersOnline.innerText = ``;
      }
    });

    // this.registry.lobbyRoom.onMessage('open-match-init', (allMatches) => {
    //   let matchDIVs = [];

    //   // Push matches to top
    //   Object.keys(allMatches).forEach((roomID) => {
    //     const matchData = allMatches[roomID];

    //     matchDIVs = [
    //       ...matchDIVs,
    //       this.renderOpenMatch(matchData)
    //     ];
    //   });

    //   // Enable join buttons if there are matches
    //   if (matchDIVs.length > 0) {
    //     this.btnJoinOpen.removeAttribute('disabled');
    //     this.btnJoinByID.removeAttribute('disabled');
    //   }

    //   // Fill out list with either 10 or 11 placeholders, to keep match list even
    //   const placeholderCount = (matchDIVs.length % 2 === 0 ? 10 : 11);

    //   matchDIVs = [
    //     ...matchDIVs,
    //     ...this.renderMatchPlaceholders(placeholderCount)
    //   ];

    //   this.panelMatches.append(...matchDIVs);

    //   // Bind click events to initial matches (if any)
    //   this.bindMatchEventListeners();
    // });

    this.renderMatchPlaceholders();

    this.registry.lobbyRoom.state.openMatches.onAdd = (matchData) => {

      const newMatchDIV = this.renderOpenMatch(matchData);

      // Prepend it to the list
      this.panelMatches.prepend(newMatchDIV);

      // Re-render the placeholder divs
      this.renderMatchPlaceholders();

      // There's at least one match, so we can enable buttons
      this.btnJoinOpen.removeAttribute('disabled');
      this.btnJoinByID.removeAttribute('disabled');

      this.sortMatches();
      // Unbind, then re-bind match box click events
      this.unbindMatchEventListeners();
      this.bindMatchEventListeners();
    }

    this.registry.lobbyRoom.onMessage('match-started', (roomID) => {
      console.log(`Match ${roomID} has started!`);
      this.setMatchActiveByID(roomID);
      this.unbindMatchEventListeners();
      this.bindMatchEventListeners();
      this.sortMatches();
    }); 

    this.registry.lobbyRoom.state.openMatches.onRemove = (matchData) => {
      let { roomID } = matchData;

      // Remove the match div
      this.removeOpenMatchByRoomID(roomID);

      // Re-render the placeholder divs
      this.renderMatchPlaceholders();

      // Check if no matches remaining
      const openMatchCount = document.querySelectorAll('.match[data-room-id]').length;

      if (openMatchCount === 0) {
        this.btnJoinOpen.setAttribute('disabled', 'true');
        this.btnJoinByID.setAttribute('disabled', 'true');
      }
    }

    // this.registry.lobbyRoom.onMessage('open-match-remove', (roomID) => {
    //   // Remove the match div
    //   this.removeOpenMatchByRoomID(roomID);

    //   // Re-render the placeholder divs
    //   this.renderMatchPlaceholders();

    //   // Check if no matches remaining
    //   const openMatchCount = document.querySelectorAll('.match[data-room-id]').length;

    //   if (openMatchCount === 0) {
    //     this.btnJoinOpen.setAttribute('disabled', 'true');
    //     this.btnJoinByID.setAttribute('disabled', 'true');
    //   }
    // });

    this.registry.lobbyRoom.onMessage('connect-to-match-room', async (roomID) => {
      this.registry.gameRoom = await this.registry.gameClient.joinById(roomID, {
        playerName: this.playerName,
        playerColor: this.selectedColor
      });

      this.registry.lobbyRoom.send('connected-player-ready');
    });

    this.registry.lobbyRoom.onMessage('launch-match', (roomID) => {
      const isClientMatch = (typeof this.registry.gameRoom !== 'undefined' && this.registry.gameRoom.id === roomID);

      console.log('LAUNCH MATCH', isClientMatch);

      if (isClientMatch) {
        this.menuMusic.stop();
        this.scene.start('scene-game');
        this.registry.lobbyRoom.removeAllListeners();
      }
    });

    this.btnHideMatches.addEventListener('click', () => {
      this.buttonClack.play();
      this.toggleMatchSidebar();
    });

    this.panelMatches.addEventListener('scroll', () => {
      const scrollMax = (this.panelMatches.scrollHeight - this.panelMatches.clientHeight);
      const scrollBottomBuffer = 10;
      
      if (this.panelMatches.scrollTop >= scrollMax - scrollBottomBuffer) {
        this.iconMatchesScroll.classList.add('noscroll');
      }
      else {
        this.iconMatchesScroll.classList.remove('noscroll');
      }
    });

    this.btnsGameTypeToggle.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.buttonClick.play();
        const newType = btn.getAttribute('data-game-type');

        this.btnsGameTypeToggle.forEach((_btn) => _btn.classList.remove('selected'));
        btn.classList.add('selected');
        this.createGameType = newType;
      });
    });

    this.btnCancelMatch.addEventListener('click', async () => {
      this.buttonClick.play();
      this.btnCancelMatch.classList.add('disabled');
      this.infoPopupButton.classList.remove('disabled');

      this.containerPanelInfo.classList.remove('waiting');
      this.panelInfo.querySelectorAll('input, button').forEach((formEle) => {
        formEle.removeAttribute('disabled');
      });

      await this.registry.lobbyRoom.send('cancel-open-match');
    })

    this.btnCreateMatch.addEventListener('click', async () => {
      this.buttonClick.play();
      this.setPlayerName(this.txtPlayerName.value.trim());

      if (this.playerName.length === 0) {
        alert('Please enter a name');
        return;
      }

      if (this.createGameType === 'PvP Fencing') {
        this.containerPanelInfo.classList.add('waiting');
        this.btnCancelMatch.classList.remove('disabled');
        this.infoPopupButton.classList.add('disabled');

        this.panelInfo.querySelectorAll('input, button').forEach((formEle) => {
          formEle.setAttribute('disabled', 'true');
        });

        this.registry.gameRoom = await this.registry.gameClient.create('arena_room', {
          playerName: this.playerName,
          playerColor: this.selectedColor
        });
  
        const {id: roomID} = this.registry.gameRoom;

        this.registry.lobbyRoom.send('create-fencing-match', {
          roomID,
          creatorName: this.playerName
        });

        // this.containerPanelInfo.classList.add('waiting');

        // this.panelInfo.querySelectorAll('input, button').forEach((formEle) => {
        //   formEle.setAttribute('disabled', 'true');
        // });

        this.labelWaitingMsg.textContent = "Waiting for opponent...";
      }
      else if (this.createGameType === 'PvP Raids') {
        alert('Not ready yet.');
      }

    });

    this.btnJoinOpen.addEventListener('click', async () => {
      this.buttonClickPrimary.play();
      this.setPlayerName(this.txtPlayerName.value.trim());

      if (this.playerName.length === 0) {
        alert('Please enter a name.');
        return;
      }

      this.registry.lobbyRoom.send('connect-to-any-match');
    });

    this.btnJoinByID.addEventListener('click', () => {
      this.buttonClickPrimary.play();
      const roomID = this.txtRoomID.value.trim();
      this.setPlayerName(this.txtPlayerName.value.trim());

      if (this.playerName.length === 0) {
        alert('Please enter a name.');
        return;
      }
      
      if (roomID.length === 0) {
        alert('Please enter a roomID to join, or click on an open room to prefill it.');
        return;
      }

      this.registry.lobbyRoom.send('connect-to-match-by-room-id', roomID);

      // try {
      //   this.registry.gameRoom = await this.registry.gameClient.joinById(roomID, {
      //     playerName: this.playerName
      //   });
  
      //   this.registry.lobbyRoom.send('connected-player-ready');
      // }
      // catch (e) {
      //   alert(`Unable to join room "${roomID}"`);
      // }

    });
  }

  toggleAudio() {
    if(this.audioEnabled) {
      this.sound.setMute(true);
      this.audioToggleElement.innerHTML = `<i class="fa-solid fa-volume-xmark"></i>`;
      this.audioEnabled = false;
    } else {
      this.sound.setMute(false);
      this.audioToggleElement.innerHTML = `<i class="fa-solid fa-volume-high"></i>`;
      this.audioEnabled = true;
    }
  }

  
  /**
   * @todo Add a method that automatically joins a lobby game room that then tells the client all the available rooms
   */

  toggleMatchSidebar() {
    this.menuContainer.classList.toggle('matches-closed');
  }

  async create() {
    this.cameras.main.fadeIn(1000, 0, 0, 0);
    this.audioEnabled = !this.sound.mute;

    this.registry.chatClients = new Map();

    this.menuMusic = this.sound.add('menu-music', { volume: 0.5, loop: true });
    this.menuMusic.play();

    this.buttonClick = this.sound.add('btn-click');
    this.buttonClickPrimary = this.sound.add('btn-click-2');
    this.buttonClack = this.sound.add('btn-clack');

    // ----New lobby----
    this.htmlMenu = this.add.dom(0, 0, 'div', 'width: 100%;').createFromCache('dom-lobby');
    this.htmlMenu.setOrigin(0, 0);

    this.threeJSRender();

    this.createGameType = 'PvP Fencing';
    this.playerName = this.sanitize(window.localStorage.getItem('playername'));
    this.selectedColor = 'rgb(222, 165, 30)';

    this.menuContainer = document.querySelector('.menu-container');
    this.btnHideMatches = document.querySelector('.btn-hide-matches');
    this.panelMatches = document.querySelector('.matches');
    this.iconMatchesScroll = document.querySelector('.down-icon img');
    this.btnsGameTypeToggle = document.querySelectorAll('.toggle-game-type .btn-toggle');
    this.containerPanelInfo = document.querySelector('.menu > .panel-container');
    this.panelInfo = document.querySelector('.menu > .panel-container .panel');
    this.btnCreateMatch = document.getElementById('btn-create');
    this.btnCancelMatch = document.getElementById('btn-cancel-match');
    this.txtPlayerName = document.getElementById('txt-name');
    this.labelWaitingMsg = document.querySelector('.msg-waiting label');
    this.btnJoinOpen = document.getElementById('btn-join');
    this.btnJoinByID = document.getElementById('btn-join-by-id');
    this.txtRoomID = document.getElementById('txt-room-id');
    this.btnInputRoomID = document.getElementById('btn-input-room-id');
    this.btnsColors = document.querySelectorAll('.color-picker button');
    this.playersOnline = document.getElementById('players-online');

    this.errorPopup = document.getElementById('server-disconnected');

    this.infoPopup = document.getElementById('instructions');
    this.infoPopupButton = document.getElementById('instructions-button');
    this.infoPopupButton.onclick = () => {
      if(this.infoPopup.classList.contains('disabled')) {
        this.infoPopup.classList.remove('disabled');
      } else {
        this.infoPopup.classList.add('disabled');
      }
    };

    this.closeInfoPopup = document.getElementById('close-info-popup');
    this.closeInfoPopup.onclick = () => this.infoPopup.classList.add('disabled');

    this.audioToggleElement = document.getElementById('audio-toggle');
    this.audioToggleElement.onclick = () => this.toggleAudio();
    this.audioToggleElement.innerHTML = (this.audioEnabled) ? `<i class="fa-solid fa-volume-high"></i>` : `<i class="fa-solid fa-volume-xmark"></i>`;

    this.handleMatchClick = this.handleMatchClick.bind(this);

    this.txtPlayerName.focus();
    this.txtPlayerName.onkeydown = this.validate;

    this.tryLobbyConnection();

    if (this.playerName.length > 0) {
      this.txtPlayerName.value = this.playerName;
    }

    // this.registerListeners();
  }

  renderOpenMatch(matchData) {
    const headerCreatorName = document.createElement('header');
    headerCreatorName.textContent = matchData.creatorName;

    const labelMatchType = document.createElement('label');
    labelMatchType.classList.add('match-type');
    labelMatchType.textContent = matchData.gameMode;

    const labelMatchInfo = document.createElement('label');
    labelMatchInfo.classList.add('match-info');

    const spanRoomID = document.createElement('span');
    spanRoomID.textContent = matchData.started ? "ACTIVE" : matchData.roomID;
    matchData.started && spanRoomID.classList.add('started');
    
    const spanPlayerCount = document.createElement('span');
    spanPlayerCount.textContent = `${matchData.playerCount}/${matchData.maxPlayerCount}`;

    const divFlashbox = document.createElement('div');
    divFlashbox.classList.add('flashbox');

    const divMatch = document.createElement('div');
    divMatch.classList.add(...((matchData.started) ? ['match', 'started'] : ['match']));
    divMatch.classList.add('do-flash-pulse'); // Trigger flash animation 1 time
    divMatch.setAttribute('data-room-id', matchData.roomID);
    divMatch.setAttribute('timestamp', matchData.timestamp);

    labelMatchInfo.append(spanRoomID);
    labelMatchInfo.append(spanPlayerCount);

    divMatch.append(headerCreatorName);
    divMatch.append(labelMatchType);
    divMatch.append(labelMatchInfo);
    divMatch.append(divFlashbox);
    
    return divMatch;
  }

  setMatchActiveByID(roomID) {
    const { playerCount, maxPlayerCount } = this.registry.lobbyRoom.state.openMatches.get(roomID);
    const matchDIV = document.querySelector(`.match[data-room-id="${roomID}"]`);
    // Get the first <span> element child and append 'started' to its classlist.
    const matchInfo = matchDIV.querySelector('span');
    const matchPlayers = matchDIV.querySelectorAll('span')[1];

    if (matchDIV !== null && matchInfo !== null) {
      matchDIV.classList.add('started');
      matchInfo.textContent = 'ACTIVE';
      matchInfo.classList.add('started');
      matchPlayers.textContent = `${playerCount}/${maxPlayerCount}`;
    }
  }

  removeOpenMatchByRoomID(roomID) {
    const matchDIV = document.querySelector(`.match[data-room-id="${roomID}"]`);

    if (matchDIV !== null) {
      matchDIV.remove();
    }
  }

  doRenderMatchPlaceholders(count) {
    return Array.from({ length: count }).map(() => {
      const divPlaceholder = document.createElement('div');
      divPlaceholder.classList.add('match');
      divPlaceholder.classList.add('placeholder');

      return divPlaceholder;
    });
  }

  removeMatchPlaceholders() {
    const placeholders = this.panelMatches.querySelectorAll('.match.placeholder');

    placeholders.forEach((placeholder) => {
      placeholder.remove();
    });
  }

  renderMatchPlaceholders() {
    // Remove the current placeholder divs
    this.removeMatchPlaceholders();

    // Count the number of match divs
    const openMatchCount = this.panelMatches.querySelectorAll('.match').length;

    // Re-render the correct number of placeholders
    const newPlaceholderCount = (openMatchCount % 2 === 0 ? 10 : 11);

    this.panelMatches.append(
      ...this.doRenderMatchPlaceholders(newPlaceholderCount)
    );
  }

  handleMatchClick(e) {
    const notInRoom = (typeof this.registry.gameRoom === 'undefined');
    
    if (notInRoom) {
      const roomID = e.target.getAttribute('data-room-id');
  
      this.txtRoomID.value = roomID;
      this.btnInputRoomID.classList.remove('do-pulse');
      this.btnInputRoomID.classList.add('do-pulse');
    }
  }

  bindMatchEventListeners() {
    let matchDIVs = document.querySelectorAll('.match[data-room-id]');

    matchDIVs.forEach((div) => {
      // Bind click event if match hasn't started
      if(!div.classList.contains('started'))
        div.addEventListener('click', this.handleMatchClick);
    });
  }

  unbindMatchEventListeners() {
    const matchDIVs = document.querySelectorAll('.match[data-room-id]');

    matchDIVs.forEach((div) => {
      div.removeEventListener('click', this.handleMatchClick);
    });
  }
}

export default LobbyScene;