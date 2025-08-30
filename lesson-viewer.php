<?php
session_start();
require 'db.php';

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

// Notification count
$count = 0;
$notifStmt = $pdo->prepare("SELECT COUNT(*) FROM notifications WHERE (user_email IS NULL OR user_email = ?) AND is_read = 0");
$notifStmt->execute([$email]);
$count = $notifStmt->fetchColumn();
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Lesson Viewer | Universite</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="shortcut icon" href="assets/images/icon-removebg-preview.png-128x128.png" type="image/x-icon">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
  <link rel="stylesheet" href="assets/bootstrap/css/bootstrap.min.css">
  <link rel="stylesheet" href="assets/css/lesson-viewer.min.css">
</head>
<body>
<div class="container">
  <nav>
    <div class="logo">
      <img src="assets/images/new-logo-white-removebg-preview.png-1-192x192.png" alt="Universite logo" style="height: 5rem;">
    </div>
    <div class="sidebar">
      <a href="profile.php" class="nav-item"><i class="fas fa-user"></i><?= htmlspecialchars($student['name']) ?></a>
      <a href="recommendations.php" class="nav-item"><i class="fas fa-book"></i> Courses</a>
      <a href="lesson-viewer.php" class="nav-item active"><i class="fas fa-play-circle"></i> Learn</a>
      <a href="notifications.php" class="nav-item"><i class="fas fa-bell"></i> Notifications<?php if ($count > 0): ?>
        <span class="badge"><?= $count ?></span>
      <?php endif; ?></a>
      <a href="logout.php" class="nav-item"><i class="fas fa-sign-out-alt"></i> Sign out</a>
    </div>
  </nav>
  <main class="main">
    <div class="video-container">
      <div class="video-player">
        <!-- Replace with dynamic video source as needed -->
        <video id="lessonVideo" width="100%" height="100%" controls poster="assets/images/mbr-1187x992.png" style="border-radius:1rem; background:#000;">
          <source src="assets/videos/sample-lesson.mp4" type="video/mp4">
          Your browser does not support the video tag.
        </video>
      </div>
      <button id="fullscreenBtn" class="btn btn-outline-primary" style="margin-bottom:1rem;">
        <i class="fas fa-expand"></i> Fullscreen
      </button>
      <div style="display:flex;align-items:center;justify-content:space-between;width:100%;max-width:800px;margin:0 auto 0 auto;gap:1rem;">
        <div style="display:flex;align-items:center;gap:0.7rem;">
          <a href="exam.php" class="btn btn-outline-success btn-sm"><i class="fas fa-question-circle"></i> Quiz</a>
          <a href="notes.php" class="btn btn-outline-info btn-sm"><i class="fas fa-sticky-note"></i> Notes</a>
        </div>
        <div style="font-size:1.3rem;font-weight:600;color:#1f2937;text-align:center;flex:1;">Lesson Title Here</div>
        <div>
          <a href="#" class="btn btn-outline-primary btn-sm"><i class="fas fa-arrow-right"></i> Next lesson</a>
        </div>
      </div>
      <div style="color:#6b7280;max-width:800px;margin:0 auto 1rem auto;">Lesson description or details can go here.</div>
    </div>
    <div class="chatbot-box">
      <div class="chatbot-header"><i class="fas fa-robot"></i> AI Chatbot</div>
      <form id="chat-form" style="display:flex;gap:0.5rem;align-items:center;">
        <input type="text" id="chat-input" class="form-control" placeholder="Ask the AI about this lesson..." required style="flex:1;">
        <button type="submit" class="btn btn-primary"><i class="fas fa-paper-plane"></i></button>
      </form>
      <div id="chat-messages" style="margin-top:1rem;max-height:200px;overflow-y:auto;"></div>
    </div>
  </main>
</div>
<script src="assets/js/lesson-viewer.min.js"></script>
<script src="assets/js/lesson-viewer.min.js"></script>
</body>
</html>
