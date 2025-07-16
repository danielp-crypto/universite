<?php
$host = 'localhost';        // or your DB host
$db   = 'mydb';    // replace with your DB name
$user = 'root';     // replace with your DB user
$pass = 'NewSecurePassword123!'; // replace with your DB password
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";

$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION, // throw exceptions
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,       // return associative arrays
    PDO::ATTR_EMULATE_PREPARES   => false,                  // use native prepares
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    die("Database connection failed: " . $e->getMessage());
}
