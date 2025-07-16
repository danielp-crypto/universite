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



  <title>AI Notes | Universite</title>
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      min-height: 100vh;
      background: linear-gradient(135deg, #f3f4f6 0%, #e0e7ef 100%);
    }
    .container {
      display: flex;
    }
    nav {
      background-color: #1f2937;
      color: white;
      padding: 1rem;
      height: 100vh;
      position: fixed;
      top: 0;
      left: 0;
      width: 250px;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      z-index: 1000;
    }
    .sidebar {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .logo {
      font-size: 1.5rem;
      font-weight: bold;
      text-align: center;
      padding-bottom: 1rem;
      border-bottom: 1px solid #374151;
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;
      transition: background 0.3s, transform 0.2s;
      cursor: pointer;
      font-size: 1rem;
      background-color: transparent;
    }
    .nav-item:hover {
      background-color: #374151;
      transform: translateX(4px);
    }
    .nav-item i {
      font-size: 1.2rem;
      color: #60a5fa;
    }
    .nav-item.active {
      background-color: #2563eb;
      font-weight: bold;
    }
    .nav-item.active i {
      color: #fff;
    }
    .main {
      margin-left: 250px;
      padding: 2rem;
      flex: 1;
      min-height: 100vh;
      display: flex;
      align-items: flex-start;
      justify-content: center;
    }
    @media (max-width: 768px) {
      .container {
        flex-direction: column;
      }
      nav {
        width: 100%;
        height: auto;
        position: fixed;
        top: 0;
        left: 0;
        padding: 0.5rem 1rem;
        z-index: 1000;
      }
      .sidebar {
        flex-direction: row;
        justify-content: space-around;
        flex-wrap: wrap;
        padding: 0.5rem;
      }
      .logo {
        display: none;
      }
      .main {
        margin-left: 0;
        margin-top: 120px;
        padding: 1rem;
      }
    }
    /* AI Notes Card Styles (as previously applied) */
    .cont {
      width: 100%;
      margin: 2.5rem 0;
      background: #fff;
      padding: 2.5rem 2rem 2rem 2rem;
      border-radius: 18px;
      box-shadow: 0 8px 32px rgba(31,41,55,0.10);
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .cont h1 {
      font-size: 1.7rem;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 2rem;
      text-align: center;
      letter-spacing: 0.01em;
    }
    .form-field {
      width: 100%;
      margin-bottom: 1.2rem;
      display: flex;
      flex-direction: column;
      align-items: stretch;
    }
    .drop-zone {
      border: 2px dashed #60a5fa;
      border-radius: 10px;
      background: #f8fafc;
      padding: 1.2rem 0.5rem;
      text-align: center;
      cursor: pointer;
      transition: border-color 0.2s, background 0.2s;
      color: #2563eb;
      font-size: 1rem;
      margin-bottom: 0.5rem;
      position: relative;
    }
    .drop-zone.dragover {
      background: #e0f2fe;
      border-color: #2563eb;
    }
    .drop-zone i {
      font-size: 1.7rem;
      color: #60a5fa;
      margin-bottom: 0.3rem;
      display: block;
    }
    .file-info {
      font-size: 0.98rem;
      color: #2563eb;
      margin-top: 0.3rem;
    }
    input[type="url"] {
      width: 100%;
      padding: 0.85rem 1rem;
      border-radius: 8px;
      border: 1.5px solid #cbd5e1;
      font-size: 1.05rem;
      background: #f8fafc;
      transition: border 0.2s;
      margin-bottom: 0.2rem;
    }
    input[type="url"]:focus {
      border: 1.5px solid #2563eb;
      outline: none;
      background: #fff;
    }
    button#generateBtn {
      width: 100%;
      padding: 1.1rem;
      background: linear-gradient(90deg, #2563eb 0%, #60a5fa 100%);
      border: none;
      border-radius: 10px;
      color: white;
      font-size: 1.13rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s, transform 0.2s;
      margin-top: 0.5rem;
      margin-bottom: 1.2rem;
    }
    button#generateBtn:active {
      transform: scale(0.98);
    }
    button#generateBtn[disabled] {
      opacity: 0.7;
      cursor: not-allowed;
    }
    .spinner {
      border: 3px solid #e0e7ff;
      border-top: 3px solid #2563eb;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      animation: spin 1s linear infinite;
      display: inline-block;
      vertical-align: middle;
      margin-left: 0.7rem;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .or-divider {
      width: 100%;
      text-align: center;
      color: #b0b3b8;
      font-weight: 600;
      margin: 1.2rem 0 1.2rem 0;
      position: relative;
      font-size: 0.98rem;
    }
    .or-divider:before, .or-divider:after {
      content: '';
      display: inline-block;
      width: 38%;
      height: 1px;
      background: #e5e7eb;
      vertical-align: middle;
      margin: 0 0.5rem;
    }
    .generated-notes {
      background: #f8fafc;
      border-radius: 10px;
      box-shadow: 0 1px 4px rgba(37,99,235,0.06);
      padding: 1.1rem 1rem;
      margin-top: 0.5rem;
      min-height: 60px;
      font-size: 1.03rem;
      color: #334155;
      line-height: 1.6;
      max-height: 220px;
      overflow-y: auto;
      width: 100%;
      display: none;
    }
    .generated-notes.active {
      display: block;
    }
    @media (max-width: 500px) {
      .cont {
        padding: 1.2rem 0.5rem;
        width: 100%;
      }
    }
    a {text-decoration:none;color:white;}
    a:visited {
    color: inherit; /* Inherits color from parent element */
    text-decoration: none; /* Optional: remove underline */
    }
  </style>
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
      <div class="cont">
        <h1>AI Notes</h1>
        <div class="form-field">
          <label class="drop-zone" id="dropZone">
            <i class="fas fa-cloud-upload-alt"></i>
            <span>Drag & drop to upload</span>
            <span class="file-info">.pdf, .docx, .pptx • Max 25MB</span>
            <input type="file" id="fileInput" accept=".pdf,.docx,.pptx" style="display:none;" />
          </label>
        </div>
        <div class="or-divider">or</div>
        <div class="form-field">
          <input type="url" id="linkInput" placeholder="Paste any website link or upload a file" />
        </div>
        <button id="generateBtn">Generate</button>
        <div class="generated-notes" id="generatedNotes"></div>
      </div>
    </main>
  </div>
  <script>
  // Drag and drop functionality for the drop zone
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const fileInfo = dropZone.querySelector('.file-info');
  const generateBtn = document.getElementById('generateBtn');
  const generatedNotes = document.getElementById('generatedNotes');

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', (e) => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      fileInput.files = e.dataTransfer.files;
      fileInfo.textContent = e.dataTransfer.files[0].name + ' selected';
    }
  });

  // Also update file-info when file is selected via click
  fileInput.addEventListener('change', (e) => {
    if (fileInput.files && fileInput.files.length > 0) {
      fileInfo.textContent = fileInput.files[0].name + ' selected';
    } else {
      fileInfo.textContent = '.pdf, .docx, .pptx • Max 25MB';
    }
  });

  // Clicking the drop zone opens the file dialog
  dropZone.addEventListener('click', () => {
    fileInput.click();
  });

  // Generate button loading spinner and fake notes display
  generateBtn.addEventListener('click', () => {
    generateBtn.disabled = true;
    generateBtn.innerHTML = 'Generating... <span class="spinner"></span>';
    generatedNotes.classList.remove('active');
    // Simulate AI note generation
    setTimeout(() => {
      generateBtn.disabled = false;
      generateBtn.innerHTML = 'Generate';
      generatedNotes.innerHTML = '<b>AI Notes Example:</b><br>- Key concept 1 explained.<br>- Important fact 2 summarized.<br>- Main takeaway 3 highlighted.';
      generatedNotes.classList.add('active');
    }, 1800);
  });
  </script>
</body>
</html>
