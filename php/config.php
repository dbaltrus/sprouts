<?
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);

if (isset($_GET['debug'])) {
  error_reporting(E_ALL);
} else {
  error_reporting(E_ERROR);
}

include('hash.php');

define('MYSQL_DB', 'sprouts');
?>
