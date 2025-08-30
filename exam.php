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


// Example: get interests (assuming they are in a separate table)
$interestStmt = $pdo->prepare("SELECT option1, option2, option3 FROM options WHERE student_id = ?");
$interestStmt->execute([$student['student_id']]); // correct

$interests = $interestStmt->fetch();
?>

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1">
  <link rel="shortcut icon" href="assets/images/icon-removebg-preview.png-128x128.png" type="image/x-icon">
  <title>Mock Exam Generator</title>
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
  <script src="assets/js/exam.min.js"></script>
  <link rel="stylesheet" href="assets/css/exam.min.css">
</head>
<body>
  <div class="container">
    <nav>
      <div class="logo">  <img src="assets/images/new-logo-white-removebg-preview.png-1-192x192.png" alt="Universite logo" style="height: 5rem;"></div>
      <div class="sidebar">
        <a href="profile.php" class="nav-item active"><i class="fas fa-user"></i><?= htmlspecialchars($student['name']) ?>
        </a>
        <a href="recommendations.php" class="nav-item"><i class="fas fa-book"></i> Courses</a>
        <a href="market.php" class="nav-item"><i class="fas fa-store"></i> Marketplace</a>
        <a href="logout.php" class="nav-item"><i class="fas fa-sign-out-alt"></i> Sign out</a>
      </div>
    </nav>
    <main class="main">
      <div class="exam-card">
        <h1>Mock Exam Generator</h1>
        <div class="form-group">
          <label for="examText">Paste your study text here:</label>
          <textarea id="examText" placeholder="Paste your notes, textbook content, or any text..."></textarea>
        </div>
        <div id="fileUploadZone" class="file-upload-zone" tabindex="0">
          <i class="fas fa-cloud-upload-alt"></i>
          <span class="file-upload-label">Upload or drag & drop a .txt or .pdf file</span>
          <span class="file-upload-info">Accepted: .txt, .pdf &bull; Max 25MB</span>
          <span id="fileSelected" class="file-upload-selected" style="display:none;"></span>
          <input type="file" id="fileInput" accept=".txt,.pdf" style="display:none;" />
        </div>
        <div class="form-group">
          <label for="numQuestions">Number of Questions:</label>
          <input type="number" id="numQuestions" min="1" max="50" value="5" />
        </div>
        <button id="generateBtn">Generate Exam</button>
        <div id="examOutput" class="exam-output"></div>
      </div>
    </main>
  </div>
  <script src="assets/js/exam.min.js"></script>
</body>
</html>
