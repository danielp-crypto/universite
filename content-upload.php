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
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f9fafb; margin: 0; }
    .container { display: flex; }
    nav { background-color: #1f2937; color: white; padding: 1rem; height: 100vh; position: fixed; top: 0; left: 0; width: 250px; display: flex; flex-direction: column; gap: 1.5rem; z-index: 1000; }
    .sidebar { display: flex; flex-direction: column; gap: 1rem; }
    .logo { font-size: 1.5rem; font-weight: bold; text-align: center; padding-bottom: 1rem; border-bottom: 1px solid #374151; }
    .nav-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; border-radius: 0.5rem; transition: background 0.3s, transform 0.2s; cursor: pointer; font-size: 1rem; background-color: transparent; }
    .nav-item:hover { background-color: #374151; transform: translateX(4px); }
    .nav-item i { font-size: 1.2rem; color: #60a5fa; }
    .nav-item.active { background-color: #2563eb; font-weight: bold; }
    .nav-item.active i { color: #fff; }
    .main { margin-left: 250px; padding: 2rem; flex: 1; display: flex; flex-direction: column; min-height: 100vh; }
    .upload-container { width: 100%; max-width: 900px; margin: 0 auto; background: #fff; border-radius: 1.25rem; box-shadow: 0 4px 24px rgba(37,99,235,0.08); padding: 2rem 1.5rem 1.5rem 1.5rem; display: flex; flex-direction: column; align-items: center; }
    .file-upload-zone { border: 2px dashed #60a5fa; border-radius: 12px; background: #f8fafc; padding: 2rem 1rem; text-align: center; cursor: pointer; transition: border-color 0.2s, background 0.2s; color: #2563eb; font-size: 1rem; margin-bottom: 1.5rem; position: relative; display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
    .file-upload-zone.dragover { background: #e0f2fe; border-color: #2563eb; }
    .file-upload-zone i { font-size: 2.2rem; color: #60a5fa; margin-bottom: 0.3rem; display: block; }
    .file-upload-label { font-weight: 600; color: #1e293b; margin-bottom: 0.2rem; }
    .file-upload-info { font-size: 0.98rem; color: #2563eb; margin-top: 0.2rem; }
    .file-upload-selected { color: #059669; font-size: 1rem; margin-top: 0.3rem; font-weight: 500; }
    .placeholder-anim { margin-top: 2rem; color: #2563eb; font-size: 1.1rem; text-align: center; }
    @media (max-width: 900px) { .main, .upload-container { padding: 1rem; } .upload-container { max-width: 100%; } }
    @media (max-width: 768px) { .container { flex-direction: column; } nav { width: 100%; height: auto; position: fixed; top: 0; left: 0; } .sidebar { flex-direction: row; justify-content: space-around; flex-wrap: wrap; padding: 0.5rem; } .logo { display: none; } .main { margin-left: 0; margin-top: 120px; } }
    a {text-decoration:none;color:white;} a:visited { color: inherit; text-decoration: none; }
  </style>
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
<script src="assets/bootstrap/js/bootstrap.bundle.min.js"></script>
<script>
const fileInput = document.getElementById('fileInput');
const fileUploadZone = document.getElementById('fileUploadZone');
const fileSelected = document.getElementById('fileSelected');
const uploadForm = document.getElementById('uploadForm');
const animationPlaceholder = document.getElementById('animationPlaceholder');

fileUploadZone.addEventListener('click', () => fileInput.click());
fileUploadZone.addEventListener('dragover', e => { e.preventDefault(); fileUploadZone.classList.add('dragover'); });
fileUploadZone.addEventListener('dragleave', e => { e.preventDefault(); fileUploadZone.classList.remove('dragover'); });
fileUploadZone.addEventListener('drop', e => {
  e.preventDefault();
  fileUploadZone.classList.remove('dragover');
  if (e.dataTransfer.files.length) {
    fileInput.files = e.dataTransfer.files;
    showSelectedFile();
  }
});
fileInput.addEventListener('change', showSelectedFile);
function showSelectedFile() {
  if (fileInput.files.length) {
    fileSelected.textContent = 'Selected: ' + fileInput.files[0].name;
    fileSelected.style.display = '';
  } else {
    fileSelected.textContent = '';
    fileSelected.style.display = 'none';
  }
}
uploadForm.addEventListener('submit', function(e) {
  e.preventDefault();
  if (!fileInput.files.length) return;
  animationPlaceholder.style.display = '';
  // Simulate processing (replace with real upload/animation logic)
  setTimeout(() => {
    animationPlaceholder.innerHTML = '<i class="fas fa-check-circle" style="color:#059669;"></i> Your animated video lesson is ready! (Demo placeholder)';
  }, 3000);
});
</script>
</body>
</html>
