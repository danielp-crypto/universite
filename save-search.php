<?php
session_start();
require 'db.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user_email'])) {
    echo json_encode(['message' => 'Not logged in']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

$course = trim($input['course'] ?? '');
$institution = trim($input['institution'] ?? '');

if ($course === '') {
    echo json_encode(['message' => 'Course field is required.']);
    exit;
}

$email = $_SESSION['user_email'];

$stmt = $pdo->prepare("INSERT INTO saved_searches (user_email, query, institution) VALUES (?, ?, ?)");
$stmt->execute([$email, $course, $institution]);

echo json_encode(['message' => 'Search saved successfully!']);
