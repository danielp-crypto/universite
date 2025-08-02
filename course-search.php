<?php
session_start();

require 'db.php';

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

$location = strtolower(trim($student['location'] ?? ''));

// Notification count
$count = 0;
$notifStmt = $pdo->prepare("SELECT COUNT(*) FROM notifications WHERE (user_email IS NULL OR user_email = ?) AND is_read = 0");
$notifStmt->execute([$email]);
$count = $notifStmt->fetchColumn();

// Search and pagination
$myCourse = isset($_GET['myCourse']) ? trim($_GET['myCourse']) : '';
$selectedInstitution = isset($_GET['institution']) ? trim($_GET['institution']) : '';
$current_page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
$total_records_per_page = 10;
$offset = ($current_page - 1) * $total_records_per_page;

// Fetch institution list for filter
$institutions = [];
if ($location === 'south africa') {
    $stmt = $pdo->query("SELECT DISTINCT institution FROM sa_courses ORDER BY institution");
    $institutions = $stmt->fetchAll(PDO::FETCH_COLUMN);
} else {
    $stmt = $pdo->query("SELECT DISTINCT INSTNM FROM institutions ORDER BY INSTNM");
    $institutions = $stmt->fetchAll(PDO::FETCH_COLUMN);
}

$results = [];
$total_rows = 0;
$total_pages = 1;

