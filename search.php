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

// Notification count
$count = 0;
$notifStmt = $pdo->prepare("SELECT COUNT(*) FROM notifications WHERE (user_email IS NULL OR user_email = ?) AND is_read = 0");
$notifStmt->execute([$email]);
$count = $notifStmt->fetchColumn();

// Search logic
$q = trim($_GET['q'] ?? '');
$results = [];
if ($q !== '') {
    $sql = "
    SELECT DISTINCT
      i.INSTNM,
      i.CITY,
      i.STABBR,
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
      REPLACE(c.CIPCODE, '.', '') LIKE REPLACE(:codeQuery, '.', '')
      OR LOWER(cc.CIPTITLE) LIKE LOWER(:titleQuery)
    ORDER BY i.INSTNM
    LIMIT 100
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':codeQuery' => '%' . $q . '%',
        ':titleQuery' => '%' . $q . '%',
    ]);
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function format_awlevel($level) {
    $map = [
        1 => 'Certificate',
        2 => 'Associate',
        3 => 'Associate+',
        4 => 'Bachelor’s Prep',
        5 => 'Bachelor’s',
        6 => 'Post-Bachelor’s',
        7 => 'Master’s',
        8 => 'Post-Master’s',
        17 => 'Doctoral',
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
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🎓 Search Courses by Name or CIP Code</title>
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
  <link rel="stylesheet" href="assets/css/search.min.css">
</head>
<body>
  <div class="container">
    <nav>
      <div class="logo">  <img src="assets/images/new-logo-white-removebg-preview.png-1-192x192.png" alt="Universite logo" style="height: 5rem;"></div>
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
      <h1>Search by Course Name or CIP Code</h1>
      <form method="GET" action="search.php">
        <input type="text" name="q" placeholder="Enter course name or CIP code" value="<?= htmlspecialchars($q) ?>" required>
        <button type="submit">Search</button>
      </form>
      <?php if ($q !== ''): ?>
        <h2>Results (<?= count($results) ?> found)</h2>
        <?php if ($results): ?>
          <div class="results">
            <?php foreach ($results as $row): ?>
              <div class="card">
                <h3><?= htmlspecialchars($row['CIPTITLE'] ?? '[No Title Found]') ?></h3>
                <p><strong>Institution:</strong> <?= htmlspecialchars($row['INSTNM']) ?></p>
                <p><strong>Location:</strong> <?= htmlspecialchars($row['CITY']) ?>, <?= htmlspecialchars($row['STABBR']) ?></p>
                <p><strong>CIP Code:</strong> <?= htmlspecialchars($row['CIPCODE']) ?></p>
                <p><strong>Award Level:</strong> <?= format_awlevel($row['AWLEVEL']) ?></p>
                <p><strong>ACT English:</strong> <?= htmlspecialchars($row['ACTEN50']) ?></p>
                <p><strong>ACT Math:</strong> <?= htmlspecialchars($row['ACTMT50']) ?></p>
                <p><strong>Admission Requirements:</strong> <?= format_adm_conditions($row) ?></p>
              </div>
            <?php endforeach; ?>
          </div>
        <?php else: ?>
          <p>No institutions offer a course matching "<strong><?= htmlspecialchars($q) ?></strong>".</p>
        <?php endif; ?>
      <?php endif; ?>
    </main>
  </div>
</body>
</html>




