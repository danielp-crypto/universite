<!DOCTYPE html>
<html>
<head>
    <title>Send Notification</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <style>
        body {
            background: #f3f4f6;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .card {
            background: #fff;
            border-radius: 16px;
            box-shadow: 0 4px 24px rgba(31,41,55,0.10);
            padding: 2.5rem 2rem 2rem 2rem;
            max-width: 400px;
            width: 100%;
            margin: 2rem auto;
        }
        h2 {
            text-align: center;
            color: #2563eb;
            margin-bottom: 1.5rem;
        }
        textarea {
            width: 100%;
            min-height: 100px;
            border-radius: 8px;
            border: 1px solid #d1d5db;
            padding: 1rem;
            font-size: 1rem;
            margin-bottom: 1.5rem;
            resize: vertical;
            background: #f9fafb;
            transition: border 0.2s;
        }
        textarea:focus {
            border: 1.5px solid #2563eb;
            outline: none;
            background: #fff;
        }
        button[type="submit"] {
            background: #2563eb;
            color: #fff;
            border: none;
            border-radius: 8px;
            padding: 0.75rem 2rem;
            font-size: 1.1rem;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(31,41,55,0.08);
            transition: background 0.2s, transform 0.2s;
            width: 100%;
        }
        button[type="submit"]:hover {
            background: #1d4ed8;
            transform: translateY(-2px);
        }
        .fa-bullhorn {
            color: #2563eb;
            margin-right: 0.5rem;
        }
    </style>
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
