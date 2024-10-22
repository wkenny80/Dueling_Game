// @ts-nocheck
import { Scene } from "phaser";

/**
 * The GameUI class handles the UI for the player while they are in a game
 */
class GameUI extends Scene {
  constructor() {
    super('scene-game-ui');
  }

  init({ parentScene }) {
    this.parentScene = parentScene;
  }

  /**
   * Create a function called "filter" that takes a string as input, removes < and >, and returns the filtered string
   */
  filter(str) {
    return str.replace(/[<>]/g, '');
  }


  /**
   * @todo Add check for new connected chat rooms
   */

  create() {
    this.overlay = this.add.dom(0, 0, 'div', 'width: 100%').createFromCache('dom-game-overlay');
    this.overlay.setOrigin(0, 0);

    // Anims
    this.anims.create({
      key: "room-pointer-loop",
      frames: this.anims.generateFrameNames("room-pointer"),
      frameRate: 24,
      repeat: -1,
    });
    this.anims.create({
      key: 'gameover-loop',
      frames: this.anims.generateFrameNumbers('gameover-screen'),
      frameRate: 12,
      repeat: -1,
    });

    this.anims.create({
      key: 'curtain-close',
      frames: this.anims.generateFrameNumbers('curtains'),
      frameRate: 12,
      repeat: 0,
    })

    this.roomPointerTweens = [];
    this.initRoomPointer();

    // Message Storage
    //
    // Format: Map of chat room name to of Array of chat messages
    // Example: "current_room" => ["message1", "message2", "message3"]
    // Example use: messages = chatMessages.get("global_chat");
    this.chatMessages = new Map();

    // Chat Message Storage for DOM elements
    //
    // Format: Map of chat room name to of Array of DOM elements
    // Example: "global_chat" => ["<p class="admin-msg">User1 joined!</p>",
    //                            "<p>[User1]: Sup nerds </p>",
    //                            "<p>[Jacko]: sup n00b</p>"]
    // Example use: messagesDOM = chatMessagesDOM.get("global_chat");
    this.chatMessagesDOM = new Map();

    this.chatSelected = "global_chat"; // Default to global_chat

    // Game Over Dialog
    this.overlay = document.getElementById('game-overlay');
    this.gameOverDialog = document.getElementById('game-over-dialog');
    this.txtWinner = document.getElementById('txt-winner');
    this.txtWinReason = document.getElementById('txt-win-reason');
    this.btnLobby = document.getElementsByClassName('btn-lobby');
    
    // Game Stats
    this.gameStats = document.getElementById('game-stats');
    this.gameStats.classList.add('disabled');
    // Room Badge
    this.roomBadge = document.getElementById('room-badge');
    this.roomBadge.classList.add('disabled');
    // Room Info (ID)
    this.roomInfo = document.getElementById('room-info');
    this.roomInfo.innerHTML = `Opponent can join this room with key <span class="highlight">${this.parentScene.registry.gameRoom.id}</span>`;
    // Chat Room
    this.chatRoom = document.getElementById('chat-room');
    this.chatContent = document.getElementById('chat-content');
    this.chatInput = document.getElementById('chat-input');
    this.chatSubmit = document.getElementById('chat-input-submit');
    this.chatSelector = document.getElementById('chat-selector');

    this.players = {};

    this.killCounts = {};
    this.leadingKills = 0;
    this.lastKiller = "";

    // Add click event for all lobby buttons
    for(var i = 0; i < this.btnLobby.length; i++) {
      this.btnLobby[i].addEventListener('click', () => {
        this.parentScene.input.keyboard.removeAllListeners();
        this.clearChatListeners();
        this.scene.stop(this.parentScene);
        this.scene.start('scene-lobby');
        this.scene.stop(this);
      });
    }

    // Raise chat when ENTER is pressed
    this.input.keyboard.on('keydown-ENTER', () => {
      this.toggleChat(true);
    });

    // Submit chat message to server on button press
    this.chatSubmit.addEventListener('click', () => {
      this.sendChat(this.chatSelected, this.chatInput.value);
      this.chatInput.value = "";
      this.toggleChat(false);
    });

    this.registry.gameRoom.onMessage('update-killcount', ({ playerID, killCount }) => {
      if (typeof this.killCounts[playerID] !== 'undefined') {
        this.killCounts[playerID].kills = killCount;
        this.killCounts[playerID].textContent = `${killCount} kill${killCount !== 1 ? 's' : ''}`;

        // this.lastKiller, this.roomBadge.textContent = `${this.players[playerID].name}!`;
        // this.roomBadge.classList.remove(...['disabled', 'room-badge__room_R6', 'room-badge__room_L6'])
        // this.roomBadge.classList.add(`room-badge__${this.players[playerID].winRoom}`);

        const roomSide = (this.players[playerID].winRoom === 'room_R6') ? 'right' : 'left';
        this.setPointerPosition(roomSide, this.players[playerID].name);
        
        // If this player has the most kills, update the leading kills, and highlight their kill counter
        if(killCount >= this.leadingKills) {
          this.leadingKills = killCount;
          // First, remove the highlight from the previous leading player
          for(var i in this.killCounts) {
            this.killCounts[i].classList.remove('leading-kills');
          }
          this.killCounts[playerID].classList.add('leading-kills');
        }
      }
    });

    // Initialize the chat rooms (most likely just global_chat)
    this.registerChatRooms();
  }

