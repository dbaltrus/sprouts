var ajaxClient = (function () {

  var ACTION_ADDRESS = 'server';
  var REFRESH_INTERVAL = 1000;

  var currentMove = 'NO';
  var intervalId;

  function playerStarts() {
    start('F'); // First
  }

  function computerStarts() {
    start('S'); // Second
  }

  function start(starts) {
    type = facade.settings.numberOfSpots + '+' + starts;
    document.getElementById('playerStartsButton').hidden = true;
    document.getElementById('computerStartsButton').hidden = true;
    document.getElementById('textField').hidden = false;
    facade.startGame();
    sendNew(type);
  }

  function sendNew(type) {
    currentMove = type;
    var data = 'NEW ' + type;
    xmlHttpPost(ACTION_ADDRESS, data, handleOkResponse);

    if (type.charAt(2).toUpperCase() == 'F') {
      playersTurn();
    } else {
      waitForNewMove();
    }
  }

  function sendMove(move) {
    currentMove = move;
    var data = 'MOVE ' + move;
    xmlHttpPost(ACTION_ADDRESS, data, handleOkResponse);
    waitForNewMove();
  }

  function handleOkResponse(req) {
    if (req.response != 'OK') {
      alert('Something bad happened...');
    }
  }
  function playersTurn() {
    document.getElementById('textField').value = "Your turn. :)";
  }

  function waitForNewMove() {
    document.getElementById('textField').value = "Please wait...";
    intervalId = window.setInterval(sendGet, 1000);
  }

  function sendGet() {
      var data = 'GET';           
      xmlHttpPost(ACTION_ADDRESS, data, handleGetResponse);
  }

  function handleGetResponse(req) {
    if (req.responseText != currentMove) {
      currentMove = req.responseText;
      console.log('Got move: ' + currentMove);
      computerMove.interpretMove(currentMove);
      window.clearInterval(intervalId);
      playersTurn();
    }
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
              callback(req);
          }
      }
      req.send(data);
  }

  return {
    playerStarts: playerStarts,
    computerStarts: computerStarts,
    sendMove: sendMove
  };
}());
