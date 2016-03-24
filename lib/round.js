var _ = require('lodash');

var PHASE = require('./constants').PHASE,
    RESULT = require('./constants').RESULT;

var MAX_REJECTIONS = 5;

module.exports = function Round(game, teamSize, failCount, leader, players) {
  var _rejections = 0,
      _phase = PHASE.TEAM_SELECTION,
      _team = [],
      _votes,
      _result;
  
  game.notifyAll('A new round is beginning!');
  leader.notify('Please select a mission team.');
      
  this.showHelp = function showHelp(player) {
    var message, teamMember;
    
    if (_phase === PHASE.TEAM_SELECTION) {
      if (player === leader) {
        message = [
          'Please select a team to go on the mission:',
          'To add a team member: "add @USER_TAG"',
          'To remove a team member: "remove @USER_TAG"',
          'To submit team for vote: "submit"'
        ].join('\n');
      } else {
        message = [
          'Please wait for the mission leader to select a team.',
          'In the meantime, join in conversation about the selection with the other players.'
        ].join('\n');
      }
      
      player.notify(message);
    } else if (_phase === PHASE.TEAM_VOTING) {
      message = _.concat(
        [ 'Please decide whether you want the selected team to go on the mission:' ],
        _.map(_team, function (player) {
          return '<@' + player.getUserID() + '>';
        }),
        'For yes, vote: "accept", "yes" or "yea"',
        'For no, vote: "reject", "no", or "nay"'
      ).join('\n');
      
      player.notify(message);
    } else { // MISSION VOTING
      teamMember = _.find(_team, function (teamMember) {
        return teamMember === player;
      });
      
      if (teamMember) {
        message = [
          'Please decide whether you want the mission to succeed for fail:',
          'For succeed: "succeed"',
          'For fail: "fail"'
        ].join('\n');
      } else {
        message = [
          'Please wait for the team members to decide the fate of the mission.',
          'In the meantime, feel free to engage in some lively table-talk.'
        ].join('\n');
      }
      
      player.notify(message);
    }
  };
  
  this.addTeamMember = function addTeamMember(userID) {
    var existingMember, newMember;
    
    if (_phase !== PHASE.TEAM_SELECTION) {
      throw new Error('Team selection has completed.');
    }
    
    if (_team.length === teamSize) {
      throw new Error('Maximum team size reached.');
    }
    
    existingMember = _.find(_team, function (player) {
      return player.getUserID() === userID;
    });
    
    if (existingMember) {
      throw new Error('Selected player has already been added to the team.');
    }
    
    newMember = _.find(players, function (player) {
      return player.getUserID() === userID;
    });
    
    if (!newMember) {
      throw new Error('Selected player is not part of this game.');
    }
    
    _team.push(newMember);
    game.notifyAll([ 'New team member, <@', userID, '>, added.' ].join(''));
  };
  
  this.removeTeamMember = function removeTeamMember(userID) {
    var removed;
    
    if (_phase !== PHASE.TEAM_SELECTION) {
      throw new Error('Team selection has completed.');
    }
    
    removed = _.find(_team, function (player) {
      return player.getUserID() === userID;
    });
    
    if (!removed.length) {
      throw new Error('Selected player is not part of the team.');
    }
    
    game.notifyAll([ 'Team member, <@', userID, '>, removed.' ].join(''));
  };
  
  this.submitTeam = function submitTeam() {
    var message;
    
    if (_phase !== PHASE.TEAM_SELECTION) {
      throw new Error('Team has already been submitted.');
    }
    
    if (_team.length !== teamSize) {
      throw new Error('Please select a full team complement.');
    }
    
    message = _.concat(
      [ 'Please vote on the following selected team:' ],
      _.map(_team, function (player) {
        return '<@' + player.getUserID() + '>';
      })
    ).join('\n');
    
    _votes = {};
    _phase = PHASE.TEAM_VOTING;
    game.notifyAll(message);
  };
  
  this.submitTeamVote = function submitTeamVote(player, accept) {
    var voteCount, yesCount,
        voteIDs,
        message;
    
    if (_phase !== PHASE.TEAM_VOTING) {
      throw new Error('It is not time to vote on a mission team.');
    }
    
    _votes[player.getUserID()] = accept;
    
    voteIDs = _.keys(_votes);
    voteCount = voteIDs.length;
    
    if (voteCount !== players.length) {
      return;
    }
    
    yesCount = _.reduce(_votes, function (result, value, key) {
      return value ? result + 1 : result;
    }, 0);
    
    message = _.concat(
      [ 'The vote results are in:' ],
      _.map(voteIDs, function (userID) {
        return [ '<@', userID, '>: ', _votes[userID] ? 'YES' : 'NO' ].join('');
      })
    ).join('\n');
    game.notifyAll(message);
    
    leader = game.nextLeader();
    _votes = {};
    
    if (yesCount > voteCount / 2) {
      _phase = PHASE.MISSION_VOTING;
      
      game.notifyAll('The team was approved. The mission will proceed.');
      _.each(_team, function (player) {
        player.notify('Please vote to succeed or fail the mission.');
      });
    } else {
      _rejections++;
      _team = [];
      
      if (_rejections === MAX_REJECTIONS) {
        game.notifyAll('Maximum team rejections reached. The Imperial Spies win the round.');
        setResult(RESULT.IMPERIAL);
      } else {
        game.notifyAll('The team was rejected. A new team will be selected.');
        leader.notify('Please select a mission team.');
        _phase = PHASE.TEAM_SELECTION;
      }
    }
  };
  
  this.submitMissionVote = function submitMissionVote(player, succeed) {
    var teamMember,
        voteCount, yesCount, noCount,
        voteIDs,
        message, success;
    
    if (_phase !== PHASE.MISSION_VOTING) {
      throw new Error('The mission has not yet begun.');
    }
    
    teamMember = _.find(_team, function (teamMember) {
      return teamMember === player;
    });
    
    if (!teamMember) {
      throw new Error('You are not part of the current mission team.');
    }
    
    _votes[player.getUserID()] = succeed;
    
    voteIDs = _.keys(_votes);
    voteCount = voteIDs.length;
    
    if (voteCount !== _team.length) {
      return;
    }
    
    yesCount = _.reduce(_votes, function (result, value, key) {
      return value ? result + 1 : result;
    }, 0);
    noCount = voteCount - yesCount;
    success = noCount < failCount;
    
    message = [
      'The mission results are in:',
      'Success: ' + yesCount,
      'Fail: ' + noCount,
      'The mission has ' + (success ? 'succeeded!' : 'failed!')
    ].join('\n');
    
    game.notifyAll(message);
    setResult(success ? RESULT.RESISTANCE : RESULT.IMPERIAL);
  };
  
  function setResult(result) {
    _phase = PHASE.FINISHED;
    _result = result;
    game.roundFinished();
  };
  
  this.getResult = function getResult() {
    if (_phase !== PHASE.FINISHED) {
      return _result;
    }
    
    return null;
  };
};
