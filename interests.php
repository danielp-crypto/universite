<?php
session_start();
require 'db.php'; // This should initialize $pdo = new PDO(...)

// Redirect to login if session invalid
if (!isset($_SESSION['user_id']) || !isset($_SESSION['user_email'])) {
    header("Location: login.php");
    exit;
}

$email = $_SESSION['user_email'];

// Fetch user info
$stmt = $pdo->prepare("SELECT * FROM student_info WHERE mail = ?");
$stmt->execute([$email]);
$student = $stmt->fetch();

if (!$student) {
    echo "User not found in student_info.";
    exit;
}

// Load current interests
$interestStmt = $pdo->prepare("SELECT option1, option2, option3 FROM options WHERE student_id = ?");
$interestStmt->execute([$student['student_id']]);
$interests = $interestStmt->fetch();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $option1 = $_POST['option1'] ?? '';
    $option2 = $_POST['option2'] ?? '';
    $option3 = $_POST['option3'] ?? '';
    $student_id = $student['student_id'];

    // Check if record exists
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

    header("Location: recommendations.php");
    exit;
}
?>

<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Edit Preferred Courses</title>
  <link rel="stylesheet" href="assets/bootstrap/css/bootstrap.min.css" />
</head>
<body class="container mt-5">
  <h2>Edit Preferred Courses</h2>
  <form method="POST">
    <div class="mb-3">
      <label>Course Option 1</label>
      <input type="text" name="option1" class="form-control" value="<?= htmlspecialchars($interests['option1'] ?? '') ?>" />
    </div>
    <div class="mb-3">
      <label>Course Option 2</label>
      <input type="text" name="option2" class="form-control" value="<?= htmlspecialchars($interests['option2'] ?? '') ?>" required />
    </div>
    <div class="mb-3">
      <label>Course Option 3</label>
      <input type="text" name="option3" class="form-control" value="<?= htmlspecialchars($interests['option3'] ?? '') ?>" required />
    </div>
    <button type="submit" class="btn btn-primary">Save</button>
    <a href="profile.php" class="btn btn-secondary">Cancel</a>
  </form>
</body>
</html>
