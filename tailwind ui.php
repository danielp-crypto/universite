<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Find Online & University Courses for Students | Compare & Enroll</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Explore top online courses and university programs in one place. Compare options, read reviews, and enroll in the best course for your goals.">
  <link rel="shortcut icon" href="assets/images/icon-removebg-preview.png-128x128.png" type="image/x-icon">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 text-gray-900">
  <div class="flex min-h-screen">
    
    <!-- Sidebar -->
    <nav class="w-64 bg-blue-700 text-white flex flex-col p-6 space-y-6">
      <div class="flex items-center justify-center">
        <img src="assets/images/new-logo-white-removebg-preview.png-1-192x192.png" alt="Universite logo" class="h-20">
      </div>
      <div class="flex flex-col space-y-3">
        <a href="profile.php" class="flex items-center space-x-2 hover:bg-blue-600 p-2 rounded">
          <i class="fas fa-user"></i> 
          <span><?= htmlspecialchars($student['name']) ?></span>
        </a>
        <a href="recommendations.php" class="flex items-center space-x-2 bg-blue-900 p-2 rounded">
          <i class="fas fa-book"></i> 
          <span>Courses</span>
        </a>
        <a href="mycourses.php" class="flex items-center space-x-2 hover:bg-blue-600 p-2 rounded">
          <i class="fas fa-star"></i> 
          <span>Saved Searches</span>
        </a>
        <a href="notifications.php" class="flex items-center space-x-2 hover:bg-blue-600 p-2 rounded relative">
          <i class="fas fa-bell"></i> 
          <span>Notifications</span>
          <?php if ($count > 0): ?>
            <span class="absolute right-2 top-1 bg-red-500 text-white text-xs px-2 py-1 rounded-full"><?= $count ?></span>
          <?php endif; ?>
        </a>
        <a href="logout.php" class="flex items-center space-x-2 hover:bg-blue-600 p-2 rounded">
          <i class="fas fa-sign-out-alt"></i> 
          <span>Sign out</span>
        </a>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="flex-1 p-8">
      
      <!-- Search -->
      <form action="course-search.php" method="get" class="mb-6 flex space-x-2">
        <input type="text" name="myCourse" placeholder="Search for a course" required 
               class="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none">
        <button type="submit" 
                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Search
        </button>
      </form>

      <!-- Recommendations Header -->
      <h2 class="text-2xl font-bold mb-4">Recommended For You</h2>

      <?php if ($location === 'south africa'): ?>
        <?php if ($courses): ?>
          <p class="mb-4 text-gray-700">About <?= $total_records ?> course(s) found</p>
          <div class="grid md:grid-cols-2 gap-6">
            <?php foreach ($courses as $row): ?>
              <div class="bg-white rounded-xl shadow p-6">
                <h3 class="text-lg font-semibold text-gray-800 mb-2"><?= htmlspecialchars($row["programme"]) ?></h3>
                <p><strong>Qualification:</strong> <?= htmlspecialchars($row["certification"]) ?></p>
                <p><strong>Duration:</strong> <?= htmlspecialchars($row["duration"]) ?></p>
                <p><strong>Study Mode:</strong> <?= htmlspecialchars($row["class"]) ?></p>
                <p><strong>Institution:</strong> <?= htmlspecialchars($row["institution"]) ?></p>
                <p><strong>Campus:</strong> <?= htmlspecialchars($row["campus"]) ?></p>
                <p><strong>Minimum APS:</strong> <?= htmlspecialchars($row["aps"]) ?></p>
                <p><strong>Requirements:</strong><br><?= nl2br(htmlspecialchars($row["subjects"])) ?></p>
                <p><strong>Closing Date:</strong> <?= htmlspecialchars($row["date"]) ?></p>
                <a href="<?= htmlspecialchars($row['link']) ?>" target="_blank" 
                   class="inline-block mt-3 text-blue-600 hover:underline">Apply Now</a>
              </div>
            <?php endforeach; ?>
          </div>
        <?php else: ?>
          <p>No course recommendations found. <a href="interests-edit.php" class="text-blue-600 hover:underline">Update your preferences</a>.</p>
        <?php endif; ?>
      <?php else: ?>
        <?php if ($results): ?>
          <p class="mb-4 text-gray-700">About <?= $total_records ?> course(s) found</p>
          <div class="grid md:grid-cols-2 gap-6">
            <?php foreach ($results as $row): ?>
              <div class="bg-white rounded-xl shadow p-6">
                <h3 class="text-lg font-semibold text-gray-800 mb-2"><?= htmlspecialchars($row['CIPTITLE'] ?? '[No Title Found]') ?></h3>
                <p><strong>Institution:</strong> <?= htmlspecialchars($row['INSTNM']) ?></p>
                <p><strong>Location:</strong> <?= htmlspecialchars($row['CITY']) ?>, <?= htmlspecialchars($row['STABBR']) ?></p>
                <p><strong>CIP Code:</strong> <?= htmlspecialchars($row['CIPCODE']) ?></p>
                <p><strong>Award Level:</strong> <?= htmlspecialchars($row['AWLEVEL']) ?></p>
                <p><strong>ACT English:</strong> <?= htmlspecialchars($row['ACTEN50']) ?></p>
                <p><strong>ACT Math:</strong> <?= htmlspecialchars($row['ACTMT50']) ?></p>
                <p><strong>Admission Requirements:</strong> 
                  <?php
                    $adm = [];
                    for ($i = 1; $i <= 9; $i++) {
                      if (!empty($row["ADMCON$i"])) $adm[] = htmlspecialchars($row["ADMCON$i"]);
                    }
                    echo $adm ? implode(', ', $adm) : 'N/A';
                  ?>
                </p>
                <a href="<?= htmlspecialchars($row['webaddr']) ?>" target="_blank" 
                   class="inline-block mt-3 text-blue-600 hover:underline">Apply Now</a>
              </div>
            <?php endforeach; ?>
          </div>
        <?php else: ?>
          <p>No international course recommendations found. <a href="interests-edit.php" class="text-blue-600 hover:underline">Update your preferences</a>.</p>
        <?php endif; ?>
      <?php endif; ?>

      <!-- Pagination -->
      <div class="flex justify-center mt-8 space-x-2">
        <?php if ($page_no > 1): ?>
          <a href="?page_no=<?= $page_no - 1 ?>" 
             class="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300">Previous</a>
        <?php endif; ?>

        <span class="px-3 py-2 bg-gray-100 rounded">Page <?= $page_no ?> of <?= $total_pages ?></span>

        <?php if ($page_no < $total_pages): ?>
          <a href="?page_no=<?= $page_no + 1 ?>" 
             class="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300">Next</a>
        <?php endif; ?>
      </div>

    </main>
  </div>
</body>
</html>
