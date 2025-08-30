<?php
session_start();


require 'db.php'; // Assume this contains $pdo = new PDO(...);

// Check session
if (!isset($_SESSION['user_id']) || !isset($_SESSION['user_email'])) {
    header("Location: login.php");
    exit;
}

$email = $_SESSION['user_email'];
// Handle delete action
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['delete_id'])) {
  $deleteStmt = $pdo->prepare("DELETE FROM saved_searches WHERE id = ? AND user_email = ?");
  $deleteStmt->execute([$_POST['delete_id'], $email]);
  // Optional: Redirect to avoid form re-submission
  header("Location: mycourses.php");
 

  exit;
}


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
$location = strtolower(trim($student['location'] ?? ''));

// Get notification count
$count = 0;
$notifStmt = $pdo->prepare("SELECT COUNT(*) FROM notifications WHERE (user_email IS NULL OR user_email = ?) AND is_read = 0");
$notifStmt->execute([$email]);
$count = $notifStmt->fetchColumn();

// Fetch saved searches
$stmt = $pdo->prepare("SELECT * FROM saved_searches WHERE user_email = ? ORDER BY created_at DESC");
$stmt->execute([$email]);
$saved_searches = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Helper functions
function format_awlevel($level) {
    $map = [
        1 => 'Certificate', 2 => 'Associate', 3 => 'Associate+',
        4 => 'Bachelor’s Prep', 5 => 'Bachelor’s', 6 => 'Post-Bachelor’s',
        7 => 'Master’s', 8 => 'Post-Master’s', 17 => 'Doctoral',
    ];
    return $map[$level] ?? $level;
}
function format_adm_conditions($row) {
    $conditions = [];
    for ($i = 1; $i <= 9; $i++) {
        if (!empty($row["ADMCON$i"])) {
            $conditions[] = "ADMCON$i";
        }
    }
    return $conditions ? implode(', ', $conditions) : 'N/A';
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
  <link rel="stylesheet" href="assets/css/mycourses.min.css">
</head>
<body>
  <div class="container">
    <nav>
      <div class="logo">  <img src="assets/images/new-logo-white-removebg-preview.png-1-192x192.png" alt="Universite logo" style="height: 5rem;"></div>
      <div class="sidebar">

        <a href="profile.php" class="nav-item"><i class="fas fa-user"></i><?= htmlspecialchars($student['name']) ?>
    </a>

        <a href="recommendations.php" class="nav-item"><i class="fas fa-book"></i> Courses</a>
        <a href="mycourses.php" class="nav-item active"><i class="fas fa-star"></i> Saved Searches</a>
        <a href="notifications.php" class="nav-item"><i class="fas fa-bell"></i> Notifications<?php if ($count > 0): ?>
        <span class="badge"><?= $count ?></span>
    <?php endif; ?></a>
        <a href="logout.php" class="nav-item"><i class="fas fa-sign-out-alt"></i> Sign out</a>
      </div>
    </nav>

    <main class="main">
    <h2>Saved Course Searches</h2>
    <?php if (isset($_GET['deleted'])): ?>
  <p style="color: green;">Search deleted successfully.</p>
<?php endif; ?>

<?php if (empty($saved_searches)): ?>
  <p>You have no saved searches yet.</p>
<?php endif; ?>

<?php foreach ($saved_searches as $search): ?>
  <?php
  $course = trim($search['query']);
  $institution = trim($search['institution'] ?? '');
  $results = [];

  if ($location === 'south africa') {
      $stmt = $pdo->prepare("
        SELECT class, campus, certification, programme, duration, aps, institution, subjects, date, link
        FROM sa_courses
        WHERE programme LIKE ?" . ($institution ? " AND institution = ?" : "") . "
        ORDER BY aps ASC
        LIMIT 10
      ");
      $params = ["%$course%"];
      if ($institution) $params[] = $institution;
      $stmt->execute($params);
      $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
  } else {
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
          (REPLACE(c.CIPCODE, '.', '') LIKE REPLACE(:codeQuery, '.', '')
          OR LOWER(cc.CIPTITLE) LIKE LOWER(:titleQuery))
          " . ($institution ? " AND i.INSTNM = :institution" : "") . "
        ORDER BY i.INSTNM
        LIMIT 10
      ";
      $stmt = $pdo->prepare($sql);
      $stmt->bindValue(':codeQuery', "%$course%");
      $stmt->bindValue(':titleQuery', "%$course%");
      if ($institution) $stmt->bindValue(':institution', $institution);
      $stmt->execute();
      $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
  }
  ?>

  <h4 style="margin-top: 2rem;"><?= htmlspecialchars($course) ?><?= $institution ? " at " . htmlspecialchars($institution) : '' ?></h4>
  <form method="POST" onsubmit="return confirm('Are you sure you want to delete this saved search?');" style="display:inline;">
  <input type="hidden" name="delete_id" value="<?= htmlspecialchars($search['id']) ?>">
  <button type="submit" class="edit-button" style="background-color: #dc2626;"><i class="fa fa-trash" aria-hidden="true"></i></button>
</form>

  <?php if (count($results) > 0): ?>
    <div class="cards-grid">
      <?php foreach ($results as $row): ?>
        <div class="card">
          <?php if ($location === 'south africa'): ?>
            
            <h3><?= htmlspecialchars($row['programme']) ?></h3>
            <p><strong>Institution:</strong> <?= htmlspecialchars($row['institution']) ?></p>
            <p><strong>Qualification:</strong> <?= htmlspecialchars($row['certification']) ?></p>
            <p><strong>Duration:</strong> <?= htmlspecialchars($row['duration']) ?></p>
            <p><strong>APS:</strong> <?= htmlspecialchars($row['aps']) ?></p>
            <p><strong>Campus:</strong> <?= htmlspecialchars($row['campus']) ?></p>
            <p><strong>Mode:</strong> <?= htmlspecialchars($row['class']) ?></p>
            <p><strong>Requirements:</strong><br><?= nl2br(htmlspecialchars($row['subjects'])) ?></p>
            <p><strong>Closing Date:</strong> <?= htmlspecialchars($row['date']) ?></p>
            <?php if (!empty($row['link'])): ?>
              <a href="<?= htmlspecialchars($row['link']) ?>" target="_blank">Apply Now</a>
            <?php endif; ?>
          <?php else: ?>
            <h3><?= htmlspecialchars($row['CIPTITLE'] ?? '[No Title Found]') ?></h3>
            <p><strong>Institution:</strong> <?= htmlspecialchars($row['INSTNM']) ?></p>
            <p><strong>Location:</strong> <?= htmlspecialchars($row['CITY']) ?>, <?= htmlspecialchars($row['STABBR']) ?></p>
            <p><strong>CIP Code:</strong> <?= htmlspecialchars($row['CIPCODE']) ?></p>
            <p><strong>Award Level:</strong> <?= format_awlevel($row['AWLEVEL']) ?></p>
            <p><strong>ACT English:</strong> <?= htmlspecialchars($row['ACTEN50']) ?></p>
            <p><strong>ACT Math:</strong> <?= htmlspecialchars($row['ACTMT50']) ?></p>
            <p><strong>Admission Requirements:</strong> <?= format_adm_conditions($row) ?></p>
            <?php if (!empty($row['webaddr'])): ?>
              <a href="<?= htmlspecialchars($row['webaddr']) ?>" target="_blank">Apply Now</a>
            <?php endif; ?>
          <?php endif; ?>
        </div>
      <?php endforeach; ?>
    </div>
  <?php else: ?>
    <p>No courses found for this search.</p>
  <?php endif; ?>
<?php endforeach; ?>
    </main>
  </div>
</body>
</html>
