<?php
session_start();
require_once 'db.php'; // Assumes you have PDO setup in db.php

// Handle POST submission
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';
    $confirmPassword = $_POST['confirm_password'] ?? '';
    $termsAccepted = isset($_POST['terms']);

    $errors = [];

    // Validation
    if (empty($username)) $errors[] = "Username is required.";
    if (strlen($password) < 6) $errors[] = "Password must be at least 6 characters.";
    if ($password !== $confirmPassword) $errors[] = "Passwords do not match.";
    if (!$termsAccepted) $errors[] = "You must agree to the terms.";

    // Check if username is already taken
    if (empty($errors)) {
        $stmt = $pdo->prepare("SELECT id FROM students WHERE username = ?");
        $stmt->execute([$username]);

        if ($stmt->fetch()) {
            $errors[] = "Username already taken.";
        }
    }

    // If no errors, insert user
    if (empty($errors)) {
        $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $pdo->prepare("INSERT INTO students (username, password, created_at) VALUES (?, ?, NOW())");
        $stmt->execute([$username, $hashedPassword]);

        // Auto-login
        $_SESSION['user_id'] = $pdo->lastInsertId();
        $_SESSION['username'] = $username;

        // Redirect
        header("Location: studentinfo.php");
        exit;
    }
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
  <!-- Canonical URL -->
  <link rel="canonical" href="https://universite.co.za/" />

  <!-- Hreflang tags -->
  <link rel="alternate" href="https://universite.co.za/" hreflang="en-za" />
  <link rel="alternate" href="https://universite.co.za/" hreflang="en" />
  <link rel="alternate" href="https://universite.co.za/" hreflang="x-default" />
  <!-- Google tag (gtag.js) -->
  <script src="assets/js/signup.min.js"></script>
  <script src="assets/js/signup.min.js"></script>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="generator" content="Mobirise v6.0.1, mobirise.com">
  <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1">
  <link rel="shortcut icon" href="assets/images/icon-removebg-preview.png-128x128.png" type="image/x-icon">
  <meta name="description" content="Create your free Universite account to explore and compare the best online and university courses. Get personalized recommendations today.">
  <meta property="og:title" content="Find Online & University Courses for Students">
  <meta property="og:description" content="Browse both online courses and in-person college programs. Discover the best course for your goals and enroll with confidence.">
  <meta property="og:image" content="https://universite.co.za/assets/images/new-logo-white-removebg-preview.png-1-192x192.png">
  <meta property="og:url" content="https://universite.co.za">
  <meta property="og:type" content="website">



  <title>Sign Up | Universite – Find & Compare Courses Free</title>
  <link rel="stylesheet" href="assets/web/assets/mobirise-icons2/mobirise2.css">
  <link rel="stylesheet" href="assets/bootstrap/css/bootstrap.min.css">
  <link rel="stylesheet" href="assets/bootstrap/css/bootstrap-grid.min.css">
  <link rel="stylesheet" href="assets/bootstrap/css/bootstrap-reboot.min.css">
  <link rel="stylesheet" href="assets/animatecss/animate.css">
  <link rel="stylesheet" href="assets/dropdown/css/style.css">
  <link rel="stylesheet" href="assets/socicon/css/styles.css">
  <link rel="stylesheet" href="assets/theme/css/style.css">
  <link rel="preload" href="https://fonts.googleapis.com/css?family=Poppins:100,100i,200,200i,300,300i,400,400i,500,500i,600,600i,700,700i,800,800i,900,900i&display=swap" as="style" onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Poppins:100,100i,200,200i,300,300i,400,400i,500,500i,600,600i,700,700i,800,800i,900,900i&display=swap"></noscript>
  <link rel="preload" href="https://fonts.googleapis.com/css?family=Montserrat:100,200,300,400,500,600,700,800,900,100i,200i,300i,400i,500i,600i,700i,800i,900i&display=swap" as="style" onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Montserrat:100,200,300,400,500,600,700,800,900,100i,200i,300i,400i,500i,600i,700i,800i,900i&display=swap"></noscript>
  <link rel="preload" href="https://fonts.googleapis.com/css?family=Roboto+Slab:100,200,300,400,500,600,700,800,900&display=swap" as="style" onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Roboto+Slab:100,200,300,400,500,600,700,800,900&display=swap"></noscript>
  <link rel="preload" href="https://fonts.googleapis.com/css?family=Nunito:200,300,400,500,600,700,800,900,200i,300i,400i,500i,600i,700i,800i,900i&display=swap" as="style" onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Nunito:200,300,400,500,600,700,800,900,200i,300i,400i,500i,600i,700i,800i,900i&display=swap"></noscript>
  <link rel="preload" href="https://fonts.googleapis.com/css?family=Quicksand:300,400,500,600,700&display=swap" as="style" onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Quicksand:300,400,500,600,700&display=swap"></noscript>
  <link rel="preload" as="style" href="assets/mobirise/css/mbr-additional.css?v=mjqTLc"><link rel="stylesheet" href="assets/mobirise/css/mbr-additional.css?v=mjqTLc" type="text/css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">

  <script src="assets/js/signup.min.js"></script>
  <script src="assets/js/signup.min.js"></script>
  <link rel="stylesheet" href="assets/css/signup.min.css">
</head>
<body style="background-color: #f2f4f8;font-family: 'Poppins', sans-serif;">
  <?php include_once "nav.php"; ?><br><br>
  <div class="signup-container">
    <h1>Sign Up with Google or Apple</h1>

    <div class="social-login-buttons">
      <!-- Google Sign-In -->
      <div id="g_id_onload"
           data-client_id="435540089443-trqmc9iaq288jmvkb9t304tsmrlshikg.apps.googleusercontent.com"
           data-callback="handleGoogleLogin">
      </div>
      <div class="g_id_signin" data-type="standard"></div>

      <!-- Apple Sign-In -->
      <div id="appleid-signin"
           data-type="sign in"
           data-color="black"
           data-border="true"
           data-border-radius="8"
           data-width="200">
      </div>
    </div>
  </div>
  <script src="assets/js/signup.min.js"></script>
<?php include_once "footer.php"; ?>
