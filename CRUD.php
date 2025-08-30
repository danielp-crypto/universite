

<!DOCTYPE html>
<html  >
<head>
   
    <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1">
  <link rel="shortcut icon" href="assets/images/portal2.png" type="image/x-icon">
  <meta name="description" content="">
  
  
  <title>Admin page</title>
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

  <link rel="stylesheet" href="assets/css/CRUD.min.css">
  <script src="assets/js/CRUD.min.js"></script>
</head>
<body>
    
    <div class="content">
<section class="info2 cid-sFeEzPxE48" id="info2-2">
  <div class="page-header"><br><br>
  <section>
 
</section>
<section data-bs-version="5.1" class="features1 cid-sFzyUE9AaP" id="features1-1i">
    

    
    <div class="container-fluid">
        <div class="row">
            <div class="col-12">
                <h3 class="mbr-section-title mbr-fonts-style align-center mb-0 display-2">
                    <strong>Dashboard</strong><br><br>
                </h3>
                
            </div>
        </div>
        <div class="row">
            <div class="card col-12 col-md-6 col-lg-3" >
                <div class="card-wrapper">
                    <div class="card-box align-center">
                        <div class="iconfont-wrapper">
                            <span class="mbr-iconfont mobi-mbri-mobile mobi-mbri" style="color: rgb(41, 116, 250); fill: rgb(41, 116, 250);"></span>
                        </div>
                        <h5 class="card-title mbr-fonts-style display-5"> <strong><?php    echo $users;  ?> </strong></h5>
                        <p class="card-text mbr-fonts-style display-7">REGISTERED USERS</p>
                    </div>
                </div>
            </div>
            <div class="card col-12 col-md-6 col-lg-3">
                <div class="card-wrapper">
                    <div class="card-box align-center">
                        <div class="iconfont-wrapper">
                            <span class="mbr-iconfont mobi-mbri-file mobi-mbri" style="color: rgb(41, 116, 250); fill: rgb(41, 116, 250);"></span>
                        </div>
                        <h5 class="card-title mbr-fonts-style display-5"><strong><?php  echo $hits[0];  ?></strong></h5>
                        <p class="card-text mbr-fonts-style display-7">TOTAL WEBSITE VISITS</p>
                    </div>
                </div>
            </div>
            <div class="card col-12 col-md-6 col-lg-3" style="display:none">
                <div class="card-wrapper">
                    <div class="card-box align-center">
                        <div class="iconfont-wrapper">
                            <span class="mbr-iconfont mobi-mbri-cursor-click mobi-mbri" style="color: rgb(41, 116, 250); fill: rgb(41, 116, 250);"></span>
                        </div>
                        <h5 class="card-title mbr-fonts-style display-5"><strong><?php echo $sessionCount;?></strong></h5>
                        <p class="card-text mbr-fonts-style display-7">DAILY ACTIVE USERS</p>
                    </div>
                </div>
            </div>
            <div class="card col-12 col-md-6 col-lg-3" style="display:none;">
                <div class="card-wrapper">
                    <div class="card-box align-center">
                        <div class="iconfont-wrapper">
                            <span class="mbr-iconfont mobi-mbri-browse mobi-mbri" style="color: rgb(41, 116, 250); fill: rgb(41, 116, 250);"></span>
                        </div>
                        <h5 class="card-title mbr-fonts-style display-5"><strong>?</strong></h5>
                        <p class="card-text mbr-fonts-style display-7">COURSE SEARCHES PER DAY</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>
</div><br><br><br>
<h3 align=center><strong>Admin</strong></h3>
    <form class="course-search" action="read1.php" style="margin:auto;max-width:300px" autocomplete="on">
  <input type="search" placeholder="search course..." name="course" id="auto" spellcheck="true">
  <button type="submit" class="button" onclick="this.classList.toggle('button--loading')"><span class="button__text"><i class="fa fa-search"></i></span></button>
</form>
<link rel="stylesheet" href="//code.jquery.com/ui/1.12.1/themes/base/jquery-ui.css">
  <script src="assets/js/CRUD.min.js"></script>
  <script src="assets/js/CRUD.min.js"></script>
  <script src="assets/js/CRUD.min.js"></script>

<hr><br><div class="fb-like" data-href="https://universite.co.za" data-width="" data-layout="" data-action="" data-size="" data-share="true"></div>

    <div class="align-center container-fluid">
        <div class="row justify-content-center">
            <div class="card col-12 col-lg-6">
                <div class="wrapper">
                    <h3 class="mbr-section-title mb-4 mbr-fonts-style display-5"><strong>Add a new course</strong></h3>
                    <p class="mbr-text mb-4 mbr-fonts-style display-4">Add new course to database </p>
                    <div class="mbr-section-btn"><a class="btn btn-white display-4" href="admin.html"  >+</a></div>
                </div>
            </div>
            
              <div class="col-12 col-lg-6">
                <div class="wrapper"><h3>
                    <strong>Courses</strong></h3><form  action="comp2.php" autocomplete="on">       <p class="mbr-text mbr-fonts-style mb-4 display-4">Search by 

Institution

</p>
<input type="search" placeholder="Search a 

course" name="course" spellcheck="true" required style="padding: 10px;font-size:17px;border: 1px solid grey;background: #f1f1f1;
border-radius: 5px 5px;"><br><br>
     <select class="custom-select" style="width:200px;" name="schools" size="1" 

><optgroup label="Universities"><option>Wits University</option><option>University of Johannesburg</option><option>University of Pretoria</option><option> Vaal University of Technology </option><option> 

Tshwane University of Technology </option><option> Northwest University</option></optgroup><optgroup label="Colleges"><option>Central Johannesburg TVET 

College</option><option>Ekurhuleni East TVET College</option><option>Ekurhuleni West TVET College</option><option>Sedibeng 

TVET College</option><option>South West TVET College</option><option>Western TVET College</option></optgroup></select>
        <select class="custom-select" style="width:200px;" name="Ctype">
          <option>Full-time</option><option>Part-time</option>
        </select>
                </div>
        <div class="mbr-section-btn"><button type="submit"  class="btn btn-white display-4" style="float:center;" >Search Institution</span> 

</button></div> 
                </div>
            </div> 
                
            
                
       
      
</section>

<section style="background-color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif; color:#aaa; font-size:12px; padding: 0; align-items: center; display: none;"><a href="https://mobirise.site/t" style="flex: 1 1; height: 3rem; padding-left: 1rem;"></a><p style="flex: 0 0 auto; margin:0; padding-right:1rem;">Make your own <a href="https://mobirise.site/y" style="color:#aaa;">web page</a> with Mobirise</p></section>
   <script src="assets/js/CRUD.min.js"></script>  <script src="assets/js/CRUD.min.js"></script>  <script src="assets/js/CRUD.min.js"></script>  <script src="assets/js/CRUD.min.js"></script>  <script src="assets/js/CRUD.min.js"></script>  <script src="assets/js/CRUD.min.js"></script>  <script src="assets/js/CRUD.min.js"></script>  <script src="assets/js/CRUD.min.js"></script>  <script src="assets/js/CRUD.min.js"></script><script src="assets/js/CRUD.min.js"></script><script src="assets/js/CRUD.min.js"></script>  
 </script>  
  
  
 <div id="scrollToTop" class="scrollToTop mbr-arrow-up"><a style="text-align: center;"><i class="mbr-arrow-up-icon mbr-arrow-up-icon-cm cm-icon cm-icon-smallarrow-up"></i></a></div>
    <input name="animation" type="hidden">
   
  
</body></div>
</html>