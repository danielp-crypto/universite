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
  background-color:#2563eb ;
  color: white;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  box-shadow: var(--shadow);
  transition: background-color 0.2s ease, transform 0.2s ease;
}

.edit-button:hover {
  background-color: #4338ca;
  transform: translateY(-1px);
}

.edit-button:active {
  transform: scale(0.98);
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
      <div class="logo">  <img src="assets/images/new-logo-white-removebg-preview.png-1-192x192.png" alt="Universite logo" style="height: 5rem;"></div>
      <div class="sidebar">

        <a href="profile.php" class="nav-item active"><i class="fas fa-user"></i><?= htmlspecialchars($student['name']) ?>
    </a>

        <a href="recommendations.php" class="nav-item"><i class="fas fa-book"></i> Courses</a>
        <a href="market.php" class="nav-item"><i class="fas fa-store"></i> Marketplace</a>
        <a href="notifications.php" class="nav-item"><i class="fas fa-store"></i> Notifications<?php if ($count > 0): ?>
        <span class="badge"><?= $count ?></span>
    <?php endif; ?></a>
        <a href="logout.php" class="nav-item"><i class="fas fa-sign-out-alt"></i> Sign out</a>
      </div>
    </nav>

    <main class="main">
      <div class="mb-5">
        <div class="section-header">
          <section classs="profile-card">
          <h4>Personal Information</h4>
          <button class="edit-button" onclick="location.href='studentinfo-edit.php'">Edit</button>
        </div>
        <hr>
        <p><strong>Full Name:</strong> <?= htmlspecialchars($student['name'] . ' ' . $student['surname']) ?></p>
        <p><strong>Email:</strong> <?= htmlspecialchars($student['mail']) ?></p>
        <p><strong>Phone:</strong> <?= htmlspecialchars($student['cell']) ?></p>
        <p><strong>Date of Birth:</strong> <?= htmlspecialchars($student['age'] ?? 'N/A') ?></p>
        <p><strong>Country:</strong> <?= htmlspecialchars($student['location']) ?></p>
        <p><strong>Category:</strong> <?= htmlspecialchars($student['user_type']) ?></p>
      </div>

      <!-- Preferred Courses Section -->
      <div class="mb-3">
        <div class="section-header">
          <h4>Preferred Courses</h4>

          <button class="edit-button" onclick="location.href='interests-edit.php'">Edit</button>
        </div>
        <hr><br>
        <ol>
          <?php if (!empty($interests)): ?>
            <?php if (!empty($interests['option1'])): ?>
              <li><?= htmlspecialchars($interests['option1']) ?></li>
            <?php endif; ?>
            <li><?= htmlspecialchars($interests['option2']) ?></li>
            <li><?= htmlspecialchars($interests['option3']) ?></li>
          <?php else: ?>
            <li>No course preferences selected.</li>
          <?php endif; ?>
        </ol>
      </section>
      </div>
    </div>
  </div>
</div>
    </main>
  </div>
</body>
</html>
