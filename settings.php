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
    .container { max-width: 800px; margin: 2rem auto; background: #fff; padding: 2rem; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);}
    .tabs { display: flex; gap: 1rem; margin-bottom: 1rem; }
    .tab { cursor: pointer; padding: 0.5rem 1rem; background: #eee; border-radius: 5px; }
    .tab.active { background: #ccc; font-weight: bold; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .form-group { margin-bottom: 1rem; }
    label { display: block; margin-bottom: 0.5rem; }
    input[type="text"], input[type="password"] { width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; }
    .switch { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
    .switch input { transform: scale(1.3); }
    button { padding: 0.5rem 1rem; background: #007bff; color: white; border: none; border-radius: 4px; }
    .alert { padding: 10px; margin-bottom: 1rem; background: #d1e7dd; color: #0f5132; border: 1px solid #badbcc; border-radius: 5px; }
    a {text-decoration:none;color:white;}
    a:visited {
  color: inherit; /* Inherits color from parent element */
  text-decoration: none; /* Optional: remove underline */
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

    <script>
      function showTab(tabId) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
        document.querySelector(`.tab[onclick="showTab('${tabId}')"]`).classList.add('active');
        document.getElementById(tabId).classList.add('active');
      }
    </script>
    </div>

    </main>
  </div>
</body>
</html>
