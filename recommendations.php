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
$total_per_page = 10;
$offset = ($page_no - 1) * $total_per_page;

// Add search functionality
$search = isset($_GET['search']) ? trim($_GET['search']) : '';

// Prepare LIKE terms
$like1 = "%$course1%";
$like2 = "%$course2%";
$like3 = "%$course3%";
$searchLike = "%$search%";

// Count total matching records
if ($search !== '') {
    $count_stmt = $pdo->prepare("SELECT COUNT(*) FROM courses WHERE (programme LIKE ? OR programme LIKE ? OR programme LIKE ?) AND programme LIKE ?");
    $count_stmt->execute([$like1, $like2, $like3, $searchLike]);
} else {
    $count_stmt = $pdo->prepare("SELECT COUNT(*) FROM courses WHERE programme LIKE ? OR programme LIKE ? OR programme LIKE ?");
    $count_stmt->execute([$like1, $like2, $like3]);
}
$total_records = $count_stmt->fetchColumn();
$total_pages = ceil($total_records / $total_per_page);

// Fetch paginated course results
if ($search !== '') {
    $data_stmt = $pdo->prepare("
        SELECT class, campus, certification, programme, duration, aps, institution, subjects, date, link
        FROM courses
        WHERE (programme LIKE ? OR programme LIKE ? OR programme LIKE ?) AND programme LIKE ?
        ORDER BY aps ASC
        LIMIT ?, ?
    ");
    $data_stmt->bindValue(1, $like1, PDO::PARAM_STR);
    $data_stmt->bindValue(2, $like2, PDO::PARAM_STR);
    $data_stmt->bindValue(3, $like3, PDO::PARAM_STR);
    $data_stmt->bindValue(4, $searchLike, PDO::PARAM_STR);
    $data_stmt->bindValue(5, $offset, PDO::PARAM_INT);
    $data_stmt->bindValue(6, $total_per_page, PDO::PARAM_INT);
    $data_stmt->execute();
} else {
    $data_stmt = $pdo->prepare("
        SELECT class, campus, certification, programme, duration, aps, institution, subjects, date, link
        FROM courses
        WHERE programme LIKE ? OR programme LIKE ? OR programme LIKE ?
        ORDER BY aps ASC
        LIMIT ?, ?
    ");
    $data_stmt->bindValue(1, $like1, PDO::PARAM_STR);
    $data_stmt->bindValue(2, $like2, PDO::PARAM_STR);
    $data_stmt->bindValue(3, $like3, PDO::PARAM_STR);
    $data_stmt->bindValue(4, $offset, PDO::PARAM_INT);
    $data_stmt->bindValue(5, $total_per_page, PDO::PARAM_INT);
    $data_stmt->execute();
}
$courses = $data_stmt->fetchAll(PDO::FETCH_ASSOC);

// Fetch user-specific and broadcast notifications
$notifStmt = $pdo->prepare("
    SELECT * FROM notifications
    WHERE user_email IS NULL OR user_email = ?
    ORDER BY created_at DESC
");
$notifStmt->execute([$email]);
$notifications = $notifStmt->fetchAll();

// Notification count
$count = 0;
$stmt = $pdo->prepare("SELECT COUNT(*) FROM notifications WHERE (user_email IS NULL OR user_email = ?) AND is_read = 0");
$stmt->execute([$email]);
$count = $stmt->fetchColumn();
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Recommended Courses | Universite</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Personalized course recommendations for students.">
  <link rel="shortcut icon" href="assets/images/icon-removebg-preview.png-128x128.png" type="image/x-icon">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
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
    @media (max-width: 768px) {
      .container { flex-direction: column; }
      nav { width: 100%; height: auto; position: fixed; top: 0; left: 0; }
      .sidebar { flex-direction: row; justify-content: space-around; flex-wrap: wrap; padding: 0.5rem; }
      .logo { display: none; }
      .main { margin-left: 0; margin-top: 120px; }
    }
    a {text-decoration:none;color:white;}
    a:visited { color: inherit; text-decoration: none; }
    form { margin-bottom: 2rem; display: flex; gap: 0.5rem; max-width: 600px; }
    input[type="text"] { flex: 1; padding: 0.75rem; border: 1px solid #ccc; border-radius: 6px; font-size: 1rem; }
    button { background-color: #2563eb; color: white; border: none; padding: 0.75rem 1rem; border-radius: 6px; font-size: 1rem; cursor: pointer; }
    .results { display: flex; flex-wrap: wrap; gap: 1rem; }
    .card { background: white; border-radius: 10px; padding: 1rem; box-shadow: 0 2px 8px rgba(0,0,0,0.1); flex: 1 1 calc(50% - 1rem); display: flex; flex-direction: column; transition: box-shadow 0.2s, transform 0.2s; }
    .card:hover { box-shadow: 0 8px 24px rgba(37,99,235,0.16); transform: translateY(-4px) scale(1.03); }
    .card h3 { margin-top: 0; font-size: 1.2rem; color: #1f2937; }
    .card p { margin: 0.3rem 0; font-size: 0.95rem; color: #4b5563; }
    .card a { margin-top: auto; align-self: flex-start; color: #2563eb; font-weight: bold; text-decoration: none; }
    .pagination { margin-top: 2rem; display: flex; justify-content: center; gap: 0.5rem; flex-wrap: wrap; }
    .pagination a, .pagination span { padding: 0.5rem 0.75rem; background: #e5e7eb; border-radius: 6px; text-decoration: none; color: #1f2937; font-weight: 500; }
    .pagination .current { background: #2563eb; color: white; }
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
        <a href="market.php" class="nav-item"><i class="fas fa-store"></i> Marketplace</a>
        <a href="notifications.php" class="nav-item"><i class="fas fa-bell"></i> Notifications<?php if ($count > 0): ?>
        <span class="badge"><?= $count ?></span>
    <?php endif; ?></a>
        <a href="logout.php" class="nav-item"><i class="fas fa-sign-out-alt"></i> Sign out</a>
      </div>
    </nav>
    <main class="main">
      <h1>Recommended Courses</h1>
      <form method="get" action="" style="margin-bottom: 2rem; display: flex; gap: 0.5rem; max-width: 600px;">
        <input type="text" name="search" placeholder="Search recommended courses" value="<?= htmlspecialchars($search) ?>" style="flex:1; padding:0.75rem; border:1px solid #ccc; border-radius:6px; font-size:1rem;">
        <button type="submit" style="background-color:#2563eb; color:white; border:none; padding:0.75rem 1rem; border-radius:6px; font-size:1rem; cursor:pointer;">Search</button>
      </form>
      <?php if ($courses && count($courses) > 0): ?>
        <p><?= $total_records ?> course(s) found.</p>
        <div class="results">
          <?php foreach ($courses as $row): ?>
            <div class="card">
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
            </div>
          <?php endforeach; ?>
        </div>
        <div class="pagination">
          <?php if ($page_no > 1): ?>
            <a href="?page_no=<?= $page_no - 1 ?><?= $search !== '' ? '&search=' . urlencode($search) : '' ?>">Previous</a>
          <?php endif; ?>
          <span class="current">Page <?= $page_no ?> of <?= $total_pages ?></span>
          <?php if ($page_no < $total_pages): ?>
            <a href="?page_no=<?= $page_no + 1 ?><?= $search !== '' ? '&search=' . urlencode($search) : '' ?>">Next</a>
          <?php endif; ?>
        </div>
      <?php else: ?>
        <p>No course recommendations found based on your preferences.</p>
        <p><a href="interests-edit.php">Click here to update your preferences.</a></p>
      <?php endif; ?>
    </main>
  </div>
</body>
</html>
