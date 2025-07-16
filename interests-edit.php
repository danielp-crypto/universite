<?php
session_start();

require 'db.php'; // Assume this contains $pdo = new PDO(...);

// Check session
if (!isset($_SESSION['user_id']) || !isset($_SESSION['user_email'])) {
    header("Location: login.php");
    exit;
}

$email = $_SESSION['user_email'];

$stmt = $pdo->prepare("SELECT * FROM student_info WHERE mail = ?");
$stmt->execute([$email]);
$student = $stmt->fetch();

if (!$student) {
    echo "User not found in student_info.";
    exit;
}
// Load current interests
$interestStmt = $pdo->prepare("SELECT option1, option2, option3 FROM options WHERE student_id = ?");
$interestStmt->execute([$student['student_id']]); // correct

$interests = $interestStmt->fetch();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $option1 = $_POST['option1'] ?? '';
    $option2 = $_POST['option2'] ?? '';
    $option3 = $_POST['option3'] ?? '';
    $student_id = $student['student_id'];

    // Check if options exist for this student
    $checkStmt = $pdo->prepare("SELECT COUNT(*) FROM options WHERE student_id = ?");
    $checkStmt->execute([$student_id]);
    $exists = $checkStmt->fetchColumn() > 0;

    if ($exists) {
        // Update existing record
        $updateStmt = $pdo->prepare("UPDATE options SET option1 = ?, option2 = ?, option3 = ? WHERE student_id = ?");
        $updateStmt->execute([$option1, $option2, $option3, $student_id]);
    } else {
        // Insert new record
        $insertStmt = $pdo->prepare("INSERT INTO options (student_id, option1, option2, option3) VALUES (?, ?, ?, ?)");
        $insertStmt->execute([$student_id, $option1, $option2, $option3]);
    }

    // Redirect after save
    header("Location: profile.php");
    exit;
}

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
  <h2>Edit Preferred Courses</h2>
  <form method="POST">
    <div class="mb-3">
      <label>Course Option 1</label>
      <input type="text" name="option1" class="form-control" value="<?= htmlspecialchars($interests['option1'] ?? '') ?>">
    </div>
    <div class="mb-3">
      <label>Course Option 2</label>
      <input type="text" name="option2" class="form-control" value="<?= htmlspecialchars($interests['option2'] ?? '') ?>" required>
    </div>
    <div class="mb-3">
      <label>Course Option 3</label>
      <input type="text" name="option3" class="form-control" value="<?= htmlspecialchars($interests['option3'] ?? '') ?>" required>
    </div>
    <button type="submit" class="btn btn-primary">Save</button>
    <a href="profile.php" class="btn btn-secondary">Cancel</a>
  </form>
</body>
</html>
