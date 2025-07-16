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
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      min-height: 100vh;
      background: linear-gradient(135deg, #f3f4f6 0%, #e0e7ef 100%);
    }
    .container { display: flex; }
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
    .sidebar { display: flex; flex-direction: column; gap: 1rem; }
    .logo { font-size: 1.5rem; font-weight: bold; text-align: center; padding-bottom: 1rem; border-bottom: 1px solid #374151; }
    .nav-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; border-radius: 0.5rem; transition: background 0.3s, transform 0.2s; cursor: pointer; font-size: 1rem; background-color: transparent; }
    .nav-item:hover { background-color: #374151; transform: translateX(4px); }
    .nav-item i { font-size: 1.2rem; color: #60a5fa; }
    .nav-item.active { background-color: #2563eb; font-weight: bold; }
    .nav-item.active i { color: #fff; }
    .main {
      margin-left: 250px;
      padding: 2rem;
      flex: 1;
      min-height: 100vh;
      display: flex;
      align-items: flex-start;
      justify-content: center;
    }
    @media (max-width: 900px) {
      .main { padding: 1rem; }
      .exam-card { padding: 1.2rem 0.5rem; width: 100%; }
    }
    @media (max-width: 768px) {
      .container { flex-direction: column; }
      nav { width: 100%; height: auto; position: fixed; top: 0; left: 0; padding: 0.5rem 1rem; z-index: 1000; }
      .sidebar { flex-direction: row; justify-content: space-around; flex-wrap: wrap; padding: 0.5rem; }
      .logo { display: none; }
      .main { margin-left: 0; margin-top: 120px; padding: 1rem; }
    }
    .exam-card {
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
    .exam-card h1 {
      font-size: 2rem;
      font-weight: 700;
      color: #2563eb;
      margin-bottom: 1.5rem;
      text-align: center;
    }
    .form-group { width: 100%; margin-bottom: 1.2rem; }
    label { display: block; font-weight: 600; margin-bottom: 0.4rem; color: #1e293b; }
    textarea {
      width: 100%;
      min-height: 100px;
      max-width: 100%;
      padding: 1rem;
      border: 1.5px solid #60a5fa;
      border-radius: 10px;
      font-size: 1.08rem;
      background: #f8fafc;
      margin-bottom: 0.5rem;
      transition: border 0.2s;
      resize: vertical;
    }
    textarea:focus { border: 1.5px solid #2563eb; outline: none; background: #fff; }
    .file-upload-zone {
      border: 2px dashed #60a5fa;
      border-radius: 12px;
      background: #f8fafc;
      padding: 2rem 1rem;
      text-align: center;
      cursor: pointer;
      transition: border-color 0.2s, background 0.2s;
      color: #2563eb;
      font-size: 1rem;
      margin-bottom: 1.5rem;
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
    }
    .file-upload-zone.dragover { background: #e0f2fe; border-color: #2563eb; }
    .file-upload-zone i { font-size: 2.2rem; color: #60a5fa; margin-bottom: 0.3rem; display: block; }
    .file-upload-label { font-weight: 600; color: #1e293b; margin-bottom: 0.2rem; }
    .file-upload-info { font-size: 0.98rem; color: #2563eb; margin-top: 0.2rem; }
    .file-upload-selected { color: #059669; font-size: 1rem; margin-top: 0.3rem; font-weight: 500; }
    input[type="number"] {
      width: 100%;
      padding: 0.85rem 1rem;
      border-radius: 8px;
      border: 1.5px solid #cbd5e1;
      font-size: 1.05rem;
      background: #f8fafc;
      transition: border 0.2s;
      margin-bottom: 0.2rem;
    }
    input[type="number"]:focus { border: 1.5px solid #2563eb; outline: none; background: #fff; }
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
    button#generateBtn:active { transform: scale(0.98); }
    button#generateBtn[disabled] { opacity: 0.7; cursor: not-allowed; }
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
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .exam-output { margin-top: 2rem; width: 100%; }
    .question-card {
      background: #ecf0f1;
      padding: 1rem;
      margin-bottom: 1rem;
      border-radius: 6px;
      border-left: 5px solid #3498db;
    }
    .question-card h3 { margin: 0 0 0.5rem; font-size: 1.1rem; }
    .question-card p { margin: 0; color: #2c3e50; }
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
  <script>
    const fileInput = document.getElementById('fileInput');
    const fileUploadZone = document.getElementById('fileUploadZone');
    const fileSelected = document.getElementById('fileSelected');
    const examText = document.getElementById('examText');
    let uploadedText = '';

    // File upload zone drag & drop and click
    fileUploadZone.addEventListener('click', () => fileInput.click());
    fileUploadZone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });
    fileUploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      fileUploadZone.classList.add('dragover');
    });
    fileUploadZone.addEventListener('dragleave', (e) => {
      fileUploadZone.classList.remove('dragover');
    });
    fileUploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      fileUploadZone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        fileInput.files = e.dataTransfer.files;
        showSelectedFile();
        fileInput.dispatchEvent(new Event('change'));
      }
    });
    fileInput.addEventListener('change', showSelectedFile);
    function showSelectedFile() {
      if (fileInput.files && fileInput.files.length > 0) {
        fileSelected.textContent = fileInput.files[0].name + ' selected';
        fileSelected.style.display = '';
      } else {
        fileSelected.textContent = '';
        fileSelected.style.display = 'none';
      }
    }
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.name.endsWith('.pdf')) {
        // PDF handling
        const reader = new FileReader();
        reader.onload = async function(event) {
          const typedarray = new Uint8Array(event.target.result);
          const pdf = await pdfjsLib.getDocument({data: typedarray}).promise;
          let textContent = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const txt = await page.getTextContent();
            textContent += txt.items.map(item => item.str).join(' ') + '\n';
          }
          uploadedText = textContent;
          examText.value = textContent;
        };
        reader.readAsArrayBuffer(file);
      } else {
        // TXT
        const reader = new FileReader();
        reader.onload = function(event) {
          uploadedText = event.target.result;
          examText.value = uploadedText;
        };
        reader.readAsText(file);
      }
    });
    document.getElementById('generateBtn').addEventListener('click', () => {
      const text = examText.value.trim();
      const num = parseInt(document.getElementById('numQuestions').value, 10);
      const output = document.getElementById('examOutput');
      output.innerHTML = '';
      if (!text || isNaN(num) || num < 1 || num > 50) {
        alert('Please paste text or upload a file, and enter a valid number of questions.');
        return;
      }
      // Simulate generated questions
      for (let i = 1; i <= num; i++) {
        const question = `Q${i}: What is a key point from your material?`;
        const answer = `Answer: This is a sample answer for question ${i}.`;
        const card = document.createElement('div');
        card.className = 'question-card';
        card.innerHTML = `<h3>${question}</h3><p>${answer}</p>`;
        output.appendChild(card);
      }
    });
  </script>
</body>
</html>
