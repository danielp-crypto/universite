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
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
  <link rel="stylesheet" href="assets/css/flashcards.min.css">
  <script src="assets/js/flashcards.min.js"></script>
  <script src="assets/js/flashcards.min.js"></script>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div class="container">
    <nav>
      <div class="logo">  <img src="assets/images/new-logo-white-removebg-preview.png-1-192x192.png" alt="Universite logo" style="height: 5rem;"></div>
      <div class="sidebar">

        <a href="profile.php" class="nav-item active"><i class="fas fa-user"></i><?= htmlspecialchars($student['name']) ?>
    </a>

        <a href="recommendations.php" class="nav-item"><i class="fas fa-book"></i> Courses</a>
        <a href="logout.php" class="nav-item"><i class="fas fa-sign-out-alt"></i> Sign out</a>
      </div>
    </nav>

    <main class="main">
      <h5 class="text-3xl font-bold text-blue-700 mb-6">Learn faster with flashcards</h5>

  <div class="flex flex-col items-center w-full">
    <div id="fileUploadZone" class="file-upload-zone" tabindex="0">
      <i class="fas fa-cloud-upload-alt"></i>
      <span class="file-upload-label">Upload or drag & drop a .txt, .csv, or .pdf file</span>
      <span class="file-upload-info">Accepted: .txt, .csv, .pdf &bull; Max 25MB</span>
      <span id="fileSelected" class="file-upload-selected" style="display:none;"></span>
      <input type="file" id="fileInput" accept=".txt,.csv,.pdf" style="display:none;" />
    </div>
    <textarea id="input" class="w-full max-w-2xl p-4 border-2 border-blue-300 rounded-xl mb-4 shadow focus:outline-none focus:ring-2 focus:ring-blue-500" rows="4" placeholder="Enter a topic, notes, or questions..."></textarea>
    <button id="generateBtn" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-xl shadow-lg transition-all mb-2">
      ✨ Generate Flashcards
    </button>
  </div>

  <div id="flashcardContainer" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mt-10 w-full max-w-5xl px-2">
    <!-- Flashcards will be inserted here -->
  </div>

       <script src="assets/js/flashcards.min.js"></script>

       </script>
    </main>
  </div>
</body>
</html>
