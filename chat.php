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
a {text-decoration:none;color:white;}
a:visited {
color: inherit; /* Inherits color from parent element */
text-decoration: none; /* Optional: remove underline */
}
/* Chat container */
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 80vh;
  background-color: #ffffff;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  overflow: hidden;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

/* Header */
.card-header {
  background-color: #0d6efd;
  color: #fff;
  font-weight: 600;
  font-size: 1.2rem;
  padding: 1rem 1.5rem;
  user-select: none;
}

/* Chat messages container */
#chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.5rem;
  background-color: #f8f9fa;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 transparent;
}

/* Scrollbar for Webkit browsers */
#chat-messages::-webkit-scrollbar {
  width: 8px;
}

#chat-messages::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
  border-radius: 4px;
}

#chat-messages::-webkit-scrollbar-track {
  background: transparent;
}

/* Message bubble base style */
.chat-bubble {
  max-width: 75%;
  padding: 0.75rem 1.2rem;
  border-radius: 1.5rem;
  line-height: 1.4;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  word-wrap: break-word;
  white-space: pre-wrap;
  font-size: 1rem;
}

/* User message bubble */
.chat-user {
  background-color: #0d6efd;
  color: #fff;
  align-self: flex-end;
  border-bottom-right-radius: 0.2rem;
  animation: fadeIn 0.3s ease forwards;
}

/* Bot message bubble */
.chat-bot {
  background-color: #e2e3e5;
  color: #333;
  align-self: flex-start;
  border-bottom-left-radius: 0.2rem;
  animation: fadeIn 0.3s ease forwards;
}

/* Typing indicator bubble */
.typing-bubble {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 0.5rem 1rem;
  background-color: #e2e3e5;
  color: #6c757d;
  border-radius: 1.5rem;
  max-width: 60px;
  justify-content: center;
}

/* Animated dots for typing indicator */
.typing-bubble .dot {
  width: 9px;
  height: 9px;
  background-color: #6c757d;
  border-radius: 50%;
  animation: blink 1.4s infinite both;
}

.typing-bubble .dot:nth-child(2) { animation-delay: 0.2s; }
.typing-bubble .dot:nth-child(3) { animation-delay: 0.4s; }

/* Blink animation */
@keyframes blink {
  0%, 80%, 100% { opacity: 0.2; transform: scale(1); }
  40% { opacity: 1; transform: scale(1.3); }
}

/* Footer with input form */
.card-footer {
  padding: 1rem 1.5rem;
  background-color: #fff;
  border-top: 1px solid #dee2e6;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

/* Chat input */
#chat-input {
  flex: 1 1 auto;
  min-width: 0;
  padding: 0.75rem 1rem;
  border-radius: 9999px;
  border: 1px solid #ced4da;
  font-size: 1rem;
  transition: border-color 0.3s;
}

#chat-input:focus {
  outline: none;
  border-color: #0d6efd;
  box-shadow: 0 0 4px rgba(13, 110, 253, 0.5);
}

/* Submit button */
#chat-form button {
  background-color: #0d6efd;
  border: none;
  padding: 0.75rem 1.25rem;
  color: white;
  font-size: 1.1rem;
  border-radius: 9999px;
  cursor: pointer;
  transition: background-color 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
}

#chat-form button:hover:not(:disabled) {
  background-color: #0848c8;
}

#chat-form button:disabled {
  background-color: #a5b8f6;
  cursor: not-allowed;
}

/* Inline code styling */
.inline-code {
  background-color: #f1f1f1;
  font-family: monospace;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.95em;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .chat-container {
    max-height: 60vh;
  }

  #chat-input {
    font-size: 1rem;
  }

  #chat-form button {
    padding: 0.5rem 1rem;
    font-size: 1rem;
  }
}

/* Fade in animation */
@keyframes fadeIn {
  from {opacity: 0; transform: translateY(10px);}
  to {opacity: 1; transform: translateY(0);}
}
/* Entire main area behaves like a chat app */
.main {
  display: flex;
  flex-direction: column;
  height: 100vh;
  margin-left: 250px;
  padding: 0;
}

/* Chat wrapper takes full height */
.chat-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: #f9fafb;
}

/* Header stays at the top */
.chat-header {
  padding: 1rem 1.5rem;
  background-color: #0d6efd;
  color: #fff;
  font-weight: bold;
}

/* Scrollable chat messages */
.chat-body {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background-color: #f8f9fa;
}

/* Input stays at bottom */
.chat-input-bar {
  display: flex;
  padding: 1rem;
  border-top: 1px solid #ddd;
  background-color: #fff;
}

.chat-input-bar input {
  flex: 1;
  padding: 0.75rem 1rem;
  border-radius: 9999px;
  border: 1px solid #ccc;
  font-size: 1rem;
  margin-right: 0.5rem;
}

.chat-input-bar button {
  background-color: #0d6efd;
  color: #fff;
  border: none;
  padding: 0.75rem 1.25rem;
  border-radius: 9999px;
  cursor: pointer;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
}

