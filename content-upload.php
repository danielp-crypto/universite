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
  <title>Content Upload | Universite</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="shortcut icon" href="assets/images/icon-removebg-preview.png-128x128.png" type="image/x-icon">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
  <link rel="stylesheet" href="assets/bootstrap/css/bootstrap.min.css">
  <link rel="stylesheet" href="assets/css/content-upload.min.css">
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
      <a href="content-upload.php" class="nav-item active"><i class="fas fa-upload"></i> Upload</a>
      <a href="notifications.php" class="nav-item"><i class="fas fa-bell"></i> Notifications<?php if ($count > 0): ?>
        <span class="badge"><?= $count ?></span>
      <?php endif; ?></a>
      <a href="logout.php" class="nav-item"><i class="fas fa-sign-out-alt"></i> Sign out</a>
    </div>
  </nav>
  <main class="main">
    <div class="upload-container">
      <h2 class="mb-4" style="color:#2563eb;font-weight:700;">Upload Your Content</h2>
      <form id="uploadForm" enctype="multipart/form-data" method="post" style="width:100%;">
        <div id="fileUploadZone" class="file-upload-zone" tabindex="0">
          <i class="fas fa-cloud-upload-alt"></i>
          <span class="file-upload-label">Upload or drag & drop a PDF or EPUB file</span>
          <span class="file-upload-info">Accepted: .pdf, .epub &bull; Max 25MB</span>
          <span id="fileSelected" class="file-upload-selected" style="display:none;"></span>
          <input type="file" id="fileInput" name="document" accept=".pdf,.epub" style="display:none;" required />
        </div>
        <button type="submit" class="btn btn-primary w-100">Upload &amp; Animate</button>
      </form>
      <div id="animationPlaceholder" class="placeholder-anim" style="display:none;">
        <i class="fas fa-spinner fa-spin"></i> Generating animated video lesson from your document...
      </div>
    </div>
  </main>
</div>
<script src="assets/js/content-upload.min.js"></script>
<script src="assets/js/content-upload.min.js"></script>
</body>
</html>
