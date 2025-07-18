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
        <option value="High School"<?= ($student['user_type'] === 'High School') ? ' selected' : '' ?>>High School</option>
        <option value="University/College"<?= ($student['user_type'] === 'University/College') ? ' selected' : '' ?>>University/College</option>
        <option value="Other"<?= ($student['user_type'] === 'Other') ? ' selected' : '' ?>>Other</option>
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
        <option value="Argentina"<?= ($student['location'] === 'Argentina') ? ' selected' : '' ?>>Argentina</option>
        <option value="Australia"<?= ($student['location'] === 'Australia') ? ' selected' : '' ?>>Australia</option>
        <option value="Brazil"<?= ($student['location'] === 'Brazil') ? ' selected' : '' ?>>Brazil</option>
        <option value="Canada"<?= ($student['location'] === 'Canada') ? ' selected' : '' ?>>Canada</option>
        <option value="China"<?= ($student['location'] === 'China') ? ' selected' : '' ?>>China</option>
        <option value="Colombia"<?= ($student['location'] === 'Colombia') ? ' selected' : '' ?>>Colombia</option>
        <option value="France"<?= ($student['location'] === 'France') ? ' selected' : '' ?>>France</option>
        <option value="Germany"<?= ($student['location'] === 'Germany') ? ' selected' : '' ?>>Germany</option>
        <option value="India"<?= ($student['location'] === 'India') ? ' selected' : '' ?>>India</option>
        <option value="Indonesia"<?= ($student['location'] === 'Indonesia') ? ' selected' : '' ?>>Indonesia</option>
        <option value="Italy"<?= ($student['location'] === 'Italy') ? ' selected' : '' ?>>Italy</option>
        <option value="Japan"<?= ($student['location'] === 'Japan') ? ' selected' : '' ?>>Japan</option>
        <option value="Malaysia"<?= ($student['location'] === 'Malaysia') ? ' selected' : '' ?>>Malaysia</option>
        <option value="Mexico"<?= ($student['location'] === 'Mexico') ? ' selected' : '' ?>>Mexico</option>
        <option value="Netherlands"<?= ($student['location'] === 'Netherlands') ? ' selected' : '' ?>>Netherlands</option>
        <option value="Nigeria"<?= ($student['location'] === 'Nigeria') ? ' selected' : '' ?>>Nigeria</option>
        <option value="Russia"<?= ($student['location'] === 'Russia') ? ' selected' : '' ?>>Russia</option>
        <option value="Saudi Arabia"<?= ($student['location'] === 'Saudi Arabia') ? ' selected' : '' ?>>Saudi Arabia</option>
        <option value="Singapore"<?= ($student['location'] === 'Singapore') ? ' selected' : '' ?>>Singapore</option>
        <option value="South Africa"<?= ($student['location'] === 'South Africa') ? ' selected' : '' ?>>South Africa</option>
        <option value="South Korea"<?= ($student['location'] === 'South Korea') ? ' selected' : '' ?>>South Korea</option>
        <option value="Spain"<?= ($student['location'] === 'Spain') ? ' selected' : '' ?>>Spain</option>
        <option value="Sweden"<?= ($student['location'] === 'Sweden') ? ' selected' : '' ?>>Sweden</option>
        <option value="Turkey"<?= ($student['location'] === 'Turkey') ? ' selected' : '' ?>>Turkey</option>
        <option value="United Arab Emirates"<?= ($student['location'] === 'United Arab Emirates') ? ' selected' : '' ?>>United Arab Emirates</option>
        <option value="United Kingdom"<?= ($student['location'] === 'United Kingdom') ? ' selected' : '' ?>>United Kingdom</option>
        <option value="United States"<?= ($student['location'] === 'United States') ? ' selected' : '' ?>>United States</option>
      </select>
    </div>
    <button type="submit" class="btn btn-primary">Save</button>
    <a href="profile.php" class="btn btn-secondary">Cancel</a>
  </form>
</body>
</html>