  initRoomPointer() {
    this.roomPointer = this.add.sprite(0, 100, 'room-pointer');
    this.roomPointer.setScale(1.5);
    this.roomPointer.play('room-pointer-loop');
    this.roomPointer.alpha = 0;
    this.roomPointerText = this.add.text(0, 100, '', {
      fontFamily: ['Aboreto', 'Cormorant Garamond'],
      fontSize: '22px',
      fontWeight: 'bold',
      color: '#000000',
      align: 'center',
    });
    this.roomPointerText.alpha = 0;

  }

  setPointerPosition(pos, name) {
    // Reset bounce tween
    if (pos === 'left') {
      this.roomPointer.x = 30;
      this.roomPointer.flipX = true;
      this.roomPointer.setOrigin(0, 0.5);
      this.roomPointerText.setOrigin(1, 0.5);
      this.roomPointerText.setText(name);
      this.roomPointerText.x = this.roomPointer.x + (this.roomPointer.width);
      this.roomPointer.alpha = 1;
      this.roomPointerText.alpha = 1;
    } else if(pos === 'right') {
      this.roomPointer.x = this.sys.game.config.width - 30;
      this.roomPointer.flipX = false;
      this.roomPointer.setOrigin(1, 0.5);
      this.roomPointerText.setOrigin(0, 0.5);
      this.roomPointerText.setText(name);
      this.roomPointerText.x = this.roomPointer.x - (this.roomPointer.width);
      this.roomPointer.alpha = 1;
      this.roomPointerText.alpha = 1;
    }
  }

  /**
   * Method to be called when a new chat room is added to the client, and also when the chat box is initialized.
   * 
   * Because it will be called multiple times, we need to check if it has already been run.
   */
  registerChatRooms() {
    // Get keys as an array from chatClients mapping keys() function
    const connectedChats = [...this.registry.chatClients.keys()];

    // First, check if the chat has already been registered by checking for the existence of the chatMessagesDOM map entry
    // Remove keys from the iterable that have already been registered
    const checkChildren = this.chatSelector.children;
    for (var i = 0; i < checkChildren.length; i++) {
      const chatName = checkChildren[i].attributes.room;
      if (connectedChats.includes(chatName)) {
        // If the chat has already been registered, remove it from the list of chats to be registered
        connectedChats.splice(connectedChats.indexOf(chatName), 1);
      }
    }

    // Add all connected chats to the chat selector (excluding chats that have already been registered)
    for(var keyVal of connectedChats) {
      const chat = keyVal;
      const option = document.createElement('a');
      option.attributes.room = chat;

      var innerText = chat;

      if(innerText == "global_chat") {
        innerText = "Global Chat"
      } else if(innerText == "current_room") {
        innerText = "Current Room"
      }

      option.innerText = innerText;

      // Register on-click functions for each chat selector button
      option.addEventListener('click', () => {
        // Deselect all elements
        const children = this.chatSelector.children;
        for (var i = 0; i < children.length; i++) {
          var tableChild = children[i];
          tableChild.classList.remove('selected');
        }
        // Select this element
        option.classList.add('selected');
        option.classList.remove('new-message');
        
        this.setSelectedChat(chat);
      });

      // "global_chat" selected by default
      if(option.attributes.room == this.chatSelected) {
        option.classList.add('selected');
      }

      // Add the option to the chat selector
      this.chatSelector.appendChild(option);

      // Register listeners for each connected chat room
      this.registry.chatClients.get(chat).state.messages.onAdd = (message, key) => {
        this.addNewChatMessage(chat, message);
      }
    }
  }

