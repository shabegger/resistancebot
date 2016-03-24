var _ = require('lodash');
var SlackBot = require('slackbots');
var botConfig = require('./config');

var Game = require('./game');
var Player = require('./player');

var _players = {};
var _endMessages = {};
var _bot = new SlackBot(botConfig);

var _regex = {
  directMessage: /^D[A-Z0-9]{8}$/,
  newGame: /^\s*new\s*$/i,
  joinGame: /^\s*join <@(U[A-Z0-9]{8})>\s*$/i,
  startGame: /^\s*start\s*$/i,
  endGame: /^\s*end\s*$/i
};

_bot.on('message', function (data) {
  // Only handle direct messages
  if (data.type === 'message' && !data.bot_id && _regex.directMessage.test(data.channel)) {
    handleMessage(data.user, data.channel, data.text);
  }
});

function handleMessage(userID, channelID, text) {
  try {
    if (_regex.newGame.test(text)) {
      newGame(userID, channelID);
    } else if (_regex.joinGame.test(text)) {
      joinGame(userID, _regex.joinGame.exec(text)[1], channelID);
    } else if (_regex.startGame.test(text)) {
      startGame(userID);
    } else if (_regex.endGame.test(text)) {
      endGame(userID, channelID);
    } else {
      defaultMessage(userID, channelID, text);
    }
  } catch (error) {
    _bot.postMessage(channelID, 'ERROR: ' + error.message);
  }
}

function newGame(userID, channelID) {
  var player, game;
  
  if (_players[userID]) {
    throw new Error('You are already in an existing game.');
  }
  
  game = new Game(_bot, clearGame);
  player = new Player(_bot, game, userID, channelID);
  
  _players[userID] = player;
  _bot.postMessage(channelID, 'Successfully created a new game.');
}

function joinGame(userID, gameUserID, channelID) {
  var gamePlayer = _players[gameUserID],
      game, player;
  
  if (!gamePlayer) {
    throw new Error('The requested player is not currently part of a game.');
  }
  
  if (_players[userID]) {
    throw new Error('You are already in an existing game.');
  }
  
  game = gamePlayer.getGame();
  player = new Player(_bot, game, userID, channelID);
  
  _players[userID] = player;
  _bot.postMessage(channelID, 'Successfully joined the game.');
}

function startGame(userID) {
  var player = _players[userID];
  
  if (!player) {
    throw new Error('You have not yet joined a game.');
  }
  
  player.getGame().start();
  delete _endMessages[userID];
}

function endGame(userID, channelID) {
  var player = _players[userID],
      game,
      now, last;
      
  if (!player) {
    throw new Error('You are not currently participating in a game.');
  }
  
  now = Date.now();
  last = _endMessages[userID];
  
  // Must respond within 30 seconds to end game
  if (!last || (now - last > 30000)) {
    _endMessages[userID] = now;
    _bot.postMessage(channelID, 'Message "end" again to confirm.');
  } else {
    player.getGame().end();
  }
}

function clearGame(game) {
  var players = game.getPlayers();
  
  _.each(players, function (player) {
    var userID = player.getUserID();
    
    delete _endMessages[userID];
    delete _players[userID];
  });
}
  
function defaultMessage(userID, channelID, message) {
  var player = _players[userID];
  
  if (player) {
    player.handleMessage(message);
  } else {
    _bot.postMessage(channelID, 'Message "new" to create a new game.');
  }
}
