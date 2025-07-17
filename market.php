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
 <script async src="https://www.googletagmanager.com/gtag/js?id=G-YTT2QHLQC7"></script>
 <script>
   window.dataLayer = window.dataLayer || [];
   function gtag(){dataLayer.push(arguments);}
   gtag('js', new Date());

   gtag('config', 'G-YTT2QHLQC7');
 </script>
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
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f9fafb; }

    .container { display: flex; }

    nav {
      background-color: #1f2937; color: white; padding: 1rem; height: 100vh;
      position: fixed; top: 0; left: 0; width: 250px; display: flex;
      flex-direction: column; gap: 1.5rem; z-index: 1000;
    }

    .sidebar { display: flex; flex-direction: column; gap: 1rem; }
    .logo { text-align: center; padding-bottom: 1rem; border-bottom: 1px solid #374151; }

    .nav-item {
      display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem;
      border-radius: 0.5rem; cursor: pointer; font-size: 1rem;
      transition: background 0.3s, transform 0.2s;
    }

    .nav-item:hover { background-color: #374151; transform: translateX(4px); }
    .nav-item i { color: #60a5fa; }
    .nav-item.active { background-color: #2563eb; font-weight: bold; }
    .nav-item.active i { color: #fff; }

    .main {
      margin-left: 250px; padding: 2rem; flex: 1;
    }

    .container-custom {
      max-width: 900px; margin: 40px auto; padding: 20px; background: #fff;
      border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.05);
    }

    form {
      display: flex; gap: 10px; justify-content: center; margin-bottom: 20px;
    }

    form input[type="text"] {
      flex: 1; padding: 10px; border-radius: 5px; border: 1px solid #ccc;
    }

    form button {
      padding: 10px 20px; background-color: #007BFF; border: none; color: white;
      border-radius: 5px; cursor: pointer;
    }

    .category-button {
      padding: 10px 15px; margin: 5px; background-color: #007BFF;
      color: white; border: none; border-radius: 5px; text-decoration: none;
    }

    .category-button:hover { background-color: #0056b3; }

    .products {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px; margin-top: 20px;
    }

    .product {
      border: 1px solid #ddd; border-radius: 5px; padding: 15px; background: #fff;
      text-align: center;
    }

    .product img {
      max-width: 100%; height: auto; border-radius: 4px;
    }

    .product-title {
      margin: 10px 0; font-size: 16px; font-weight: 600;
    }

    .product-link {
      color: #007BFF; text-decoration: none; font-size: 14px;
    }

    .pagination-wrapper {
      text-align: center; margin: 30px 0;
    }

    .pagination {
      display: inline-flex; list-style: none; gap: 0.5rem;
    }

    .pagination a, .pagination .current-page {
      padding: 10px 16px; border-radius: 6px; border: 1px solid #ccc;
      background-color: white; color: #007bff; text-decoration: none;
      font-weight: 500;
    }

    .pagination a:hover {
      background-color: #007bff; color: white;
    }

    .pagination .current-page {
      background-color: #e9ecef; color: #333; cursor: default;
    }

    a { text-decoration: none; color: white; }
    a:visited { color: inherit; text-decoration: none; }

    @media (max-width: 768px) {
      .container { flex-direction: column; }
      nav { width: 100%; height: auto; position: fixed; top: 0; left: 0; }
      .sidebar { flex-direction: row; flex-wrap: wrap; justify-content: space-around; }
      .logo { display: none; }
      .main { margin-left: 0; margin-top: 120px; }
      form, .category-button { width: 100%; flex-direction: column; }
      .products { grid-template-columns: 1fr; }
      .container-custom { padding: 15px; margin: 20px 10px; }
    }
    @media only screen and (max-width: 768px) {
      /* Make sidebar responsive */
      nav {
        width: 100%;
        height: auto;
        position: fixed;
        top: 0;
        left: 0;
        padding: 0.5rem 1rem;
        z-index: 1000;
      }

      .sidebar {
        flex-direction: row;
        flex-wrap: wrap;
        justify-content: space-around;
        padding: 0.5rem 0;
      }

      .nav-item {
        font-size: 0.85rem;
        padding: 0.5rem 0.75rem;
        flex: 1 1 30%;
        justify-content: center;
        text-align: center;
      }

      .main {
        margin-left: 0;
        margin-top: 200px; /* Leave space for fixed nav */
        padding: 1rem;
      }

      /* Make cards stack nicely */
      .card-body {
        flex: 1 1 100%;
        padding: 1rem;
      }

      .row.g-4 {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .col-12,
      .col-md-6 {
        width: 100%;
      }

      /* Pagination buttons stack vertically if too narrow */
      .pagination {
        flex-direction: row;
        justify-content: center;
        flex-wrap: wrap;
      }

      .page-link {
        padding: 0.4rem 0.8rem;
        font-size: 0.85rem;
      }

      form {
        flex-direction: column;
        gap: 0.5rem;
      }

      input[type="text"] {
        width: 100%;
        max-width: 100%;
      }

      button {
        width: 100%;
      }

      /* Image scaling */
      nav .logo img {
        height: 3rem;
        margin: 0 auto;
      }
      .category-button {
    width: 90%;
    max-width: 300px;
    margin: 0.4rem 0;
    font-size: 1rem;
  }
    }
    .badge {
    background-color: red;
    color: white;
    border-radius: 50%;
    padding: 3px 8px;
    font-size: 12px;
    vertical-align: middle;
}
  </style>
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
      <div class="container-custom">
        <h1>Marketplace</h1>

        <form method="GET">
          <input type="text" name="search" value="<?= htmlspecialchars($searchQuery) ?>" placeholder="Search for textbooks, stationery, electronics..." required>
          <button type="submit">Search</button>
        </form>

        <div class="text-center">
          <h2>Categories</h2><br>

          <button class="category-button" onclick="location.href='?search=textbooks'">Books</button>
          <button class="category-button" onclick="location.href='?search=laptops'">Laptops</button>
          <button class="category-button" onclick="location.href='?search=furniture'">Furniture</button>

        </div>

        <?php if (!empty($products['items'])): ?>
          <div class="products">
            <?php foreach ($products['items'] as $item): ?>
              <div class="product">
                <?php if (!empty($item['pagemap']['cse_image'][0]['src'])): ?>
                  <img loading="lazy" src="<?= htmlspecialchars($item['pagemap']['cse_image'][0]['src']) ?>" alt="Product Image">
                <?php endif; ?>
                <div class="product-title"><?= htmlspecialchars($item['title']) ?></div>
                <a href="<?= htmlspecialchars($item['link']) ?>" class="product-link" target="_blank" rel="noopener noreferrer">View Product</a>
              </div>
            <?php endforeach; ?>
          </div>
        <?php elseif (isset($products['error'])): ?>
          <p class="text-danger text-center"><?= htmlspecialchars($products['error']) ?></p>
        <?php elseif (!empty($searchQuery)): ?>
          <p class="text-center">No products found. Try a different search.</p>
        <?php endif; ?>

        <?php if (!empty($products['items'])): ?>
          <div class="pagination-wrapper">
            <ul class="pagination">
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

      </div>
    </main>
  </div>
</body>
</html>
