<?

function handleNewGame() {
  $player = playerFromType($_POST['gameType']);
  $username = ensureUsername($_POST['username'], $player);
  list($gameId, $hash) = insertNewGame($username, $_POST['gameType']);
  insertNewPlayer($username, $player, $gameId);
  echo json_encode(array('gameId' => $hash, 'playerId' => $username));
}

function handleJoinGame() {
  $game = getGame($_POST['gameId']);
  $player = playerFromType($game['game_type'], true);
  $username = ensureUsername($_POST['username'], $player);
  insertNewPlayer($username, $player, $game['game_id']);
  echo json_encode(array('playerId' => $username, 'gameType' => $game['game_type']));
}

function handleMakeMove() {
  $gameId = getGameForMove($_POST['gameId'], $_POST['username']);
  checkMove($_POST['move']);
  $moveId = insertMove($gameId, $_POST['move']);
  updateGameAfterMove($gameId);
  echo json_encode(array('moveId' => $moveId));
}

function handleGetMoves() {
  $game = getGame($_POST['gameId']);
  $moves = getMoves($game['game_id'], $_POST['lastMove']);
  $moveRepr = array();
  while ($row = $moves->fetch_assoc()) {
    $moveRepr[] = $row['move'];
  };
  $isOver = $game['won_type'] > 0;
  $yourTurn = $isOver ? false : ($game['current_username'] == $_POST['username']);
  $lastMove = getLastMoveId($game['game_id']);
  echo json_encode(array(
    'gameType' => $game['game_type'],
    'isOver' => $isOver,
    'numberOfMoves' => sizeof($moveRepr),
    'lastMove' => $lastMove,
    'moves' => $moveRepr,
    'yourTurn' => $yourTurn
  ));
}

function handleClaimGame() {
  $game = getGame($_POST['gameId']);
  changePlayerUsername($game['game_id'], $_POST['targetUser'], $_POST['username']);
  echo json_encode(array('status' => 'OK'));
}

function handleWon() {
  $game = getGame($_POST['gameId']);
  $me = yesOrNo($_POST['me']);
  $resign = yesOrNo($_POST['resign']);
  changeGameStatus($game, $me, $resign, $_POST['username']);
  echo json_encode(array('status' => 'OK'));
}

function handleGetGames() {
  $games = getGames($_POST['username'], $_POST['targetUser']);
  $gameIds = array();
  while ($row = $games->fetch_assoc()) {
    $gameIds[] = $row['hash'];
  };
  echo json_encode(array(
    'numberOfGames' => sizeof($gameIds),
    'games' => $gameIds
  ));
}

// -------------------------- Utils --------------------------

function returnError($errorString) {
  header('Error!', true, 400);
  echo json_encode(array('error' => $errorString));
  exit();
}

function playerFromType($type, $invert = false) {
  $player = (strtolower(substr($type, -1)) == 's') ? 2 : 1;
  return $invert ? invertPlayer($player) : $player;
}

function invertPlayer($player) {
  return ($player % 2) + 1;
}

function checkMove($move) {
  $pattern ='/^\d+!?\(\d+(@\d+)?\)!?\d+!?(\[(\d+(-\d+)?(,\d+(-\d+)?)*)?\])?$/';
  if (!preg_match($pattern, $move)) {
    returnError('Invalid move.'); 
  }
}

function ensureUsername($username, $player) {
  if (strlen($username) > 0) {
    return $username;
  } else {
    return 'P' . $player;
  }
}

function yesOrNo($text, $default = false) {
  if (strlen($text) > 0) {
    $firstLetter = strtolower(substr($text, 0, 1));
    if ($firstLetter == 'y' || $firstLetter == 't') {
      return true;
    } else {
      return false;
    }
  } else {
    return $default;
  }
}

// -------------------------- Database --------------------------

function initDb() {
  global $db;
  $db = new mysqli('localhost');
  if ($db->connect_error) {
    returnError('Unable to connect to database.');
  }
  if (!$db->select_db('sprouts')) {
    returnError('Unable to select database.');
  };
}

function insertNewGame($user, $type) {
  global $db;
  $user = $db->real_escape_string($user);
  $type = $db->real_escape_string($type);
  $hash = shortHash(microtime(true)*100);

  $query = "
    INSERT INTO games
    (owner_username, game_type, hash, created)
    VALUES ('".$user."', '".$type."', '".$hash."', CURRENT_TIMESTAMP);
  ";
  $result = $db->query($query);
  if ($result) {
    return array($db->insert_id, $hash);
  } else {
    returnError('Unable to insert game to database.');
  }
}

function insertNewPlayer($user, $player, $id) {
  global $db;
  $user = $db->real_escape_string($user);

  $query = "
    SELECT *
    FROM game_players
    WHERE game_id = ".intval($id)." AND username = '".$user."';
  ";
  $result = $db->query($query);
  if ($result->num_rows > 0) {
    // Player is already playing this game.
    return;
  }

  $query = "
    SELECT *
    FROM game_players
    WHERE game_id = ".intval($id)." AND player = ".intval($player).";
  ";
  $result = $db->query($query);
  if ($result->num_rows > 0) {
    returnError('You cannot join this game.');
  }
    
  $query = "
    INSERT INTO game_players
    (game_id, username, player)
    VALUES (".intval($id).", '".$user."', ".intval($player).");
  ";
  //echo $query;
  $result = $db->query($query);
  if (!$result) {
    returnError('Unable to insert player to database.');
  }
}

