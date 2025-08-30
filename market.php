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
// Google API Config
define('GOOGLE_API_KEY', 'AIzaSyAFMk2Ons11Prrcg4swXxJgtctZpxX5gh4');
define('SEARCH_ENGINE_ID', 'b67fc506b83e84456');

$products = [];
$searchQuery = '';
$currentPage = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
$resultsPerPage = 10;
$startIndex = ($currentPage - 1) * $resultsPerPage + 1;

if (isset($_GET['search'])) {
    $searchQuery = htmlspecialchars(trim($_GET['search']));
    $products = fetchProducts($searchQuery, $startIndex);
}

function fetchProducts($query, $start = 1) {
    $url = "https://www.googleapis.com/customsearch/v1?q=" . urlencode($query) .
           "&cx=" . SEARCH_ENGINE_ID . "&key=" . GOOGLE_API_KEY .
           "&start=" . intval($start);

    $response = @file_get_contents($url);
    if ($response === false) {
        return ['error' => 'Failed to fetch data from Google API.'];
    }

    $decoded = json_decode($response, true);
    return $decoded ?: ['error' => 'Invalid response format.'];
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
  <!-- Google tag (gtag.js) -->
 <script src="assets/js/market.min.js"></script>
 <script src="assets/js/market.min.js"></script>
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
  <link rel="stylesheet" href="assets/css/market.min.css">
</head>
<body>
  <div class="container">
    <nav>
      <div class="logo">
        <img src="assets/images/new-logo-white-removebg-preview.png-1-192x192.png" alt="Universite logo" style="height: 5rem;">
      </div>
      <div class="sidebar">
        <a href="profile.php" class="nav-item"><i class="fas fa-user"></i><?= htmlspecialchars($student['name']) ?>
        </a>

        <a href="recommendations.php" class="nav-item"><i class="fas fa-book"></i> Courses</a>
        <a href="market.php" class="nav-item active"><i class="fas fa-store"></i> Marketplace</a>
        <a href="notifications.php" class="nav-item"><i class="fas fa-bell"></i> Notifications<?php if ($count > 0): ?>
        <span class="badge"><?= $count ?></span>
    <?php endif; ?></a>
        <a href="logout.php" class="nav-item"><i class="fas fa-sign-out-alt"></i> Sign out</a>
      </div>
    </nav>

    <main class="main">
      <link rel="stylesheet" href="assets/css/market.min.css">
      <div class="market-header">Marketplace</div>
      <div class="market-sub">Find and compare textbooks, electronics, furniture, and more from trusted sources.</div>
      <div class="market-card">
        <form method="GET" class="market-search-form">
          <input type="text" name="search" value="<?= htmlspecialchars($searchQuery) ?>" placeholder="Search for textbooks, stationery, electronics..." required>
          <button type="submit">Search</button>
        </form>
        <div class="market-categories">
          <button class="market-cat-btn" onclick="location.href='?search=textbooks'">Books</button>
          <button class="market-cat-btn" onclick="location.href='?search=laptops'">Laptops</button>
          <button class="market-cat-btn" onclick="location.href='?search=furniture'">Furniture</button>
        </div>
      </div>
      <?php if (!empty($products['items'])): ?>
        <div class="market-products">
          <?php foreach ($products['items'] as $item): ?>
            <div class="market-product-card">
              <?php if (!empty($item['pagemap']['cse_image'][0]['src'])): ?>
                <img loading="lazy" src="<?= htmlspecialchars($item['pagemap']['cse_image'][0]['src']) ?>" alt="Product Image">
              <?php endif; ?>
              <div class="market-product-title"><?= htmlspecialchars($item['title']) ?></div>
              <a href="<?= htmlspecialchars($item['link']) ?>" class="market-product-link" target="_blank" rel="noopener noreferrer">View Product</a>
            </div>
          <?php endforeach; ?>
        </div>
      <?php elseif (isset($products['error'])): ?>
        <p class="text-danger text-center"><?= htmlspecialchars($products['error']) ?></p>
      <?php elseif (!empty($searchQuery)): ?>
        <p class="text-center">No products found. Try a different search.</p>
      <?php endif; ?>
      <?php if (!empty($products['items'])): ?>
        <div class="market-pagination-wrapper">
          <ul class="market-pagination">
            <?php if ($currentPage > 1): ?>
              <li><a href="?search=<?= urlencode($searchQuery) ?>&page=<?= $currentPage - 1 ?>">&laquo; Prev</a></li>
            <?php endif; ?>
            <li><span class="current-page">Page <?= $currentPage ?></span></li>
            <?php if (!empty($products['queries']['nextPage'][0]['startIndex'])): ?>
              <li><a href="?search=<?= urlencode($searchQuery) ?>&page=<?= $currentPage + 1 ?>">Next &raquo;</a></li>
            <?php endif; ?>
          </ul>
        </div>
      <?php endif; ?>
    </main>
  </div>
</body>
</html>
