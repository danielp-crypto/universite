<!DOCTYPE html>
<html  >
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1">
  <link rel="shortcut icon" href="assets/images/portal2.png" type="image/x-icon">
  <meta name="description" content="">
  
  
  <title>Universite | Display-universite search results</title>
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
label{font-weight:bold;}
article:nth-of-type(odd) {background-color:#DCF8C6;border-color:#DCF8C6;}
article {
	margin: 5px;
  display: inline-block;
  position: relative;
	width: 270px;
	height: auto;
	background-color: #ECE5DD;
}
article:before {
	content: ' ';
	position: absolute;
	width: 0;
	height: 0;
  left: -20px;
	right: auto;
  top: -1px;
	bottom: auto;
	border: 32px solid ;
	border-color: transparent transparent transparent; 
}
article:after{
	content: ' ';
	position: absolute;
	width: 0;
	height: 0;
  left: -20px;
	right: auto;
  top: 0px;
	bottom: auto;
	border: 22px solid black;
	border-color: transparent transparent transparent;
}
article{
  padding: 1em;
	text-align: left;
  line-height: 1.5em;
}
</style>
</head>
<body>
<?php include_once "nav.php"; ?>
<div class="content">
  <br> 
<?php 
    echo "

<br>
<br>";
?>
<?php
function dt(){
  echo "

<br>
<br>";  
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
if (isset($_GET['page_no']) && $_GET['page_no']!="") {
	$page_no = $_GET['page_no'];
	} else {
		$page_no = 1;
        }

	$total_records_per_page = 3;
    $offset = ($page_no-1) * $total_records_per_page;
	$previous_page = $page_no - 1;
	$next_page = $page_no + 1;
	$adjacents = "2"; 
$myCourse= $_GET['course'];
	$result_count = mysqli_query($con,"SELECT COUNT(*) As total_records FROM `courses`");
	$total_records = mysqli_fetch_array($result_count);
	$total_records = $total_records['total_records'];
    $total_no_of_pages = ceil($total_records / $total_records_per_page);
	$second_last = $total_no_of_pages - 1; // total page minus 1


$sql = "SELECT class,certification,programme,duration,aps,institution,subjects,selection, DATE_FORMAT(date, '%d %M %Y')as date FROM courses WHERE programme LIKE '%$myCourse%' LIMIT $offset, $total_records_per_page";
$result = $conn->query($sql);
if ($result->num_rows > 0) {
    echo "<h3 align=center>search results for:<i>$myCourse</i></h3>";
    echo "<div>";
    echo "<table  align=center><tr><th>Study Type</th><th>Certification</th><th>Programme</th><th>Aps</th><th>Institution</th><th>Subjects & Achieved Scale</th><th>Selection Procedures</th><th>Closing Date</th></tr>";

  // output data of each row
  while($row = $result->fetch_assoc()) {
    echo "<tr><td>".$row["class"]."</td><td>".$row["certification"]."</td><td>".$row["programme"]." ".$row["duration"]."</td><td>".$row["aps"]."</td><td>".$row["institution"]."</td><td>".$row["subjects"]."</td><td>".$row["selection"]."</td><td>".$row["date"]."</td></tr>";
  }
  echo "</table></div>";
   echo ('<br><a href="advanced search.php">Advanced search</a><br>');
} else {
  echo "0 results found for <b>$myCourse</b>. please try another course or search term.";
}
$conn->close();
}
?>
<br>
<div style='padding: 10px 20px 0px; border-top: dotted 1px #CCC;'>
<strong>Page <?php echo $page_no." of ".$total_no_of_pages; ?></strong>
</div>

<ul class="pagination">
	<?php // if($page_no > 1){ echo "<li><a href='?page_no=1'>First Page</a></li>"; } ?>
    
	<li <?php if($page_no <= 1){ echo "class='disabled'"; } ?>>
	<a <?php if($page_no > 1){ echo "href='?page_no=$previous_page'"; } ?>>Previous</a>
	</li>
       
    <?php 
	if ($total_no_of_pages <= 10){  	 
		for ($counter = 1; $counter <= $total_no_of_pages; $counter++){
			if ($counter == $page_no) {
		   echo "<li class='active'><a>$counter</a></li>";	
				}else{
           echo "<li><a href='?page_no=$counter'>$counter</a></li>";
				}
        }
	}
	elseif($total_no_of_pages > 10){
		
	if($page_no <= 4) {			
	 for ($counter = 1; $counter < 8; $counter++){		 
			if ($counter == $page_no) {
		   echo "<li class='active'><a>$counter</a></li>";	
				}else{
           echo "<li><a href='?page_no=$counter'>$counter</a></li>";
				}
        }
		echo "<li><a>...</a></li>";
		echo "<li><a href='?page_no=$second_last'>$second_last</a></li>";
		echo "<li><a href='?page_no=$total_no_of_pages'>$total_no_of_pages</a></li>";
		}

	 elseif($page_no > 4 && $page_no < $total_no_of_pages - 4) {		 
		echo "<li><a href='?page_no=1'>1</a></li>";
		echo "<li><a href='?page_no=2'>2</a></li>";
        echo "<li><a>...</a></li>";
        for ($counter = $page_no - $adjacents; $counter <= $page_no + $adjacents; $counter++) {			
           if ($counter == $page_no) {
		   echo "<li class='active'><a>$counter</a></li>";	
				}else{
           echo "<li><a href='?page_no=$counter'>$counter</a></li>";
				}                  
       }
       echo "<li><a>...</a></li>";
	   echo "<li><a href='?page_no=$second_last'>$second_last</a></li>";
	   echo "<li><a href='?page_no=$total_no_of_pages'>$total_no_of_pages</a></li>";      
            }
		
		else {
        echo "<li><a href='?page_no=1'>1</a></li>";
		echo "<li><a href='?page_no=2'>2</a></li>";
        echo "<li><a>...</a></li>";

        for ($counter = $total_no_of_pages - 6; $counter <= $total_no_of_pages; $counter++) {
          if ($counter == $page_no) {
		   echo "<li class='active'><a>$counter</a></li>";	
				}else{
           echo "<li><a href='?page_no=$counter'>$counter</a></li>";
				}                   
                }
            }
	}
?>
    
	<li <?php if($page_no >= $total_no_of_pages){ echo "class='disabled'"; } ?>>
	<a <?php if($page_no < $total_no_of_pages) { echo "href='?page_no=$next_page'"; } ?>>Next</a>
	</li>
    <?php if($page_no < $total_no_of_pages){
		echo "<li><a href='?page_no=$total_no_of_pages'>Last &rsaquo;&rsaquo;</a></li>";
		} 
	 	?>
</ul>


<br /><br />
<?php
function mob(){
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
$myCourse= $_GET['course'];
$sql = "SELECT class,certification,programme,duration,aps,institution,subjects,selection, DATE_FORMAT(date, '%d %M %Y')as date FROM courses WHERE programme LIKE '%$myCourse%'";
$result = $conn->query($sql);
if ($result->num_rows > 0) {
    echo "<h3 align=center>search results for:<i>$myCourse </i></h3>";
    echo "<div>";
  // output data of each row
  while($row = $result->fetch_assoc()) {
 echo "<article><label>Class type:</label>".$row["class"]."<br><label>Certification:</label>".$row["certification"]."<br><label>Course:</label>".$row["programme"]."<br><label>Duration:</label> ".$row["duration"]."<br><label>Minimum Aps:</label>".$row["aps"]."<br><label>School:</label>".$row["institution"]."<br><label>Subjects & Achieved Scale:</label><br>".$row["subjects"]."<br><label>Selection Procedures:</label><br>".$row["selection"]."<br><label>Closing Date:</label>".$row["date"]."<br></br></article>";  
  }
  echo "</table></div></div>";
  echo ('<br><a href="advanced search.php">Advanced search</a>');
} else {
  echo "0 results found for <b>$myCourse</b>. please try another course or search term.";
}
$conn->close();  
}
// (A) CHECK IF "MOBILE" EXISTS IN USER AGENT
$isMob = is_numeric(strpos(strtolower($_SERVER['HTTP_USER_AGENT']), "mobile"));

echo $isMob
  ? "".mob() 
  : "" .dt();
  ?>
<?php include_once "footer2.php"; ?>
<section style="background-color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif; color:#aaa; font-size:12px; padding: 0; align-items: center; display: none;"><a href="https://mobirise.site/t" style="flex: 1 1; height: 3rem; padding-left: 1rem;"></a><p style="flex: 0 0 auto; margin:0; padding-right:1rem;">Make your own <a href="https://mobirise.site/y" style="color:#aaa;">web page</a> with Mobirise</p></section><script src="assets/web/assets/jquery/jquery.min.js"></script>  <script src="assets/popper/popper.min.js"></script>  <script src="assets/tether/tether.min.js"></script>  <script src="assets/bootstrap/js/bootstrap.min.js"></script>  <script src="assets/smoothscroll/smooth-scroll.js"></script>  <script src="assets/dropdown/js/nav-dropdown.js"></script>  <script src="assets/dropdown/js/navbar-dropdown.js"></script>  <script src="assets/touchswipe/jquery.touch-swipe.min.js"></script>  <script src="assets/theme/js/script.js"></script><script src="assets/custom/js/slide.min.js"></script><script src="assets/custom/js/search.min.js">
</script>  
 </script>  
  
  
 <div id="scrollToTop" class="scrollToTop mbr-arrow-up"><a style="text-align: center;"><i class="mbr-arrow-up-icon mbr-arrow-up-icon-cm cm-icon cm-icon-smallarrow-up"></i></a></div>
    <input name="animation" type="hidden">
   
  
</body>
</div>
</html>