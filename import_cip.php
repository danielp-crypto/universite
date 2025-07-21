<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require 'db2.php'; // Ensure this file creates a valid PDO connection with UTF8MB4 charset

$csvFilePath = 'CIPCode2020.csv';

if (!file_exists($csvFilePath)) {
    die("❌ CSV file not found at path: $csvFilePath\n");
}

$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

try {
    $csvFile = fopen($csvFilePath, 'r');
    if (!$csvFile) {
        throw new Exception("Failed to open CSV file.");
    }

    // Skip the header
    fgetcsv($csvFile);

    // Helper to clean strange Excel formatting like ="01.0101"
    function clean($value) {
        $value = preg_replace('/^=?"?([^"]+)"?$/', '$1', $value);
        return trim($value);
    }

    $sql = "INSERT IGNORE INTO cip_codes (CIPCODE, CIPTITLE) VALUES (?, ?)";
    $stmt = $pdo->prepare($sql);

    $rowCount = 0;
    while (($row = fgetcsv($csvFile)) !== false) {
        if (count($row) < 5) continue; // Make sure we have at least 5 columns

        $cipcode = clean($row[1]);   // CIPCode is in column index 1
        $ciptitle = clean($row[4]);  // CIPTitle is in column index 4

        if ($cipcode === '' || $ciptitle === '') continue; // Skip blanks

        $stmt->execute([$cipcode, $ciptitle]);
        $rowCount++;
    }

    fclose($csvFile);
    echo "✅ Successfully imported $rowCount CIP codes.\n";

} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    if (isset($csvFile) && is_resource($csvFile)) {
        fclose($csvFile);
    }
    exit(1);
}