.chat-input-bar button:hover {
  background-color: #0848c8;
}

.chat-bubble {
  max-width: 75%;
  padding: 0.75rem 1rem;
  border-radius: 1.5rem;
  font-size: 1rem;
  line-height: 1.4;
  word-break: break-word;
}

.chat-user {
  align-self: flex-end;
  background-color: #0d6efd;
  color: white;
}

.chat-bot {
  align-self: flex-start;
  background-color: #e2e3e5;
  color: #333;
}
@media (max-width: 768px) {
.main {
margin-left: 0;
margin-top: 150px; /* adjust if needed */
}
}
  </style>
</head>
<body><br>
  <div class="container">
    <nav>
      <div class="logo">  <img src="assets/images/new-logo-white-removebg-preview.png-1-192x192.png" alt="Universite logo" style="height: 5rem;"></div>
      <div class="sidebar">
        <a href="profile.php" class="nav-item"><i class="fas fa-user"></i><?= htmlspecialchars($student['name']) ?>
        </a>


        <a href="recommendations.php" class="nav-item"><i class="fas fa-book"></i> Courses</a>
        <a href="chat.php" class="nav-item active"><i class="fas fa-robot"></i> AI chat</a>
        <a href="market.php" class="nav-item"><i class="fas fa-store"></i> Marketplace</a>
        <a href="logout.php" class="nav-item"><i class="fas fa-sign-out-alt"></i> Sign out</a>
      </div>
    </nav>


      <script src="assets/bootstrap/js/bootstrap.bundle.min.js"></script>
      <script>
        const form = document.getElementById('chat-form');
        const input = document.getElementById('chat-input');
        const messages = document.getElementById('chat-messages');

        form.addEventListener('submit', async function (e) {
          e.preventDefault();
          let userMsg = input.value.trim();
          if (!userMsg) return;

          userMsg = sanitizeInput(userMsg);
          appendMessage(userMsg, 'user');
          input.value = '';

          appendTypingIndicator();

          try {
            const response = await fetch("http://localhost:5000/chat", {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ message: userMsg })
            });

            removeTypingIndicator();

            const data = await response.json();
            appendMessage(data.reply || "⚠️ No reply from the server.", 'bot');
          } catch (error) {
            console.error("Fetch error:", error);
            removeTypingIndicator();
            appendMessage("❌ Error connecting to the chatbot server.", 'bot');
          }
        });

        function appendMessage(message, sender) {
          const div = document.createElement('div');
          div.className = sender === 'user' ? 'text-end d-flex justify-content-end' : 'text-start d-flex justify-content-start';

          const bubble = document.createElement('div');
          bubble.className = `chat-bubble ${sender === 'user' ? 'chat-user' : 'chat-bot'}`;
          bubble.innerHTML = formatMessageHTML(message);

          div.appendChild(bubble);
          messages.appendChild(div);
          messages.scrollTop = messages.scrollHeight;
        }

        function appendTypingIndicator() {
          const div = document.createElement('div');
          div.className = 'text-start d-flex justify-content-start';
          div.id = 'typing-indicator';

          const bubble = document.createElement('div');
          bubble.className = 'chat-bubble chat-bot typing-bubble';
          bubble.innerHTML = `<span class="dot"></span><span class="dot"></span><span class="dot"></span>`;

          div.appendChild(bubble);
          messages.appendChild(div);
          messages.scrollTop = messages.scrollHeight;
        }

        function removeTypingIndicator() {
          const indicator = document.getElementById('typing-indicator');
          if (indicator) indicator.remove();
        }

        function sanitizeInput(input) {
          const div = document.createElement('div');
          div.textContent = input;
          return div.innerHTML;
        }

        function formatMessageHTML(message) {
      // Basic formatting using regex
      let html = message
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>")
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")      // bold
        .replace(/\*(.*?)\*/g, "<em>$1</em>")                  // italic
        .replace(/`(.*?)`/g, '<code class="inline-code">$1</code>')  // inline code

        // ✅ Markdown-style links [text](url)
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

      return html;
      }

        }


      </script>
      <main class="main">
        <div class="chat-wrapper">
          <!-- Header -->
          <div class="chat-header">
            <label class="display-5">AI Chat Assistant</label>
          </div>

          <!-- Chat Messages -->
          <div id="chat-messages" class="chat-body">
            <div class="chat-bot chat-bubble">Hello! How can I help you today? Are you looking for information about college admissions, financial aid, study tips, or help with coursework? Let me know what you need, and I'll do my best to assist you!</div>
          </div>

          <!-- Chat Input -->
          <form id="chat-form" class="chat-input-bar">
            <input type="text" id="chat-input" placeholder="Ask anything..." required />
            <button type="submit"><i class="fas fa-paper-plane"></i></button>
          </form>
        </div>
      </main>




    </div>

    </main>
  </div>
</body>
</html>
