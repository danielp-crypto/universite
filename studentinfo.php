<?php
session_start();
require 'db.php'; // Initialize $pdo = new PDO(...)

// Redirect to login if user not logged in
if (!isset($_SESSION['user_id']) || !isset($_SESSION['user_email'])) {
    header("Location: login.php");
    exit;
}

$email = $_SESSION['user_email'];

// Check if user info already exists in student_info
$stmt = $pdo->prepare("SELECT * FROM student_info WHERE mail = ?");
$stmt->execute([$email]);
$student = $stmt->fetch();

if ($student) {
    // User info exists, redirect to profile.php
    header("Location: profile.php");
    exit;
}

// Handle form submission
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $name = $_POST['name'] ?? '';
    $surname = $_POST['surname'] ?? '';
    $mail = $_POST['mail'] ?? '';
    $cell = $_POST['cell'] ?? '';
    $age = $_POST['age'] ?? '';
    $category = $_POST['user-type'] ?? '';
    $location = $_POST['location'] ?? '';

    // Insert new student info
    $stmt = $pdo->prepare("INSERT INTO student_info (name, surname, mail, cell, age, location, user_type) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([$name, $surname, $mail, $cell, $age, $location, $category]);

    // Redirect to profile.php after saving info
    header("Location: interests.php");
    exit;
}
?>

<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Enter Student Info</title>
  <link rel="stylesheet" href="assets/bootstrap/css/bootstrap.min.css" />
</head>
<body class="container mt-5">
  <h2>Enter Your Personal Information</h2>
  <form method="POST">
    <div class="mb-3">
      <label>First Name</label>
      <input type="text" name="name" class="form-control" required />
    </div>
    <div class="mb-3">
      <label>Last Name</label>
      <input type="text" name="surname" class="form-control" required />
    </div>
    <div class="mb-3">
      <label>What grade are you in?</label>
      <select class="form-select" name="user-type" required>
        <option value="">-- Grade --</option>
        <option>High School</option>
        <option>University/College</option>
        <option>Other</option>
      </select>
    </div>
    <div class="mb-3">
      <label>Email</label>
      <input type="email" name="mail" class="form-control" value="<?= htmlspecialchars($email) ?>" required />
    </div>
    <div class="mb-3">
      <label>Phone</label>
      <input type="text" name="cell" class="form-control" required />
    </div>
    <div class="mb-3">
      <label>Date of Birth</label>
      <input type="text" name="age" class="form-control" />
    </div>
    <div class="mb-3">
      <label>Country</label>
      <select class="form-select" name="location" required>
        <option value="">-- Select Country --</option>
        <option>Argentina</option>
        <option>Australia</option>
        <option>Brazil</option>
        <option>Canada</option>
        <option>China</option>
        <option>Colombia</option>
        <option>France</option>
        <option>Germany</option>
        <option>India</option>
        <option>Indonesia</option>
        <option>Italy</option>
        <option>Japan</option>
        <option>Malaysia</option>
        <option>Mexico</option>
        <option>Netherlands</option>
        <option>Nigeria</option>
        <option>Russia</option>
        <option>Saudi Arabia</option>
        <option>Singapore</option>
        <option>South Africa</option>
        <option>South Korea</option>
        <option>Spain</option>
        <option>Sweden</option>
        <option>Turkey</option>
        <option>United Arab Emirates</option>
        <option>United Kingdom</option>
        <option>United States</option>
      </select>
    </div>
    <button type="submit" class="btn btn-primary">Save</button>
  </form>
</body>
</html>
