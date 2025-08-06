<?php
session_start();


require 'db.php'; // Assume this contains $pdo = new PDO(...);

// Check session
if (!isset($_SESSION['user_id']) || !isset($_SESSION['user_email'])) {
    header("Location: login.php");
    exit;
}

$email = $_SESSION['user_email'];
// Handle delete action
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['delete_id'])) {
  $deleteStmt = $pdo->prepare("DELETE FROM saved_searches WHERE id = ? AND user_email = ?");
  $deleteStmt->execute([$_POST['delete_id'], $email]);
  // Optional: Redirect to avoid form re-submission
  header("Location: mycourses.php");
 

  exit;
}


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
$location = strtolower(trim($student['location'] ?? ''));

// Get notification count
$count = 0;
$notifStmt = $pdo->prepare("SELECT COUNT(*) FROM notifications WHERE (user_email IS NULL OR user_email = ?) AND is_read = 0");
$notifStmt->execute([$email]);
$count = $notifStmt->fetchColumn();

// Fetch saved searches
$stmt = $pdo->prepare("SELECT * FROM saved_searches WHERE user_email = ? ORDER BY created_at DESC");
$stmt->execute([$email]);
$saved_searches = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Helper functions
function format_awlevel($level) {
    $map = [
        1 => 'Certificate', 2 => 'Associate', 3 => 'Associate+',
        4 => 'Bachelor’s Prep', 5 => 'Bachelor’s', 6 => 'Post-Bachelor’s',
        7 => 'Master’s', 8 => 'Post-Master’s', 17 => 'Doctoral',
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
    .profile-card {
        background: white;
        border-radius: 1px;
        box-shadow: 0 0 10px rgba(0,0,0,0.05);
        padding: 2rem;
        font-family: 'Inter', sans-serif;

    }
    .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        max-width: 800px;
 margin: auto;
 background-color: var(--white);
 border-radius: var(--radius);
 box-shadow: var(--shadow);
 padding: 2rem;
 display: flex;
 flex-direction: column;
 align-items: center;
 text-align: center;
    }

    .edit-button {
  background-color: #3b82f6; /* Primary Blue */
  color: white;
  border: none;
  padding: 0.75rem; /* Equal padding for circle shape */
  border-radius: 50%; /* Full circle */
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transition: background-color 0.2s ease, transform 0.2s ease;
  width: 3rem;
  height: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.edit-button:hover {
  background-color: #2563eb; /* Darker on hover */
  transform: scale(1.05);
}

.edit-button:active {
  transform: scale(0.95);
}

.edit-button:focus {
  outline: 2px solid #93c5fd;
  outline-offset: 2px;
}
@media (max-width: 640px) {
  .edit-button {
    width: 2.5rem;
    height: 2.5rem;
    font-size: 0.875rem;
  }
}

    a {text-decoration:none;color:white;}
    a:visited {
  color: inherit; /* Inherits color from parent element */
  text-decoration: none; /* Optional: remove underline */
}
li {
  margin-bottom: 0.6rem;
  line-height: 1.5;
  color: #374151; /* cool dark gray */
  font-size: 1rem;

  padding-left: 1.2rem;
}

/* Paragraph */
p {
  font-size: 1rem;
  line-height: 1.6;
  color: #4b5563; /* medium gray */
  margin: 0.75rem 0;
}

/* Heading 4 */
h4 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #1f2937; /* darker gray */
  letter-spacing: 0.02em;
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
      .cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-top: 1rem;
}

.card {
  background-color: #ffffff;
  border-radius: 0.75rem;
  box-shadow: 0 4px 10px rgba(0,0,0,0.06);
  padding: 1.5rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 6px 16px rgba(0,0,0,0.12);
}

.card h3 {
  margin-bottom: 0.5rem;
  font-size: 1.2rem;
  color: #1f2937;
}

.card p {
  font-size: 0.95rem;
  color: #374151;
  margin-bottom: 0.4rem;
}

.card a {
  margin-top: 1rem;
  display: inline-block;
  color: #2563eb;
  font-weight: 500;
  text-decoration: none;
}

.card a:hover {
  text-decoration: underline;
}
 
  </style>
</head>
<body>
  <div class="container">
    <nav>
      <div class="logo">  <img src="assets/images/new-logo-white-removebg-preview.png-1-192x192.png" alt="Universite logo" style="height: 5rem;"></div>
      <div class="sidebar">

        <a href="profile.php" class="nav-item"><i class="fas fa-user"></i><?= htmlspecialchars($student['name']) ?>
    </a>

        <a href="recommendations.php" class="nav-item"><i class="fas fa-book"></i> Courses</a>
        <a href="mycourses.php" class="nav-item active"><i class="fas fa-star"></i> Saved Searches</a>
        <a href="notifications.php" class="nav-item"><i class="fas fa-bell"></i> Notifications<?php if ($count > 0): ?>
        <span class="badge"><?= $count ?></span>
    <?php endif; ?></a>
        <a href="logout.php" class="nav-item"><i class="fas fa-sign-out-alt"></i> Sign out</a>
      </div>
    </nav>

    <main class="main">
    <h2>Saved Course Searches</h2>
    <?php if (isset($_GET['deleted'])): ?>
  <p style="color: green;">Search deleted successfully.</p>
<?php endif; ?>

<?php if (empty($saved_searches)): ?>
  <p>You have no saved searches yet.</p>
<?php endif; ?>

<?php foreach ($saved_searches as $search): ?>
  <?php
  $course = trim($search['query']);
  $institution = trim($search['institution'] ?? '');
  $results = [];

  if ($location === 'south africa') {
      $stmt = $pdo->prepare("
        SELECT class, campus, certification, programme, duration, aps, institution, subjects, date, link
        FROM sa_courses
        WHERE programme LIKE ?" . ($institution ? " AND institution = ?" : "") . "
        ORDER BY aps ASC
        LIMIT 10
      ");
      $params = ["%$course%"];
      if ($institution) $params[] = $institution;
      $stmt->execute($params);
      $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
  } else {
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
          " . ($institution ? " AND i.INSTNM = :institution" : "") . "
        ORDER BY i.INSTNM
        LIMIT 10
      ";
      $stmt = $pdo->prepare($sql);
      $stmt->bindValue(':codeQuery', "%$course%");
      $stmt->bindValue(':titleQuery', "%$course%");
      if ($institution) $stmt->bindValue(':institution', $institution);
      $stmt->execute();
      $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
  }
  ?>

  <h4 style="margin-top: 2rem;"><?= htmlspecialchars($course) ?><?= $institution ? " at " . htmlspecialchars($institution) : '' ?></h4>
  <form method="POST" onsubmit="return confirm('Are you sure you want to delete this saved search?');" style="display:inline;">
  <input type="hidden" name="delete_id" value="<?= htmlspecialchars($search['id']) ?>">
  <button type="submit" class="edit-button" style="background-color: #dc2626;"><i class="fa fa-trash" aria-hidden="true"></i></button>
</form>

  <?php if (count($results) > 0): ?>
    <div class="cards-grid">
      <?php foreach ($results as $row): ?>
        <div class="card">
          <?php if ($location === 'south africa'): ?>
            
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
          <?php else: ?>
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
          <?php endif; ?>
        </div>
      <?php endforeach; ?>
    </div>
  <?php else: ?>
    <p>No courses found for this search.</p>
  <?php endif; ?>
<?php endforeach; ?>
    </main>
  </div>
</body>
</html>
