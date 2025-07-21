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
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; min-height: 100vh; background: #f9fafb; margin: 0; }
    .container { display: flex; }
    nav { background-color: #1f2937; color: white; padding: 1rem; height: 100vh; position: fixed; top: 0; left: 0; width: 250px; display: flex; flex-direction: column; gap: 1.5rem; z-index: 1000; }
    .sidebar { display: flex; flex-direction: column; gap: 1rem; }
    .logo { font-size: 1.5rem; font-weight: bold; text-align: center; padding-bottom: 1rem; border-bottom: 1px solid #374151; }
    .nav-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; border-radius: 0.5rem; transition: background 0.3s, transform 0.2s; cursor: pointer; font-size: 1rem; background-color: transparent; }
    .nav-item:hover { background-color: #374151; transform: translateX(4px); }
    .nav-item i { font-size: 1.2rem; color: #60a5fa; }
    .nav-item.active { background-color: #2563eb; font-weight: bold; }
    .nav-item.active i { color: #fff; }
    .main { margin-left: 250px; padding: 2rem; flex: 1; }
    @media (max-width: 768px) { .container { flex-direction: column; } nav { width: 100%; height: auto; position: fixed; top: 0; left: 0; } .sidebar { flex-direction: row; justify-content: space-around; flex-wrap: wrap; padding: 0.5rem; } .logo { display: none; } .main { margin-left: 0; margin-top: 120px; } }
    a {text-decoration:none;color:white;} a:visited { color: inherit; text-decoration: none; }
    form { margin-bottom: 2rem; display: flex; gap: 0.5rem; max-width: 600px; }
    input[type="text"] { flex: 1; padding: 0.75rem; border: 1px solid #ccc; border-radius: 6px; font-size: 1rem; }
    button { background-color: #2563eb; color: white; border: none; padding: 0.75rem 1rem; border-radius: 6px; font-size: 1rem; cursor: pointer; }
    .results { display: flex; flex-wrap: wrap; gap: 1rem; }
    .card { background: white; border-radius: 10px; padding: 1rem; box-shadow: 0 2px 8px rgba(0,0,0,0.1); flex: 1 1 calc(50% - 1rem); display: flex; flex-direction: column; transition: box-shadow 0.2s, transform 0.2s; }
    .card:hover { box-shadow: 0 8px 24px rgba(37,99,235,0.16); transform: translateY(-4px) scale(1.03); }
    .card h3 { margin-top: 0; font-size: 1.2rem; color: #1f2937; }
    .card p { margin: 0.3rem 0; font-size: 0.95rem; color: #4b5563; }
    .badge { background-color: red; color: white; border-radius: 50%; padding: 3px 8px; font-size: 12px; vertical-align: middle; }
    @media (max-width: 768px) { .card { flex: 1 1 100%; } form { flex-direction: column; } }
  </style>
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




