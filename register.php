<?php
session_start();
require_once 'db.php'; // assumes you have a PDO connection in this file

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username']);
    $password = $_POST['password'];
    $confirmPassword = $_POST['confirmPassword'];

    // Basic validation
    if (empty($username) || strlen($password) < 6 || $password !== $confirmPassword) {
        http_response_code(400);
        echo json_encode(["error" => "Invalid input."]);
        exit;
    }

    // Check if username is taken
    $stmt = $pdo->prepare("SELECT id FROM students WHERE username = ?");
    $stmt->execute([$username]);

    if ($stmt->fetch()) {
        http_response_code(409); // Conflict
        echo json_encode(["error" => "Username already taken."]);
        exit;
    }

    // Insert user
    $hash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare("INSERT INTO students (username, password) VALUES (?, ?");
    $stmt->execute([$username, $hash]);

    // Auto-login
    $_SESSION['username'] = $username;
    $_SESSION['user_id'] = $pdo->lastInsertId();

    echo json_encode(["success" => true]);
}
