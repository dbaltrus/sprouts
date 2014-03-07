var ajaxClient = (function () {

  var ACTION_ADDRESS = 'api.php';
  var REFRESH_INTERVAL = 1000;

  var lastMove = 0;
  var intervalId;

  var settings = {
    gameId: null,
    username: ''
  }

  function init() {
    if (window.location.hash.length > 1) {
      var params = window.location.hash.substring(1).split(":");
      if (params.length > 1) {
        settings.username = params[1];
      }
      document.getElementById('mainInput').value = params[0];
      joinGame();
    }
  }

  function newGame() {
    changeInterfaceAfterStart();
    sendNew(document.getElementById('mainInput').value);
  }

  function joinGame() {
    changeInterfaceAfterStart();
    sendJoin(document.getElementById('mainInput').value);
  }

  function changeInterfaceAfterStart() {
    document.getElementById('initialCorner').hidden = true;
    document.getElementById('corner').hidden = false;
    setTextField('Initializing...');
  }

  function sendNew(gameType) {
    facade.settings.numberOfSpots = parseInt(gameType);

    var formData = new FormData();
    formData.append('action', 'newGame');
    formData.append('gameType', gameType);
    formData.append('username', settings.username);

    xmlHttpPost(ACTION_ADDRESS, formData, handleNewGameResponse)
  }

  function sendJoin(gameId) {
    settings.gameId = gameId;

    var formData = new FormData();
    formData.append('action', 'joinGame');
    formData.append('gameId', gameId);
    formData.append('username', settings.username);

    xmlHttpPost(ACTION_ADDRESS, formData, handleNewGameResponse)
  }

  function sendMove(move) {
    if (settings.gameId == null) {
      return;
    }
    var formData = new FormData();
    formData.append('action', 'makeMove');
    formData.append('gameId', settings.gameId);
    formData.append('move', move);
    formData.append('username', settings.username);

    xmlHttpPost(ACTION_ADDRESS, formData, handleSendMoveResponse);
  }

  function sendGetMoves() {
    var formData = new FormData();
    formData.append('action', 'getMoves');
    formData.append('gameId', settings.gameId);
    formData.append('lastMove', lastMove);
    formData.append('username', settings.username);

    xmlHttpPost(ACTION_ADDRESS, formData, handleGetMovesResponse);
  }

  function sendWon() {
    sendWon(false, false);
  }

  function sendWon(me, resigned) {
    var formData = new FormData();
    formData.append('action', 'won');
    formData.append('gameId', settings.gameId);
    formData.append('me', '' + me);
    formData.append('resigned', '' + resigned);
    formData.append('username', settings.username);

    xmlHttpPost(ACTION_ADDRESS, formData, handleOkResponse);
  }

  function handleNewGameResponse(req) {
    var response = JSON.parse(req.responseText);
    settings.username = response.playerId;
    if (response.gameId != null) {
      settings.gameId = response.gameId;
    }
    if (response.gameType != null) {
      facade.settings.numberOfSpots = parseInt(response.gameType);
    }
    window.location.hash = settings.gameId + ':' + settings.username;
    facade.init();
    graphics.updateWindow();

    waitForNewMove();
  }

  function handleSendMoveResponse(req) {
    var response = JSON.parse(req.responseText);
    lastMove = response.moveId;
    waitForNewMove();
  }

  function handleGetMovesResponse(req) {
    var response = JSON.parse(req.responseText);
    if (response.moves.length > 0 && response.lastMove <= lastMove) {
      // We already had these moves
      return;
    }
    lastMove = response.lastMove;
    for (var i = 0; i < response.moves.length; i++) {
      var move = response.moves[i];
      console.log(move);
      if (i < response.moves.length - 1) {
        // For all but the last move
        computerMove.interpretMoveFast(move);
      } else {
        // Draw the last move
        computerMove.interpretMove(move);
      }
    }
    if (response.yourTurn) {
        playersTurn();
    } else if (response.isOver) {
      gameOver();
    } else {
      waitForNewMove();
    }
  }

  function handleOkResponse(req) {
    var response = JSON.parse(req.responseText);
    if (response.status != 'OK') {
      console.error('Something is not OK...');
    }
  }

  function waitForNewMove() {
    setTextField("Please wait...");
    if (intervalId == null) {
      sendGetMoves();
      intervalId = window.setInterval(sendGetMoves, REFRESH_INTERVAL);
    }
  }

  function clearInterval() {
    window.clearInterval(intervalId);
    intervalId = null;
  }

  function playersTurn() {
    setTextField("<b>Your turn. :)</b>");
    clearInterval();
  }

  function gameOver() {
    setTextField("Game Over!");
    if (intervalId == null) {
      // Our turn, confirm victory of the opponent.
      sendWon();
    }
    clearInterval();
  }

  function setTextField(text) {
    document.getElementById('corner').innerHTML = text;
  }

  function xmlHttpPost(url, data, callback) {
      var req = false;
      try {
          // Firefox, Opera 8.0+, Safari
          req = new XMLHttpRequest();
      }
      catch (e) {
          // Internet Explorer
          try {
              req = new ActiveXObject("Msxml2.XMLHTTP");
          }
          catch (e) {
              try {
                  req = new ActiveXObject("Microsoft.XMLHTTP");
              }
              catch (e) {
                  alert("Your browser does not support AJAX!");
                  return false;
              }
          }
      }
      req.open("POST", url, true);
      req.onreadystatechange = function() {
          if (req.readyState == 4) {
            if (req.status == 200) {
              console.log(req.responseText);
              callback(req);
            } else {
              console.error('Something very bad happened');
              console.error(req);
            }
          }
      }
      req.send(data);
  }

  return {
    init: init,
    newGame: newGame,
    joinGame: joinGame,
    sendMove: sendMove,
    gameOver: gameOver,
    settings: settings
  };
}());

window.onload = ajaxClient.init;
