<?php
/**
 * Ulozeni JSON souboru obsazenosti po overeni hesla.
 *
 * Klient posila POST JSON:
 *   {
 *     "password": "...",
 *     "unit": "chata" | "apartman",
 *     "obsazenost": [ { "od": "DD.MM.YYYY", "do": "DD.MM.YYYY" }, ... ]
 *   }
 *
 * Server overi heslo, validuje data a atomicky prepise soubor.
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
usleep(300000);

function fail($code, $msg) {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail(405, 'Method not allowed');
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) fail(400, 'Neplatny JSON.');

if (empty($data['password']) || !is_string($data['password'])) fail(400, 'Chybi heslo.');
if (empty($data['unit']) || !in_array($data['unit'], ['chata', 'apartman'], true)) {
    fail(400, 'Neplatna jednotka.');
}
if (!isset($data['obsazenost']) || !is_array($data['obsazenost'])) {
    fail(400, 'Chybi pole obsazenost.');
}

// === Overeni hesla ===
$authFile = __DIR__ . '/auth.json';
if (!is_file($authFile)) fail(500, 'Konfigurace hesla chybi.');
$auth = json_decode(file_get_contents($authFile), true);
if (!is_array($auth) || empty($auth['passwordHash'])) fail(500, 'Hash hesla neni nastaven.');

$expected = strtolower(trim($auth['passwordHash']));
$entered  = strtolower(hash('sha256', $data['password']));
if (!hash_equals($expected, $entered)) fail(401, 'Nespravne heslo.');

// === Validace polozek obsazenosti ===
$clean = [];
foreach ($data['obsazenost'] as $i => $item) {
    if (!is_array($item) || !isset($item['od'], $item['do'])) {
        fail(400, "Polozka #{$i}: chybi 'od' nebo 'do'.");
    }
    $od = trim((string)$item['od']);
    $do = trim((string)$item['do']);
    if (!preg_match('/^\d{2}\.\d{2}\.\d{4}$/', $od) || !preg_match('/^\d{2}\.\d{2}\.\d{4}$/', $do)) {
        fail(400, "Polozka #{$i}: ocekavany format DD.MM.YYYY (dostal jsem '{$od}' / '{$do}').");
    }
    // overit, ze datumy jsou platne
    $odTs = DateTime::createFromFormat('d.m.Y', $od);
    $doTs = DateTime::createFromFormat('d.m.Y', $do);
    if (!$odTs || !$doTs) fail(400, "Polozka #{$i}: neplatne datum.");
    if ($odTs > $doTs) fail(400, "Polozka #{$i}: 'od' musi byt drive nez 'do'.");

    $clean[] = ['od' => $od, 'do' => $do];
}

// === Sestaveni vystupu - zachovat puvodni 'rezervace' pokud existoval ===
$targetFile = __DIR__ . '/obsazenost_' . $data['unit'] . '.json';
$existing = [];
if (is_file($targetFile)) {
    $existing = json_decode(file_get_contents($targetFile), true);
    if (!is_array($existing)) $existing = [];
}

$output = ['obsazenost' => $clean];
if (isset($existing['rezervace'])) {
    $output['rezervace'] = $existing['rezervace'];
}

$json = json_encode($output, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
if ($json === false) fail(500, 'Chyba pri serializaci JSON.');

// === Atomicky zapis - prvne do .tmp, pak rename ===
$tmpFile = $targetFile . '.tmp';
if (file_put_contents($tmpFile, $json, LOCK_EX) === false) {
    fail(500, 'Soubor se nepodarilo zapsat. Zkontrolujte opravneni adresare.');
}

// volitelne zachovat backup
$backupFile = $targetFile . '.bak';
if (is_file($targetFile)) {
    @copy($targetFile, $backupFile);
}

if (!@rename($tmpFile, $targetFile)) {
    @unlink($tmpFile);
    fail(500, 'Soubor se nepodarilo prepsat.');
}

echo json_encode(['ok' => true, 'count' => count($clean)]);
