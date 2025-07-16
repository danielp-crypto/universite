<?php
// logger3.php
session_start();
header("Content-Type: application/json");

// DB setup
$pdo = new PDO("mysql:host=localhost;dbname=mydb", "root", "NewSecurePassword123!");

// Helper: create or fetch user
function createOrGetUser($email, $name) {
    global $pdo;

    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user) {
        $stmt = $pdo->prepare("INSERT INTO users (email, name) VALUES (?, ?)");
        $stmt->execute([$email, $name]);
        $userId = $pdo->lastInsertId();
        $_SESSION['user_id'] = $userId;
        return 'new';
    } else {
        $_SESSION['user_id'] = $user['id'];
        return 'existing';
    }
}


// GOOGLE SIGNUP
if (isset($_POST['google_id_token'])) {
    $token = $_POST['google_id_token'];
    $response = file_get_contents("https://oauth2.googleapis.com/tokeninfo?id_token=" . $token);
    $data = json_decode($response, true);

    if (isset($data['email'])) {
        $email = $data['email'];
        $name = $data['name'] ?? 'Google User';
        $userType = createOrGetUser($email, $name);
        echo json_encode(['status' => 'success', 'user_type' => $userType]);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Invalid Google token']);
    }
    exit;
}


// APPLE SIGNUP
if (isset($_POST['apple_identity_token'])) {
    $token = $_POST['apple_identity_token'];
    // Decode JWT (basic; you should verify signature in production)
    $payload = explode('.', $token)[1];
    $decoded = json_decode(base64_decode(strtr($payload, '-_', '+/')), true);

    if (isset($decoded['email'])) {
        $email = $decoded['email'];
        $name = $decoded['name'] ?? 'Apple User';
        createOrGetUser($email, $name);
        echo json_encode(['status' => 'success']);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Invalid Apple token']);
    }
    exit;
}

echo json_encode(['status' => 'error', 'message' => 'No token provided']);