  addPlayerToStats(playerID, playerName, winRoom) {
    this.players[playerID] = {
      name: playerName,
      winRoom: winRoom
    };

    const playerRow = document.createElement('div');
    const playerRowName = document.createElement('label');
    const playerRowKills = document.createElement('span');

    playerRow.classList.add('player-row');

    playerRowName.classList.add('player-row__name');
    playerRowName.textContent = playerName;

    playerRowKills.classList.add('player-row__kills');
    playerRowKills.textContent = '0 kills';

    this.killCounts[playerID] = playerRowKills;

    playerRow.append(playerRowName);
    playerRow.append(playerRowKills);

    // Only display gameStats if there are more than 1 player
    if(Object.keys(this.killCounts).length >= 2 && this.gameStats.classList.contains('disabled')) {
      this.gameStats.classList.remove('disabled');
      this.roomInfo.classList.add('disabled');
    }

    this.gameStats.append(playerRow);
  }

  disconnected() {
    this.scene.stop(this.parentScene);
    this.scene.start('scene-lobby');
    this.scene.stop(this);
  }

  /**
   * @todo Expand with new win/loss sequence
   * @param {@} winningPlayerName 
   * @param {*} winnerByDefault 
   */
  gameOver(winningPlayerName, winnerByDefault) {
    this.registry.lobbyRoom.send('match-finished');

    var gameOver = this.add.sprite(this.sys.canvas.width / 2, this.sys.canvas.height / 2, 'gameover-screen', 0).setOrigin(0.5, 0.5);
    var curtains = this.add.sprite(this.sys.canvas.width / 2, this.sys.canvas.height / 2, 'curtains', 0).setOrigin(0.5, 0.5);

    var scale = window.innerWidth / gameOver.width;
    if(gameOver.height * scale < window.innerHeight) {
      scale = window.innerHeight / gameOver.height;
    }

    curtains.setScale(scale * 2);
    gameOver.setScale(scale);
    gameOver.setAlpha(0);

    curtains.play('curtain-close');

    this.time.delayedCall(this.anims.get('curtain-close').duration / 2, () => {
      gameOver.play('gameover-loop');
      gameOver.setAlpha(1);
    });

    this.overlay.classList.add('on');
    this.gameOverDialog.classList.add('on');
    this.roomBadge.classList.remove(...['disabled', 'room-badge__room_R6', 'room-badge__room_L6'])
    this.roomBadge.classList.add('disabled');
    this.gameStats.classList.add('disabled');
    this.txtWinner.innerHTML = `${winningPlayerName} wins this match`;
    // this.txtWinReason.innerHTML = (winnerByDefault ? `Opponent disconnected.` : `${winningPlayerName} has destroyed The Altar!`);
  }

  clearChatListeners() {
    const connectedChats = this.registry.chatClients.keys();

    // Removes all listeners from each connected chat room
    for(var keyVal of connectedChats) {
      const chat = keyVal;
      this.registry.chatClients.get(chat).state.messages.onAdd = null;
    }
  }

  sendChat(room, message) {
    try {
      this.registry.chatClients.get(room).send("chat-message", message);
    } catch (e) {
      console.log(e);
    }
  }

