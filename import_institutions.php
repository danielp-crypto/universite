
<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);

// Optional for large files (CLI mode)
ini_set('memory_limit', '512M');
ini_set('max_execution_time', '300'); // 5 minutes

require 'db2.php'; // Make sure db2.php uses charset=utf8mb4 in DSN

// Safely truncate table while respecting foreign keys
try {
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");
    $pdo->exec("TRUNCATE TABLE institutions");
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
} catch (PDOException $e) {
    die("❌ Error truncating table: " . $e->getMessage());
}

// Check if CSV exists
$csvPath = 'hd2023.csv';
if (!file_exists($csvPath)) {
    die("❌ CSV file not found at path: $csvPath");
}

// Open CSV
if (($csvFile = fopen($csvPath, 'r')) === false) {
    die("❌ Failed to open CSV file.");
}

fgetcsv($csvFile); // Skip header row

// Clean helper for encoding + NULL handling
function clean($value) {
    $v = trim($value);

    // Convert from Windows-1252 to UTF-8 (common for IPEDS files)
    $v = mb_convert_encoding($v, 'UTF-8', 'Windows-1252');

    // Replace known problematic characters
    $v = str_replace(
        ["\x91", "\x92", "\x93", "\x94", "\x96", "\x97"],
        ["'", "'", '"', '"', "-", "--"],
        $v
    );

    return ($v === '' || strtoupper($v) === 'NULL') ? null : $v;
}

// Prepare insert statement (without IALIAS)
$sql = "INSERT INTO institutions (
    UNITID, INSTNM, ADDR, CITY, STABBR, ZIP, LATITUDE, LONGITUD
) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
$stmt = $pdo->prepare($sql);

// Read and insert CSV data
$rowCount = 0;
try {
    while (($row = fgetcsv($csvFile)) !== false) {
        if (count($row) < 73) continue; // Skip malformed rows

        $stmt->execute([
            clean($row[0]),   // UNITID
            clean($row[1]),   // INSTNM
            clean($row[3]),   // ADDR
            clean($row[4]),   // CITY
            clean($row[5]),   // STABBR
            clean($row[6]),   // ZIP
            clean($row[72]),  // LATITUDE
            clean($row[71])   // LONGITUD
        ]);
        $rowCount++;
    }

    fclose($csvFile);
    echo "✅ Imported $rowCount institutions successfully.\n";

} catch (PDOException $e) {
    echo "❌ DB Error on row $rowCount: " . $e->getMessage() . "\n";
    fclose($csvFile);
}
?>
