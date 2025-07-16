<?php
session_start();

// DB credentials
$host = 'localhost';
$db   = 'mydb';
$user = 'root';
$pass = 'NewSecurePassword123!';

$conn = new mysqli($host, $user, $pass, $db);
if ($conn->connect_error) {
    header("Location: login.php?error=Database connection failed");
    exit;
}

// Get user input
$username = trim($_POST['username']);
$password = $_POST['password'];

// Check if fields are filled
if (empty($username) || empty($password)) {
    header("Location: login.php?error=Please fill in all fields");
    exit;
}

// Prepare query
$stmt = $conn->prepare("SELECT id, username, password FROM students WHERE username = ?");
$stmt->bind_param("s", $username);
$stmt->execute();

$result = $stmt->get_result();

if ($result->num_rows === 1) {
    $row = $result->fetch_assoc();

    if (password_verify($password, $row['password'])) {
        // Success
        $_SESSION['user_id'] = $row['id'];
        $_SESSION['username'] = $row['username'];
        header("Location: matcher.php");
        exit;
    } else {
        header("Location: login.php?error=Invalid password");
        exit;
    }
} else {
    header("Location: login.php?error=User not found");
    exit;
}

$stmt->close();
$conn->close();
?>
