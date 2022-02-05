<?php
 session_start();
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
$option1 =$_POST['opt1'];
$option2 =$_POST['opt2'];
$option3 =$_POST['opt3'];
 //query to insert the variable data into the database
$sql="INSERT INTO options
VALUES('$option1','$option2', '$option3','".$_SESSION['id']."')";
if ($conn->query($sql) === TRUE) {
 
   header("location: profile.php");
} else {
  echo "Error updating record: " . $conn->error;
}

$conn->close();
?>