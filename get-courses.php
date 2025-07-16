<?php
$host = 'localhost';
$db = 'mydb';
$user = 'root';
$pass = 'NewSecurePassword123!';

$conn = new mysqli($host, $user, $pass, $db);
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

$myCourse = isset($_GET['course']) ? $conn->real_escape_string($_GET['course']) : '';

$sql = "SELECT class, campus, certification, programme, duration, aps, institution, subjects, date, link
        FROM courses
        WHERE programme LIKE '%$myCourse%'
        ORDER BY aps ASC";

$result = $conn->query($sql);

echo '<div class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4">';
if ($result->num_rows > 0) {
    while ($row = $result->fetch_assoc()) {
        echo '
        <div class="col">
            <div class="card h-100 shadow-sm">
                <div class="card-body">
                    <h5 class="card-title">'.htmlspecialchars($row["programme"]).'</h5>
                    <p class="card-text"><strong>Institution:</strong> '.htmlspecialchars($row["institution"]).'</p>
                    <p class="card-text"><strong>Campus:</strong> '.htmlspecialchars($row["campus"]).'</p>
                    <p class="card-text"><strong>Certification:</strong> '.htmlspecialchars($row["certification"]).'</p>
                    <p class="card-text"><strong>Duration:</strong> '.htmlspecialchars($row["duration"]).'</p>
                    <p class="card-text"><strong>APS:</strong> '.htmlspecialchars($row["aps"]).'</p>
                    <p class="card-text"><strong>Subjects:</strong> '.htmlspecialchars($row["subjects"]).'</p>
                    <a href="'.htmlspecialchars($row["link"]).'" class="btn btn-outline-primary" target="_blank">More Info</a>
                </div>
                <div class="card-footer text-muted">
                    Added on '.htmlspecialchars($row["date"]).'
                </div>
            </div>
        </div>';
    }
} else {
    echo '<div class="col"><p>No courses found.</p></div>';
}
echo '</div>';

$conn->close();
?>
