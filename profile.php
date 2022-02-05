<?php 
session_start(); //Add this 
    echo "
<br><br>";
?>

<?php
 

  
$servername = "localhost";
$username = "id17459554_univesyc_phuti";
$password = "jarvisOS141@";
$dbname = "id17459554_univesyc_db";
// Create connection
$conn = new mysqli($servername, $username, $password, $dbname);
// Check connection
if ($conn->connect_error) {
  die("Connection failed: " . $conn->connect_error);
}

$sql = "SELECT email, name, surname, birth, gender, race, cell FROM users WHERE id = '".$_SESSION['id']."'";  
$result = $conn->query($sql);
if ($result->num_rows > 0) {
  // output data of each row
  while($row = $result->fetch_assoc()) {
echo"       
<br>
 <div >
<h4 >Basic Info</h4>
  ";
    echo  " <label>Full name</label>"."<li>".$row['name']." ".$row['surname'] ."</li>" ."<br />";echo"<br>";
    echo  " <label align=left>Date of Birth</label>"."<li>".$row['birth'] ."</li>". "<br />";echo"<br>";
     echo " <label>Gender</label>"."<li>".$row['gender']."</li>" . "<br />";echo"<br>";
       echo " <label>Race</label>"."<li>".$row['race'] ."</li>". "<br />";echo"<br>";
         echo " <label>cell</label>"."<li>0".$row['cell']."</li>" . "<br />";echo"<br>";
       echo " <label>email</label>"."<li>".$row['email'] ."</li>". "<br />";
   echo('<div class="mbr-section-btn"><a class="btn btn-white display-4" href="https://www.universite.tk/profile-edit.php">edit</a></div>'); 
  }
  echo "<br>
      <br>";
 


 
  echo"</div>"; 
} else {
  echo "0 results found .";
}
echo"
<br>
 <div >
<h4 >Academics</h4><br>
<label>Subjects:</label>
  ";

$sql = "SELECT subject, mark FROM subjects WHERE id = '".$_SESSION['id']."'"; 
$result = $conn->query($sql);
if ($result->num_rows > 0) {
  // output data of each row
  while($row = $result->fetch_assoc()) {
      
    echo  " <label></label>"."<li>".$row['subject'].":".$row['mark'] ."</li>" ."<br />";echo"<br>";
   
    
  }
  echo "<br>
      <br>";
 
 

 
  echo"</div>"; 
} else {
  echo "0 results found .";
}
echo"
<br>
<hr>
 <div >
<br>
<label>Aps Scores:</label>
  ";
$sql = "SELECT school, score FROM aps_scores WHERE id = '".$_SESSION['id']."'"; 
$result = $conn->query($sql);
if ($result->num_rows > 0) {
  // output data of each row
  while($row = $result->fetch_assoc()) {
      
    echo  " <label></label>"."<li>".$row['school'].":".$row['score'] ."</li>" ."<br />";echo"<br>";
  }
  echo "<br>
      <br>";

 
  echo"</div>"; 
} else {
  echo "0 results found .";
}
echo"
<br>
<hr>
 <div >
<br>
<label>Course Preferences:</label>
  ";

$sql = "SELECT option1,option2,option3 FROM options WHERE users_id = '".$_SESSION['id']."'"; 
$result = $conn->query($sql);
if ($result->num_rows > 0) {
  // output data of each row
  while($row = $result->fetch_assoc()) {
      
    echo  " <label></label>"."<li>".$row['option1'] ."</li>" ."<br />";echo"<br>";
     echo  " <label></label>"."<li>".$row['option2'] ."</li>" ."<br />";echo"<br>";
     echo  " <label></label>"."<li>".$row['option3'] ."</li>" ."<br />";echo"<br>";
    echo('<div class="mbr-section-btn"><a class="btn btn-white display-4" href="https://www.universite.tk/options-edit.php">edit</a></div>');  
  }
  echo "<br> 
      <br>";
 
 

 
  echo"</div>"; 
} else {
  echo "0 results found .";
}
$sql = "SELECT MAX(score)
FROM aps_scores
WHERE id = '".$_SESSION['id']."'";
$result = $conn->query($sql);
if ($result->num_rows > 0) {
  // output data of each row
  while($row = $result->fetch_assoc()) {
      
   
     $highestaps= $row["MAX(score)"];
    
  }
  echo "<br> 
      <br>";

 
  echo"</div>"; 
} else {
  echo "0 results found .";
}
$sql = "SELECT option1,option2,option3 FROM options WHERE users_id = '".$_SESSION['id']."'";
$result = $conn->query($sql);
if ($result->num_rows > 0) {
  // output data of each row
  while($row = $result->fetch_assoc()) {
      
     $myCourse1= $row["option1"];
      $myCourse2= $row["option2"];
       $myCourse3= $row["option3"];
    
  }
 
} else {
  echo "0 results found .";
}
$sql = "SELECT option1,option2,option3 FROM options WHERE users_id = '".$_SESSION['id']."'"; 
$sql = "SELECT class,certification,programme,duration,aps,institution,subjects,selection, DATE_FORMAT(date, '%d %M %Y')as date FROM courses WHERE aps<=$highestaps AND programme LIKE '%$myCourse1%' OR programme LIKE '%$myCourse2%'  OR programme LIKE '%$myCourse3%'";
$result = $conn->query($sql);
if ($result->num_rows > 0) {
    echo "<h3 align=center>Course Match results:</h3>";
    echo "<div>";
  echo "<table align=center ><tr><th>Study Type</th><th>Certification</th><th>Programme</th><th>Aps</th><th>Institution</th><th>Subjects & Achieved Scale</th><th>Selection Procedures</th><th>Closing Date</th></tr>";
  // output data of each row
  while($row = $result->fetch_assoc()) {
    echo "<tr><td>".$row["class"]."</td><td>".$row["certification"]."</td><td>".$row["programme"]." ".$row["duration"]."</td><td>".$row["aps"]."</td><td>".$row["institution"]."</td><td>".$row["subjects"]."</td><td>".$row["selection"]."</td><td>".$row["date"]."</td></tr>";
  }
  echo "</table></div>";
} else {
    echo"<h3 align=center>Course Matches:</h3>";
  echo "0 results found ";
}
?>

