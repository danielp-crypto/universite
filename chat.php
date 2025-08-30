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
?>
<?php
// Database connection
$host = "localhost";
$user = "root";
$password = "NewSecurePassword123!";
$dbname = "mydb";

$con = new mysqli($host, $user, $password, $dbname);
if ($con->connect_error) {
    die("Connection failed: " . $con->connect_error);
}

// Search and pagination
$myCourse = isset($_GET['myCourse']) ? $con->real_escape_string($_GET['myCourse']) : '';
$current_page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
$total_records_per_page = 10;
$offset = ($current_page - 1) * $total_records_per_page;

// Get total
$count_sql = "SELECT COUNT(*) AS total FROM courses WHERE programme LIKE '%$myCourse%'";
$count_result = $con->query($count_sql);
$total_rows = $count_result->fetch_assoc()['total'];
$total_pages = ceil($total_rows / $total_records_per_page);

// Fetch data
$sql = "SELECT class, campus, certification, programme, duration, aps, institution, subjects, date, link
        FROM courses
        WHERE programme LIKE '%$myCourse%'
        ORDER BY aps ASC
        LIMIT $offset, $total_records_per_page";
$result = $con->query($sql);
// Fetch user-specific and broadcast notifications
$notifStmt = $pdo->prepare("
    SELECT * FROM notifications
    WHERE user_email IS NULL OR user_email = ?
    ORDER BY created_at DESC
");
$notifStmt->execute([$email]);
$notifications = $notifStmt->fetchAll();
?>
<?php
require 'db.php';
session_start();

$email = $_SESSION['user_email'] ?? null;

$count = 0;

if ($email) {
    // Count unread or total (choose one)
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM notifications WHERE (user_email IS NULL OR user_email = ?) AND is_read = 0");
    $stmt->execute([$email]);
    $count = $stmt->fetchColumn();
}
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
  <link rel="stylesheet" href="assets/css/chat.min.css">
</head>
<body><br>
  <div class="container">
    <nav>
      <div class="logo">  <img src="assets/images/new-logo-white-removebg-preview.png-1-192x192.png" alt="Universite logo" style="height: 5rem;"></div>
      <div class="sidebar">
        <a href="profile.php" class="nav-item"><i class="fas fa-user"></i><?= htmlspecialchars($student['name']) ?>
        </a>


        <a href="recommendations.php" class="nav-item"><i class="fas fa-book"></i> Courses</a>
        <a href="chat.php" class="nav-item active"><i class="fas fa-robot"></i> AI chat</a>
        <a href="notifications.php" class="nav-item"><i class="fas fa-bell"></i> Notifications<?php if ($count > 0): ?>
        <span class="badge"><?= $count ?></span>
    <?php endif; ?></a>
        <a href="logout.php" class="nav-item"><i class="fas fa-sign-out-alt"></i> Sign out</a>
      </div>
    </nav>


      <script src="assets/js/chat.min.js"></script>
      <script src="assets/js/chat.min.js"></script>
      <main class="main">
        <div class="chat-wrapper">
          <!-- Header -->
          <div class="chat-header">
            <label class="display-5">AI Chat Assistant</label>
          </div>

          <!-- Chat Messages -->
          <div id="chat-messages" class="chat-body">
            <div class="chat-bot chat-bubble">Hello! How can I help you today? Are you looking for information about college admissions, financial aid, study tips, or help with coursework? Let me know what you need, and I'll do my best to assist you!</div>
          </div>

          <!-- Example Prompts -->
          <div class="example-prompts" id="examplePrompts">
            <button type="button" class="prompt-chip">How do I apply for financial aid?</button>
            <button type="button" class="prompt-chip">What are the top universities for engineering?</button>
            <button type="button" class="prompt-chip">How do I write a personal statement?</button>
            <button type="button" class="prompt-chip">What scholarships are available for international students?</button>
            
          </div>
          <form id="chat-form" class="chat-input-bar">
            <input type="text" id="chat-input" placeholder="Ask anything..." required />
            <button type="submit" class="btn-nicer"><i class="fas fa-paper-plane"></i></button>
          </form>
        </div>
      </main>




    </div>

    </main>
  </div>
</body>
</html>
