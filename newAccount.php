<?php
// register.php
session_start();

$host = 'localhost';
$db   = 'your_database_name';
$user = 'your_db_user';
$pass = 'your_db_password';

$conn = new mysqli($host, $user, $pass, $db);
if ($conn->connect_error) {
    header("Location: signup.php?error=Database connection failed");
    exit;
}

// Collect and sanitize input
$username = trim($_POST['username']);
$password = $_POST['password'];
$confirm_password = $_POST['confirm_password'];

if (empty($username) || empty($password) || empty($confirm_password)) {
    header("Location: signup.php?error=All fields are required");
    exit;
}

if ($password !== $confirm_password) {
    header("Location: signup.php?error=Passwords do not match");
    exit;
}

// Check if username already exists
$stmt = $conn->prepare("SELECT id FROM students WHERE username = ?");
$stmt->bind_param("s", $username);
$stmt->execute();
$stmt->store_result();

if ($stmt->num_rows > 0) {
    $stmt->close();
    header("Location: signup.php?error=Username already taken");
    exit;
}

// Insert new user
$hashed_password = password_hash($password, PASSWORD_DEFAULT);

$stmt = $conn->prepare("INSERT INTO students (username, password) VALUES (?, ?)");
$stmt->bind_param("ss", $username, $hashed_password);

if ($stmt->execute()) {
    header("Location: signup.php?success=Account created successfully. You can now log in.");
} else {
    header("Location: signup.php?error=Something went wrong. Please try again.");
}

$stmt->close();
$conn->close();
?>
-----
CREATE TABLE students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL
);
