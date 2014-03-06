<?
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);

if (isset($_GET['debug'])) {
  error_reporting(E_ALL);
} else {
  error_reporting(E_ERROR);
}

include('hash.php');

define('USE_MYSQL_CREDENTIALS', false);
define('MYSQL_ADDRESS', '');
define('MYSQL_USER', '');
define('MYSQL_PASSWORD', '');
define('MYSQL_DB', 'sprouts');

?>
