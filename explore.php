<?php
require 'db.php';
// Search and pagination
$myCourse = isset($_GET['myCourse']) ? $_GET['myCourse'] : '';
$current_page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
$total_records_per_page = 10;
$offset = ($current_page - 1) * $total_records_per_page;

// Get total
$count_sql = "SELECT COUNT(*) AS total FROM courses WHERE programme LIKE :myCourse";
$count_stmt = $pdo->prepare($count_sql);
$count_stmt->execute([':myCourse' => "%$myCourse%"]);
$total_rows = $count_stmt->fetch()['total'];
$total_pages = ceil($total_rows / $total_records_per_page);

// Fetch data
$sql = "SELECT class, campus, certification, programme, duration, aps, institution, subjects, date, link
        FROM courses
        WHERE programme LIKE :myCourse
        ORDER BY aps ASC
        LIMIT :offset, :total_records_per_page";
$data_stmt = $pdo->prepare($sql);
$data_stmt->bindValue(':myCourse', "%$myCourse%", PDO::PARAM_STR);
$data_stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
$data_stmt->bindValue(':total_records_per_page', $total_records_per_page, PDO::PARAM_INT);
$data_stmt->execute();
$result = $data_stmt->fetchAll();
?>
  <!DOCTYPE html>
  <html  >
  <head>
    <!-- Google tag (gtag.js) -->
   <script async src="https://www.googletagmanager.com/gtag/js?id=G-YTT2QHLQC7"></script>
   <script>
     window.dataLayer = window.dataLayer || [];
     function gtag(){dataLayer.push(arguments);}
     gtag('js', new Date());

     gtag('config', 'G-YTT2QHLQC7');
   </script> 
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

    <style>
        body {
            font-family: "Segoe UI", sans-serif;
            margin: 0;
            padding: 0 1rem;
            background-color: #f9f9f9;
        }
        h2 {
            margin-top: 1rem;
        }
        form {
            margin: 1rem 0;
            display: flex;
            gap: 0.5rem;
        }
        input[type="text"] {
            padding: 0.5rem;
            width: 100%;
            max-width: 400px;
            border: 1px solid #ccc;
            border-radius: 4px;
        }
        button {
            padding: 0.5rem 1rem;
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }

        .cards {
            display: flex;
            flex-wrap: wrap;
            gap: 1rem;
            margin-top: 1rem;
        }

        .card {
            background: white;
            padding: 1rem;
            border-radius: 8px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.1);
            flex: 1 1 calc(50% - 1rem);
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }

        .card h3 {
            margin: 0;
            color: #333;
        }

        .card p {
            margin: 0.3rem 0;
            font-size: 0.95rem;
        }

        .card a {
            margin-top: 0.5rem;
            color: #007bff;
            text-decoration: none;
            font-weight: bold;
        }

        .pagination {
            margin: 2rem 0;
            text-align: center;
        }

        .pagination a, .pagination strong {
            margin: 0 4px;
            padding: 6px 12px;
            text-decoration: none;
            border-radius: 4px;
            background: #e9e9e9;
            color: #333;
        }

        .pagination strong {
            background: #007bff;
            color: white;
        }

        @media (max-width: 768px) {
            .card {
                flex: 1 1 100%;
            }
        }
    </style>
</head>
<body>
<?php include_once "nav.php"; ?>
<section class="content5 cid-courses" id="courses-section" style="padding-top: 60px; padding-bottom: 60px;top:50px;background-color: #f9f9f9;">
    <div class="container">
        <div class="mbr-section-head mb-4">

        </div>

        <form method="get" action="" class="d-flex justify-content-center mb-5">
            <input type="text" name="myCourse" class="form-control w-50 me-2" placeholder="Search by programme" value="<?= htmlspecialchars($myCourse) ?>">
            <button type="submit" class="btn btn-primary">Search</button>
        </form>
        <h2 class="mbr-section-title mbr-fonts-style align-center display-5">
            Courses Matching: <?= htmlspecialchars($myCourse) ?>
        </h2>
        <?php if ($result && count($result) > 0): ?>
            <div class="row">
                <?php foreach ($result as $row): ?>
                    <div class="col-md-6 col-lg-6 mb-4">
                        <div class="card p-3 h-100 shadow-sm rounded border-0">
                            <div class="card-body">
                                <h4 class="card-title text-primary"><?= htmlspecialchars($row['programme']) ?></h4>
                                <p class="mbr-text mbr-fonts-style mb-1"><strong>Institution:</strong> <?= htmlspecialchars($row['institution']) ?></p>
                                <p class="mbr-text mbr-fonts-style mb-1"><strong>Campus:</strong> <?= htmlspecialchars($row['campus']) ?></p>
                                <p class="mbr-text mbr-fonts-style mb-1"><strong>Certification:</strong> <?= htmlspecialchars($row['certification']) ?></p>
                                <p class="mbr-text mbr-fonts-style mb-1"><strong>Class:</strong> <?= htmlspecialchars($row['class']) ?></p>
                                <p class="mbr-text mbr-fonts-style mb-1"><strong>Duration:</strong> <?= htmlspecialchars($row['duration']) ?></p>
                                <p class="mbr-text mbr-fonts-style mb-1"><strong>APS:</strong> <?= htmlspecialchars($row['aps']) ?></p>
                                <p class="mbr-text mbr-fonts-style mb-1"><strong>Subjects:</strong> <?= htmlspecialchars($row['subjects']) ?></p>
                                <p class="mbr-text mbr-fonts-style mb-2"><strong>Date:</strong> <?= htmlspecialchars($row['date']) ?></p>
                                <a href="<?= htmlspecialchars($row['link']) ?>" target="_blank" class="btn btn-sm btn-success mt-2">
                                    <i class="fas fa-arrow-right"></i> Apply
                                </a>
                            </div>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>

            <div class="d-flex justify-content-center mt-4">
                <nav>
                    <ul class="pagination">
                        <?php if ($current_page > 1): ?>
                            <li class="page-item"><a class="page-link" href="?myCourse=<?= urlencode($myCourse) ?>&page=<?= $current_page - 1 ?>">« Prev</a></li>
                        <?php endif; ?>

                        <?php for ($i = 1; $i <= $total_pages; $i++): ?>
                            <li class="page-item <?= $i == $current_page ? 'active' : '' ?>">
                                <a class="page-link" href="?myCourse=<?= urlencode($myCourse) ?>&page=<?= $i ?>"><?= $i ?></a>
                            </li>
                        <?php endfor; ?>

                        <?php if ($current_page < $total_pages): ?>
                            <li class="page-item"><a class="page-link" href="?myCourse=<?= urlencode($myCourse) ?>&page=<?= $current_page + 1 ?>">Next »</a></li>
                        <?php endif; ?>
                    </ul>
                </nav>
            </div>
        <?php else: ?>
            <p class="text-center text-muted mt-5">No courses found.</p>
        <?php endif; ?>
    </div>
</section>

<?php $pdo->close(); ?>
<?php include_once "footer.php"; ?>
