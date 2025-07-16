<?php
session_start();

$GOOGLE_CLIENT_ID = '435540089443-trqmc9iaq288jmvkb9t304tsmrlshikg.apps.googleusercontent.com';

$mysqli = new mysqli('localhost', 'root', 'NewSecurePassword123!', 'mydb');
if ($mysqli->connect_error) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'DB connection failed']);
    exit;
}

function findOrCreateUser($provider, $oauth_id, $email, $name) {
    global $mysqli;

    $stmt = $mysqli->prepare("SELECT id FROM users WHERE oauth_provider=? AND oauth_id=?");
    $stmt->bind_param("ss", $provider, $oauth_id);
    $stmt->execute();
    $stmt->store_result();

    if ($stmt->num_rows > 0) {
        $stmt->bind_result($user_id);
        $stmt->fetch();
        $stmt->close();

        $update = $mysqli->prepare("UPDATE users SET last_login=NOW() WHERE id=?");
        $update->bind_param("i", $user_id);
        $update->execute();
    } else {
        $stmt->close();
        $insert = $mysqli->prepare("INSERT INTO users (oauth_provider, oauth_id, email, name, created_at, last_login) VALUES (?, ?, ?, ?, NOW(), NOW())");
        $insert->bind_param("ssss", $provider, $oauth_id, $email, $name);
        $insert->execute();
        $user_id = $insert->insert_id;
    }

    return $user_id;
}

if (isset($_POST['google_id_token'])) {
    $id_token = $_POST['google_id_token'];
    $url = "https://oauth2.googleapis.com/tokeninfo?id_token=$id_token";
    $data = json_decode(file_get_contents($url), true);

    if (!$data || $data['aud'] !== $GOOGLE_CLIENT_ID) {
        echo json_encode(['status' => 'error', 'message' => 'Invalid Google token']);
        exit;
    }

    $user_id = findOrCreateUser(
        'google',
        $data['sub'],
        $data['email'],
        $data['name'] ?? ''
    );

    $_SESSION['user_id'] = $user_id;
    $_SESSION['user_email'] = $data['email'];
    $_SESSION['user_name'] = $data['name'] ?? '';

    echo json_encode(['status' => 'success']);
    exit;
}

echo json_encode(['status' => 'error', 'message' => 'No token received']);
?>
