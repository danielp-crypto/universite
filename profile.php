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
  <link rel="stylesheet" href="assets/css/profile.min.css">
</head>
<body>
  <div class="container">
    <nav>
      <div class="logo">  <img src="assets/images/new-logo-white-removebg-preview.png-1-192x192.png" alt="Universite logo" style="height: 5rem;"></div>
      <div class="sidebar">

        <a href="profile.php" class="nav-item active"><i class="fas fa-user"></i><?= htmlspecialchars($student['name']) ?>
    </a>

        <a href="recommendations.php" class="nav-item"><i class="fas fa-book"></i> Courses</a>
        <a href="mycourses.php" class="nav-item"><i class="fas fa-star"></i> Saved Searches</a>
        <a href="notifications.php" class="nav-item"><i class="fas fa-bell"></i> Notifications<?php if ($count > 0): ?>
        <span class="badge"><?= $count ?></span>
    <?php endif; ?></a>
        <a href="logout.php" class="nav-item"><i class="fas fa-sign-out-alt"></i> Sign out</a>
      </div>
    </nav>

    <main class="main">
      <div class="profile-main-wrapper" style="display: flex; flex-direction: column; align-items: center; justify-content: flex-start; min-height: 100vh; background: #f3f4f6; padding: 2rem 0;">
        <div class="profile-card-ui" style="background: #fff; border-radius: 1.25rem; box-shadow: 0 4px 24px rgba(37,99,235,0.08); padding: 2.5rem 2.5rem 2rem 2.5rem; max-width: 900px; width: 90vw; margin-bottom: 2rem;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; flex-wrap: wrap;">
            <h2 style="font-size: 2rem; font-weight: 700; color: #1f2937; margin: 0; letter-spacing: -1px;">Personal Information</h2>
            <button class="edit-button" style="margin-left: 1rem; background: linear-gradient(90deg, #2563eb 0%, #60a5fa 100%); color: #fff; border: none; border-radius: 999px; padding: 0.5rem 1.2rem; font-size: 1rem; font-weight: 500; cursor: pointer; transition: background 0.2s, transform 0.2s; box-shadow: 0 2px 8px rgba(37,99,235,0.10);" onclick="location.href='studentinfo-edit.php'">Edit</button>
          </div>
          <div style="display: flex; flex-direction: column; gap: 1.1rem;">
            <div><span style="font-weight: 600; color: #374151;">Full Name:</span> <span style="color: #374151;"><?= htmlspecialchars($student['name'] . ' ' . $student['surname']) ?></span></div>
            <div><span style="font-weight: 600; color: #374151;">Email:</span> <span style="color: #374151;"><?= htmlspecialchars($student['mail']) ?></span></div>
            <div><span style="font-weight: 600; color: #374151;">Phone:</span> <span style="color: #374151;"><?= htmlspecialchars($student['cell']) ?></span></div>
            <div><span style="font-weight: 600; color: #374151;">Date of Birth:</span> <span style="color: #374151;"><?= htmlspecialchars($student['age'] ?? 'N/A') ?></span></div>
            <div><span style="font-weight: 600; color: #374151;">Country:</span> <span style="color: #374151;"><?= htmlspecialchars($student['location']) ?></span></div>
            <div><span style="font-weight: 600; color: #374151;">Category:</span> <span style="color: #374151;"><?= htmlspecialchars($student['user_type']) ?></span></div>
          </div>
        </div>
        <div class="profile-card-ui" style="background: #fff; border-radius: 1.25rem; box-shadow: 0 4px 24px rgba(37,99,235,0.08); padding: 2.5rem 2.5rem 2rem 2.5rem; max-width: 900px; width: 90vw;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; flex-wrap: wrap;">
            <h2 style="font-size: 2rem; font-weight: 700; color: #1f2937; margin: 0; letter-spacing: -1px;">Preferred Courses</h2>
            <button class="edit-button" style="margin-left: 1rem; background: linear-gradient(90deg, #2563eb 0%, #60a5fa 100%); color: #fff; border: none; border-radius: 999px; padding: 0.5rem 1.2rem; font-size: 1rem; font-weight: 500; cursor: pointer; transition: background 0.2s, transform 0.2s; box-shadow: 0 2px 8px rgba(37,99,235,0.10);" onclick="location.href='interests-edit.php'">Edit</button>
          </div>
          <ol style="padding-left: 1.2rem; color: #374151; font-size: 1.1rem;">
            <?php if (!empty($interests)): ?>
              <?php if (!empty($interests['option1'])): ?>
                <li><?= htmlspecialchars($interests['option1']) ?></li>
              <?php endif; ?>
              <?php if (!empty($interests['option2'])): ?>
                <li><?= htmlspecialchars($interests['option2']) ?></li>
              <?php endif; ?>
              <?php if (!empty($interests['option3'])): ?>
                <li><?= htmlspecialchars($interests['option3']) ?></li>
              <?php endif; ?>
            <?php else: ?>
              <li>No course preferences selected.</li>
            <?php endif; ?>
          </ol>
        </div>
      </div>
      <link rel="stylesheet" href="assets/css/profile.min.css">
    </main>
  </div>
</body>
</html>
