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
$email =$_POST['mail'];
$fname =$_POST['name'];
$lname =$_POST['sname'];
$birth =$_POST['birth'];
$gender =$_POST['sex'];
$race =$_POST['race'];
$cell =$_POST['cell'];
$location=$_POST['province'];
  //query to insert the variable data into the database
$sql="UPDATE users SET email='$email', name='$fname', surname='$lname', birth='$birth',gender='$gender', race='$race', cell='$cell', province='$location' WHERE  id = '".$_SESSION['id']."'"; 
if ($conn->query($sql) === TRUE) {
 
   header("location: profile.php");
} else {
  echo "Error updating record: " . $conn->error;
}

$conn->close();
?>