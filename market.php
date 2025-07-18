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
      <style>
        .market-header {
          font-size: 2.3rem;
          font-weight: 800;
          color: #1f2937;
          margin-bottom: 0.2rem;
          letter-spacing: -1px;
          text-align: left;
        }
        .market-sub {
          color: #6b7280;
          font-size: 1.15rem;
          margin-bottom: 2rem;
        }
        .market-card {
          background: #fff;
          border-radius: 1.5rem;
          box-shadow: 0 4px 24px rgba(37,99,235,0.08);
          padding: 2.2rem 2rem 2rem 2rem;
          margin-bottom: 2.5rem;
          max-width: 900px;
          margin-left: auto;
          margin-right: auto;
        }
        .market-search-form {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        .market-search-form input[type="text"] {
          flex: 1;
          padding: 0.9rem 1.2rem;
          border-radius: 999px;
          border: 1px solid #d1d5db;
          font-size: 1.1rem;
        }
        .market-search-form button {
          padding: 0.9rem 2rem;
          background: linear-gradient(90deg, #2563eb 0%, #60a5fa 100%);
          color: #fff;
          border: none;
          border-radius: 999px;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s, transform 0.2s;
        }
        .market-search-form button:hover, .market-search-form button:focus {
          background: linear-gradient(90deg, #1e40af 0%, #2563eb 100%);
          transform: scale(1.05);
        }
        .market-categories {
          display: flex;
          gap: 1rem;
          justify-content: center;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }
        .market-cat-btn {
          background: linear-gradient(90deg, #60a5fa 0%, #2563eb 100%);
          color: #fff;
          border: none;
          border-radius: 999px;
          padding: 0.7rem 1.7rem;
          font-size: 1.08rem;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(37,99,235,0.10);
          transition: background 0.2s, transform 0.2s;
          margin-bottom: 0.5rem;
        }
        .market-cat-btn:hover, .market-cat-btn:focus {
          background: linear-gradient(90deg, #2563eb 0%, #1e40af 100%);
          transform: scale(1.05);
        }
        .market-products {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 2rem;
          margin-bottom: 2rem;
        }
        .market-product-card {
          background: #fff;
          border-radius: 1.2rem;
          box-shadow: 0 4px 24px rgba(37,99,235,0.10);
          padding: 1.5rem 1.2rem 1.2rem 1.2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          transition: box-shadow 0.2s, transform 0.2s;
          min-height: 260px;
        }
        .market-product-card:hover {
          box-shadow: 0 8px 32px rgba(37,99,235,0.16);
          transform: translateY(-4px) scale(1.01);
        }
        .market-product-card img {
          max-width: 100%;
          max-height: 180px;
          border-radius: 0.7rem;
          margin-bottom: 1rem;
          object-fit: contain;
          background: #f3f4f6;
        }
        .market-product-title {
          font-size: 1.13rem;
          font-weight: 700;
          color: #2563eb;
          margin-bottom: 0.5rem;
          text-align: center;
        }
        .market-product-link {
          margin-top: 1rem;
          background: linear-gradient(90deg, #2563eb 0%, #60a5fa 100%);
          color: #fff;
          border: none;
          border-radius: 999px;
          padding: 0.6rem 1.5rem;
          font-size: 1.02rem;
          font-weight: 600;
          cursor: pointer;
          text-align: center;
          text-decoration: none;
          transition: background 0.2s, transform 0.2s;
          display: inline-block;
        }
        .market-product-link:hover, .market-product-link:focus {
          background: linear-gradient(90deg, #1e40af 0%, #2563eb 100%);
          transform: scale(1.05);
          color: #fff;
          text-decoration: none;
        }
        .market-pagination-wrapper {
          text-align: center;
          margin: 30px 0 0 0;
        }
        .market-pagination {
          display: inline-flex;
          list-style: none;
          gap: 0.5rem;
        }
        .market-pagination a, .market-pagination .current-page {
          padding: 10px 16px;
          border-radius: 999px;
          border: 1px solid #2563eb;
          background-color: #fff;
          color: #2563eb;
          text-decoration: none;
          font-weight: 600;
          font-size: 1.05rem;
          transition: background 0.2s, color 0.2s;
        }
        .market-pagination a:hover {
          background-color: #2563eb;
          color: #fff;
        }
        .market-pagination .current-page {
          background-color: #e9ecef;
          color: #333;
          cursor: default;
        }
        @media (max-width: 900px) {
          .market-card { padding: 1.2rem 0.7rem 1rem 0.7rem; }
          .market-products { grid-template-columns: 1fr; gap: 1.2rem; }
        }
        @media (max-width: 600px) {
          .market-header { font-size: 1.3rem; }
          .market-card { border-radius: 0.7rem; }
          .market-search-form input[type="text"] { font-size: 1rem; padding: 0.7rem 1rem; }
          .market-search-form button { font-size: 1rem; padding: 0.7rem 0.7rem; }
          .market-cat-btn { width: 100%; padding: 0.8rem 0; font-size: 1rem; }
          .market-product-card { border-radius: 0.7rem; padding: 1rem 0.5rem; }
          .market-product-title { font-size: 1rem; }
          .market-product-link { width: 100%; padding: 0.8rem 0; font-size: 1rem; }
        }
      </style>
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
