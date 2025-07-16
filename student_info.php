<?php
 session_start();
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
$name    =$_POST['name'];
$surname =$_POST['surname'];
$email  =$_POST['mail'];
$age    =$_POST['age'];
$gender =$_POST['gender'];
$phone  =$_POST['cell'];
$location  =$_POST['location'];
$userData ="Make my profile available to recruiters and companies";

$sql="INSERT INTO student_info
VALUES('$name','$surname', '$email','$age','$gender', '$phone','$location','$userData', ".$_SESSION['id'].")";
if ($conn->query($sql) === TRUE) {

   header("location: Interests.php");
} else {
  echo "Error updating record: " . $conn->error;
}

$conn->close();
?>
