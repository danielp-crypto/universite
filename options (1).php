

<!DOCTYPE html>
<html  >
<head>
   <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1">
  <link rel="shortcut icon" href="assets1/images/portal2-43x31.png" type="image/x-icon">
  <meta name="description" content="about universite">
  
  
  <title> Course Options </title>
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
  
  
  
  <style type="text/css">
        body{ font: 14px sans-serif; }
        .wrapper{ width: 350px; padding: 20px; }
         <link rel="icon" type="image/ico" href="./uam/Media/portal2.png"/>
        @media screen and (max-width: 300px) {
        /* Full-width inputs */
input[type=text], input[type=password] {
  width: 90%;
  padding: 12px 20px;
  margin: 14px ;
  display: inline-block;
  border: 1px solid black;
  box-sizing: border-box;
text-align:center;
}
input[type=submit], input[type=reset]{
 
  color: white;
  padding: 14px 20px;
  margin: 8px 0;
  border: none;
  cursor: pointer;
  width: 90%;
}
}
.form-group{position:relative;}
.form-group i{position:absolute;left:10px;top:30px;color:grey;}
    </style>
</head>
<body>
 <?php include_once "navigation1.php"; ?> 
  


<br>
<br>
<br>
<br>
    <div class="wrapper">
        <h2>Courses</h2>
        <p>Please type in three courses you are most interested in.</p>
        <form action="OPTIONS.php" method="post">
            <div class="form-group <?php echo (!empty($username_err)) ? 'has-error' : ''; ?>">
                <label>Option one</label>
                <i class="fa fa-question"></i><input type="text" name="opt1" class="form-control"  style=" padding: 14px 26px;" required></i>
            </div>    
            <div class="form-group <?php echo (!empty($username_err)) ? 'has-error' : ''; ?>">
                <label>Option two</label>
                <i class="fa fa-question"></i><input type="text" name="opt2" class="form-control"  style=" padding: 14px 26px;"></i>
            </div>
             <div class="form-group <?php echo (!empty($username_err)) ? 'has-error' : ''; ?>">
                <label>Option three</label>
                <i class="fa fa-question"></i><input type="text" name="opt3" class="form-control"  style=" padding: 14px 26px;"></i>
            </div>   
            <br><br>

            <div class="form-group">
                <input type="submit" class="btn btn-primary" value="Submit">
            </div>
        </form>
    </div>




 <?php include_once "footer1.php"; ?>

<section style="background-color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif; color:#aaa; font-size:12px; padding: 0; align-items: center; display: none;"><a href="https://mobirise.site/g" style="flex: 1 1; height: 3rem; padding-left: 1rem;"></a><p style="flex: 0 0 auto; margin:0; padding-right:1rem;">Mobirise web page software - <a href="https://mobirise.site/n" style="color:#aaa;">Click here</a></p></section><script src="assets1/web/assets/jquery/jquery.min.js"></script>  <script src="assets1/popper/popper.min.js"></script>  <script src="assets1/tether/tether.min.js"></script>  <script src="assets1/bootstrap/js/bootstrap.min.js"></script>  <script src="assets1/smoothscroll/smooth-scroll.js"></script>  <script src="assets1/viewportchecker/jquery.viewportchecker.js"></script>  <script src="assets1/dropdown/js/nav-dropdown.js"></script>  <script src="assets1/dropdown/js/navbar-dropdown.js"></script>  <script src="assets1/touchswipe/jquery.touch-swipe.min.js"></script>  <script src="assets1/parallax/jarallax.min.js"></script>  <script src="assets1/theme/js/script.js"></script> <script src="cookie-banner.min.js"> 
</script>  




  
 <div id="scrollToTop" class="scrollToTop mbr-arrow-up"><a style="text-align: center;"><i class="mbr-arrow-up-icon mbr-arrow-up-icon-cm cm-icon cm-icon-smallarrow-up"></i></a></div>
    <input name="animation" type="hidden">
  </body>
</html>