function insertMove($gameId, $move) {
  global $db;
  $move = $db->real_escape_string($move);
  $moveId = getLastMoveId($gameId);
  $query = "
    INSERT INTO game_moves (game_id, move_id, move)
      VALUES (".$gameId.", ".($moveId+1).", '".$move."');
  ";
  //echo $query;
  $res = $db->query($query);
  if (!$res) {
    returnError('Unable to insert a move.');
  }
  return getLastMoveId($gameId);
}

function updateGameAfterMove($gameId) {
  global $db;
  $query = "
    UPDATE games
    SET whose_turn = ((whose_turn % 2) + 1)
    WHERE game_id=".intval($gameId).";
  ";
  //echo $query;
  $res = $db->query($query);
  if (!$res || $db->affected_rows != 1) {
    returnError('Unable to insert a move.');
  }
}

function changePlayerUsername($gameId, $userFrom, $userTo) {
  global $db;
  $userFrom = $db->real_escape_string($userFrom);
  $userTo = $db->real_escape_string($userTo);

  if (!($userFrom == 'P1' || $userFrom == 'P2')) {
    returnError('Can not claim this game.');
  }

  $query = "
    UPDATE game_players
    SET username = '".$userTo."'
    WHERE username = '".$userFrom."';
  ";
  //echo $query;
  $res = $db->query($query);
  if (!$res || $db->affected_rows != 1) {
    returnError('Unable to claim a game.');
  }
}

function changeGameStatus($game, $me, $resign, $username) {
  global $db;

  $username = $db->real_escape_string($username);

  if ($username == $game['current_username']) {
    $won = $me ? $game['whose_turn'] : invertPlayer($game['whose_turn']);
  } else if ($username == $game['next_username']) {
    $won = $me ? invertPlayer($game['whose_turn']) : $game['whose_turn'];
  } else {
    returnError('You are not part of this game.');
  }

  $query = "
    UPDATE games
    SET won_player = '".$won."',
      won_type = '".($resign ? 1 : 2)."'
    WHERE game_id = '".$game['game_id']."';
  ";
  //echo $query;
  $res = $db->query($query);
  if (!$res || $db->affected_rows != 1) {
    returnError('Unable to win a game.');
  }
}

function getGame($hash) {
  global $db;
  $hash = $db->real_escape_string($hash);
  $query ="
    SELECT games.*, current.username AS current_username, next.username AS next_username
    FROM games
    LEFT JOIN game_players AS current
      ON games.game_id = current.game_id AND games.whose_turn = current.player
    LEFT JOIN game_players AS next
      ON games.game_id = next.game_id AND ((games.whose_turn % 2) + 1) = next.player
    WHERE hash='".$hash."';
  ";
  //echo $query;
  $res = $db->query($query);
  if ($res && $res->num_rows == 1) {
    $row = $res->fetch_assoc();
    return $row;
  } else {
    returnError('Unable to find game ID.');
  }
}

function getGames($username, $targetUser) {
  global $db;
  $username = $db->real_escape_string($username);
  $targetUser = $db->real_escape_string($targetUser);
  $query ="
    SELECT games.*, current.username AS current_username, next.username AS next_username
    FROM games
    LEFT JOIN game_players AS current
      ON games.game_id = current.game_id AND games.whose_turn = current.player
    LEFT JOIN game_players AS next
      ON games.game_id = next.game_id AND ((games.whose_turn % 2) + 1) = next.player
    HAVING next_username='".$targetUser."'
      AND (current_username='".$username."' OR current_username IS NULL)
      AND won_type = 0;
  ";
  //echo $query;
  $res = $db->query($query);
  if ($res) {
    return $res;
  } else {
    returnError('Unable to find game ID.');
  }
}

function getGameForMove($hash, $username) {
  global $db;
  $hash = $db->real_escape_string($hash);
  $query = "
    SELECT * 
    FROM games
    JOIN game_players ON game_players.game_id = games.game_id
    WHERE hash = '".$hash."'
    AND whose_turn = player
    AND won_type = 0;
  ";
  $res = $db->query($query);
  if ($res->num_rows > 0) {
    $row = $res->fetch_assoc();
    if ($row['username'] != $username) {
      returnError('Not your turn.');
    } else {
      return $row['game_id'];
    }
  } else {
    returnError('Unable to find the game to make the move.');
  }
}

function getLastMoveId($gameId) {
  global $db;

  $query = "
    SELECT MAX(move_id) AS move_id
    FROM game_moves
    WHERE game_id = ".intval($gameId).";
  ";
  $res = $db->query($query);
  if (!$res || $res->num_rows < 1) {
    returnError('Unable to get move id.');
  }
  $row = $res->fetch_assoc();
  return intval($row['move_id']);
}

function getMoves($gameId, $lastMove) {
  global $db;
  $gameId = $db->real_escape_string($gameId);
  $lastMove = $db->real_escape_string($lastMove);
  if (strlen($lastMove == 0)) {
    $lastMove = 0;
  }

  $query = "
    SELECT move_id, move
    FROM game_moves
    WHERE game_id = ".intval($gameId)."
      AND move_id > ".$lastMove."
    ORDER BY move_id;
  ";
  //echo $query;
  $res = $db->query($query);
  if ($res) {
    return $res;
  } else {
    returnError('Unable to get moves.');
  }
}

function closeDb() {
  global $db;
  mysqli_close($db);
}

?>
