<?
/* Functions for converting between notations and short MD5 generation.
 * No license (public domain) but backlink is always welcome :)
 * By Proger_XP. http://proger.i-forge.net/Short_MD5/OMF
 */
define('HASH_ALPHABET', '0123456789abcdefghijklmnopqrstuvwxyz');

function RawToShortMD5($alphabet, $raw) {
  $result = '';
  $length = strlen(DecToBase($alphabet, 2147483647));

  foreach (str_split($raw, 4) as $dword) {
    $dword = ord($dword[0]) + ord($dword[1]) * 256 + ord($dword[2]) * 65536 + ord($dword[3]) * 16777216;
    $result .= str_pad(DecToBase($alphabet, $dword), $length, $alphabet[0], STR_PAD_LEFT);
  }

  return $result;
}

function DecToBase($alphabet, $dword) {
  $rem = (int) fmod($dword, strlen($alphabet));
  if ($dword < strlen($alphabet)) {
    return $alphabet[$rem];
  } else {
    return DecToBase($alphabet, ($dword - $rem) / strlen($alphabet)).$alphabet[$rem];
  }
}

function shortHash($str) { return substr(RawToShortMD5(HASH_ALPHABET, md5($str)), 0, 10); }
?>
