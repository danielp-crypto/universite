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
label{font-weight:bold;}
article:nth-of-type(odd) {background-color:#DCF8C6;border-color:#DCF8C6;}
article {
	margin: 5px;
  display: inline-block;
  position: relative;
	width: 280px;
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
.pagination a {
  color: black;
  float: left;
  padding: 8px 16px;
  text-decoration: none;
}
.pagination li.active {
  background-color: #007bff;
  color: white;
}

.pagination a:hover:not(.active) {background-color: #ddd;}
</style>

</head>
<body>
<?php include_once "nav.php"; ?>  
<div class="content">
 <br>
<?php
include('db.php');
$myCourse = $_GET['course'];
if (isset($_GET['page_no']) && $_GET['page_no']!="") {
	$page_no = $_GET['page_no'];
	} else {
		$page_no = 1;
        }
        
	$total_records_per_page = 4;
    $offset = ($page_no-1) * $total_records_per_page;
	$previous_page = $page_no - 1;
	$next_page = $page_no + 1;
	$adjacents = "2"; 
   
	$result_count = mysqli_query($con,"SELECT COUNT(*) As total_records FROM `courses` WHERE programme LIKE '%$myCourse%'");
	$total_records = mysqli_fetch_array($result_count);
	$total_records = $total_records['total_records'];
    $total_no_of_pages = ceil($total_records / $total_records_per_page);
	$second_last = $total_no_of_pages - 1; // total page minus 1
	
    $result = mysqli_query($con,"SELECT  class,certification,programme,duration,aps,institution,subjects,selection, DATE_FORMAT(date, '%d %M %Y')as date FROM `courses`WHERE programme LIKE '%$myCourse%' LIMIT $offset, $total_records_per_page");
   echo "<h3 align=center>search results for:<i>$myCourse</i></h3>"; 
    while($row = mysqli_fetch_array($result)){
		echo "<article><label>Class type:</label>".$row["class"]."<br><label>Certification:</label>".$row["certification"]."<br><label>Course:</label>".$row["programme"]."<br><label>Duration:</label> ".$row["duration"]."<br><label>Minimum Aps:</label>".$row["aps"]."<br><label>School:</label>".$row["institution"]."<br><label>Subjects & Achieved Scale:</label><br>".$row["subjects"]."<br><label>Selection Procedures:</label><br>".$row["selection"]."<br><label>Closing Date:</label>".$row["date"]."<br></br></article>"; 
        }
         
         echo ('<br><br><a href="advanced search.php">Advanced search</a>');
	mysqli_close($con);
    ?>

<div style='padding: 10px 20px 0px; border-top: dotted 1px #CCC;'>
<strong>Page <?php echo $page_no." of ".$total_no_of_pages; ?></strong>
</div>

<ul class="pagination">
	<?php // if($page_no > 1){ echo "<li><a href='?page_no=1'>First Page</a></li>"; } ?>
    
	<li <?php if($page_no <= 1){ echo "class='disabled'"; } ?>>
	<a <?php if($page_no > 1){ echo "href='?page_no=$previous_page&course=$myCourse'"; } ?>>Previous</a>
	</li>
       
    
    
	<li <?php if($page_no >= $total_no_of_pages){ echo "class='disabled'"; } ?>>
	<a <?php if($page_no < $total_no_of_pages) { echo "href='?page_no=$next_page&course=$myCourse'"; } ?>>Next</a>
	</li>
    <?php if($page_no < $total_no_of_pages){
		echo "<li><a href='?page_no=$total_no_of_pages&course=$myCourse'>Last &rsaquo;&rsaquo;</a></li>";
		} 
		?>
</ul>


<br /><br />



<?php include_once "footer2.php"; ?>
<section style="background-color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif; color:#aaa; font-size:12px; padding: 0; align-items: center; display: none;"><a href="https://mobirise.site/t" style="flex: 1 1; height: 3rem; padding-left: 1rem;"></a><p style="flex: 0 0 auto; margin:0; padding-right:1rem;">Make your own <a href="https://mobirise.site/y" style="color:#aaa;">web page</a> with Mobirise</p></section><script src="assets/web/assets/jquery/jquery.min.js"></script>  <script src="assets/popper/popper.min.js"></script>  <script src="assets/tether/tether.min.js"></script>  <script src="assets/bootstrap/js/bootstrap.min.js"></script>  <script src="assets/smoothscroll/smooth-scroll.js"></script>  <script src="assets/dropdown/js/nav-dropdown.js"></script>  <script src="assets/dropdown/js/navbar-dropdown.js"></script>  <script src="assets/touchswipe/jquery.touch-swipe.min.js"></script>  <script src="assets/theme/js/script.js"></script><script src="assets/custom/js/slide.min.js"></script><script src="assets/custom/js/search.min.js">
</script>  
 </script>  
  
  
 <div id="scrollToTop" class="scrollToTop mbr-arrow-up"><a style="text-align: center;"><i class="mbr-arrow-up-icon mbr-arrow-up-icon-cm cm-icon cm-icon-smallarrow-up"></i></a></div>
    <input name="animation" type="hidden">
   
  
</body></div>
</html>