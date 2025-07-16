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
.flashcard-wrapper {
  perspective: 1000px;
}

.flashcard-inner {
  transform-style: preserve-3d;
  transition: transform 0.6s;
  position: relative;
  width: 100%;
  height: 100%;
}

.flashcard.flipped .flashcard-inner {
  transform: rotateY(180deg);
}

.flashcard-front,
.flashcard-back {
  backface-visibility: hidden;
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  font-weight: 500;
  font-size: 1.1rem;
  background-color: white;
}

.flashcard-back {
  transform: rotateY(180deg);
  background-color: #fef9c3;
}

  </style>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="style.css" />
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
        <a href="logout.php" class="nav-item"><i class="fas fa-sign-out-alt"></i> Sign out</a>
      </div>
    </nav>

    <main class="main">
      <h1 class="text-3xl font-bold text-blue-700 mb-6">Learn faster Flashcards</h1>

  <div class="flex flex-col items-center w-full">
    <textarea id="input" class="w-full max-w-2xl p-4 border-2 border-blue-300 rounded-xl mb-4 shadow focus:outline-none focus:ring-2 focus:ring-blue-500" rows="4" placeholder="Enter a topic, notes, or questions..."></textarea>
    <button id="generateBtn" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-xl shadow-lg transition-all mb-2">
      ✨ Generate Flashcards
    </button>
  </div>

  <div id="flashcardContainer" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mt-10 w-full max-w-5xl px-2">
    <!-- Flashcards will be inserted here -->
  </div>

       <script>
       <script>
  const generateBtn = document.getElementById('generateBtn');
  const flashcardContainer = document.getElementById('flashcardContainer');

  generateBtn.addEventListener('click', () => {
    const inputText = document.getElementById('input').value.trim();

    if (!inputText) {
      alert('Please enter a topic or notes.');
      return;
    }

    flashcardContainer.innerHTML = '';

    const fakeFlashcards = [
      { question: 'What is the capital of France?', answer: 'Paris' },
      { question: 'What is the largest planet?', answer: 'Jupiter' },
      { question: 'Who discovered gravity?', answer: 'Isaac Newton' }
    ];

    fakeFlashcards.forEach(({ question, answer }) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'flashcard-wrapper w-full h-48';

      const card = document.createElement('div');
      card.className = 'flashcard w-full h-full cursor-pointer relative rounded-xl';
      card.innerHTML = `
        <div class="flashcard-inner">
          <div class="flashcard-front">${question}</div>
          <div class="flashcard-back">${answer}</div>
        </div>
      `;

      card.addEventListener('click', () => {
        card.classList.toggle('flipped');
      });

      wrapper.appendChild(card);
      flashcardContainer.appendChild(wrapper);
    });
  });
</script>

       </script>
    </main>
  </div>
</body>
</html>
