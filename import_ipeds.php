<?php
$host = 'localhost';
$db = 'mydb';
$user = 'root';
$pass = 'NewSecurePassword123!';

$mysqli = new mysqli($host, $user, $pass, $db);
if ($mysqli->connect_errno) {
    die("Failed to connect to MySQL: " . $mysqli->connect_error);
}

$csvFile = 'Most-Recent-Cohorts-Institution_05192025.csv';
$handle = fopen($csvFile, 'r');
if ($handle === false) {
    die("Could not open the CSV file.");
}

// Read and clean header row
$header = array_map('trim', fgetcsv($handle));
$header[0] = preg_replace('/^\xEF\xBB\xBF/', '', $header[0]); // Remove BOM

// Map of CSV -> database fields
$columns = [
    'unitid' => 'UNITID',
    'institution_name' => 'INSTNM',
    'state' => 'STABBR',
    'admission_rate' => 'ADM_RATE',
    'SAT_avg' => 'SAT_AVG',
    'ACT_avg' => 'ACTCMMID'
];

// Get indexes
$colIndex = [];
foreach ($columns as $key => $csvCol) {
    $index = array_search($csvCol, $header);
    if ($index === false) {
        die("Missing column in CSV: $csvCol");
    }
    $colIndex[$key] = $index;
}

// Prepare insert
$stmt = $mysqli->prepare("
    INSERT INTO ipeds_data (
        unitid, year, institution_name, state, admission_rate, SAT_avg, ACT_avg
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
        year=VALUES(year),
        institution_name=VALUES(institution_name),
        state=VALUES(state),
        admission_rate=VALUES(admission_rate),
        SAT_avg=VALUES(SAT_avg),
        ACT_avg=VALUES(ACT_avg)
");

$year = '2024-2025';
$rowCount = 0;

while (($row = fgetcsv($handle)) !== false) {
    $unitid = (int) $row[$colIndex['unitid']];
    $institution_name = $row[$colIndex['institution_name']];
    $state = $row[$colIndex['state']];
    $admission_rate = is_numeric($row[$colIndex['admission_rate']]) ? (float) $row[$colIndex['admission_rate']] : null;
    $SAT_avg = is_numeric($row[$colIndex['SAT_avg']]) ? (int) $row[$colIndex['SAT_avg']] : null;
    $ACT_avg = is_numeric($row[$colIndex['ACT_avg']]) ? (int) $row[$colIndex['ACT_avg']] : null;

    $stmt->bind_param("isssdii", $unitid, $year, $institution_name, $state, $admission_rate, $SAT_avg, $ACT_avg);
    $stmt->execute();
    $rowCount++;
}

fclose($handle);
$stmt->close();
$mysqli->close();

echo "Import complete. $rowCount rows inserted or updated.\n";
?>
