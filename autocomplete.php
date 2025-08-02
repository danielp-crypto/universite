<?php
session_start();
require 'db.php';

$term = isset($_GET['term']) ? trim($_GET['term']) : '';

$suggestions = [];

if ($term !== '') {
    $term = strtolower($term);
    
    // Choose appropriate table depending on the user's region
    if ($_SESSION['user_email']) {
        $email = $_SESSION['user_email'];
        $stmt = $pdo->prepare("SELECT location FROM student_info WHERE mail = ?");
        $stmt->execute([$email]);
        $location = strtolower($stmt->fetchColumn());

        if ($location === 'south africa') {
            $stmt = $pdo->prepare("SELECT DISTINCT programme FROM sa_courses WHERE programme LIKE ? LIMIT 10");
            $stmt->execute(["%$term%"]);
        } else {
            $stmt = $pdo->prepare("
                SELECT DISTINCT cc.CIPTITLE 
                FROM courses c 
                LEFT JOIN cip_codes cc 
                  ON REPLACE(TRIM(c.CIPCODE), '.', '') = REPLACE(TRIM(cc.CIPCODE), '.', '')
                WHERE LOWER(cc.CIPTITLE) LIKE ? 
                LIMIT 10
            ");
            $stmt->execute(["%$term%"]);
        }

        $suggestions = $stmt->fetchAll(PDO::FETCH_COLUMN);
    }
}

header('Content-Type: application/json');
echo json_encode($suggestions);
?>
