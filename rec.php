<?php
session_start();
require 'db.php'; // Assumes $pdo = new PDO(...);

// Check if user is logged in
if (!isset($_SESSION['user_id']) || !isset($_SESSION['user_email'])) {
    header("Location: login.php");
    exit;
}

$email = $_SESSION['user_email'];

// Fetch student info
$stmt = $pdo->prepare("SELECT * FROM student_info WHERE mail = ?");
$stmt->execute([$email]);
$student = $stmt->fetch();

if (!$student) {
    echo "User not found in student_info.";
    exit;
}

// Fetch course preferences (interests)
$interestStmt = $pdo->prepare("SELECT option1, option2, option3 FROM options WHERE student_id = ?");
$interestStmt->execute([$student['student_id']]);
$interests = $interestStmt->fetch();

$course1 = $interests['option1'] ?? '';
$course2 = $interests['option2'] ?? '';
$course3 = $interests['option3'] ?? '';
$country = strtolower(trim($student['location'] ?? ''));
$use_ipeds = ($country === 'united states');

// Redirect or notify if no preferences
if (empty($course1) && empty($course2) && empty($course3)) {
    echo "<div style='padding: 2rem; font-family: sans-serif;'>
            <p>No course preferences found.</p>
            <p><a href='interests-edit.php'>Click here to update your preferences</a> and get personalized course recommendations.</p>
          </div>";
    exit;
}

// Pagination setup
$page_no = isset($_GET['page_no']) ? (int) $_GET['page_no'] : 1;
$total_per_page = 4;
$offset = ($page_no - 1) * $total_per_page;

// Prepare LIKE terms
$like1 = "%$course1%";
$like2 = "%$course2%";
$like3 = "%$course3%";

// Count total matching records
$count_stmt = $pdo->prepare("SELECT COUNT(*) FROM courses WHERE programme LIKE ? OR programme LIKE ? OR programme LIKE ?");
$count_stmt->execute([$like1, $like2, $like3]);
$total_records = $count_stmt->fetchColumn();
$total_pages = ceil($total_records / $total_per_page);

