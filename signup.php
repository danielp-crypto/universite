<?php
// Include config file
require_once "config3.php";

// Define variables and initialize with empty values
$username = $password = $confirm_password = "";
$username_err = $password_err = $confirm_password_err = "";

// Processing form data when form is submitted
if($_SERVER["REQUEST_METHOD"] == "POST"){

    // Validate username
    if(empty(trim($_POST["username"]))){
        $username_err = "Please enter a username.";
    } else{
        // Prepare a select statement
        $sql = "SELECT id FROM users WHERE username = :username";

        if($stmt = $pdo->prepare($sql)){
            // Bind variables to the prepared statement as parameters
            $stmt->bindParam(":username", $param_username, PDO::PARAM_STR);

            // Set parameters
            $param_username = trim($_POST["username"]);

            // Attempt to execute the prepared statement
            if($stmt->execute()){
                if($stmt->rowCount() == 1){
                    $username_err = "This username is already taken.";
                } else{
                    $username = trim($_POST["username"]);
                }
            } else{
                echo "Oops! Something went wrong. Please try again later.";
            }

            // Close statement
            unset($stmt);
        }
    }

    // Validate password
    if(empty(trim($_POST["password"]))){
        $password_err = "Please enter a password.";
    } elseif(strlen(trim($_POST["password"])) < 6){
        $password_err = "Password must have atleast 6 characters.";
    } else{
        $password = trim($_POST["password"]);
    }

    // Validate confirm password
    if(empty(trim($_POST["confirm_password"]))){
        $confirm_password_err = "Please confirm password.";
    } else{
        $confirm_password = trim($_POST["confirm_password"]);
        if(empty($password_err) && ($password != $confirm_password)){
            $confirm_password_err = "Passwords do not match.";
        }
    }

    // Check input errors before inserting in database
    if(empty($username_err) && empty($password_err) && empty($confirm_password_err)){

        // Prepare an insert statement
        $sql = "INSERT INTO users (username, password) VALUES (:username, :password)";

        if($stmt = $pdo->prepare($sql)){
            // Bind variables to the prepared statement as parameters
            $stmt->bindParam(":username", $param_username, PDO::PARAM_STR);
            $stmt->bindParam(":password", $param_password, PDO::PARAM_STR);

            // Set parameters
            $param_username = $username;
            $param_password = password_hash($password, PASSWORD_DEFAULT); // Creates a password hash

            // Attempt to execute the prepared statement
            if($stmt->execute()){
                // Redirect to login page
                header("location: login2.php");
            } else{
                echo "Something went wrong. Please try again later.";
            }

            // Close statement
            unset($stmt);
        }
    }

    // Close connection
    unset($pdo);
}
?>
    
<!DOCTYPE html>
<html  >
<head>
   <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1">
  <link rel="shortcut icon" href="assets1/images/portal2-43x31.png" type="image/x-icon">
  <meta name="description" content="Apply to University">
  
  
  <title>Universite | sign up</title>
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


  
</head>
<body> 


    <style type="text/css">
        body{ font: 14px sans-serif; }
        .wrapper{ width: 350px; padding: 20px; }
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

<?php include_once "navigation1.php"; ?> 

   
<script type="text/javascript" >
function myFunction() {
  var x = document.getElementById("myInput");
  if (x.type === "password") {
    x.type = "text";
  } else {
    x.type = "password";
  }
}
</script>
<body>
<br>
<br>
<br>
    <div class="wrapper">
        <h2>Sign Up</h2>
        <p>Please fill this form to create an account.</p>
        <form action="<?php echo htmlspecialchars($_SERVER["PHP_SELF"]); ?>" method="post">
            <div class="form-group <?php echo (!empty($username_err)) ? 'has-error' : ''; ?>">
                <label>Username</label>
                <i class="fa fa-user-circle-o"></i><input type="text" name="username" class="form-control" value="<?php echo $username; ?>" style=" padding: 14px 26px;">
                <span class="help-block"><?php echo $username_err; ?></span>
            </div>
            <div class="form-group <?php echo (!empty($password_err)) ? 'has-error' : ''; ?>">
                <label>Password</label>
                 <i class="fa fa-lock"></i><input type="password" name="password" class="form-control" value="<?php echo $password; ?>"style=" padding: 14px 26px;">
                <span class="help-block"><?php echo $password_err; ?></span>
            </div>
            <div class="form-group <?php echo (!empty($confirm_password_err)) ? 'has-error' : ''; ?>">
                <label>Confirm Password</label>
                 <i class="fa fa-lock"></i><input type="password" name="confirm_password" class="form-control" value="<?php echo $confirm_password; ?>"style=" padding: 14px 26px;">
                <span class="help-block"><?php echo $confirm_password_err; ?></span>
            </div>
            <div class="form-group">
                <input type="submit" class="btn btn-primary" value="Submit">
                <input type="reset" class="btn btn-default" value="Reset">
            </div>
            <p>Already have an account? <a href="login.php">Login here</a>.</p>
        </form>
    </div>
     <?php include_once "footer1.php"; ?>
     <section style="background-color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif; color:#aaa; font-size:12px; padding: 0; align-items: center; display: none;"><a href="https://mobirise.site/g" style="flex: 1 1; height: 3rem; padding-left: 1rem;"></a><p style="flex: 0 0 auto; margin:0; padding-right:1rem;">Mobirise web page software - <a href="https://mobirise.site/n" style="color:#aaa;">Click here</a></p></section><script src="assets1/web/assets/jquery/jquery.min.js"></script>  <script src="assets1/popper/popper.min.js"></script>  <script src="assets1/tether/tether.min.js"></script>  <script src="assets1/bootstrap/js/bootstrap.min.js"></script>  <script src="assets1/smoothscroll/smooth-scroll.js"></script>  <script src="assets1/viewportchecker/jquery.viewportchecker.js"></script>  <script src="assets1/dropdown/js/nav-dropdown.js"></script>  <script src="assets1/dropdown/js/navbar-dropdown.js"></script>  <script src="assets1/touchswipe/jquery.touch-swipe.min.js"></script>  <script src="assets1/parallax/jarallax.min.js"></script>  <script src="assets1/theme/js/script.js"></script> <script src="cookie-banner.min.js"> 
</script>  


  
  
 <div id="scrollToTop" class="scrollToTop mbr-arrow-up"><a style="text-align: center;"><i class="mbr-arrow-up-icon mbr-arrow-up-icon-cm cm-icon cm-icon-smallarrow-up"></i></a></div>
    <input name="animation" type="hidden">
    <?php include_once "footer.php"; ?>
</body>
</html
