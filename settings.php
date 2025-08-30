<?php
session_start();
require_once 'db.php'; // Ensure this file sets up your $pdo database connection

if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit;
}

$student_id = $_SESSION['user_id'];

// Handle form submissions
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Update account
    if (isset($_POST['update_account'])) {
        $username = trim($_POST['username']);
        if (!empty($username)) {
            $stmt = $pdo->prepare("UPDATE students SET username = ? WHERE id = ?");
            $stmt->execute([$username, $student_id]);
        }
    }



    // Update password
    if (isset($_POST['update_password'])) {
        $password = $_POST['password'];
        $confirm = $_POST['confirmPassword'];
        if (!empty($password) && $password === $confirm) {
            $hashed = password_hash($password, PASSWORD_DEFAULT);
            $stmt = $pdo->prepare("UPDATE students SET password = ? WHERE id = ?");
            $stmt->execute([$hashed, $student_id]);
        }
    }

    header("Location: settings.php?updated=true");
    exit;
}

// Fetch user data
$stmt = $pdo->prepare("SELECT * FROM students WHERE id = ?");
$stmt->execute([$student_id]);
$user = $stmt->fetch();

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
  <link rel="stylesheet" href="assets/css/settings.min.css">
</head>
<body>
  <div class="container">
    <nav>
      <div class="logo">  <img src="assets/images/new-logo-white-removebg-preview.png-1-192x192.png" alt="Universite logo" style="height: 5rem;"></div>
      <div class="sidebar">
        <a href="profile.php" class="nav-item"><i class="fas fa-user"></i><?php echo isset($_SESSION['username']) ? htmlspecialchars($_SESSION['username']) : 'Profile'; ?>
        </a>

        <a href="settings.php"class="nav-item active"><i class="fas fa-cog"></i> Settings</a>
        <a href="matcher.php" class="nav-item"><i class="fas fa-book"></i> Courses</a>
        <a href="market.php" class="nav-item"><i class="fas fa-store"></i> Marketplace</a>
        <a href="logout.php" class="nav-item"><i class="fas fa-sign-out-alt"></i> Sign out</a>
      </div>
    </nav>

    <main class="main">
      <h2>Settings</h2>

      <?php if (isset($_GET['updated'])): ?>
        <div class="alert">Settings updated successfully.</div>
      <?php endif; ?>

      <div class="tabs">
        <div class="tab active" onclick="showTab('account')">Account</div>

        <div class="tab" onclick="showTab('security')">Security</div>
      </div>

      <!-- Account -->
      <form method="POST" class="tab-content active" id="account">
        <div class="form-group">
          <label for="username">Username</label>
          <input type="text" name="username" id="username" value="<?= htmlspecialchars($user['username']) ?>">
        </div>
        <button name="update_account">Update Account</button>
      </form>



      <!-- Security -->
      <form method="POST" class="tab-content" id="security">
        <div class="form-group">
          <label for="password">New Password</label>
          <input type="password" name="password" id="password">
        </div>
        <div class="form-group">
          <label for="confirmPassword">Confirm Password</label>
          <input type="password" name="confirmPassword" id="confirmPassword">
        </div>
        <button name="update_password">Update Password</button>
      </form>
    </div>

    <script src="assets/js/settings.min.js"></script>
    </div>

    </main>
  </div>
</body>
</html>
