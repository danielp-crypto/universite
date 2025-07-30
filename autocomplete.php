<?php
require 'db.php';

$q = $_GET['q'] ?? '';

if (strlen($q) < 2) {
    echo json_encode([]);
    exit;
}

$results = [];

try {
    $stmt1 = $pdo->prepare("SELECT DISTINCT programme FROM sa_courses WHERE programme LIKE ? LIMIT 10");
    $stmt1->execute(["%$q%"]);
    $results = $stmt1->fetchAll(PDO::FETCH_COLUMN);

    $stmt2 = $pdo->prepare("SELECT DISTINCT CIPTITLE FROM cip_codes WHERE LOWER(CIPTITLE) LIKE LOWER(?) LIMIT 10");
    $stmt2->execute(["%$q%"]);
    $intlResults = $stmt2->fetchAll(PDO::FETCH_COLUMN);

    $allResults = array_unique(array_merge($results, $intlResults));

    echo json_encode(array_values($allResults));
} catch (PDOException $e) {
    echo json_encode([]);
}
