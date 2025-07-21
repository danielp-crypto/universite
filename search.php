<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);
require 'db.php';

$q = trim($_GET['q'] ?? '');

$results = [];
if ($q !== '') {
    $sql = "
    SELECT DISTINCT
      i.INSTNM,
      i.CITY,
      i.STABBR,
      c.CIPCODE,
      cc.CIPTITLE,
      c.AWLEVEL,
      a.ACTEN50,
      a.ACTMT50,
      a.ADMCON1, a.ADMCON2, a.ADMCON3, a.ADMCON4, a.ADMCON5, a.ADMCON6, a.ADMCON7, a.ADMCON8, a.ADMCON9
    FROM courses c
    JOIN institutions i ON i.UNITID = c.UNITID
    LEFT JOIN admissions a ON i.UNITID = a.UNITID
    LEFT JOIN cip_codes cc 
      ON REPLACE(TRIM(c.CIPCODE), '.', '') = REPLACE(TRIM(cc.CIPCODE), '.', '')
    WHERE 
      REPLACE(c.CIPCODE, '.', '') LIKE REPLACE(:codeQuery, '.', '')
      OR LOWER(cc.CIPTITLE) LIKE LOWER(:titleQuery)
    ORDER BY i.INSTNM
    LIMIT 100
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':codeQuery' => '%' . $q . '%',
        ':titleQuery' => '%' . $q . '%',
    ]);
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function format_awlevel($level) {
    $map = [
        1 => 'Certificate',
        2 => 'Associate',
        3 => 'Associate+',
        4 => 'Bachelor’s Prep',
        5 => 'Bachelor’s',
        6 => 'Post-Bachelor’s',
        7 => 'Master’s',
        8 => 'Post-Master’s',
        17 => 'Doctoral',
    ];
    return $map[$level] ?? $level;
}

function format_adm_conditions($row) {
    $conditions = [];
    for ($i = 1; $i <= 9; $i++) {
        if (!empty($row["ADMCON$i"])) {
            $conditions[] = "ADMCON$i";
        }
    }
    return $conditions ? implode(', ', $conditions) : 'N/A';
}
?>
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>🎓 Search Courses by Name or CIP Code</title>
  <style>
    body { font-family: Arial; padding: 30px; }
    input { padding: 6px; width: 300px; }
    button { padding: 6px 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 8px; border: 1px solid #ccc; }
    th { background: #eee; }
  </style>
</head>
<body>
  <h1>🎓 Find Institutions Offering a Course</h1>
  <form method="GET">
    <input type="text" name="q" placeholder="Enter course name or CIP code" value="<?= htmlspecialchars($q) ?>">
    <button type="submit">Search</button>
  </form>

  <?php if ($q !== ''): ?>
    <h2>Results (<?= count($results) ?> found)</h2>
    <?php if ($results): ?>
      <table>
        <tr>
          <th>Institution</th>
          <th>Location</th>
          <th>Course Title</th>
          <th>CIP Code</th>
          <th>Award Level</th>
          <th>ACT English</th>
          <th>ACT Math</th>
          <th>Admission Requirements</th>
        </tr>
        <?php foreach ($results as $row): ?>
        <tr>
          <td><?= htmlspecialchars($row['INSTNM']) ?></td>
          <td><?= htmlspecialchars($row['CITY']) ?>, <?= htmlspecialchars($row['STABBR']) ?></td>
          <td><?= htmlspecialchars($row['CIPTITLE'] ?? '[No Title Found]') ?></td>
          <td><?= htmlspecialchars($row['CIPCODE']) ?></td>
          <td><?= format_awlevel($row['AWLEVEL']) ?></td>
          <td><?= htmlspecialchars($row['ACTEN50']) ?></td>
          <td><?= htmlspecialchars($row['ACTMT50']) ?></td>
          <td><?= format_adm_conditions($row) ?></td>
        </tr>
        <?php endforeach; ?>
      </table>
    <?php else: ?>
      <p>No institutions offer a course matching “<strong><?= htmlspecialchars($q) ?></strong>”.</p>
    <?php endif; ?>
  <?php endif; ?>
</body>
</html>




