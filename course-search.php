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
?>
<?php
// Database connection
$host = "localhost";
$user = "root";
$password = "NewSecurePassword123!";
$dbname = "mydb";

$con = new mysqli($host, $user, $password, $dbname);
if ($con->connect_error) {
    die("Connection failed: " . $con->connect_error);
}

// Search and pagination
$myCourse = isset($_GET['myCourse']) ? $con->real_escape_string($_GET['myCourse']) : '';
$current_page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
$total_records_per_page = 10;
$offset = ($current_page - 1) * $total_records_per_page;

// Get total
$count_sql = "SELECT COUNT(*) AS total FROM courses WHERE programme LIKE '%$myCourse%'";
$count_result = $con->query($count_sql);
$total_rows = $count_result->fetch_assoc()['total'];
$total_pages = ceil($total_rows / $total_records_per_page);

// Fetch data
$sql = "SELECT class, campus, certification, programme, duration, aps, institution, subjects, date, link
        FROM courses
        WHERE programme LIKE '%$myCourse%'
        ORDER BY aps ASC
        LIMIT $offset, $total_records_per_page";
$result = $con->query($sql);
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
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      min-height: 100vh;
      background: #f9fafb;
      margin: 0;
    }
    .container {
      display: flex;
    }
    nav {
      background-color: #1f2937;
      color: white;
      padding: 1rem;
      height: 100vh;
      position: fixed;
      top: 0;
      left: 0;
      width: 250px;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      z-index: 1000;
    }
    .sidebar {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .logo {
      font-size: 1.5rem;
      font-weight: bold;
      text-align: center;
      padding-bottom: 1rem;
      border-bottom: 1px solid #374151;
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;
      transition: background 0.3s, transform 0.2s;
      cursor: pointer;
      font-size: 1rem;
      background-color: transparent;
    }
    .nav-item:hover {
      background-color: #374151;
      transform: translateX(4px);
    }
    .nav-item i {
      font-size: 1.2rem;
      color: #60a5fa;
    }
    .nav-item.active {
      background-color: #2563eb;
      font-weight: bold;
    }
    .nav-item.active i {
      color: #fff;
    }
    .main {
      margin-left: 250px;
      padding: 2rem;
      flex: 1;
    }
    @media (max-width: 768px) {
      .container {
        flex-direction: column;
      }
      nav {
        width: 100%;
        height: auto;
        position: fixed;
        top: 0;
        left: 0;
      }
      .sidebar {
        flex-direction: row;
        justify-content: space-around;
        flex-wrap: wrap;
        padding: 0.5rem;
      }
      .logo {
        display: none;
      }
      .main {
        margin-left: 0;
        margin-top: 120px; /* leave space for fixed top nav */
      }
    }
    a {text-decoration:none;color:white;}
    a:visited {
    color: inherit; /* Inherits color from parent element */
    text-decoration: none; /* Optional: remove underline */
    }
    form {
      margin-bottom: 2rem;
      display: flex;
      gap: 0.5rem;
      max-width: 600px;
    }
    input[type="text"] {
      flex: 1;
      padding: 0.75rem;
      border: 1px solid #ccc;
      border-radius: 6px;
      font-size: 1rem;
    }
    button {
      background-color: #2563eb;
      color: white;
      border: none;
      padding: 0.75rem 1rem;
      border-radius: 6px;
      font-size: 1rem;
      cursor: pointer;
    }
    .results {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .card {
      background: white;
      border-radius: 10px;
      padding: 1rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      flex: 1 1 calc(50% - 1rem);
      display: flex;
      flex-direction: column;
    }
    .card h3 {
      margin-top: 0;
      font-size: 1.2rem;
      color: #1f2937;
    }
    .card p {
      margin: 0.3rem 0;
      font-size: 0.95rem;
      color: #4b5563;
    }
    .card a {
      margin-top: auto;
      align-self: flex-start;
      color: #2563eb;
      font-weight: bold;
      text-decoration: none;
    }

    .pagination {
      margin-top: 2rem;
      display: flex;
      justify-content: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .pagination a, .pagination span {
      padding: 0.5rem 0.75rem;
      background: #e5e7eb;
      border-radius: 6px;
      text-decoration: none;
      color: #1f2937;
      font-weight: 500;
    }
    .pagination .current {
      background: #2563eb;
      color: white;
    }
    @media (max-width: 768px) {
      .card {
        flex: 1 1 100%;
      }
      form {
        flex-direction: column;
      }
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
    }

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
        <a href="logout.php" class="nav-item"><i class="fas fa-sign-out-alt"></i> Sign out</a>
      </div>
    </nav>

    <main class="main">
      <h1>Search Courses</h1>

        <form action="course-search.php" method="get">
          <input type="text" name="myCourse" placeholder="e.g. Engineering" value="<?= htmlspecialchars($myCourse) ?>" />
          <button type="submit">Search</button>
        </form>

        <?php if ($result && $result->num_rows > 0): ?>
          <p><?= $total_rows ?> course(s) found.</p>

          <div class="results">
            <?php while ($row = $result->fetch_assoc()): ?>
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
            <?php endwhile; ?>
          </div>

          <div class="pagination">
            <?php if ($current_page > 1): ?>
              <a href="?myCourse=<?= urlencode($myCourse) ?>&page=<?= $current_page - 1 ?>">Previous</a>
            <?php endif; ?>

            <span class="current">Page <?= $current_page ?> of <?= $total_pages ?></span>

            <?php if ($current_page < $total_pages): ?>
              <a href="?myCourse=<?= urlencode($myCourse) ?>&page=<?= $current_page + 1 ?>">Next</a>
            <?php endif; ?>
          </div>

        <?php else: ?>
          <p>No courses found matching "<?= htmlspecialchars($myCourse) ?>".</p>
        <?php endif; ?>

    </main>
  </div>
</body>
</html>
