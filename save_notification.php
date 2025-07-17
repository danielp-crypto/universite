<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
require 'db.php'; // Make sure this sets up $pdo (PDO connection)

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $message = trim($_POST['message']);
    $user_email = !empty($_POST['user_email']) ? trim($_POST['user_email']) : null;

    if (empty($message)) {
        echo "Message cannot be empty.";
        exit;
    }

    $stmt = $pdo->prepare("INSERT INTO notifications (message, user_email) VALUES (:message, :user_email)");
    $success = $stmt->execute([
        ':message' => $message,
        ':user_email' => $user_email
    ]);

    if ($success) {
        echo "✅ Notification sent successfully!";
    } else {
        echo "❌ Failed to send notification.";
    }
}
?>
<a href="admin.php">Back</a>

