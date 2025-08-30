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


// Example: get interests (assuming they are in a separate table)
$interestStmt = $pdo->prepare("SELECT option1, option2, option3 FROM options WHERE student_id = ?");
$interestStmt->execute([$student['student_id']]); // correct

$interests = $interestStmt->fetch();
?>

<!DOCTYPE html>
<html lang="en">
<head>
  <!-- Google tag (gtag.js) -->
 <script src="assets/js/matcher.min.js"></script>
 <script src="assets/js/matcher.min.js"></script>
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
  <link rel="stylesheet" href="assets/css/matcher.min.css">
</head>
<body>
  <div class="container">
    <nav>
      <div class="logo">  <img src="assets/images/new-logo-white-removebg-preview.png-1-192x192.png" alt="Universite logo" style="height: 5rem;"></div>
      <div class="sidebar">
        <a href="profile.php" class="nav-item"><i class="fas fa-user"></i><?= htmlspecialchars($student['name']) ?>
        </a>

        <a href="settings.php"class="nav-item"><i class="fas fa-cog"></i> Settings</a>
        <a href="matcher.php" class="nav-item active"><i class="fas fa-book"></i> Courses</a>
        <a href="logout.php" class="nav-item"><i class="fas fa-sign-out-alt"></i> Sign out</a>
      </div>
    </nav>

    <main class="main">
      <div>

        <?php
        $student_id = $_SESSION['user_email'];

        // Get course preferences
        $stmt = $con->prepare("SELECT option1, option2, option3 FROM options WHERE student_id = ?");
        $stmt->bind_param("i", $student_id);
        $stmt->execute();
        $stmt->bind_result($course1, $course2, $course3);
        $stmt->fetch();
        $stmt->close();

        // Check if preferences exist
        if (!$course1 && !$course2 && !$course3) {
            echo "<div class='alert alert-warning'>No course preferences found. <a href='profile.php'>Update your profile</a> to get recommendations.</div>";
            exit;
        }

        // Search form
        echo('
        <form action="course-search.php" method="get" class="d-flex mb-4">
          <input type="text" name="myCourse" class="form-control me-2" placeholder="Search for a course">
          <button type="submit" class="btn btn-outline-primary">Search</button>
        </form>
        ');

        echo "<h2 class='mb-4'>Recommended For You </h2>";

        // Pagination logic
        $page_no = isset($_GET['page_no']) ? (int) $_GET['page_no'] : 1;
        $total_per_page = 4;
        $offset = ($page_no - 1) * $total_per_page;

        $like1 = "%$course1%";
        $like2 = "%$course2%";
        $like3 = "%$course3%";

        // Total count
        $count_stmt = $con->prepare("SELECT COUNT(*) FROM courses WHERE programme LIKE ? OR programme LIKE ? OR programme LIKE ?");
        $count_stmt->bind_param("sss", $like1, $like2, $like3);
        $count_stmt->execute();
        $count_stmt->bind_result($total_records);
        $count_stmt->fetch();
        $count_stmt->close();

        $total_pages = ceil($total_records / $total_per_page);

        // Course data
        $data_stmt = $con->prepare("SELECT class, campus, certification, programme, duration, aps, institution, subjects, date FROM courses WHERE programme LIKE ? OR programme LIKE ? OR programme LIKE ? ORDER BY institution ASC LIMIT ?, ?");
        $data_stmt->bind_param("ssssi", $like1, $like2, $like3, $offset, $total_per_page);
        $data_stmt->execute();
        $result = $data_stmt->get_result();

        if ($result->num_rows > 0) {
            echo "<p>About $total_records course(s) found</p>";
            $frame = "https://www.universite.co.za/applyFrame.php?school=";

            echo '<div class="row g-4">'; // Bootstrap grid
            while ($row = $result->fetch_assoc()) {
                echo '
                <div class="col-12 col-md-6">
                    <div class="card h-100 shadow-sm">
                        <div class="card-body">
                            <h3 class="card-title">'.htmlspecialchars($row["programme"]).'</h3>
                            <p class="card-text"><strong>Qualification:</strong> '.htmlspecialchars($row["certification"]).'</p>
                            <p class="card-text"><strong>Duration:</strong> '.htmlspecialchars($row["duration"]).'</p>
                            <p class="card-text"><strong>Study Mode:</strong> '.htmlspecialchars($row["class"]).'</p>
                            <p class="card-text"><strong>Institution:</strong> '.htmlspecialchars($row["institution"]).'</p>
                            <p class="card-text"><strong>Campus:</strong> '.htmlspecialchars($row["campus"]).'</p>
                            <p class="card-text"><strong>Minimum APS:</strong> '.htmlspecialchars($row["aps"]).'</p>
                            <p class="card-text"><strong>Requirements:</strong><br>'.nl2br(htmlspecialchars($row["subjects"])).'</p>
                            <p class="card-text"><strong>Closing Date:</strong> '.htmlspecialchars($row["date"]).'</p>
                            <a href="'.$frame.urlencode($row["institution"]).'" class="btn btn-primary mt-2">Apply</a>
                        </div>
                    </div>
                </div>
                ';
            }
            echo '</div>';
        } else {
            echo "<p>No course recommendations found based on your preferences.</p>";
            echo "<p><a href='interests-edit.php'>Click here to update your preferences.</a></p>";
        }

        $data_stmt->close();
        ?>
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
