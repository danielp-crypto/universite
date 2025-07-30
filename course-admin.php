<?php
session_start();
require 'db.php';

// Optional: restrict access to admin users only
if (!isset($_SESSION['user_id']) || $_SESSION['user_email'] !== 'admin@example.com') {
    die("Access denied. Only admins can upload courses.");
}

$message = "";

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $class = $_POST['class'] ?? '';
    $certification = $_POST['certification'] ?? '';
    $programme = $_POST['programme'] ?? '';
    $duration = $_POST['duration'] ?? '';
    $aps = $_POST['aps'] ?? '';
    $institution = $_POST['institution'] ?? '';
    $campus = $_POST['campus'] ?? '';
    $subjects = $_POST['subjects'] ?? '';
    $date = $_POST['date'] ?? '';
    $link = $_POST['link'] ?? '';

    $stmt = $pdo->prepare("INSERT INTO sa_courses (CLASS, CERTIFICATION, PROGRAMME, DURATION, APS, INSTITUTION, CAMPUS, SUBJECTS, DATE, LINK)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([$class, $certification, $programme, $duration, $aps, $institution, $campus, $subjects, $date, $link]);
    $message = "Course uploaded successfully.";
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Manual Course Entry</title>
  <style>
    body { font-family: Arial; margin: 40px; }
    form { border: 1px solid #ccc; padding: 20px; max-width: 600px; }
    label { display: block; margin-top: 10px; font-weight: bold; }
    input, textarea { width: 100%; padding: 8px; margin-top: 4px; }
    .msg { color: green; margin-top: 10px; }
  </style>
</head>
<body>
  <h2>Enter Course into SA Courses Table</h2>
  <form action="" method="POST">
    <label for="class">Class</label>
    <input type="text" name="class" id="class" required>

    <label for="certification">Certification</label>
    <input type="text" name="certification" id="certification" required>

    <label for="programme">Programme</label>
    <input type="text" name="programme" id="programme" required>

    <label for="duration">Duration</label>
    <input type="text" name="duration" id="duration" required>

    <label for="aps">APS</label>
    <input type="text" name="aps" id="aps" required>

    <label for="institution">Institution</label>
    <input type="text" name="institution" id="institution" required>

    <label for="campus">Campus</label>
    <input type="text" name="campus" id="campus" required>

    <label for="subjects">Subjects</label>
    <textarea name="subjects" id="subjects" rows="3" required></textarea>

    <label for="date">Date</label>
    <input type="text" name="date" id="date" required>

    <label for="link">Link</label>
    <input type="text" name="link" id="link" required>

    <button type="submit" style="margin-top: 15px;">Submit</button>
  </form>

  <?php if ($message): ?>
    <p class="msg"><?= htmlspecialchars($message) ?></p>
  <?php endif; ?>
</body>
</html>
