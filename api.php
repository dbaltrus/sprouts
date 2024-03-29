<?
include 'php/config.php';
include 'php/functions.php';

initDb();

if ($_POST['action'] == 'newGame') {
  handleNewGame();
}
else if ($_POST['action'] == 'joinGame') {
  handleJoinGame();
}
else if ($_POST['action'] == 'makeMove') {
  handleMakeMove();
}
else if ($_POST['action'] == 'getMoves') {
  handleGetMoves();
}
else if ($_POST['action'] == 'claimGame') {
  handleClaimGame();
}
else if ($_POST['action'] == 'won') {
  handleWon();
}
else if ($_POST['action'] == 'getGames') {
  handleGetGames();
}
else {
  returnError('Invalid action');
}

closeDb();

?>
