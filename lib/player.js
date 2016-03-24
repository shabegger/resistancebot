module.exports = function Player(bot, game, userID, channelID) {
  var _player = this,
      _isSpy = false;
  
  game.addPlayer(_player);
  
  this.notify = function notify(message) {
    bot.postMessage(channelID, message);
  };
  
  this.getGame = function getGame() {
    return game;
  };
  
  this.getUserID = function getUserID() {
    return userID;
  };
  
  this.getIsSpy = function getIsSpy() {
    return _isSpy;
  };
  
  this.makeSpy = function makeSpy() {
    _isSpy = true;
  };
  
  this.handleMessage = function handleMessage(message) {
    game.handleMessage(_player, message);
  };
};
