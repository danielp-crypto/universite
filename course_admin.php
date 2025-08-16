<?php 
    echo "
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>";
?>
<?php
$servername = "localhost";
$username = "root";
$password = "NewSecurePassword123!";
$dbname = "mydb";

// Create connection
$conn = new mysqli($servername, $username, $password, $dbname);
// Check connection
if ($conn->connect_error) {
  die("Connection failed: " . $conn->connect_error);
}
$myCamp= $_POST['campus'];
$myAps= $_POST['aps'];
$myDate= $_POST['date'];
$mySubjects= $_POST['subs'];
$myCourse= $_POST['course'];
$myClass= $_POST['Ctype'];
$mySchool= $_POST['schools'];
$myCertification= $_POST['cert'];
$myDuration= $_POST['Duration'];
$myLink= $_POST['url'];
$sql = "INSERT INTO sa_courses
VALUES ('$myClass', '$myCertification', '$myCourse','$myDuration','$myAps', '$mySchool','$myCamp','$mySubjects','$myDate','$myLink')";
if ($conn->query($sql) === TRUE) {
   header("location: CRUD.php");
} else {
  echo "Error updating record: " . $conn->error;
}

$conn->close();
?>
<!DOCTYPE html>
<html>
<head>
    <!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-YTT2QHLQC7"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-YTT2QHLQC7');
</script>
<meta name="viewport" content="width=device-width,initial-scale=1.0" http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
<title>admin</title>

<style>
table{
    border: 0px solid black;width:100%;
}
th {
    color:black;border-top-style: none;border-bottom-style: none; border-left-style: none; border-right-style: none;background-color:navy;color:white;height:80px;
}
tr, td{color:black;border: 1px solid black;height:40px;
 
}
div{
   overflow-x:auto;
}
</style>
<form method="get" action="comprehensive.php" enctype="text/plain">
<div class="navbar">

<br>          

</div></form>
</head>
<body>
  <div class="mbr-section-btn"><a class="btn btn-white display-4" href="admin.html"  ><< Back </a></div>  
</body>
</html>