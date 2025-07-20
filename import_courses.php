<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);

// Optional for large files (CLI mode)
ini_set('memory_limit', '512M');
ini_set('max_execution_time', '300'); // 5 minutes

require 'db2.php'; // Ensure this includes charset=utf8mb4 in the DSN

// Safely truncate the table
try {
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");
    $pdo->exec("TRUNCATE TABLE courses");
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
} catch (PDOException $e) {
    die("❌ Error truncating table: " . $e->getMessage());
}

// Check if CSV exists
$csvPath = 'c2023_a.csv';
if (!file_exists($csvPath)) {
    die("❌ CSV file not found at path: $csvPath");
}

// Open CSV file
if (($csvFile = fopen($csvPath, 'r')) === false) {
    die("❌ Failed to open CSV file.");
}

fgetcsv($csvFile); // Skip header row

// Clean function to sanitize and convert values
function clean($value) {
    $v = trim($value);
    $v = mb_convert_encoding($v, 'UTF-8', 'Windows-1252');
    return ($v === '' || strtoupper($v) === 'NULL') ? null : $v;
}

// Prepare SQL insert
$sql = "INSERT INTO courses (UNITID, CIPCODE, MAJORNUM, AWLEVEL)
        VALUES (?, ?, ?, ?)";
$stmt = $pdo->prepare($sql);

$rowCount = 0;
try {
    while (($row = fgetcsv($csvFile)) !== false) {
        if (count($row) < 4) continue; // Skip malformed rows

        $stmt->execute([
            clean($row[0]),
            clean($row[1]),
            clean($row[2]),
            clean($row[3])
        ]);

        $rowCount++;
    }

    fclose($csvFile);
    echo "✅ Imported $rowCount courses successfully.\n";

} catch (PDOException $e) {
    echo "❌ DB Error on row $rowCount: " . $e->getMessage() . "\n";
    fclose($csvFile);
}
?>


