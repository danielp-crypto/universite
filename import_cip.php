<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require 'db2.php'; // Make sure this connects with PDO and sets utf8mb4 charset

$csvFilePath = 'CIPCode2010.csv';

if (!file_exists($csvFilePath)) {
    die("❌ CSV file not found at path: $csvFilePath\n");
}

$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

try {
    $csvFile = fopen($csvFilePath, 'r');
    if (!$csvFile) {
        throw new Exception("Failed to open CSV file.");
    }

    // Skip header row
    fgetcsv($csvFile);

    // Clean function to fix Excel exported codes like ="01.0101"
    function clean($value) {
        $value = preg_replace('/^="(.*)"$/', '$1', $value);
        return trim($value);
    }

    $sql = "INSERT IGNORE INTO cip_codes (CIPCODE, CIPTITLE) VALUES (?, ?)";
    $stmt = $pdo->prepare($sql);

    $rowCount = 0;
    while (($row = fgetcsv($csvFile)) !== false) {
        if (count($row) < 2) continue; // skip malformed rows

        $cipcode = clean($row[0]);
        $ciptile = clean($row[1]);

        if ($cipcode === '' || $ciptile === '') continue; // skip empty rows

        $stmt->execute([$cipcode, $ciptile]);
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
