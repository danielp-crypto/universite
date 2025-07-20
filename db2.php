<?php
// Database connection settings
$host = 'localhost';
$db   = 'mydb';     // ⬅️ Replace with your DB name
$user = 'root';          // ⬅️ Replace with your DB user
$pass = 'NewSecurePassword123!';          // ⬅️ Replace with your DB password
$charset = 'utf8mb4';

// Data Source Name (DSN)
$dsn = "mysql:host=$host;dbname=$db;charset=$charset";

$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION, // Throw exceptions on errors
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,       // Fetch rows as associative arrays
    PDO::ATTR_EMULATE_PREPARES   => false,                  // Use real prepared statements
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (PDOException $e) {
    die("❌ Database connection failed: " . $e->getMessage());
}
?>
