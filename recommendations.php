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

// Fetch user location
$location = strtolower(trim($student['location'] ?? ''));

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

$courses = [];
$total_records = 0;
$total_pages = 1;
$international = false;
$results = [];

if ($location === 'south africa') {
    // South African logic (current)
    $count_stmt = $pdo->prepare("SELECT COUNT(*) FROM sa_courses WHERE programme LIKE ? OR programme LIKE ? OR programme LIKE ?");
    $count_stmt->execute([$like1, $like2, $like3]);
    $total_records = $count_stmt->fetchColumn();
    $total_pages = ceil($total_records / $total_per_page);

    $data_stmt = $pdo->prepare("
        SELECT class, campus, certification, programme, duration, aps, institution, subjects, date, link
        FROM sa_courses
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
} else {
    // International logic (now using all three interests)
    $international = true;
    // Count total matching records
    $count_sql = "
    SELECT COUNT(DISTINCT c.CIPCODE, i.INSTNM)
    FROM courses c
    JOIN institutions i ON i.UNITID = c.UNITID
    LEFT JOIN cip_codes cc 
      ON REPLACE(TRIM(c.CIPCODE), '.', '') = REPLACE(TRIM(cc.CIPCODE), '.', '')
    WHERE 
      REPLACE(c.CIPCODE, '.', '') LIKE REPLACE(:codeQuery1, '.', '')
      OR REPLACE(c.CIPCODE, '.', '') LIKE REPLACE(:codeQuery2, '.', '')
      OR REPLACE(c.CIPCODE, '.', '') LIKE REPLACE(:codeQuery3, '.', '')
      OR LOWER(cc.CIPTITLE) LIKE LOWER(:titleQuery1)
      OR LOWER(cc.CIPTITLE) LIKE LOWER(:titleQuery2)
      OR LOWER(cc.CIPTITLE) LIKE LOWER(:titleQuery3)
    ";
    $count_stmt = $pdo->prepare($count_sql);
    $count_stmt->execute([
        ':codeQuery1' => $like1,
        ':codeQuery2' => $like2,
        ':codeQuery3' => $like3,
        ':titleQuery1' => $like1,
        ':titleQuery2' => $like2,
        ':titleQuery3' => $like3,
    ]);
    $total_records = (int)$count_stmt->fetchColumn();
    $total_pages = max(1, ceil($total_records / $total_per_page));

    // Now fetch paginated results
    $sql = "
    SELECT DISTINCT
      i.INSTNM,
      i.CITY,
      i.STABBR,
      i.webaddr,
      c.CIPCODE,
      cc.CIPTITLE,
      c.AWLEVEL,
      a.ACTEN50,
      a.ACTMT50,
      a.ADMCON1, a.ADMCON2, a.ADMCON3, a.ADMCON4, a.ADMCON5, a.ADMCON6, a.ADMCON7, a.ADMCON8, a.ADMCON9
    FROM courses c
    JOIN institutions i ON i.UNITID = c.UNITID
    LEFT JOIN admissions a ON i.UNITID = a.UNITID
    LEFT JOIN cip_codes cc 
      ON REPLACE(TRIM(c.CIPCODE), '.', '') = REPLACE(TRIM(cc.CIPCODE), '.', '')
    WHERE 
      REPLACE(c.CIPCODE, '.', '') LIKE REPLACE(:codeQuery1, '.', '')
      OR REPLACE(c.CIPCODE, '.', '') LIKE REPLACE(:codeQuery2, '.', '')
      OR REPLACE(c.CIPCODE, '.', '') LIKE REPLACE(:codeQuery3, '.', '')
      OR LOWER(cc.CIPTITLE) LIKE LOWER(:titleQuery1)
      OR LOWER(cc.CIPTITLE) LIKE LOWER(:titleQuery2)
      OR LOWER(cc.CIPTITLE) LIKE LOWER(:titleQuery3)
    ORDER BY i.INSTNM
    LIMIT :offset, :limit
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->bindValue(':codeQuery1', $like1, PDO::PARAM_STR);
    $stmt->bindValue(':codeQuery2', $like2, PDO::PARAM_STR);
    $stmt->bindValue(':codeQuery3', $like3, PDO::PARAM_STR);
    $stmt->bindValue(':titleQuery1', $like1, PDO::PARAM_STR);
    $stmt->bindValue(':titleQuery2', $like2, PDO::PARAM_STR);
    $stmt->bindValue(':titleQuery3', $like3, PDO::PARAM_STR);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->bindValue(':limit', $total_per_page, PDO::PARAM_INT);
    $stmt->execute();
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
}

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
  <title>Find Online & University Courses for Students | Compare & Enroll</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Explore top online courses and university programs in one place. Compare options, read reviews, and enroll in the best course for your goals.">
  <link rel="shortcut icon" href="assets/images/icon-removebg-preview.png-128x128.png" type="image/x-icon">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
  <link rel="stylesheet" href="assets/css/recommendations.min.css">
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
      <a href="mycourses.php" class="nav-item"><i class="fas fa-star"></i> Saved Searches</a>
      <a href="notifications.php" class="nav-item"><i class="fas fa-bell"></i> Notifications<?php if ($count > 0): ?>
        <span class="badge"><?= $count ?></span>
    <?php endif; ?></a>
      <a href="logout.php" class="nav-item"><i class="fas fa-sign-out-alt"></i> Sign out</a>
    </div>
  </nav>

  <main class="main">
    <link rel="stylesheet" href="assets/css/recommendations.min.css">
    <form action="course-search.php" method="get" style="margin-bottom: 2rem;">
      <input type="text" name="myCourse" placeholder="Search for a course" required>
      <button type="submit">Search</button>
    </form>
    <script src="assets/js/recommendations.min.js"></script>

    <div class="rec-header">Recommended For You</div>
    <?php if ($location === 'south africa'): ?>
      <?php if ($courses): ?>
        <div class="rec-count">About <?= $total_records ?> course(s) found</div>
        <div class="rec-grid results">
          <?php foreach ($courses as $row): ?>
            <div class="rec-card card">
              <h3 style="color:#000;"><?= htmlspecialchars($row["programme"]) ?></h3>
              <p><strong>Qualification:</strong> <?= htmlspecialchars($row["certification"]) ?></p>
              <p><strong>Duration:</strong> <?= htmlspecialchars($row["duration"]) ?></p>
              <p><strong>Study Mode:</strong> <?= htmlspecialchars($row["class"]) ?></p>
              <p><strong>Institution:</strong> <?= htmlspecialchars($row["institution"]) ?></p>
              <p><strong>Campus:</strong> <?= htmlspecialchars($row["campus"]) ?></p>
              <p><strong>Minimum APS:</strong> <?= htmlspecialchars($row["aps"]) ?></p>
              <p><strong>Requirements:</strong><br><?= nl2br(htmlspecialchars($row["subjects"])) ?></p>
              <p><strong>Closing Date:</strong> <?= htmlspecialchars($row["date"]) ?></p>
              
              <a style ='color:blue' href="<?= htmlspecialchars($row['link']) ?>" target="_blank">Apply Now</a>
               
            </div>
          <?php endforeach; ?>
        </div>
      <?php else: ?>
        <p>No course recommendations found based on your preferences.</p>
        <p><a href="interests-edit.php">Click here to update your preferences.</a></p>
      <?php endif; ?>
    <?php else: ?>
      <?php if ($results): ?>
        <div class="rec-count">About <?= $total_records ?>  course(s) found</div>
        <div class="rec-grid results">
          <?php foreach ($results as $row): ?>
            <div class="rec-card card">
              <h3><?= htmlspecialchars($row['CIPTITLE'] ?? '[No Title Found]') ?></h3>
              <p><strong>Institution:</strong> <?= htmlspecialchars($row['INSTNM']) ?></p>
              <p><strong>Location:</strong> <?= htmlspecialchars($row['CITY']) ?>, <?= htmlspecialchars($row['STABBR']) ?></p>
              <p><strong>CIP Code:</strong> <?= htmlspecialchars($row['CIPCODE']) ?></p>
              <p><strong>Award Level:</strong> <?= htmlspecialchars($row['AWLEVEL']) ?></p>
              <p><strong>ACT English:</strong> <?= htmlspecialchars($row['ACTEN50']) ?></p>
              <p><strong>ACT Math:</strong> <?= htmlspecialchars($row['ACTMT50']) ?></p>
              <p><strong>Admission Requirements:</strong> <?php
                $adm = [];
                for ($i = 1; $i <= 9; $i++) {
                  if (!empty($row["ADMCON$i"])) $adm[] = htmlspecialchars($row["ADMCON$i"]);
                }
                echo $adm ? implode(', ', $adm) : 'N/A';
              ?></p>
              <a style ='color:blue' href="<?= htmlspecialchars($row['webaddr']) ?>" target="_blank">Apply Now</a>
            </div>
          <?php endforeach; ?>
        </div>
      <?php else: ?>
        <p>No international course recommendations found based on your preferences.</p>
        <p><a href="interests-edit.php">Click here to update your preferences.</a></p>
      <?php endif; ?>
    <?php endif; ?>

    <!-- Pagination UI -->
    <div class="mt-4">
      <section aria-label="Page navigation">
        <ul class="pagination justify-content-center">
          <?php if ($page_no > 1): ?>
            <li class="page-item"><a class="page-link" href="?page_no=<?= $page_no - 1 ?>">Previous</a></li>
          <?php endif; ?>

          <li class="page-item disabled"><a class="page-link">Page <?= $page_no ?> of <?= $total_pages ?></a></li>

          <?php if ($page_no < $total_pages): ?>
            <li class="page-item"><a class="page-link" href="?page_no=<?= $page_no + 1 ?>">Next</a></li>
          <?php endif; ?>
        </ul>
      </section>
    </div>
  </main>
</div>
</body>
</html>