  /**
   * 
   * @todo If client has word filtering, filter the message before displaying in DOM
   * 
   * @param {string} room The room key to add the message to
   * @param {string} message Message object to add to the chat
   */
  addNewChatMessage(room, message) {
    // Push the message to the messages storage
    var newMessages = this.chatMessages.get(room) || [];

    newMessages.push(message);

    this.chatMessages.set(room, newMessages);

    // Convert unix timestamp to readable date
    var hours = new Date(message.timestamp).getHours();
    
    if (hours > 12) hours -= 12; // Convert from 24-hour to 12-hour clock
    var minutes = new Date(message.timestamp).getMinutes();
    if (minutes < 10) minutes = "0" + minutes; // Add leading zero if needed
    const date = hours + ":" + minutes;

    const chatMessage = document.createElement('p');
    
    // Admin/System messages are special
    if(message.authorID === "0") {
      chatMessage.classList.add('server-info');
      // If the message is a server message, don't filter the contents of the message (allows for server messages to be customized)
      chatMessage.innerHTML = `${date}: ${message.message}`;
    } else {
      // Filter player output via this.filter
      chatMessage.innerHTML = `${date} [${message.author}]: ${this.filter(message.message)}`;
    }
    
    // Append the message DOM element to the chat content DOM container, if room == selected room
    if(this.chatSelected == room) {
      this.chatContent.append(chatMessage);
      // Scroll to bottom
      this.chatContent.scrollTop = this.chatContent.scrollHeight;
    } else {
      // Add new message indicator to chatSelector
      var children = this.chatSelector.children;
      for(var child of children) {
        if(child.attributes.room == room)
          child.classList.add('new-message')
      }
    }
    
    // Append the message DOM to the chat
    var newDOM = this.chatMessagesDOM.get(room) || [];
    newDOM.push(chatMessage);
    this.chatMessagesDOM.set(room, newDOM);
  }

  setSelectedChat(room) {
    // If trying to set selected chat room to current room, stop;
    if(this.chatSelected == room) return;
    
    // Update the selected chat room
    this.chatSelected = room;
    // Update chat content

    // Clear chatContent
    this.chatContent.replaceChildren();

    // Then, add children from chatMessagesDOM map at new room ID
    var newChildren = this.chatMessagesDOM.get(room);
    for(var child of newChildren) {
      this.chatContent.append(child);
    }
  }

  toggleChat(bool) {
    // @todo Investigate why this is being called multiple times

    const isDisabled = this.chatRoom.classList.contains('disabled');

    if(bool && isDisabled) { // If true & chat is hiding, show chat
      // Focus on chat box
      this.chatInput.focus();
      // Lock game movement input
      this.parentScene.inputLocked = true;
      // Clear Phaser keyboard captures (prevent player from moving, allow keys to be inputed to chatbox)
      this.input.keyboard.clearCaptures();
      // ENTER should submit the message, and close the chat
      this.input.keyboard.on('keydown-ENTER', () => {
        if(this.chatInput.value != "") {
          // @todo Server commands should be executed based on current chat room selected, not player's active room
          if(this.chatInput.value.startsWith("/")) {
            this.registry.gameRoom.send('server-command', { command: this.chatInput.value.replace("/", "") });
            console.log(`Sent command "${this.chatInput.value.replace("/", "")}"`)
          } else {
            this.sendChat(this.chatSelected, this.chatInput.value);
          }
          this.chatInput.value = "";
        }
        this.toggleChat(false);
      });

      this.chatRoom.classList.remove('disabled');
      this.chatRoom.style.opacity = "1";
      this.chatRoom.style.bottom = "0px";
    } else if (!bool && !isDisabled) { // If false, hide chat
      // Remove focus from chat box
      document.activeElement.blur();
      // Unlock game movement input
      this.parentScene.inputLocked = false;

      this.input.keyboard.removeListener('keydown-ENTER', this.sendChatKeyboardEvent);

      // Animate chat box away
      var id = null;
      var opacity = 1;
      var heightOffset = 0;
      this.chatRoom.style.opacity = "1";
      clearInterval(id);
      id = setInterval(() => {
        if(this.chatRoom.style.opacity <= 0.4) {
          clearInterval(id);
          this.chatRoom.classList.add('disabled');
          // Re-add listener to allow chat to be opened again
          this.input.keyboard.on('keydown-ENTER', () => this.toggleChat(true));
        } else {
          opacity -= 0.02;
          heightOffset -= 2;
          this.chatRoom.style.opacity = "" + opacity;
          this.chatRoom.style.bottom = heightOffset + "px";
        }
      }, 5);
    }
  }
}

export default GameUI;