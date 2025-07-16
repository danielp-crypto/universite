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
      margin: 1rem 0;
      display: flex;
      gap: 0.5rem;
  }
  input[type="text"] {
      padding: 0.5rem;
      width: 100%;
      max-width: 400px;
      border: 1px solid #ccc;
      border-radius: 4px;
  }
  button {
      padding: 0.5rem 1rem;
      background-color: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
  }

  .card-body {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      margin-top: 1rem;
  }

  .card-body {
      background: white;
      padding: 1rem;
      border-radius: 8px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.1);
      flex: 1 1 calc(50% - 1rem);
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
  }

  .card-body h3 {
      margin: 0;
      color: #333;
  }

  .card-body p {
      margin: 0.3rem 0;
      font-size: 0.95rem;
  }

  .card-body a {
      margin-top: 0.5rem;
      color: #007bff;
      text-decoration: none;
      font-weight: bold;
  }
  /* Pagination container */
.pagination {
display: flex;
list-style: none;
padding-left: 0;
margin-top: 1rem;
gap: 0.5rem;
flex-wrap: wrap;
}

/* Pagination item */
.page-item {
display: inline;
}

/* Pagination links */
.page-link {
color: #2563eb; /* Tailwind blue-600 */
background-color: white;
border: 1px solid #d1d5db; /* Tailwind gray-300 */
padding: 0.5rem 1rem;
border-radius: 6px;
font-size: 0.95rem;
text-decoration: none;
transition: all 0.2s ease;
}

.page-link:hover {
background-color: #2563eb;
color: white;
border-color: #2563eb;
text-decoration: none;
}

.page-item.disabled .page-link {
color: #9ca3af; /* Tailwind gray-400 */
background-color: #f3f4f6; /* Tailwind gray-100 */
border-color: #e5e7eb; /* Tailwind gray-200 */
pointer-events: none;
cursor: default;
}

.page-item.active .page-link {
background-color: #1e40af; /* Tailwind blue-800 */
color: white;
border-color: #1e40af;
font-weight: 600;
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
.card {
background-color: #ffffff;


box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);



font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;

}
h3,h2 {font-family: 'Montserrat', sans-serif;}
  </style>
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
      <a href="market.php" class="nav-item"><i class="fas fa-store"></i> Marketplace</a>
      <a href="logout.php" class="nav-item"><i class="fas fa-sign-out-alt"></i> Sign out</a>
    </div>
  </nav>

  <main class="main">
    <form action="course-search.php" method="get">
      <input type="text" name="myCourse" placeholder="Search for a course">
      <button type="submit">Search</button>
    </form>

    <h2>Recommended For You</h2>

    <?php if ($courses): ?>
      <p>About <?= $total_records ?> course(s) found</p>
      <div class="row g-4">
        <?php foreach ($courses as $row): ?>
          <div class="col-12 col-md-6">
            <div class="card h-100 shadow-sm">
              <div class="card-body">
                <h3><?= htmlspecialchars($row["programme"]) ?></h3>
                <p><strong>Qualification:</strong> <?= htmlspecialchars($row["certification"]) ?></p>
                <p><strong>Duration:</strong> <?= htmlspecialchars($row["duration"]) ?></p>
                <p><strong>Study Mode:</strong> <?= htmlspecialchars($row["class"]) ?></p>
                <p><strong>Institution:</strong> <?= htmlspecialchars($row["institution"]) ?></p>
                <p><strong>Campus:</strong> <?= htmlspecialchars($row["campus"]) ?></p>
                <p><strong>Minimum APS:</strong> <?= htmlspecialchars($row["aps"]) ?></p>
                <p><strong>Requirements:</strong><br><?= nl2br(htmlspecialchars($row["subjects"])) ?></p>
                <p><strong>Closing Date:</strong> <?= htmlspecialchars($row["date"]) ?></p>
                <a href="https://www.universite.co.za/applyFrame.php?school=<?= urlencode($row["institution"]) ?>" class="btn btn-primary mt-2">Apply</a>
              </div>
            </div>
          </div>
        <?php endforeach; ?>
      </div>
    <?php else: ?>
      <p>No course recommendations found based on your preferences.</p>
      <p><a href="interests-edit.php">Click here to update your preferences.</a></p>
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
