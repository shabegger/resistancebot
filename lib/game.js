var _ = require('lodash');

var Player = require('./player'),
    Round = require('./round');

var RESULT = require('./constants').RESULT;

var ROUNDS = 5,
    MIN_PLAYERS = 4,
    MAX_PLAYERS = 10;

var _roundDefinitions = {
  4: {
    spyCount: 1,
    rounds: [{
      teamSize: 2,
      failCount: 1
    }, {
      teamSize: 1,
      failCount: 1
    }, {
      teamSize: 2,
      failCount: 1
    }, {
      teamSize: 2,
      failCount: 1
    }, {
      teamSize: 3,
      failCount: 1
    }]
  },
  5: {
    spyCount: 2,
    rounds: [{
      teamSize: 2,
      failCount: 1
    }, {
      teamSize: 3,
      failCount: 1
    }, {
      teamSize: 2,
      failCount: 1
    }, {
      teamSize: 3,
      failCount: 1
    }, {
      teamSize: 3,
      failCount: 1
    }]
  },
  6: {
    spyCount: 2,
    rounds: [{
      teamSize: 2,
      failCount: 1
    }, {
      teamSize: 3,
      failCount: 1
    }, {
      teamSize: 3,
      failCount: 1
    }, {
      teamSize: 3,
      failCount: 1
    }, {
      teamSize: 4,
      failCount: 1
    }]
  },
  7: {
    spyCount: 3,
    rounds: [{
      teamSize: 2,
      failCount: 1
    }, {
      teamSize: 3,
      failCount: 1
    }, {
      teamSize: 3,
      failCount: 1
    }, {
      teamSize: 4,
      failCount: 2
    }, {
      teamSize: 4,
      failCount: 1
    }]
  },
  8: {
    spyCount: 3,
    rounds: [{
      teamSize: 3,
      failCount: 1
    }, {
      teamSize: 4,
      failCount: 1
    }, {
      teamSize: 4,
      failCount: 1
    }, {
      teamSize: 5,
      failCount: 2
    }, {
      teamSize: 5,
      failCount: 1
    }]
  },
  9: {
    spyCount: 3,
    rounds: [{
      teamSize: 3,
      failCount: 1
    }, {
      teamSize: 4,
      failCount: 1
    }, {
      teamSize: 4,
      failCount: 1
    }, {
      teamSize: 5,
      failCount: 2
    }, {
      teamSize: 5,
      failCount: 1
    }]
  },
  10: {
    spyCount: 4,
    rounds: [{
      teamSize: 3,
      failCount: 1
    }, {
      teamSize: 4,
      failCount: 1
    }, {
      teamSize: 4,
      failCount: 1
    }, {
      teamSize: 5,
      failCount: 2
    }, {
      teamSize: 5,
      failCount: 1
    }]
  }
};

var _regex = {
  showHelp: /^\s*help\s*$/i,
  addTeamMember: /^\s*add <@(U[A-Z0-9]{8})>\s*$/i,
  removeTeamMember: /^\s*remove <@(U[A-Z0-9]{8})>\s*$/i,
  submitTeam: /^\s*submit\s*$/i,
  submitTeamVote: /^\s*(accept|yes|yea|reject|no|nay)\s*$/i,
  acceptTeam: /^\s*(accept|yes|yea)\s*$/i,
  submitMissionVote: /^\s*(succeed|fail)\s*$/i,
  succeedMission: /^\s*succeed\s*$/i
};

