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
    .video-container { width: 100%; max-width: 900px; margin: 0 auto; background: #fff; border-radius: 1.25rem; box-shadow: 0 4px 24px rgba(37,99,235,0.08); padding: 2rem 1.5rem 1.5rem 1.5rem; display: flex; flex-direction: column; align-items: center; }
    .video-player { width: 100%; max-width: 800px; height: 450px; background: #000; border-radius: 1rem; margin-bottom: 1.5rem; }
    .chatbot-box { width: 100%; max-width: 800px; margin: 2rem auto 0 auto; background: #f8f9fa; border-radius: 1rem; box-shadow: 0 2px 8px rgba(37,99,235,0.08); padding: 1.5rem; }
    .chatbot-header { font-size: 1.2rem; font-weight: 600; color: #2563eb; margin-bottom: 1rem; }
    .badge { background-color: red; color: white; border-radius: 50%; padding: 3px 8px; font-size: 12px; vertical-align: middle; }
    @media (max-width: 900px) { .main, .video-container, .chatbot-box { padding: 1rem; } .video-player, .chatbot-box { max-width: 100%; } }
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
<script src="assets/bootstrap/js/bootstrap.bundle.min.js"></script>
<script>
const form = document.getElementById('chat-form');
const input = document.getElementById('chat-input');
const messages = document.getElementById('chat-messages');
form.addEventListener('submit', async function (e) {
  e.preventDefault();
  let userMsg = input.value.trim();
  if (!userMsg) return;
  appendMessage(userMsg, 'user');
  input.value = '';
  appendTypingIndicator();
  try {
    const response = await fetch("http://localhost:5000/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMsg })
    });
    removeTypingIndicator();
    const data = await response.json();
    appendMessage(data.reply || "⚠️ No reply from the server.", 'bot');
  } catch (error) {
    removeTypingIndicator();
    appendMessage("❌ Error connecting to the chatbot server.", 'bot');
  }
});
function appendMessage(message, sender) {
  const div = document.createElement('div');
  div.className = sender === 'user' ? 'text-end' : 'text-start';
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${sender === 'user' ? 'chat-user' : 'chat-bot'}`;
  bubble.textContent = message;
  div.appendChild(bubble);
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}
function appendTypingIndicator() {
  const div = document.createElement('div');
  div.className = 'text-start';
  div.id = 'typing-indicator';
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble chat-bot typing-bubble';
  bubble.innerHTML = `<span class="dot"></span><span class="dot"></span><span class="dot"></span>`;
  div.appendChild(bubble);
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}
function removeTypingIndicator() {
  const indicator = document.getElementById('typing-indicator');
  if (indicator) indicator.remove();
}

const fullscreenBtn = document.getElementById('fullscreenBtn');
const lessonVideo = document.getElementById('lessonVideo');
let isFullscreen = false;

fullscreenBtn.addEventListener('click', function() {
  if (!isFullscreen) {
    if (lessonVideo.requestFullscreen) {
      lessonVideo.requestFullscreen();
    } else if (lessonVideo.webkitRequestFullscreen) { /* Safari */
      lessonVideo.webkitRequestFullscreen();
    } else if (lessonVideo.msRequestFullscreen) { /* IE11 */
      lessonVideo.msRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) { /* Safari */
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) { /* IE11 */
      document.msExitFullscreen();
    }
  }
});

function updateFullscreenBtn() {
  isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
  if (isFullscreen) {
    fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i> Exit Fullscreen';
  } else {
    fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i> Fullscreen';
  }
}

document.addEventListener('fullscreenchange', updateFullscreenBtn);
document.addEventListener('webkitfullscreenchange', updateFullscreenBtn);
document.addEventListener('msfullscreenchange', updateFullscreenBtn);
</script>
</body>
</html>