if ($location === 'south africa') {
    // Use sa_courses table (original logic)
    $host = "localhost";
    $user = "root";
    $password = "NewSecurePassword123!";
    $dbname = "mydb";
    $con = new mysqli($host, $user, $password, $dbname);
    if ($con->connect_error) {
        die("Connection failed: " . $con->connect_error);
    }
    $safeCourse = $con->real_escape_string($myCourse);
    $institutionFilter = $selectedInstitution ? " AND institution = '" . $con->real_escape_string($selectedInstitution) . "'" : "";
    $count_sql = "SELECT COUNT(*) AS total FROM sa_courses WHERE programme LIKE '%$safeCourse%'$institutionFilter";
    $count_result = $con->query($count_sql);
    $total_rows = $count_result->fetch_assoc()['total'];
    $total_pages = max(1, ceil($total_rows / $total_records_per_page));
    $sql = "SELECT class, campus, certification, programme, duration, aps, institution, subjects, date, link
            FROM sa_courses
            WHERE programme LIKE '%$safeCourse%'$institutionFilter
            ORDER BY aps ASC
            LIMIT $offset, $total_records_per_page";
    $result = $con->query($sql);
} else {
    // Use search.php logic (US/international) with pagination
    $institutionFilter = $selectedInstitution ? " AND i.INSTNM = :institution " : "";
    $count_sql = "
    SELECT COUNT(DISTINCT c.CIPCODE, i.INSTNM)
    FROM courses c
    JOIN institutions i ON i.UNITID = c.UNITID
    LEFT JOIN cip_codes cc 
      ON REPLACE(TRIM(c.CIPCODE), '.', '') = REPLACE(TRIM(cc.CIPCODE), '.', '')
    WHERE 
      (REPLACE(c.CIPCODE, '.', '') LIKE REPLACE(:codeQuery, '.', '')
      OR LOWER(cc.CIPTITLE) LIKE LOWER(:titleQuery))
      $institutionFilter
    ";
    $count_stmt = $pdo->prepare($count_sql);
    $params = [
        ':codeQuery' => '%' . $myCourse . '%',
        ':titleQuery' => '%' . $myCourse . '%',
    ];
    if ($selectedInstitution) {
        $params[':institution'] = $selectedInstitution;
    }
    $count_stmt->execute($params);
    $total_rows = (int)$count_stmt->fetchColumn();
    $total_pages = max(1, ceil($total_rows / $total_records_per_page));

    // Now fetch paginated results
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
      $institutionFilter
    ORDER BY i.INSTNM
    LIMIT :offset, :limit
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->bindValue(':codeQuery', '%' . $myCourse . '%');
    $stmt->bindValue(':titleQuery', '%' . $myCourse . '%');
    if ($selectedInstitution) {
        $stmt->bindValue(':institution', $selectedInstitution);
    }
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->bindValue(':limit', $total_records_per_page, PDO::PARAM_INT);
    $stmt->execute();
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
  <title>Find Online & University Courses for Students | Compare & Enroll</title>
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
      transition: box-shadow 0.2s, transform 0.2s;
    }
    .card:hover {
      box-shadow: 0 8px 24px rgba(37,99,235,0.16);
      transform: translateY(-4px) scale(1.03);
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
    .badge {
    background-color: red;
    color: white;
    border-radius: 50%;
    padding: 3px 8px;
    font-size: 12px;
    vertical-align: middle;
}
select[name="institution"]:focus {
  outline: 2px solid #2563eb;
  border-color: #2563eb;
}
select[name="institution"] {
  transition: border 0.2s, box-shadow 0.2s;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03);
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
        <a href="notifications.php" class="nav-item"><i class="fas fa-bell"></i> Notifications<?php if ($count > 0): ?>
        <span class="badge"><?= $count ?></span>
    <?php endif; ?></a>
        <a href="logout.php" class="nav-item"><i class="fas fa-sign-out-alt"></i> Sign out</a>
      </div>
    </nav>
    <main class="main">
      <h1>Search Courses</h1>
      <form action="course-search.php" method="get" style="display: flex; gap: 0.5rem; max-width: 600px; align-items: center;">
        <input type="text" name="myCourse" placeholder="e.g. Engineering" value="<?= htmlspecialchars($myCourse) ?>" required />
        <select name="institution" style="padding: 0.75rem; border: 1px solid #ccc; border-radius: 6px; font-size: 1rem; min-width: 180px; background: #fff; color: #333; height: 44px; margin-right: 0.5rem;">
          <option value="" disabled selected>Filter by institution...</option>
          <option value="" <?= $selectedInstitution === '' ? 'selected' : '' ?>>All Institutions</option>
          <?php foreach ($institutions as $inst): ?>
            <option value="<?= htmlspecialchars($inst) ?>" <?= $selectedInstitution === $inst ? 'selected' : '' ?>><?= htmlspecialchars($inst) ?></option>
          <?php endforeach; ?>
        </select>
        <button type="submit" style="padding: 0.75rem 1rem; border-radius: 6px; font-size: 1rem;">Search</button>
      </form>
      <?php if ($location === 'south africa'): ?>
        <?php if (isset($result) && $result->num_rows > 0): ?>
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
      <?php else: ?>
        <h2>Results (<?= $total_rows ?> found)</h2>
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
                <?php if (!empty($row['webaddr'])): ?>
                  <a href="<?= htmlspecialchars($row['webaddr']) ?>" target="_blank">Apply Now</a>
                <?php endif; ?>
              </div>
            <?php endforeach; ?>
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
          <p>No institutions offer a course matching "<strong><?= htmlspecialchars($myCourse) ?></strong>".</p>
        <?php endif; ?>
      <?php endif; ?>
    </main>
  </div>
  <!-- jQuery (for autocomplete) -->
<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>

<!-- jQuery UI for autocomplete -->
<script src="https://code.jquery.com/ui/1.13.2/jquery-ui.min.js"></script>
<link rel="stylesheet" href="https://code.jquery.com/ui/1.13.2/themes/base/jquery-ui.css">

<script>
$(function() {
  $('input[name="myCourse"]').autocomplete({
    source: function(request, response) {
      $.ajax({
        url: "autocomplete.php",
        dataType: "json",
        data: {
          term: request.term
        },
        success: function(data) {
          response(data);
        }
      });
    },
    minLength: 2, // Minimum characters before suggestions appear
    delay: 200
  });
});
</script>

</body>
</html>
