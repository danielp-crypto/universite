<?php
session_start();

require 'db.php'; // Assume this contains $pdo = new PDO(...);

// Check session
if (!isset($_SESSION['user_id']) || !isset($_SESSION['user_email'])) {
    header("Location: login.php");
    exit;
}

$email = $_SESSION['user_email'];
// Mark all user-relevant notifications as read
$markAsReadStmt = $pdo->prepare("
    UPDATE notifications 
    SET is_read = 1 
    WHERE (user_email IS NULL OR user_email = ?) AND is_read = 0
");
$markAsReadStmt->execute([$email]);


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
// Mark all user-specific and broadcast notifications as read
$markAsReadStmt = $pdo->prepare("
    UPDATE notifications 
    SET is_read = 1 
    WHERE (user_email IS NULL OR user_email = ?) AND is_read = 0
");
$markAsReadStmt->execute([$email]);

// Fetch notifications to display
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
  <link rel="stylesheet" href="assets/css/notifications.min.css">
</head>
<body>
  <div class="container">
    <nav>
      <div class="logo">  <img src="assets/images/new-logo-white-removebg-preview.png-1-192x192.png" alt="Universite logo" style="height: 5rem;"></div>
      <div class="sidebar">

        <a href="profile.php" class="nav-item"><i class="fas fa-user"></i><?= htmlspecialchars($student['name']) ?>
    </a>

        <a href="recommendations.php" class="nav-item"><i class="fas fa-book"></i> Courses</a>
        <a href="mycourses.php" class="nav-item"><i class="fas fa-star"></i> Saved Searches</a>
        <a href="notifications.php" class="nav-item active"><i class="fas fa-bell"></i> Notifications<?php if ($count > 0): ?>
        <span class="badge"><?= $count ?></span>
    <?php endif; ?></a>
        <a href="logout.php" class="nav-item"><i class="fas fa-sign-out-alt"></i> Sign out</a>
      </div>
    </nav>

    <main class="main">
      <h2 style="text-align:center; margin-bottom:2rem;">Notifications</h2>
      <?php
        // Fetch all notifications (latest first)
        $notifStmt = $pdo->query("SELECT message, created_at FROM notifications ORDER BY created_at DESC");
        $notifications = $notifStmt->fetchAll();
        if ($notifications) {
          foreach ($notifications as $notif) {
      ?>
        <div style="background: #fff; border-radius: 12px; box-shadow: 0 2px 8px rgba(31,41,55,0.08); padding: 1.5rem 2rem; margin-bottom: 1.5rem; max-width: 600px; margin-left:auto; margin-right:auto; border-left: 5px solid #2563eb;">
          <div style="font-size: 1.1rem; color: #1f2937; margin-bottom: 0.5rem;">
            <i class="fas fa-bullhorn" style="color:#2563eb; margin-right:0.5rem;"></i>
            <?= nl2br(htmlspecialchars($notif['message'])) ?>
          </div>
          <div style="font-size: 0.95rem; color: #6b7280; text-align: right;">
            <i class="far fa-clock" style="margin-right:0.3rem;"></i>
            <?= date('F j, Y, g:i a', strtotime($notif['created_at'])) ?>
          </div>
        </div>
      <?php
          }
        } else {
      ?>
        <div style="text-align:center; color:#6b7280;">No notifications at this time.</div>
      <?php } ?>
    </main>
  </div>
</body>
</html>
