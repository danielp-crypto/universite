<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);

// For large CSVs
ini_set('memory_limit', '512M');
ini_set('max_execution_time', '300');

require 'db2.php'; // Ensure this uses charset=utf8mb4 in DSN

// Safely truncate admissions table
try {
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");
    $pdo->exec("TRUNCATE TABLE admissions");
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
} catch (PDOException $e) {
    die("❌ Error truncating table: " . $e->getMessage());
}

// Check CSV file
$csvPath = 'adm2023.csv';
if (!file_exists($csvPath)) {
    die("❌ CSV file not found at path: $csvPath");
}

// Open CSV file
if (($csvFile = fopen($csvPath, 'r')) === false) {
    die("❌ Failed to open CSV file.");
}

fgetcsv($csvFile); // Skip header

// Clean function for UTF-8 and NULL handling
function clean($value) {
    $v = trim($value);
    $v = mb_convert_encoding($v, 'UTF-8', 'Windows-1252');
    return ($v === '' || strtoupper($v) === 'NULL') ? null : $v;
}

// Prepare SQL insert
$sql = "INSERT INTO admissions (
    UNITID, ADMCON1, ADMCON2, ADMCON3, ADMCON4, ADMCON5,
    ADMCON6, ADMCON7, ADMCON8, ADMCON9, ACTEN50, ACTMT50
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
$stmt = $pdo->prepare($sql);

// Import rows
$rowCount = 0;
try {
    while (($row = fgetcsv($csvFile)) !== false) {
        if (count($row) < 99) continue; // Skip incomplete rows

        $stmt->execute([
            clean($row[0]),  // UNITID
            clean($row[1]),  // ADMCON1
            clean($row[2]),  // ADMCON2
            clean($row[3]),  // ADMCON3
            clean($row[4]),  // ADMCON4
            clean($row[5]),  // ADMCON5
            clean($row[6]),  // ADMCON6
            clean($row[7]),  // ADMCON7
            clean($row[8]),  // ADMCON8
            clean($row[9]),  // ADMCON9
            is_numeric($row[94]) ? $row[94] : null, // ACTEN50
            is_numeric($row[98]) ? $row[98] : null  // ACTMT50
        ]);

        $rowCount++;
    }

    fclose($csvFile);
    echo "✅ Imported $rowCount admissions records successfully.\n";

} catch (PDOException $e) {
    echo "❌ DB Error on row $rowCount: " . $e->getMessage() . "\n";
    fclose($csvFile);
}
?>



