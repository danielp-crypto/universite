<!DOCTYPE html>
<html>
<head>
    <title>Send Notification</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <link rel="stylesheet" href="assets/css/admin.min.css">
</head>
<body>
    <div class="card">
        <h2><i class="fas fa-bullhorn"></i>Send Notification</h2>
        <form action="save_notification.php" method="POST">
            <textarea name="message" required placeholder="Enter your message..."></textarea><br>
            <button type="submit">Send</button>
        </form>
    </div>
</body>
</html>
