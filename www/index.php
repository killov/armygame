<?php
// Vstupní bod aplikace – směruje požadavky podle stavu přihlášení a GET parametrů.
ini_set('memory_limit', '-1');
session_start();

// Tracy debugger pro vývoj a logování chyb.
require "../src/tracy.php";
use Tracy\Debugger;

Debugger::enable();
Debugger::$maxDepth = 20;
Debugger::$maxLength = 1000;

// Načtení tříd, konfigurace, jazykového souboru a datových definic.
include "../inc/class.php";
include "../config.php";
include "../lang/".$cfg["lang"].".php";
include "../inc/data.php";

// Připojení k DB a inicializace plánovače úloh.
$db = new Db($cfg["mysqlserver"],$cfg["mysqluser"],$cfg["mysqlpw"],$cfg["mysqldb"]);
$task = new Task();

// Zpracování naplánovaných/automatických akcí (musí proběhnout před vykreslením stránky).
include "../inc/akce.php";

// Větev pro přihlášeného uživatele.
if(!empty($_SESSION["userid"])){
    // Odhlášení – zruší session a přesměruje na úvod.
    if(isset($_GET["odhlas"])){
	session_destroy();
	header("location: ./");
        exit;
    }

    // Načtení uživatele podle session; pokud neexistuje, session se zahodí.
    $user = new User();
    $user->nacti($_SESSION["userid"]);
    if(!$user->data){
        session_destroy();
        header("location: index.php");
        exit;
    }

    // Načtení města uživatele; pokud město nepatří uživateli, přiřadí se mu.
    $mesto = new Mesto();
    $mesto->nacti($user->data["mesto"]);
    if($mesto->data["user"] != $user->data["id"]){
        $mesto->pridel($user->data["id"]);
        $mesto->nacti($mesto->data["id"]);
        $user->nacti($user->data["id"]);
    }

    if($mesto->data){
        // POST akce hry – include skriptu z inc/hra/post/<post>.php (název sanitizován).
        if(isset($_GET["post"]) and preg_replace("/[^a-z\d_-]+/i", "", $_GET["post"])){
            $cesta = "../inc/hra/post/".$_GET["post"].".php";
            $cesta = strtr($cesta, './', '');
            if(file_exists($cesta)){
                include $cesta;
            }
        // FAQ stránky hry.
        }elseif(isset($_GET["faq"]) and preg_replace("/[^a-z\d_-]+/i", "", $_GET["faq"])){
            $cesta = "../inc/hra/faq/".$_GET["faq"].".php";
            $cesta = strtr($cesta, './', '');
            if(file_exists($cesta)){
                include $cesta;
            }
        }else{
            // Stránka hry podle parametru p (default: "mesto").
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
            // a = AJAX/částečný obsah, jinak se vykreslí celé hrací rozhraní (game.php).
            if(isset($_GET["a"])){
                include $cesta;
            }else{
                include "../inc/game.php";
            }

        }
    }else{
        // Uživatel nemá město – formulář pro založení, případně zpracování formuláře (ok).
        if(isset($_GET["ok"])){
            include "../inc/zalozitmestopost.php";
        }else{
            include "../inc/zalozitmesto.php";
        }
    }
// Větev pro nepřihlášeného návštěvníka.
}else{
    // POST akce přihlašovací sekce (registrace, login apod.).
    if(isset($_GET["post"]) and preg_replace("/[^a-z\d_-]+/i", "", $_GET["post"])){
        $cesta = "../inc/login/post/".$_GET["post"].".php";
        $cesta = strtr($cesta, './', '');
        if(file_exists($cesta)){
            include $cesta;
        }
    // Statické stránky přihlašovací sekce; neexistující stránka → redirect na home.
    }elseif(isset($_GET["p"]) and preg_replace("/[^a-z\d_-]+/i", "", $_GET["p"])){
        $cesta = "../inc/login/".$_GET["p"].".php";
        $cesta = strtr($cesta, './', '');
        if(file_exists($cesta)){
            include $cesta;
        }else{
            header("location: ".$cfg["dir"]);
        }
    }else{
        // Výchozí úvodní stránka (main.php).
        include "../inc/main.php";
    }
}

?>
