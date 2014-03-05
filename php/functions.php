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
  echo json_encode(array('playerId' => $username));
}

function handleMakeMove() {
  $gameId = getGameForMove($_POST['gameId'], $_POST['username']);
  checkMove($_POST['move']);
  insertMove($gameId, $_POST['move']);
  updateGameAfterMove($gameId);
  echo json_encode(array('status' => 'OK'));
}

function handleGetMoves() {
  $game = getGame($_POST['gameId']);
  $moves = getMoves($game['game_id'], $_POST['lastMove']);
  $moveRepr = array();
  while ($row = $moves->fetch_assoc()) {
    $moveRepr[] = $row['move'];
  };
  echo json_encode(array(
    'gameType' => $game['game_type'],
    'numberOfMoves' => sizeof($moveRepr),
    'moves' => $moveRepr,
    'yourTurn' => ($game['current_username'] == $_POST['username'])
  ));
}

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

// ----------- Database -----------

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
  $query = "
    INSERT INTO game_moves (game_id, move_id, move)
    SELECT ".intval($gameId).", MAX(move_id)+1, '".$move."'
    FROM (
      SELECT move_id
      FROM game_moves
      WHERE game_id = ".intval($gameId)."
      UNION SELECT 0
    ) AS max_move;
  ";
  //echo $query;
  $res = $db->query($query);
  if (!$res) {
    returnError('Unable to insert a move.');
  }
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
  if (!$res) {
    returnError('Unable to insert a move.');
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

function getGameForMove($hash, $username) {
  global $db;
  $hash = $db->real_escape_string($hash);
  $query = "
    SELECT * 
    FROM games
    JOIN game_players ON game_players.game_id = games.game_id
    WHERE hash = '".$hash."'
    AND whose_turn = player;
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
