<?php
ini_set('memory_limit', '-1');
session_start();
require "../src/tracy.php";
use Tracy\Debugger;

Debugger::enable();
Debugger::$maxDepth = 20; 
Debugger::$maxLength = 1000;
include "../inc/class.php";
include "../config.php";
include "../lang/".$cfg["lang"].".php";
include "../inc/data.php";
$db = new Db($cfg["mysqlserver"],$cfg["mysqluser"],$cfg["mysqlpw"],$cfg["mysqldb"]);
$task = new Task();
include "../inc/akce.php";

if(!empty($_SESSION["userid"])){
    if(isset($_GET["odhlas"])){
	session_destroy();
	header("location: ./");
        exit;
    }
    $user = new User();
    $user->nacti($_SESSION["userid"]);
    if(!$user->data){
        session_destroy();
        header("location: index.php");
        exit;
    }
    $mesto = new Mesto();
    $mesto->nacti($user->data["mesto"]);
    if($mesto->data["user"] != $user->data["id"]){
        $mesto->pridel($user->data["id"]);
        $mesto->nacti($mesto->data["id"]);
        $user->nacti($user->data["id"]);
    }
    if($mesto->data){
        if(isset($_GET["post"]) and preg_replace("/[^a-z\d_-]+/i", "", $_GET["post"])){
            $cesta = "../inc/hra/post/".$_GET["post"].".php";
            $cesta = strtr($cesta, './', '');
            if(file_exists($cesta)){
                include $cesta;
            }
        }elseif(isset($_GET["faq"]) and preg_replace("/[^a-z\d_-]+/i", "", $_GET["faq"])){    
            $cesta = "../inc/hra/faq/".$_GET["faq"].".php";
            $cesta = strtr($cesta, './', '');
            if(file_exists($cesta)){
                include $cesta;
            }
        }else{
            if(isset($_GET["p"]) and preg_replace("/[^a-z\d_-]+/i", "", $_GET["p"])){
                $p = explode("/", $_GET["p"]); 
            }else{
                $p = ["mesto"];
            }     
            $cesta = "../inc/hra/pages/".$p[0].".php";
            $cesta = strtr($cesta, './', '');
            if(!file_exists($cesta)){
                exit;
            }
            if(isset($_GET["a"])){
                include $cesta;
            }else{
                include "../inc/game.php";
            }

        }
    }else{
        if(isset($_GET["ok"])){
            include "../inc/zalozitmestopost.php";
        }else{
            include "../inc/zalozitmesto.php";
        }
    }
}else{
    if(isset($_GET["post"]) and preg_replace("/[^a-z\d_-]+/i", "", $_GET["post"])){
        $cesta = "../inc/login/post/".$_GET["post"].".php";
        $cesta = strtr($cesta, './', '');
        if(file_exists($cesta)){
            include $cesta;
        }
    }elseif(isset($_GET["p"]) and preg_replace("/[^a-z\d_-]+/i", "", $_GET["p"])){
        $cesta = "../inc/login/".$_GET["p"].".php";
        $cesta = strtr($cesta, './', '');
        if(file_exists($cesta)){
            include $cesta;
        }else{
            header("location: ".$cfg["dir"]);
        }
    }else{
        include "../inc/main.php";
    }
}

?>
