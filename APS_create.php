<?php
 session_start();
$servername = "localhost";
$username = "id17459554_univesyc_phuti";
$password = "jarvisOS141@";
$dbname = "id17459554_univesyc_db";

try {
  $conn = new PDO("mysql:host=$servername;dbname=$dbname", $username, $password);
  // set the PDO error mode to exception
  $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  
  
$subject1 =$_POST['subject1'];
$mark1 =$_POST['mark1'];
$subject2 =$_POST['subject2'];
$mark2 =$_POST['mark2'];
$subject3 =$_POST['subject3'];
$mark3 =$_POST['mark3'];
$subject4 =$_POST['subject4'];
$mark4 =$_POST['mark4'];
$subject5 =$_POST['subject5'];
$mark5 =$_POST['mark5'];
$subject6 =$_POST['subject6'];
$mark6 =$_POST['mark6'];
$subject7 =$_POST['subject7'];
$mark7 =$_POST['mark7'];
$witsAps = function($wits_aps) use ($mark1,$mark2,$mark3,$mark4,$mark5,$mark6,$mark7) {
if ($mark1<=2){ 
$mark1=0;}  
elseif ($mark1>=5){
$mark1-(-2);} 
elseif ($mark3<=2){
$mark3=0;} 
elseif ($mark3>=5){
$mark3-(-2);} 
elseif ($mark2<=2){
$mark2=0;}
elseif ($mark4<=2){
$mark4=0;}
elseif ($mark5<=2){
$mark5=0;}
elseif ($mark6<=2){
$mark6=0;}
elseif ($mark7<=4){
$mark7=0;}
elseif ($mark7==5){
$mark7=1;} 
elseif ($mark7==6){
$mark7=2;} 
elseif ($mark7==7){
$mark7=3;}
elseif ($mark7==8){
$mark7=4;} 
return  $GLOBALS['wits_aps'] =$mark1+$mark2+$mark3+$mark4+$mark5+$mark6+$mark7;
};
$ujAps = function($uj_aps) use ($mark1,$mark2,$mark3,$mark4,$mark5,$mark6) {
 if ($mark1==1)
{
$mark1=0; }
elseif ($mark2==1)
{
$mark2=0; }
elseif ($mark3==1)
{
$mark3=0; }
elseif ($mark4==1)
{
$mark4=0; }
elseif ($mark5==1)
{
$mark5=0; }
elseif ($mark6==1)
{
$mark6=0; }    
elseif ($mark1==8)
{
$mark1=7; }
elseif ($mark2==8)
{
$mark2=7; }
elseif ($mark3==8)
{
$mark3=7; }
if ($mark4==8)
{
$mark4=7; }
if ($mark5==8)
{
$mark5=7; }
elseif ($mark6==8)
{
$mark6=7; }      
return  $GLOBALS['uj_aps'] =$mark1+$mark2+$mark3+$mark4+$mark5+$mark6;
};
 $witsAps(0);
$ujAps(0);
// begin the transaction
  $conn->beginTransaction();
  
  
  //query to insert the variable data into the database
$conn->exec("INSERT INTO subjects
VALUES(1,'$subject1', '$mark1','".$_SESSION['id']."')");
$conn->exec("INSERT INTO subjects
VALUES(2,'$subject2', '$mark2','".$_SESSION['id']."')");
$conn->exec("INSERT INTO subjects
VALUES(3,'$subject3', '$mark3','".$_SESSION['id']."')");
$conn->exec("INSERT INTO subjects
VALUES(4,'$subject4', '$mark4','".$_SESSION['id']."')");
$conn->exec("INSERT INTO subjects
VALUES(5,'$subject5', '$mark5','".$_SESSION['id']."')");
$conn->exec("INSERT INTO subjects
VALUES(6,'$subject6', '$mark6','".$_SESSION['id']."')");
$conn->exec("INSERT INTO subjects
VALUES(7,'$subject7', '$mark7','".$_SESSION['id']."')");
$conn->exec("INSERT INTO aps_scores
VALUES('University of johannesburg','$uj_aps','".$_SESSION['id']."')");
$conn->exec("INSERT INTO aps_scores
VALUES('University of Pretoria','$uj_aps','".$_SESSION['id']."')");
$conn->exec("INSERT  INTO aps_scores
VALUES('Wits University','$wits_aps','".$_SESSION['id']."')");
$conn->exec("INSERT  INTO aps_scores
VALUES('Vaal University of Technology','$uj_aps','".$_SESSION['id']."')");
$conn->exec("INSERT INTO aps_scores
VALUES('Tshwane University of Technology','$uj_aps','".$_SESSION['id']."')");
 // commit the transaction
 $conn->commit();

header("location: options.php");
} catch(PDOException $e) {
  // roll back the transaction if something failed
  $conn->rollback();
  echo "Error: " . $e->getMessage();
}

$conn = null;
?>