// Fetch paginated course results
$data_stmt = $pdo->prepare("
    SELECT class, campus, certification, programme, duration, aps, institution, subjects, date
    FROM courses
    WHERE programme LIKE ? OR programme LIKE ? OR programme LIKE ?
    ORDER BY institution ASC
    LIMIT ?, ?
");
$data_stmt->bindValue(1, $like1, PDO::PARAM_STR);
$data_stmt->bindValue(2, $like2, PDO::PARAM_STR);
$data_stmt->bindValue(3, $like3, PDO::PARAM_STR);
$data_stmt->bindValue(4, $offset, PDO::PARAM_INT);
$data_stmt->bindValue(5, $total_per_page, PDO::PARAM_INT);
$data_stmt->execute();
$courses = $data_stmt->fetchAll(PDO::FETCH_ASSOC);
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
// Preferences and country
$course1 = $student['course1'];
$course2 = $student['course2'];
$course3 = $student['course3'];
$country = strtolower(trim($student['location'] ?? ''));
$use_ipeds = ($country === 'united states');

// Search terms
$like1 = "%$course1%";
$like2 = "%$course2%";
$like3 = "%$course3%";

// Pagination
$page = isset($_GET['page']) ? (int) $_GET['page'] : 1;
$total_per_page = 10;
$offset = ($page - 1) * $total_per_page;

// Count total matches
if ($use_ipeds) {
    $count_stmt = $pdo->prepare("
        SELECT COUNT(*) FROM ipeds_data
        WHERE institution_name LIKE ? OR institution_name LIKE ? OR institution_name LIKE ?
    ");
} else {
    $count_stmt = $pdo->prepare("
        SELECT COUNT(*) FROM courses
        WHERE programme LIKE ? OR programme LIKE ? OR programme LIKE ?
    ");
}
$count_stmt->execute([$like1, $like2, $like3]);
$total_records = $count_stmt->fetchColumn();
$total_pages = ceil($total_records / $total_per_page);

// Fetch paginated results
if ($use_ipeds) {
    $data_stmt = $pdo->prepare("
        SELECT institution_name, state, admission_rate, SAT_avg, ACT_avg, year
        FROM ipeds_data
        WHERE institution_name LIKE ? OR institution_name LIKE ? OR institution_name LIKE ?
        ORDER BY institution_name ASC
        LIMIT ?, ?
    ");
} else {
    $data_stmt = $pdo->prepare("
        SELECT class, campus, certification, programme, duration, aps, institution, subjects, date
        FROM courses
        WHERE programme LIKE ? OR programme LIKE ? OR programme LIKE ?
        ORDER BY institution ASC
        LIMIT ?, ?
    ");
}
$data_stmt->bindValue(1, $like1, PDO::PARAM_STR);
$data_stmt->bindValue(2, $like2, PDO::PARAM_STR);
$data_stmt->bindValue(3, $like3, PDO::PARAM_STR);
$data_stmt->bindValue(4, $offset, PDO::PARAM_INT);
$data_stmt->bindValue(5, $total_per_page, PDO::PARAM_INT);
$data_stmt->execute();
$results = $data_stmt->fetchAll(PDO::FETCH_ASSOC);
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Find Online & University Courses for Students | Compare & Enroll</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Explore top online courses and university programs in one place. Compare options, read reviews, and enroll in the best course for your goals.">
  <link rel="shortcut icon" href="assets/images/icon-removebg-preview.png-128x128.png" type="image/x-icon">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
  <link rel="stylesheet" href="assets/css/rec.min.css">
</head>
<body>
<div class="container">
  <nav>
    <div class="logo">
      <img src="assets/images/new-logo-white-removebg-preview.png-1-192x192.png" alt="Universite logo" style="height: 5rem;">
    </div>
    <div class="sidebar">
      <a href="profile.php" class="nav-item"><i class="fas fa-user"></i><?= htmlspecialchars($student['name']) ?></a>
      
      <a href="recommendations.php" class="nav-item active"><i class="fas fa-book"></i> Courses</a>
      <a href="notifications.php" class="nav-item"><i class="fas fa-bell"></i> Notifications<?php if ($count > 0): ?>
        <span class="badge"><?= $count ?></span>
    <?php endif; ?></a>
      <a href="logout.php" class="nav-item"><i class="fas fa-sign-out-alt"></i> Sign out</a>
    </div>
  </nav>

  <main class="main">
    <link rel="stylesheet" href="assets/css/rec.min.css">
    <form action="course-search.php" method="get" style="margin-bottom: 2rem;">
      <input type="text" name="myCourse" placeholder="Search for a course">
      <button type="submit">Search</button>
    </form>
    <div class="rec-header">Recommended <?php echo $use_ipeds ? "U.S. Universities" : "Local Courses"; ?></div>
    <div class="rec-count">
      <?php if ($use_ipeds): ?>
        About <?= $total_records ?> U.S. university(ies) found
      <?php else: ?>
        About <?= $total_records ?> course(s) found
      <?php endif; ?>
    </div>
    <?php if (empty($results)): ?>
      <p>No matching programs found.</p>
    <?php else: ?>
      <div class="rec-grid">
        <?php foreach ($results as $row): ?>
          <div class="rec-card">
            <?php if ($use_ipeds): ?>
              <h3><?= htmlspecialchars($row["institution_name"]) ?></h3>
              <p><strong>State:</strong> <?= htmlspecialchars($row["state"]) ?></p>
              <p><strong>Admission Rate:</strong> <?= $row["admission_rate"] !== null ? ($row["admission_rate"] * 100) . '%' : 'N/A' ?></p>
              <p><strong>SAT Average:</strong> <?= $row["SAT_avg"] ?? 'N/A' ?></p>
              <p><strong>ACT Average:</strong> <?= $row["ACT_avg"] ?? 'N/A' ?></p>
              <p><strong>Year:</strong> <?= htmlspecialchars($row["year"]) ?></p>
              <a class="rec-apply-btn" href="https://www.universite.co.za/applyFrame.php?school=<?= urlencode($row["institution_name"]) ?>">Apply</a>
            <?php else: ?>
              <h3><?= htmlspecialchars($row["programme"]) ?></h3>
              <p><strong>Qualification:</strong> <?= htmlspecialchars($row["certification"]) ?></p>
              <p><strong>Duration:</strong> <?= htmlspecialchars($row["duration"]) ?></p>
              <p><strong>Study Mode:</strong> <?= htmlspecialchars($row["class"]) ?></p>
              <p><strong>Institution:</strong> <?= htmlspecialchars($row["institution"]) ?></p>
              <p><strong>Campus:</strong> <?= htmlspecialchars($row["campus"]) ?></p>
              <p><strong>Minimum APS:</strong> <?= htmlspecialchars($row["aps"]) ?></p>
              <p><strong>Requirements:</strong><br><?= nl2br(htmlspecialchars($row["subjects"])) ?></p>
              <p><strong>Closing Date:</strong> <?= htmlspecialchars($row["date"]) ?></p>
              <a class="rec-apply-btn" href="https://www.universite.co.za/applyFrame.php?school=<?= urlencode($row["institution"]) ?>">Apply</a>
            <?php endif; ?>
          </div>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
    <!-- Pagination UI -->
    <div class="mt-4">
      <section aria-label="Page navigation">
        <ul class="pagination justify-content-center">
          <?php if ($page > 1): ?>
            <li class="page-item"><a class="page-link" href="?page=<?= $page - 1 ?>">Previous</a></li>
          <?php endif; ?>
          <li class="page-item disabled"><a class="page-link">Page <?= $page ?> of <?= $total_pages ?></a></li>
          <?php if ($page < $total_pages): ?>
            <li class="page-item"><a class="page-link" href="?page=<?= $page + 1 ?>">Next</a></li>
          <?php endif; ?>
        </ul>
      </section>
    </div>
    </main>
</div>
</body>
</html>
