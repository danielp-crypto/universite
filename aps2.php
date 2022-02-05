

<!DOCTYPE html>
<html  >
<head>
   <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1">
  <link rel="shortcut icon" href="assets1/images/portal2-43x31.png" type="image/x-icon">
  <meta name="description" content="about universite">
  
  
  <title> Admission Point Score </title>
   <link rel="stylesheet" href="cookieBanner.css"> <link rel="stylesheet" href="assets/tether/tether.min.css">
  <link rel="stylesheet" href="assets1/bootstrap/css/bootstrap.min.css">
  <link rel="stylesheet" href="assets1/bootstrap/css/bootstrap-grid.min.css">
  <link rel="stylesheet" href="assets1/bootstrap/css/bootstrap-reboot.min.css">
  <link rel="stylesheet" href="assets1/animatecss/animate.css">
  <link rel="stylesheet" href="assets1/dropdown/css/style.css">
  <link rel="stylesheet" href="assets1/socicon/css/styles.css">
  <link rel="stylesheet" href="assets1/theme/css/style.css">
  <link rel="preload" href="https://fonts.googleapis.com/css2?family=Jost:ital,wght@0,400;0,700;1,400;1,700&display=swap&display=swap" as="style" onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jost:ital,wght@0,400;0,700;1,400;1,700&display=swap&display=swap"></noscript>
  <link rel="preload" as="style" href="assets1/mobirise/css/mbr-additional.css"><link rel="stylesheet" href="assets1/mobirise/css/mbr-additional.css" type="text/css">
  
  
  <style>
input[type=submit]{font-size:20px;background-color:green;border:none;color:white;padding:10px 10px;text-decoration:none;margin:4px 2px;cursor:pointer;width:15%;height:5%;border-radius:35px 35px;}
input[type=reset]{font-size:20px;background-color:red;border:none;color:white;padding:10px 10px;text-decoration:none;margin:4px 2px;cursor:pointer;width:15%;height:5%;border-radius:35px 35px;}
input[type=number]{color:black;background-color:white;font-size:15px;border-radius:10px 10px;padding:15px 10px;width:250px;}
</style>
</head>
<body>
  <?php include_once "navigation1.php"; ?>
  


<br>
<br>
<br>
<br>
<br>
<br>