module.exports = function Game(bot, clearGame) {
  var _game = this,
      _players = [],
      _started = false,
      _rounds = [],
      _leader;
  
  function getSpies() {
    return _.filter(_players, function (player) {
      return player.getIsSpy();
    });
  }
  
  function setSpies() {
    var spyCount = _roundDefinitions[_players.length].spyCount,
        nonSpies = _.shuffle(_players);
    
    while (spyCount--) {
      nonSpies.pop().makeSpy();
    }
  }
  
  function declareLeaders() {
    var message;
    
    message = _.concat(
      [ 'The order of leaders is:' ],
      _.map(_players, function (player) {
        return '<@' + player.getUserID() + '>';
      })
    ).join('\n');
    
    _game.notifyAll(message);
  }
  
  function declareSpies() {
    var spies = getSpies(),
        message;
    
    message = _.concat(
      [ 'The spies are:' ],
      _.map(spies, function (spy) {
        return '<@' + spy.getUserID() + '>';
      })
    ).join('\n');
    
    _game.notifySpies(message);
  }
  
  function createRound() {
    var roundDef = _roundDefinitions[_players.length].rounds[_rounds.length];
    
    _rounds.push(new Round(_game, roundDef.teamSize, roundDef.failCount,
      _players[_leader], _players));
  }
  
  function getCurrentRound() {
    return _.last(_rounds);
  }
  
  this.notifyAll = function notifyAll(message) {
    _.each(_players, function (player) {
      player.notify(message);
    });
  };
  
  this.notifySpies = function notifySpies(message) {
    _.each(getSpies(), function (player) {
      player.notify(message);
    });
  };
  
  this.nextLeader = function nextLeader() {
    _leader = (_leader + 1) % _players.length;
    return _players[_leader];
  };
  
  this.roundFinished = function roundFinished() {
    var victoryCount = Math.ceil(ROUNDS / 2),
        resultCounts;
    
    resultCounts = _.countBy(_rounds, function (round) {
      return round.getResult();
    });
    
    if (resultCounts[RESULT.RESISTANCE] >= victoryCount) {
      _game.notifyAll('The Resistance has won!');
    } else if (resultCounts[RESULT.IMPERIAL] >= victoryCount) {
      _game.notifyAll('The Imperial Spies have won!');
    } else {
      createRound();
      return;
    }
    
    _game.end();
  };
  
  this.getPlayers = function getPlayers() {
    return _players.slice();
  };
  
  this.addPlayer = function addPlayer(player) {
    if (_started) {
      throw new Error('This game has already started. Cannot add a new player.');
    }
    
    if (_players.length >= MAX_PLAYERS) {
      throw new Error([
        'This game already has',
        MAX_PLAYERS,
        'players.'
      ].join(' '));
    }
    
    _players.push(player);
  };
  
  this.removePlayer = function removePlayer(userID) {
    var removed;
    
    if (_started) {
      throw new Error('This game has already started. Cannot remove a player.');
    }
    
    removed = _.remove(_players, function (player) {
      return player.getUserID() === userID;
    });
    
    _.each(removed, function (player) {
      player.notify([
        'You have successfully left the game.',
        'You may rejoin this game or join any other that has not yet started.'
      ].join('\n'));
    });
  };
  
  this.start = function start() {
    var message = [],
        i, len;
    
    if (_started) {
      throw new Error('The game has already started.');
    }
    
    if (_players.length < MIN_PLAYERS) {
      throw new Error([
        'There must be at least',
        MIN_PLAYERS,
        'in the game to start.'
      ].join(' '));
    }
    
    _players = _.shuffle(_players);
    _started = true;
    _leader = 0;
    
    message.push('The game has begun!');
    
    declareLeaders();
    declareSpies();
    
    createRound();
  };
  
  this.end = function end() {
    clearGame(_game);
    _game.notifyAll('The game has ended.');
    _players = null;
  };
  
  this.handleMessage = function handleMessage(player, message) {
    var currentRound = getCurrentRound();
    
    try {
      if (currentRound && _regex.addTeamMember.test(message)) {
        if (player !== _players[_leader]) {
          throw new Error('Only the mission leader may add players to the team.');
        }
        
        currentRound.addTeamMember(_regex.addTeamMember.exec(message)[1]);
      } else if (currentRound && _regex.removeTeamMember.test(message)) {
        if (player !== _players[_leader]) {
          throw new Error('Only the mission leader may remove players from the team.');
        }
        
        currentRound.removeTeamMember(_regex.removeTeamMember.exec(message)[1]);
      } else if (currentRound && _regex.submitTeam.test(message)) {
        if (player !== _players[_leader]) {
          throw new Error('Only the mission leader may submit a team.');
        }
        
        currentRound.submitTeam();
      } else if (currentRound && _regex.submitTeamVote.test(message)) {
        currentRound.submitTeamVote(player, _regex.acceptTeam.test(message));
      } else if (currentRound && _regex.submitMissionVote.test(message)) {
        currentRound.submitMissionVote(player, _regex.succeedMission.test(message));
      } else if (_regex.showHelp.test(message)) {
        if (currentRound) {
          currentRound.showHelp(player);
        } else {
          player.notify([
            'The game has not yet begun.',
            'After the game begins, type "help" for contextual help.'
          ].join('\n'));
        }
      } else {
        _.each(_players, function (recipient) {
          if (recipient !== player) {
            recipient.notify([ '<@', player.getUserID(), '>: ', message ].join(''));
          }
        });
      }
    } catch (error) {
      throw error;
    }
  };
};
