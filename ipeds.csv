<?php
$mysqli = new mysqli('localhost', 'root', 'NewSecurePassword123!', 'mydb');
if ($mysqli->connect_error) die("DB error: ".$mysqli->connect_error);

$file = fopen('ipeds.csv', 'r');
$header = fgetcsv($file); // capture headers

// Map column indices
$idx = array_flip($header);

while ($row = fgetcsv($file)) {
    $unitid = intval($row[$idx['UNITID']]);
    $year = $row[$idx['YEAR']];
    $name = $row[$idx['INSTNM']];
    $state = $row[$idx['STABBR']];
    $adm = is_numeric($row[$idx['ADM_RATE']]) ? (float)$row[$idx['ADM_RATE']] : null;
    $enroll = is_numeric($row[$idx['EFTOTLT']]) ? intval($row[$idx['EFTOTLT']]) : null;
    $sat = is_numeric($row[$idx['SAT_AVG']]) ? intval($row[$idx['SAT_AVG']]) : null;
    $act = is_numeric($row[$idx['ACTCMMID']]) ? intval($row[$idx['ACTCMMID']]) : null;

    $stmt = $mysqli->prepare("
      INSERT INTO ipeds_colleges
      (unitid, year, institution_name, state, admission_rate,
       fall_enrollment, SAT_avg, ACT_avg)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
      admission_rate=VALUES(admission_rate),
      fall_enrollment=VALUES(fall_enrollment),
      SAT_avg=VALUES(SAT_avg),
      ACT_avg=VALUES(ACT_avg)
    ");
    $stmt->bind_param("isssdiis", $unitid, $year, $name, $state, $adm, $enroll, $sat, $act);
    $stmt->execute();
}
fclose($file);
echo "Imported " . $mysqli->affected_rows . " rows.\n";