<!DOCTYPE html>
<html  >
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1">
  <link rel="shortcut icon" href="assets/images/portal2.png" type="image/x-icon">
  <meta name="description" content="">
  
  
  <title>Universite | My Profile</title>
  <link rel="stylesheet"
href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css"><link rel="stylesheet" href="assets/tether/tether.min.css">  
<link rel="stylesheet" href="assets/custom/css/styles.css">  <link rel="stylesheet" href="assets/bootstrap/css/bootstrap.min.css">
  <link rel="stylesheet" href="assets/bootstrap/css/bootstrap-grid.min.css">
  <link rel="stylesheet" href="assets/bootstrap/css/bootstrap-reboot.min.css">
  <link rel="stylesheet" href="assets/dropdown/css/style.css">
  <link rel="stylesheet" href="assets/socicon/css/styles.css">
  <link rel="stylesheet" href="assets/theme/css/style.css">
  <link rel="preload" href="https://fonts.googleapis.com/css2?family=Jost:ital,wght@0,400;0,700;1,400;1,700&display=swap&display=swap" as="style" onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jost:ital,wght@0,400;0,700;1,400;1,700&display=swap&display=swap"></noscript>
  <link rel="preload" as="style" href="assets/mobirise/css/mbr-additional.css"><link rel="stylesheet" href="assets/mobirise/css/mbr-additional.css" type="text/css">
 

 
  
   <style type="text/css">
    table {
  border: 3px solid #f1f1f1;
}
td,th {
  border: 1px solid #f1f1f1;
}
    div {
  overflow-x:auto;
}
label {
  float:left;color:grey;text-align:left;
}
h4{ background-color: #DDD;font-family:Arial, calibri; }
li{
  float:right;list-style-type:none;font-weight:bold;
}
    button{font-size:20px;background-color:navy;border:none;color:white;padding:10px 10px;text-decoration:none;margin:4px 2px;cursor:pointer;width:30%;height:100%;border-radius:25px 25px;}
        body{ font:  sans-serif; text-align: center; }
      
 /* Create three unequal columns that floats next to each other */
.column {
  float: left;
  padding: 10px;
  border:solid #DDD;
}

/* Left and right column */
.column.side {
  width: 25%;
}

/* Middle column */
.column.middle {
  width: 65%;
}

/* Clear floats after the columns */
.row:after {
  content: "";
  display: table;
  clear: both;
}

/* Responsive layout - makes the three columns stack on top of each other instead of next to each other */
@media screen and (max-width: 600px) {
  .column.side, .column.middle {
    width: 100%;
  }
}
 
    </style>
</head>
<body>
  <?php include_once "nav.php"; ?> 
  <div class="content">
  <br>
<?php include_once "footer2.php"; ?>
<section style="background-color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif; color:#aaa; font-size:12px; padding: 0; align-items: center; display: none;"><a href="https://mobirise.site/t" style="flex: 1 1; height: 3rem; padding-left: 1rem;"></a><p style="flex: 0 0 auto; margin:0; padding-right:1rem;">Make your own <a href="https://mobirise.site/y" style="color:#aaa;">web page</a> with Mobirise</p></section><script src="assets/web/assets/jquery/jquery.min.js"></script>  <script src="assets/popper/popper.min.js"></script>  <script src="assets/tether/tether.min.js"></script>  <script src="assets/bootstrap/js/bootstrap.min.js"></script>  <script src="assets/smoothscroll/smooth-scroll.js"></script>  <script src="assets/dropdown/js/nav-dropdown.js"></script>  <script src="assets/dropdown/js/navbar-dropdown.js"></script>  <script src="assets/touchswipe/jquery.touch-swipe.min.js"></script>  <script src="assets/theme/js/script.js"></script><script src="c:/universite/app/assets/custom/js/slide.min.js"></script><script src="c:/universite/app/assets/custom/js/search.min.js">
</script>  
 </script>  
  
  
 <div id="scrollToTop" class="scrollToTop mbr-arrow-up"><a style="text-align: center;"><i class="mbr-arrow-up-icon mbr-arrow-up-icon-cm cm-icon cm-icon-smallarrow-up"></i></a></div>
    <input name="animation" type="hidden">
   
  
</body>
</div>
</html>