<?php
/**
 * Overeni hesla pro spravu rezervaci.
 * Klient posila POST JSON: { "password": "..." }
 * Server porovna SHA-256 hash s hodnotou v auth.json.
 *
 * Heslo samotne se NIKAM neuklada - porovnava se pouze hash.
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
// Velmi jednoducha rate-limit ochrana: sleep, aby brute-force byl pomaly
usleep(300000); // 300 ms

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data) || !isset($data['password']) || !is_string($data['password'])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Chybi heslo.']);
    exit;
}

$authFile = __DIR__ . '/auth.json';
if (!is_file($authFile)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Konfigurace hesla chybi.']);
    exit;
}

$auth = json_decode(file_get_contents($authFile), true);
if (!is_array($auth) || empty($auth['passwordHash'])) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Hash hesla neni nastaven.']);
    exit;
}

$expected = strtolower(trim($auth['passwordHash']));
$entered  = strtolower(hash('sha256', $data['password']));

if (!hash_equals($expected, $entered)) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Nespravne heslo.']);
    exit;
}

echo json_encode(['ok' => true]);