<a name="dis"><h3 align=center style="font-family:Arial, consolas;">Calculate your APS</h3></a>
<p align=center style="font-size:17px;">If you proceed,we'll assume that you have read and agree to our disclaimer.<a href="disclaimer2.html" style="text-decoration:underline;color:navy;">Here</a><br><br>
</p>
<div style="overflow-x:auto;">
<table border="0" align=left>
<tr>                  
<td width="100px"  align="center"  style="background-color:#1F75FE;color:white;border-top-style: none;border-bottom-style: none; border-left-style: none; border-right-style: none;">&nbsp;<b>NSC %</b></td>      
<td width="100px"  align="center" 
style="background-color:#1F75FE;color:white;border-top-style: none;border-bottom-style: none; border-left-style: none; border-right-style: none;">&nbsp;<b>NSC SCALE</b></td>   
</tr>
<tr align=center>       
<td>90-100</td>       
<td>8</td>           
</tr>   
<tr align=center>       
<td>80-89</td>       
<td>7</td>           
</tr>    
<tr align=center>       
<td>70-79</td>       
<td>6</td>      
</tr>
<tr align=center>       
<td>60-69</td>       
<td>5</td>     
</tr> 
<tr align=center>       
<td>50-59</td>       
<td>4</td>     
</tr> 
<tr align=center>       
<td>40-49</td>       
<td>3</td>     
</tr>
<tr align=center>       
<td>30-39</td>       
<td>2</td>    
</tr>
<tr align=center>       
<td>0-29</td>       
<td>1</td>     
</tr> 
</table>
<table border="0" align=center>
<form method="POST" action="APS_create.php"  enctype="multipart/form-data">
<tr>       
<td align=center width="400px" style="font-family:Arial, consolas;font-size:19px;background-color:#1F75FE;color:white;border-top-style: none;border-bottom-style: none; border-left-style: none; border-right-style: none;"><b>Your Subject and Mark </b></td>        
</tr>
<tr>       
<td style="background-color:#1F75FE;font-size:20px;color:white;">&nbsp;1.&nbsp;<select name="subject1" size="1"  class="select-mobi"> <option>English Home Language</option> <option>English Language Of Learning and Teaching</option></td></tr>
<tr><td style="background-color:#DCDCDC;font-size:20px;color:black;">&nbsp;<input type="number" name="mark1" min="1" max="8" step="1" value="1" > </td>      
</tr>    
<tr>    
<td style="background-color:#1F75FE;font-size:20px;color:white;">&nbsp;2.&nbsp;<select name="subject2" size="1"  class="select-mobi"> <option>Afrikaans First Additional Language</option> <option>Setswana First Additional Language</option><option>Sesotho First Additional Language</option><option>IsiZulu First Additional Language</option><option>IsiXhosa First Additional Language</option> <option>IsiNdebele First Additional Language</option></td></tr>
<tr><td style="background-color:#DCDCDC;font-size:20px;color:black;">&nbsp;<input type="number" name="mark2" min="1" max="8" step="1" value="1"></td>        
</tr>
<tr>       
<td style="background-color:#1F75FE;font-size:20px;color:white;">&nbsp;3.&nbsp;<select name="subject3" size="1"  class="select-mobi"> <option>Mathematics</option> <option>Mathematical Literacy</option></td></tr>
<tr><td style="background-color:#DCDCDC;font-size:20px;color:black;">&nbsp;<input type="number" name="mark3" min="1" max="8" step="1" value="1"> </td>   
</tr> 
<tr>       
<td style="background-color:#1F75FE;font-size:20px;color:white;">&nbsp;4.<select name="subject4" size="1"  class="select-mobi"><option>Select a fourth subject...</option> <option>Accounting</option> <option>Agricultural Sciences</option> <option>Business Studies</option> <option>Consumer Studies</option><option>Dramatic Art</option> <option>Economics</option> <option>Engineering Graphics and Design</option> <option>Geography</option> <option>History</option> <option>Information Technology</option><option>Life Sciences</option><option>Music</option><option>Physical Sciences</option><option>Tourism</option><option>visual Art</option><option>Religion Studies</option> </td></tr>  
<tr><td style="background-color:#DCDCDC;font-size:20px;color:black;">&nbsp;<input type="number" name="mark4" min="1" max="8" step="1" value="1"> </td>   
</tr> 
<tr>       
<td style="background-color:#1F75FE;font-size:20px;color:white;">&nbsp;5.<select name="subject5" size="1"  class="select-mobi"><option>Select a fifth subject...</option> <option>Accounting</option> <option>Agricultural Sciences</option> <option>Business Studies</option> <option>Consumer Studies</option><option>Dramatic Art</option> <option>Economics</option> <option>Engineering Graphics and Design</option> <option>Geography</option> <option>History</option> <option>Information Technology</option><option>Life Sciences</option><option>Music</option><option>Physical Sciences</option><option>Tourism</option><option>visual Art</option><option>Religion Studies</option> </td></tr>      
<tr><td style="background-color:#DCDCDC;font-size:20px;color:black;">&nbsp;<input type="number" name="mark5" min="1" max="8" step="1" value="1"> </td>
</tr>
<tr>       
<td style="background-color:#1F75FE;font-size:20px;color:white;">&nbsp;6.<select name="subject6" size="1"  class="select-mobi"><option>Select a sixth subject...</option> <option>Accounting</option> <option>Agricultural Sciences</option> <option>Business Studies</option> <option>Consumer Studies</option><option>Dramatic Art</option> <option>Economics</option> <option>Engineering Graphics and Design</option> <option>Geography</option> <option>History</option> <option>Information Technology</option><option>Life Sciences</option><option>Music</option><option>Physical Sciences</option><option>Tourism</option><option>visual Art</option><option>Religion Studies</option> </td></tr> 
<tr><td style="background-color:#DCDCDC;font-size:20px;color:black;">&nbsp;<input type="number"   name="mark6" min="1" max="8" step="1" value="1"></td>    
</tr>
<tr>       
<td style="background-color:#1F75FE;font-size:20px;color:white;">&nbsp;7.&nbsp;<select name="subject7" size="1"  class="select-mobi"> <option>Life orientation</option></td></tr>
<tr><td style="background-color:#DCDCDC;font-size:20px;color:black;">&nbsp;<input type="number" name="mark7" min="1" max="8" step="1" value="1"> </td>
</tr>
<tr><td align=center><input type="reset"  value="reset" id="reset">&nbsp;&nbsp;&nbsp;&nbsp;<input type="submit"  value="Done" id="reset"></p></form></td>
</table>
</div>





 <?php include_once "footer1.php"; ?>

<section style="background-color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif; color:#aaa; font-size:12px; padding: 0; align-items: center; display: none;"><a href="https://mobirise.site/g" style="flex: 1 1; height: 3rem; padding-left: 1rem;"></a><p style="flex: 0 0 auto; margin:0; padding-right:1rem;">Mobirise web page software - <a href="https://mobirise.site/n" style="color:#aaa;">Click here</a></p></section><script src="assets1/web/assets/jquery/jquery.min.js"></script>  <script src="assets1/popper/popper.min.js"></script>  <script src="assets1/tether/tether.min.js"></script>  <script src="assets1/bootstrap/js/bootstrap.min.js"></script>  <script src="assets1/smoothscroll/smooth-scroll.js"></script>  <script src="assets1/viewportchecker/jquery.viewportchecker.js"></script>  <script src="assets1/dropdown/js/nav-dropdown.js"></script>  <script src="assets1/dropdown/js/navbar-dropdown.js"></script>  <script src="assets1/touchswipe/jquery.touch-swipe.min.js"></script>  <script src="assets1/parallax/jarallax.min.js"></script>  <script src="assets1/theme/js/script.js"></script> <script src="cookie-banner.min.js"> 
</script>  





  
 <div id="scrollToTop" class="scrollToTop mbr-arrow-up"><a style="text-align: center;"><i class="mbr-arrow-up-icon mbr-arrow-up-icon-cm cm-icon cm-icon-smallarrow-up"></i></a></div>
    <input name="animation" type="hidden">
  </body>
</html>
