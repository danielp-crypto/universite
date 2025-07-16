<?php
session_start();
require 'db.php'; // This should initialize $pdo = new PDO(...)

// Redirect to login if session is invalid
if (!isset($_SESSION['user_id']) || !isset($_SESSION['user_email'])) {
    header("Location: login.php");
    exit;
}

// Get user data by student_id
$email = $_SESSION['user_email'];

$stmt = $pdo->prepare("SELECT * FROM student_info WHERE mail = ?");
$stmt->execute([$email]);
$student = $stmt->fetch();
$student_id = $student['student_id']; // Assign the actual student_id


if (!$student) {
    echo "User not found in student_info.";
    exit;
}

// Handle POST (update form)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $name = $_POST['name'] ?? '';
    $surname = $_POST['surname'] ?? '';
    $mail = $_POST['mail'] ?? '';
    $cell = $_POST['cell'] ?? '';
    $age = $_POST['age'] ?? '';
    $category = $_POST['user-type'] ?? '';
    $location = $_POST['location'] ?? '';


$stmt = $pdo->prepare("UPDATE student_info SET name = ?, surname = ?, mail = ?, cell = ?, age = ?, location = ?, user_type = ? WHERE student_id = ?");
    $stmt->execute([$name, $surname, $mail, $cell, $age, $location, $category, $student_id]);

    header("Location: profile.php");
    exit;
}

// Pre-select options
$selectedGrade = $student['user_type'] ?? '';
$selectedLocation = $student['location'] ?? '';
?>


<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="generator" content="Mobirise v6.0.1, mobirise.com">
  <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1">
  <link rel="shortcut icon" href="assets/images/icon-removebg-preview.png-128x128.png" type="image/x-icon">
  <meta name="description" content="Explore top online courses and university programs in one place. Compare options, read reviews, and enroll in the best course for your goals.">
  <meta property="og:title" content="Find Online & University Courses for Students">
  <meta property="og:description" content="Browse both online courses and in-person college programs. Discover the best course for your goals and enroll with confidence.">
  <meta property="og:image" content="https://universite.co.za/assets/images/new-logo-white-removebg-preview.png-1-192x192.png">
  <meta property="og:url" content="https://universite.co.za">
  <meta property="og:type" content="website">



  <title>Find Online & University Courses for Students | Compare & Enroll</title>
  <link rel="stylesheet" href="assets/bootstrap/css/bootstrap.min.css">
</head>
<body class="container mt-5">
  <h2>Edit Personal Info</h2>
  <form method="POST">
    <div class="mb-3">
      <label>First Name</label>
      <input type="text" name="name" class="form-control" value="<?= htmlspecialchars($student['name']) ?>" required>
    </div>
    <div class="mb-3">
      <label>Last Name</label>
      <input type="text" name="surname" class="form-control" value="<?= htmlspecialchars($student['surname']) ?>" required>
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
      <input type="email" name="mail" class="form-control" value="<?= htmlspecialchars($student['mail']) ?>" required>
    </div>
    <div class="mb-3">
      <label>Phone</label>
      <input type="text" name="cell" class="form-control" value="<?= htmlspecialchars($student['cell']) ?>" required>
    </div>
    <div class="mb-3">
      <label>Date of Birth</label>
      <input type="text" name="age" class="form-control" value="<?= htmlspecialchars($student['age']) ?>">
    </div>
    <div class="mb-3">
      <label for="location">Country </label>
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
    <a href="profile.php" class="btn btn-secondary">Cancel</a>
  </form>
</body>
</html>
