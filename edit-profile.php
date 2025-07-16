<?php
session_start();
require 'db.php'; // Assume this contains $pdo = new PDO(...)

// Redirect if not logged in
if (!isset($_SESSION['user_id']) || !isset($_SESSION['user_email'])) {
    header("Location: login.php");
    exit;
}

$email = $_SESSION['user_email'];
$student_id = $_SESSION['user_id'];

// Fetch student
$stmt = $pdo->prepare("SELECT * FROM student_info WHERE mail = ?");
$stmt->execute([$email]);
$student = $stmt->fetch();

if (!$student) {
    echo "User not found in student_info.";
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

    $stmt = $pdo->prepare("UPDATE student_info SET name = ?, surname = ?, mail = ?, cell = ?, age = ?, location = ?, user_type = ? WHERE student_id = ?");
    $stmt->execute([$name, $surname, $mail, $cell, $age, $location, $category, $student_id]);

    header("Location: profile.php");
    exit;
}

// Reload updated info
$stmt = $pdo->prepare("SELECT * FROM student_info WHERE student_id = ?");
$stmt->execute([$student_id]);
$student = $stmt->fetch(PDO::FETCH_ASSOC);

// For select options
$grades = ['High School', 'University/College', 'Other'];
$countries = [
    'Argentina', 'Australia', 'Brazil', 'Canada', 'China', 'Colombia', 'France', 'Germany', 'India',
    'Indonesia', 'Italy', 'Japan', 'Malaysia', 'Mexico', 'Netherlands', 'Nigeria', 'Russia',
    'Saudi Arabia', 'Singapore', 'South Africa', 'South Korea', 'Spain', 'Sweden', 'Turkey',
    'United Arab Emirates', 'United Kingdom', 'United States'
];
?>

<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Edit Profile | Université</title>
  <link rel="stylesheet" href="assets/bootstrap/css/bootstrap.min.css">
  <link rel="shortcut icon" href="assets/images/icon-removebg-preview.png-128x128.png" type="image/x-icon">
</head>
<body class="container mt-5">
  <h2 class="mb-4">Edit Personal Info</h2>
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
        <?php foreach ($grades as $grade): ?>
          <option value="<?= $grade ?>" <?= $student['user_type'] === $grade ? 'selected' : '' ?>>
            <?= $grade ?>
          </option>
        <?php endforeach; ?>
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
      <input type="date" name="age" class="form-control" value="<?= htmlspecialchars($student['age']) ?>">
    </div>

    <div class="mb-3">
      <label>Country</label>
      <select class="form-select" name="location" required>
        <option value="">-- Select Country --</option>
        <?php foreach ($countries as $country): ?>
          <option value="<?= $country ?>" <?= $student['location'] === $country ? 'selected' : '' ?>>
            <?= $country ?>
          </option>
        <?php endforeach; ?>
      </select>
    </div>

    <button type="submit" class="btn btn-primary">Save</button>
    <a href="profile.php" class="btn btn-secondary">Cancel</a>
  </form>
</body>
</html>
