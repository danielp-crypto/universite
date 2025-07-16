<?php
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require 'vendor/autoload.php';

function sendResetEmail($toEmail, $resetLink) {
    $mail = new PHPMailer(true);

    try {
        // SMTP Configuration
        $mail->isSMTP();
        $mail->Host       = 'smtp.gmail.com'; // or SES SMTP endpoint
        $mail->SMTPAuth   = true;
        $mail->Username   = 'your@gmail.com'; // your Gmail address
        $mail->Password   = 'your-app-password'; // use an App Password
        $mail->SMTPSecure = 'tls';
        $mail->Port       = 587;

        // Email Settings
        $mail->setFrom('enterprisewebtech@gmail.com', 'Universite Support');
        $mail->addAddress($toEmail);
        $mail->isHTML(true);
        $mail->Subject = 'Your Password Reset Request';

        $mail->Body = "
            <html>
            <body>
                <p>Hello,</p>
                <p>To reset your password, click the link below:</p>
                <p><a href='$resetLink'>$resetLink</a></p>
                <p>If you didn't request this, please ignore this email.</p>
            </body>
            </html>
        ";

        $mail->send();
        return true;
    } catch (Exception $e) {
        error_log("Mailer Error: {$mail->ErrorInfo}");
        return false;
    }
}

// Example usage:
sendResetEmail('recipient@example.com', 'https://yourdomain.com/reset-password?token=abc123');
?>
